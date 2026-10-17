export type Position = 'QB' | 'RB' | 'WR' | 'TE';
export const POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE'];

export interface Player {
  id: string;
  name: string;
  /** Sleeper position; K, DEF and others are kept for display but never valued. */
  pos: string;
  team: string | null;
  injury?: string;
  /** Rest-of-season trade value (FantasyCalc units); 0 for unlisted players. */
  value: number;
  fantasyCalcId?: number;
  espnId?: string;
}

export interface Team {
  rosterId: number;
  ownerId: string | null;
  name: string;
  ownerName: string;
  avatar: string | null;
  players: Player[];
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
}

/** A starting slot and the positions it accepts. */
export interface Slot {
  name: string;
  accepts: Position[];
}

export interface League {
  id: string;
  name: string;
  season: string;
  slots: Slot[];
  teams: Team[];
}
