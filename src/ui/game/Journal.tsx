import { useEffect, useRef } from 'react';
import type { VisibleEvent } from '../../engine';

export function Journal({ log }: { log: VisibleEvent[] }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log.length]);
  const items = log.slice(-300);
  return (
    <div className="panel journal">
      <div className="journal-head">
        <span className="tag">Journal</span>
        <span className="tag" title="Les lignes en violet sont secrètes : vous seul (et un autre joueur) les voyez.">✦ secret</span>
      </div>
      <ol ref={ref} aria-live="polite">
        {items.map((e) => (
          <li key={e.seq} className={`${e.type}${e.secret ? ' secret' : ''}`}>{e.text}</li>
        ))}
      </ol>
    </div>
  );
}
