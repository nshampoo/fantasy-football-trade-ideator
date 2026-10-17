import { NEED_THRESHOLD } from '../engine/profile';

/** Position grade (share of league median) as a color tone. */
export const gradeTone = (g: number) => (g < NEED_THRESHOLD ? 'bad' : g > 1.15 ? 'good' : 'even');

export const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
export const signed = (n: number) => (Math.round(n) >= 0 ? '+' : '−') + fmt(Math.abs(n));
export const pct = (x: number) => `${Math.round(x * 100)}%`;
export const record = (t: { wins: number; losses: number; ties: number }) => `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ''}`;

const INJURY: Record<string, string> = { Questionable: 'Q', Doubtful: 'D', Out: 'O' };
export const injuryTag = (status: string) => INJURY[status] ?? status.toUpperCase().slice(0, 3);

/** "You overpay 8%" style summary of a trade's value balance; fairness = what they get ÷ what they give. */
export function balanceLabel(fairness: number): { text: string; tone: 'even' | 'good' | 'bad' } {
  const diff = fairness - 1;
  if (Math.abs(diff) < 0.05) return { text: 'Even value', tone: 'even' };
  return diff > 0 ? { text: `You pay ${pct(diff)} more`, tone: 'bad' } : { text: `You get ${pct(-diff)} more`, tone: 'good' };
}
