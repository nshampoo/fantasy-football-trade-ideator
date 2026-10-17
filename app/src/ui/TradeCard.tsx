import type { TradeEval } from '../engine/trades';
import { balanceLabel, fmt, record, signed } from './format';
import { Avatar, PlayerRow } from './Player';

function Gain({ label, value }: { label: string; value: number }) {
  const tone = Math.round(value) > 0 ? 'good' : Math.round(value) < 0 ? 'bad' : 'even';
  return (
    <span className={`gain ${tone}`}>
      <span className="gain-label">{label}</span> {signed(value)}
    </span>
  );
}

export function TradeSummary({ e }: { e: TradeEval }) {
  const balance = balanceLabel(e.fairness);
  const total = (ps: typeof e.give) => fmt(ps.reduce((s, p) => s + p.value, 0));
  return (
    <>
      <div className="sides">
        <section>
          <h4>You give · {total(e.give)}</h4>
          {e.give.map((p) => <PlayerRow key={p.id} player={p} />)}
        </section>
        <section>
          <h4>You get · {total(e.get)}</h4>
          {e.get.map((p) => <PlayerRow key={p.id} player={p} />)}
        </section>
      </div>
      <div className="trade-stats">
        <Gain label="Your lineup" value={e.myGain} />
        <Gain label="Their lineup" value={e.theirGain} />
        <span className={`gain ${balance.tone}`}>{balance.text}</span>
      </div>
      {(e.myDrops.length > 0 || e.theirDrops.length > 0) && (
        <p className="note">
          {e.myDrops.length > 0 && <>You'd drop {e.myDrops.map((p) => p.name).join(', ')} to make room. </>}
          {e.theirDrops.length > 0 && <>They'd drop {e.theirDrops.map((p) => p.name).join(', ')}.</>}
        </p>
      )}
      {e.reasons.length > 0 && (
        <ul className="reasons">
          {e.reasons.map((r) => <li key={r}>{r}</li>)}
        </ul>
      )}
    </>
  );
}

export function TradeCard({ e, onAdjust }: { e: TradeEval; onAdjust: () => void }) {
  return (
    <article className="card trade">
      <header className="trade-head">
        <Avatar avatar={e.them.avatar} name={e.them.name} />
        <div className="who">
          <strong>{e.them.name}</strong>
          <span className="muted">
            {e.them.ownerName} · {record(e.them)}
          </span>
        </div>
      </header>
      <TradeSummary e={e} />
      <button type="button" className="text-btn" onClick={onAdjust}>
        Adjust in evaluator →
      </button>
    </article>
  );
}
