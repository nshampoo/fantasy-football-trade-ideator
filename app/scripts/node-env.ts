// Helpers for running the app's code from the terminal.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PlayerDb } from '../src/sleeper/types';

export const appDir = join(dirname(fileURLToPath(import.meta.url)), '..');

export function readPlayers(): PlayerDb {
  try {
    return JSON.parse(readFileSync(join(appDir, 'public/data/players.json'), 'utf8'));
  } catch {
    throw new Error('public/data/players.json is missing; run `npm run players` first.');
  }
}
