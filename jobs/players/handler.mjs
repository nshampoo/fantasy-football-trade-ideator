// Daily job: Sleeper's ~5 MB /players/nfl -> data/players.json in the app bucket.
// Sleeper asks for this call at most once a day; the app reads the trimmed file instead.
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { trimPlayers } from './trim.mjs';

const s3 = new S3Client({});

export async function handler() {
  const res = await fetch('https://api.sleeper.app/v1/players/nfl');
  if (!res.ok) throw new Error(`Sleeper /players/nfl: HTTP ${res.status}`);
  const players = trimPlayers(await res.json());
  const count = Object.keys(players).length;
  // A broken response shouldn't replace yesterday's good file.
  if (count < 1000) throw new Error(`Only ${count} players in Sleeper's response; keeping the old file`);
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.BUCKET,
      Key: 'data/players.json',
      Body: JSON.stringify(players),
      ContentType: 'application/json',
      // An hour, so a new file shows up the same evening.
      CacheControl: 'public, max-age=3600',
    }),
  );
  console.log(`Wrote ${count} players`);
  return { count };
}
