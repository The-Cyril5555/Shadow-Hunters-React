# Shadow Hunters — React

Adaptation numérique du jeu de plateau **Shadow Hunters**, aussi fidèle que possible à la version physique (jeu de base + extension). On y retrouve les identités cachées, la déduction et les bluffs, de 4 à 8 joueurs : en solo contre des bots ou en ligne entre amis, avec des bots pour compléter la table.

> Reprise en React/TypeScript du projet Godot [shadow_hunter_app](https://github.com/The-Cyril5555/shadow_hunter_app), dont elle réutilise le pixel art.

## Fonctionnalités

- **Règles complètes** : 20 personnages, 48 cartes (16 Ermite, 16 Lumière, 16 Ténèbres) et 6 lieux répartis au hasard en 3 zones.
- **Informations cachées respectées** :
  - chaque joueur reçoit une vue filtrée de la partie ;
  - les cartes Ermite restent secrètes entre celui qui les donne et celui qui les reçoit ;
  - une Prédiction ne se montre qu'au joueur actif ;
  - l'Inconnu peut mentir.
- **Révélation à tout moment**. Les capacités qui exigent d'être révélé proposent directement « se révéler et utiliser ».
- **Bots qui ne trichent pas** : ils ne voient que leur propre vue et raisonnent de façon probabiliste sur les identités (cartes Ermite données, attaques, soins…). Il y a 3 niveaux et 3 personnalités.
- **Solo** : 4 à 8 joueurs, avec sauvegarde automatique et reprise après fermeture de l'onglet.
- **Multijoueur**, au choix :
  - **pair-à-pair (WebRTC)**, sans serveur : l'onglet de l'hôte fait tourner la partie ;
  - **serveur Node WebSocket** : plus robuste, avec reconnexion. Un bot remplace un joueur déconnecté en attendant son retour.
- **Interface pixel art** :
  - plateau en triangle et piste des dégâts de 0 à 14 comme sur le plateau ;
  - dés, cartes et révélations animés, avec effets sonores ;
  - carnet de déduction ;
  - règles et encyclopédie intégrées ;
  - affichage adapté au téléphone.

## Corrections de règles par rapport au projet Godot

| Point | Avant | Maintenant (règle officielle) |
|---|---|---|
| Répartition à 4 joueurs | 1 Hunter, 1 Shadow, 2 Neutres | 2 Hunters, 2 Shadows, 0 Neutre |
| Points de vie | Emi 8, Gregor 12, Spectre 13, Bryan 12, David 10 | Emi 10, Gregor 14, Spectre 14, Bryan 10, David 13 : les PV suivent l'initiale (A 8, B 10, C 11, D 13, E 10, F 12, G 14, U 11, V 13, W 14) |
| Lieux | Positions numérotées aléatoires | Numéros imprimés sur chaque lieu (Ermite 2-3, Porte 4-5, Église 6, Cimetière 8, Forêt 9, Sanctuaire 10). Sur un 7, le joueur choisit. On relance si le résultat donne le lieu actuel. |
| Attaque | d6 + bonus − défense, au moins 1 | \|d6 − d4\|, un double fait rater l'attaque, les armes ajoutent +1, la Robe sacrée peut réduire les dégâts à 0 |
| Cartes | Une « main » de cartes | Les cartes à usage unique s'appliquent tout de suite, les équipements sont posés face visible |
| Chocolat | PV ≤ 11 | Personnages A, E, U uniquement |
| Miroir | Tout Shadow | Tout Shadow **sauf l'Inconnu** |
| Daniel | « Premier à tuer ou être tué » | Premier mort, **ou** vivant quand tous les Shadows sont morts |
| Victoire des Shadows | Tous les Hunters morts | … **ou 3 Neutres morts** |
| Mort | — | Le tueur prend 1 équipement (tous avec le Rosaire d'argent), le reste est défaussé |
| Fin de partie | — | Immédiate dès qu'une condition est remplie ; toute la faction gagnante gagne, morts compris |

## Jouer

Le jeu est publié sur GitHub Pages à chaque push sur `main` (voir « Déploiement »).

En local :

```bash
npm install
npm run dev          # http://localhost:5173
```

## Développement

```bash
npm test             # tests Vitest : règles, cartes, capacités, victoires, bots, salon, serveur
npm run lint         # ESLint
npm run typecheck    # TypeScript strict
npm run build        # build de production dans dist/
npm run server       # serveur multijoueur sur le port 8787 (variable PORT)
```

### Architecture

```
src/engine/   moteur de règles pur et déterministe (sans React), état 100 % sérialisable
              ├─ data/        personnages, cartes et lieux (textes en français)
              ├─ flow.ts      étapes du tour et résolution des décisions
              ├─ victory.ts   conditions de victoire
              └─ view.ts      vue filtrée d'un joueur (aucune fuite d'information)
src/ai/       bots : croyances probabilistes + politique de décision, simulation de parties
src/net/      protocole, GameHost (partie + bots), Room (salon), transports local / PeerJS / WebSocket
src/ui/       interface React (écrans, plateau, effets, sons)
server/       serveur Node WebSocket (réutilise src/engine et src/net)
```

Le **même code** fait tourner une partie dans le navigateur (solo, hôte P2P) et sur le serveur. Le client ne reçoit jamais que sa propre vue.

Le moteur fonctionne par pile d'étapes. Quand une étape attend un choix, elle pose une décision en attente (`pending`) ; `applyAction` la résout puis fait avancer la partie jusqu'au choix suivant.

Certaines décisions ne proposent qu'une option (« Continuer ») à des joueurs qui n'ont rien à faire, par exemple après une attaque. Elles se valident seules et servent de **décisions de couverture** : une pause pour réfléchir ne trahit pas un Loup-garou ou un Charles.

## Déploiement

### Le jeu (GitHub Pages)

1. Dans *Settings → Pages* du dépôt, choisir la source **GitHub Actions**.
2. Pousser sur `main` : le workflow `.github/workflows/deploy.yml` lance le lint, les types, les tests et le build, puis publie le site.
3. Facultatif : créer une variable de dépôt `SERVER_URL` (*Settings → Secrets and variables → Actions → Variables*) avec l'adresse du serveur multijoueur, par exemple `wss://shadow-hunters-server.onrender.com`. Elle sera proposée par défaut dans le jeu.

### Le serveur multijoueur (facultatif)

Le mode pair-à-pair n'a besoin d'aucun serveur : il utilise le service public de mise en relation PeerJS. Pour le mode « Serveur » :

- **Render** : « New → Blueprint » avec ce dépôt ; `render.yaml` configure le service.
  - Sur l'offre gratuite, le serveur s'endort après 15 minutes d'inactivité. Le premier joueur attend alors environ une minute.
- **Docker** (Koyeb, Fly.io, un VPS…) : `docker build -t shadow-hunters-server . && docker run -p 8787:8787 shadow-hunters-server`.
- **Sur votre PC** : `npm run server`, puis exposez le port avec ngrok ou utilisez `ws://IP-LOCALE:8787` en réseau local.

Pour auto-héberger aussi la mise en relation P2P, définissez au build `VITE_PEER_HOST`, `VITE_PEER_PORT`, `VITE_PEER_PATH` et `VITE_PEER_SECURE`, qui pointent vers un [PeerServer](https://github.com/peers/peerjs-server).

## Crédits

- Jeu original **Shadow Hunters** de Yasutaka Ikeda (Game Republic / Z-Man Games). Adaptation non officielle, à usage personnel et éducatif.
- Pixel art (personnages, lieux, piste de vie, titre) et effets sonores : projet [shadow_hunter_app](https://github.com/The-Cyril5555/shadow_hunter_app).
- Polices :
  - [Chomsky](https://github.com/ctrlcctrlv/chomsky) (SIL OFL 1.1, licence dans `src/ui/fonts/Chomsky-OFL.txt`) ;
  - [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) (SIL OFL 1.1) ;
  - [Pixelify Sans](https://fonts.google.com/specimen/Pixelify+Sans) (SIL OFL 1.1).
