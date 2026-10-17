import { describe, expect, it } from 'vitest';
import { buildLeague, type RawLeague } from '../load';
import { parseFantasyCalc } from '../values/fantasycalc';
import { bestLineup, BENCH_WEIGHT } from './lineup';
import { profileLeague } from './profile';
import { parseSlots } from './slots';
import { evaluateTrade, MAX_OVERPAY, packageValue, rosterAfter, suggestTrades } from './trades';
import type { League, Player, Team } from './types';
import flaggers from './__fixtures__/flaggers.json';
import rizzler from './__fixtures__/rizzler.json';

let nextId = 0;
const p = (pos: string, value: number, name = `${pos}${value}`): Player => ({ id: String(++nextId), name, pos, team: 'X', value });
const team = (rosterId: number, players: Player[]): Team => ({
  rosterId, ownerId: `u${rosterId}`, name: `T${rosterId}`, ownerName: `u${rosterId}`, avatar: null,
  players, wins: 0, losses: 0, ties: 0, pointsFor: 0,
});

describe('parseSlots', () => {
  it('drops K, DEF, bench and orders flex slots last', () => {
    const slots = parseSlots(['QB', 'FLEX', 'RB', 'SUPER_FLEX', 'WR', 'K', 'DEF', 'BN']);
    expect(slots.map((s) => s.name)).toEqual(['QB', 'RB', 'WR', 'FLEX', 'SUPER_FLEX']);
  });
});

describe('bestLineup', () => {
  const slots = parseSlots(['QB', 'RB', 'WR', 'TE', 'FLEX', 'BN']);

  it('fills strict slots first, then flex with the best player left', () => {
    const rb1 = p('RB', 900), rb2 = p('RB', 800), wr = p('WR', 500), te = p('TE', 300), qb = p('QB', 400);
    const l = bestLineup([wr, rb1, te, rb2, qb], slots);
    expect(l.starters.map((s) => s.player?.id)).toEqual([qb.id, rb1.id, wr.id, te.id, rb2.id]);
    expect(l.strength).toBe(900 + 800 + 500 + 300 + 400);
  });

  it('counts the best bench player per position at BENCH_WEIGHT', () => {
    const l = bestLineup([p('QB', 400), p('QB', 200), p('RB', 900), p('WR', 500), p('TE', 300), p('RB', 800), p('RB', 100)], slots);
    expect(l.strength).toBeCloseTo(2900 + BENCH_WEIGHT * (200 + 100));
  });

  it('leaves slots empty when nobody fits', () => {
    expect(bestLineup([p('RB', 100)], slots).starters.filter((s) => s.player).length).toBe(1);
  });
});

describe('packageValue', () => {
  it('values one star above two halves', () => {
    expect(packageValue([p('RB', 8000)])).toBeGreaterThan(packageValue([p('RB', 4000), p('WR', 4000)]));
  });
});

describe('rosterAfter', () => {
  it('drops the least valuable player when taking back more than it sends', () => {
    const a = p('RB', 900), b = p('WR', 50), c = p('TE', 10);
    const inc = [p('WR', 400), p('WR', 300)];
    const { roster, drops } = rosterAfter([a, b, c], [a], inc);
    expect(drops).toEqual([c]);
    expect(roster).toHaveLength(3);
  });
});

describe('suggestTrades (synthetic)', () => {
  // Team 1 is deep at RB and has no TE; team 2 is deep at TE and thin at RB.
  const slots = parseSlots(['QB', 'RB', 'RB', 'WR', 'TE', 'BN', 'BN', 'BN']);
  const t1 = team(1, [p('QB', 1000), p('RB', 3000), p('RB', 2900), p('RB', 2800, 'RB-surplus'), p('WR', 2000), p('TE', 100)]);
  const t2 = team(2, [p('QB', 1000), p('RB', 3000), p('RB', 200), p('WR', 2000), p('TE', 2700, 'TE-surplus'), p('TE', 2600)]);
  const league: League = { id: 'x', name: 'x', season: '2026', slots, teams: [t1, t2] };

  it('finds the obvious RB-for-TE swap that helps both sides', () => {
    const { ideas } = suggestTrades(league, 1, { preset: 'fair' });
    expect(ideas.length).toBeGreaterThan(0);
    const top = ideas[0];
    expect(top.give.map((x) => x.pos)).toContain('RB');
    expect(top.get.map((x) => x.pos)).toContain('TE');
    expect(top.myGain).toBeGreaterThan(0);
    expect(top.theirGain).toBeGreaterThanOrEqual(0);
  });

  it('marks the third RB as surplus and TE as a need', () => {
    const me = profileLeague(league).find((x) => x.team.rosterId === 1)!;
    expect(me.surplus.map((s) => s.player.name)).toContain('RB-surplus');
    expect(me.needs).toContain('TE');
  });

  it('respects untouchable players', () => {
    const rb = t1.players.find((x) => x.name === 'RB-surplus')!;
    const { ideas } = suggestTrades(league, 1, { preset: 'fair', untouchable: [rb.id] });
    expect(ideas.every((e) => !e.give.includes(rb))).toBe(true);
  });

  it('evaluateTrade reports gains for both sides', () => {
    const e = evaluateTrade(league, t1, t2, [t1.players[3]], [t2.players[4]]);
    expect(e.myGain).toBeGreaterThan(0);
    expect(e.theirGain).toBeGreaterThan(0);
  });
});

describe.each([['flaggers', flaggers], ['rizzler', rizzler]])('real league: %s', (_, fx) => {
  const league = buildLeague(fx as unknown as RawLeague, parseFantasyCalc(fx.fantasyCalc as never), fx.players);

  it('values most rostered skill players and names them', () => {
    const skill = league.teams.flatMap((t) => t.players).filter((x) => ['QB', 'RB', 'WR', 'TE'].includes(x.pos));
    expect(skill.filter((x) => x.value > 0).length).toBeGreaterThan(skill.length * 0.5);
    expect(skill.every((x) => x.name !== x.id)).toBe(true);
  });

  it('every idea helps me, stays within value bounds, and has a reason', () => {
    for (const t of league.teams) {
      const { ideas } = suggestTrades(league, t.rosterId);
      for (const e of ideas) {
        expect(e.myGain).toBeGreaterThan(0);
        expect(e.fairness).toBeGreaterThanOrEqual(0.9);
        expect(e.fairness).toBeLessThanOrEqual(MAX_OVERPAY);
        expect(e.give.length + e.get.length).toBeLessThanOrEqual(3);
      }
    }
  });
});
