import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Le chemin de base est fourni par la CI (GitHub Pages : /<nom-du-dépôt>/).
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
    environment: 'node',
    testTimeout: 120_000,
  },
});
