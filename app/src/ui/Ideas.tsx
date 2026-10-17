import { useMemo, useState } from 'react';
import { PRESETS, suggestTrades, type PresetName, type TradeEval } from '../engine/trades';
import type { League, Player } from '../engine/types';
import { TradeCard } from './TradeCard';

export interface Focus {
  kind: 'target' | 'shop';
  player: Player;
}

interface Props {
  league: League;
  myRosterId: number;
  preset: PresetName;
  onPreset: (p: PresetName) => void;
  untouchable: Set<string>;
  focus: Focus | null;
  onClearFocus: () => void;
  onAdjust: (e: TradeEval) => void;
}

const PRESET_HELP: Record<PresetName, string> = {
  fair: 'Both lineups improve and the values match.',
  balanced: 'Mostly helps you; they still come out close to even.',
  aggressive: 'Leans your way, within what a manager might accept.',
};

export function Ideas({ league, myRosterId, preset, onPreset, untouchable, focus, onClearFocus, onAdjust }: Props) {
  const [maxPerSide, setMaxPerSide] = useState<1 | 2>(2);
  const [twoForTwo, setTwoForTwo] = useState(false);

  const { ideas } = useMemo(
    () =>
      suggestTrades(league, myRosterId, {
        preset,
        maxPerSide,
        allowTwoForTwo: twoForTwo,
        untouchable: [...untouchable].filter((id) => id !== focus?.player.id),
        targets: focus?.kind === 'target' ? [focus.player.id] : undefined,
        shopping: focus?.kind === 'shop' ? [focus.player.id] : undefined,
        perPartner: focus ? 5 : 2,
        // A target can be any player, so search wider for them.
        candidates: focus ? 16 : 10,
      }),
    [league, myRosterId, preset, maxPerSide, twoForTwo, untouchable, focus],
  );

  return (
    <div className="ideas">
      <div className="controls card">
        <div className="segmented" role="radiogroup" aria-label="Strategy">
          {(Object.keys(PRESETS) as PresetName[]).map((p) => (
            <button key={p} type="button" role="radio" aria-checked={p === preset} className={p === preset ? 'on' : ''} onClick={() => onPreset(p)}>
              {PRESETS[p].label}
            </button>
          ))}
        </div>
        <p className="muted small">{PRESET_HELP[preset]}</p>
        <div className="toggles">
          <label>
            <input type="checkbox" checked={maxPerSide === 2} onChange={(e) => setMaxPerSide(e.target.checked ? 2 : 1)} /> 2-for-1 trades
          </label>
          <label>
            <input type="checkbox" checked={twoForTwo} disabled={maxPerSide === 1} onChange={(e) => setTwoForTwo(e.target.checked)} /> 2-for-2 trades
          </label>
          {untouchable.size > 0 && <span className="muted small">{untouchable.size} untouchable</span>}
        </div>
      </div>

      {focus && (
        <div className="focus">
          {focus.kind === 'target' ? 'Ways to get ' : 'Offers for '}
          <strong>{focus.player.name}</strong>
          <button type="button" className="chip-x" aria-label="Show all ideas" onClick={onClearFocus}>
            ✕
          </button>
        </div>
      )}

      {ideas.length === 0 ? (
        <p className="empty card">
          No trades pass the {PRESETS[preset].label.toLowerCase()} filters{focus ? ' for this player' : ''}. Try another strategy
          {maxPerSide === 1 ? ' or allow 2-for-1 trades' : ''}.
        </p>
      ) : (
        <div className="trade-list">
          {ideas.map((e) => (
            <TradeCard key={`${e.them.rosterId}:${e.give.map((p) => p.id)}:${e.get.map((p) => p.id)}`} e={e} onAdjust={() => onAdjust(e)} />
          ))}
        </div>
      )}
    </div>
  );
}
