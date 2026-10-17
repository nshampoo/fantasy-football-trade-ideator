import type { ReactNode } from 'react';
import type { Player } from '../engine/types';
import { playerLinks } from '../links';
import { avatarUrl } from '../sleeper/client';
import { fmt, injuryTag } from './format';

export function PosTag({ pos }: { pos: string }) {
  return <span className={`pos pos-${pos}`}>{pos}</span>;
}

export function PlayerLinks({ player }: { player: Player }) {
  return (
    <span className="links">
      {playerLinks(player).map((l) => (
        <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer" title={`${player.name} on ${l.label}`}>
          {l.label}
        </a>
      ))}
    </span>
  );
}

/** One player: position, name, NFL team, injury, value, and links out for live news. */
export function PlayerRow({ player, slot, actions, dim }: { player: Player; slot?: string; actions?: ReactNode; dim?: boolean }) {
  return (
    <div className={`player${dim ? ' dim' : ''}`}>
      {slot !== undefined && <span className="slot">{slot}</span>}
      <PosTag pos={player.pos} />
      <span className="pname">
        <span className="name">{player.name}</span>
        <span className="nfl">{player.team ?? 'FA'}</span>
        {player.injury && (
          <span className="inj" title={player.injury}>
            {injuryTag(player.injury)}
          </span>
        )}
      </span>
      <span className="val" title="FantasyCalc rest-of-season value">
        {player.value ? fmt(player.value) : '—'}
      </span>
      {actions && <span className="actions">{actions}</span>}
      <PlayerLinks player={player} />
    </div>
  );
}

/** Sleeper's image CDN refuses some referrers (e.g. *.cloudfront.net), so avatars send none. */
export function Avatar({ avatar, name }: { avatar: string | null; name: string }) {
  const url = avatarUrl(avatar);
  return url ? <img className="avatar" src={url} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="avatar blank">{name.slice(0, 1).toUpperCase()}</span>;
}
