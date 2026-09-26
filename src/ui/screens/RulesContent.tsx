import { useState } from 'react';
import { ALL_CHARACTERS, AREAS, AREA_IDS, CARDS, FACTION_COUNTS, type CardType, type DeckId } from '../../engine';
import { CardFace } from '../components/CardFace';
import { CharacterCard } from '../components/CharacterCard';

type Tab = 'rules' | 'characters' | 'cards';

export function RulesContent() {
  const [tab, setTab] = useState<Tab>('rules');
  return (
    <div className="rules">
      <div className="segmented" style={{ marginBottom: 12 }}>
        <button className={`btn${tab === 'rules' ? ' active' : ''}`} onClick={() => setTab('rules')}>Règles</button>
        <button className={`btn${tab === 'characters' ? ' active' : ''}`} onClick={() => setTab('characters')}>Personnages</button>
        <button className={`btn${tab === 'cards' ? ' active' : ''}`} onClick={() => setTab('cards')}>Cartes</button>
      </div>
      {tab === 'rules' && <Rules />}
      {tab === 'characters' && (
        <div className="char-grid">
          {ALL_CHARACTERS.map((c) => <div key={c.id} className="panel" style={{ padding: 10 }}><CharacterCard id={c.id} compact /></div>)}
        </div>
      )}
      {tab === 'cards' && <CardsList />}
    </div>
  );
}

function CardsList() {
  const decks: [DeckId, string][] = [['hermit', 'Cartes Ermite (vertes)'], ['white', 'Cartes Lumière (blanches)'], ['black', 'Cartes Ténèbres (noires)']];
  return (
    <>
      {decks.map(([d, title]) => (
        <section key={d}>
          <h2 className="gothic">{title}</h2>
          <div className="cards-grid">
            {Object.values(CARDS).filter((c) => c.deck === d).map((c) => (
              <div key={c.type} style={{ display: 'grid', justifyItems: 'center', gap: 4 }}>
                <CardFace card={`${c.type as CardType}#1`} width={160} />
                <span className="tag">× {c.copies}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

function Rules() {
  return (
    <>
      <h2 className="gothic">But du jeu</h2>
      <p>
        Chaque joueur incarne en secret un personnage de l'une des trois factions. Les <strong style={{ color: 'var(--hunter)' }}>Hunters</strong> veulent
        éliminer tous les Shadows ; les <strong style={{ color: 'var(--shadow)' }}>Shadows</strong> veulent éliminer tous les Hunters (ou trois Neutres) ;
        les <strong style={{ color: 'var(--neutral)' }}>Neutres</strong> ont chacun leur propre objectif. Personne ne sait qui est qui : il faut déduire,
        bluffer et frapper au bon moment.
      </p>
      <h3>Répartition des personnages</h3>
      <table>
        <thead><tr><th>Joueurs</th><th>Hunters</th><th>Shadows</th><th>Neutres</th></tr></thead>
        <tbody>
          {Object.entries(FACTION_COUNTS).map(([n, c]) => (
            <tr key={n}><td>{n}</td><td>{c.hunter}</td><td>{c.shadow}</td><td>{c.neutral}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="small muted">
        Les points de vie dépendent de l'initiale du personnage (A = 8, B = 10, C = 11, D = 13, E = 10, F = 12, G = 14, U = 11, V = 13, W = 14),
        c'est ce qui rend utiles les cartes Brimade, Dure leçon et Chocolat. En mode « Mélange », une seule carte par initiale est utilisée.
      </p>

      <h2 className="gothic">Le tour de jeu</h2>
      <h3>1. Déplacement</h3>
      <p>
        Lancez le dé à 6 faces et le dé à 4 faces, puis allez sur le lieu dont le numéro correspond à la somme. Sur un <strong>7</strong>, vous choisissez
        n'importe quel lieu. Si le résultat vous ramène sur votre lieu actuel, relancez.
      </p>
      <table>
        <thead><tr><th>Somme</th><th>Lieu</th><th>Action (facultative)</th></tr></thead>
        <tbody>
          {AREA_IDS.map((a) => (
            <tr key={a}><td>{AREAS[a].numbers.join(' ou ')}</td><td>{AREAS[a].name}</td><td>{AREAS[a].text}</td></tr>
          ))}
          <tr><td>7</td><td>Au choix</td><td>Vous choisissez votre destination.</td></tr>
        </tbody>
      </table>
      <p className="small muted">Les six lieux sont répartis au hasard en trois zones de deux lieux au début de la partie.</p>
      <h3>2. Action du lieu</h3>
      <p>Vous pouvez effectuer l'action de votre lieu d'arrivée (ou y renoncer).</p>
      <h3>3. Attaque</h3>
      <p>
        Vous pouvez attaquer un joueur situé dans votre <strong>zone</strong> (votre lieu ou l'autre lieu de la même tuile). Lancez les deux dés :
        les dégâts valent la <strong>différence</strong> entre le d6 et le d4. Si les deux dés sont identiques, l'attaque échoue. Les armes ajoutent
        des dégâts seulement si l'attaque réussit.
      </p>

      <h2 className="gothic">Les cartes</h2>
      <p>
        <strong>Cartes Ermite</strong> (Cabane de l'Ermite) : vous la lisez en secret puis la donnez à un autre joueur. Il la lit en secret et applique
        l'effet si le pari est juste (l'Inconnu peut mentir). Les autres joueurs ne voient que le résultat.
      </p>
      <p>
        <strong>Cartes Lumière</strong> (Église) et <strong>Ténèbres</strong> (Cimetière) : elles sont montrées à tous. Une carte à usage unique est
        appliquée immédiatement ; un équipement est posé face visible devant vous et reste actif. La Porte de l'Outremonde permet de piocher dans le
        paquet de votre choix.
      </p>

      <h2 className="gothic">Révélation, capacités et mort</h2>
      <p>
        Vous pouvez révéler votre personnage <strong>à tout moment</strong> (bouton « Se révéler »). La plupart des capacités spéciales exigent d'être
        révélé : le jeu vous propose alors « se révéler et utiliser ». Quand vos dégâts atteignent vos points de vie, vous mourez et votre carte est
        révélée. Celui qui vous a tué prend <strong>une</strong> de vos cartes Équipement (toutes avec le Rosaire d'argent) ; les autres sont défaussées.
      </p>
      <p>
        La partie s'arrête <strong>immédiatement</strong> dès qu'une condition de victoire est remplie. Tous les joueurs dont la condition est remplie à
        ce moment gagnent, y compris les membres morts de la faction gagnante.
      </p>

      <h2 className="gothic">Précisions de cette adaptation</h2>
      <ul>
        <li>Emi peut se téléporter sur l'un des deux lieux voisins sur le cercle des six lieux.</li>
        <li>Les morts simultanées sont traitées ensemble : tous les personnages morts dans le premier lot comptent comme « premier mort ».</li>
        <li>Un joueur tué par un effet est attribué au joueur qui l'a provoqué (carte, Forêt hantée, capacité, carte Ermite donnée).</li>
        <li>
          Pour ne pas trahir les identités, un court « Continuer » est parfois demandé à des joueurs qui n'ont rien à faire (après une attaque, en
          fin de tour). Il se valide tout seul après un instant.
        </li>
      </ul>
    </>
  );
}
