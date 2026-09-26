import { useStore } from '../store';
import { RulesContent } from './RulesContent';

export function RulesScreen() {
  const go = useStore((s) => s.go);
  return (
    <div className="screen">
      <div className="screen-wide">
        <div className="screen-header">
          <h1 className="gothic">Règles et cartes</h1>
          <button className="btn btn-small btn-ghost" onClick={() => go('menu')}>Retour</button>
        </div>
      </div>
      <div className="panel screen-wide" style={{ padding: 18 }}>
        <RulesContent />
      </div>
    </div>
  );
}
