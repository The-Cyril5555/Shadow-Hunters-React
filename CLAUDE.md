# Consignes du dépôt Shadow Hunters React

## Commits, branches et pull requests (règle absolue)

- Aucune mention d'outil de génération de code, d'assistant ou de co-auteur, nulle part sur GitHub :
  messages de commit, titres et descriptions de PR, commentaires, code, documentation.
- Jamais de ligne `Co-Authored-By`, de lien de session ni de pied de page du type « Generated with … ».
- Auteur et committer : `The-Cyril5555 <cyrilbizouarn5@gmail.com>`.
- Noms de branches neutres : `feature/…`, `fix/…` (jamais le nom d'un outil).
- Messages de commit et descriptions de PR en français.

## Commandes

```bash
npm run dev          # jeu en local (Vite)
npm test             # tests Vitest
npm run lint         # ESLint
npm run typecheck    # TypeScript strict
npm run build        # build de production (dist/)
npm run server       # serveur multijoueur WebSocket (port 8787, variable PORT)
```

Avant chaque push : lint, typecheck, tests et build doivent passer.

## Architecture

- `src/engine/` : moteur de règles pur et déterministe, état sérialisable. `flow.ts` résout les étapes et
  les décisions, `victory.ts` les conditions de victoire, `view.ts` la vue filtrée de chaque joueur
  (aucune information cachée ne doit fuiter).
- `src/bots/` : bots (croyances probabilistes + politique), jouent uniquement à partir de leur vue.
- `src/net/` : protocole, `GameHost` (partie + bots), `Room` (salon), transports local, PeerJS et WebSocket.
- `src/ui/` : interface React en français, pixel art.
- `server/` : serveur Node WebSocket qui réutilise `src/engine` et `src/net`.

Toute évolution des règles doit rester fidèle au jeu de plateau et être couverte par un test dans
`src/engine/__tests__/`.
