// Shared by scripts/players.mjs and the players Lambda.
const POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']);

/** Sleeper's /players/nfl -> { id: { n, p, t, i? } } for fantasy-relevant positions. */
export function trimPlayers(all) {
  const out = {};
  for (const [id, p] of Object.entries(all)) {
    if (!POSITIONS.has(p.position)) continue;
    // Retired and long-gone players linger in the DB; keep anyone with a team or a recent season.
    if (!p.team && !p.active) continue;
    const name = p.full_name || `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim();
    out[id] = {
      n: name,
      p: p.position,
      t: p.team ?? null,
      ...(p.injury_status ? { i: p.injury_status } : {}),
      ...(p.espn_id ? { e: String(p.espn_id) } : {}),
    };
  }
  return out;
}
