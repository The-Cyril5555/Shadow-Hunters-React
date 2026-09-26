# Serveur multijoueur Shadow Hunters (WebSocket). Le jeu lui-même est servi par GitHub Pages.
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY src ./src
COPY server ./server
ENV NODE_ENV=production PORT=8787
EXPOSE 8787
CMD ["npx", "tsx", "server/index.ts"]
