import type { TeamProfile } from '../engine/profile';
import { POSITIONS } from '../engine/types';
import { gradeTone, pct } from './format';

/** Starter value at each position against the league median (the tick at the middle). */
export function Grades({ profile }: { profile: TeamProfile }) {
  return (
    <div className="grades">
      {POSITIONS.map((pos) => {
        const g = profile.grades[pos].vsMedian;
        const tone = gradeTone(g);
        return (
          <div key={pos} className="grade">
            <span className={`pos pos-${pos}`}>{pos}</span>
            <span className="bar" aria-hidden="true">
              <span className={`fill ${tone}`} style={{ width: `${Math.min(g / 2, 1) * 100}%` }} />
              <span className="median" />
            </span>
            <span className={`grade-pct ${tone}`}>{pct(g)}</span>
          </div>
        );
      })}
    </div>
  );
}
