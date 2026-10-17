import type { Player } from './engine/types';

export interface PlayerLink {
  label: string;
  url: string;
}

/**
 * FantasyPros' page slug: "Ja'Marr Chase" -> "jamarr-chase". Right for most players; a miss lands on
 * FantasyPros' player search. TODO: use the exact `player_filename` from DynastyProcess once the
 * daily job caches it.
 */
const slug = (name: string) =>
  name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['.]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Live pages for a player: value history, news, and injury status. The app's own player data is
 * refreshed once a day, so these are where to look for anything newer.
 */
export function playerLinks(p: Player): PlayerLink[] {
  const links: PlayerLink[] = [];
  if (p.fantasyCalcId) links.push({ label: 'FantasyCalc', url: `https://fantasycalc.com/players/${slug(p.name)}-${p.fantasyCalcId}` });
  if (p.espnId) links.push({ label: 'ESPN', url: `https://www.espn.com/nfl/player/_/id/${p.espnId}` });
  if (p.pos !== 'DEF') links.push({ label: 'FantasyPros', url: `https://www.fantasypros.com/nfl/players/${slug(p.name)}.php` });
  links.push({ label: 'Sleeper', url: `https://sleeper.com/players/nfl/${p.id}` });
  return links;
}
