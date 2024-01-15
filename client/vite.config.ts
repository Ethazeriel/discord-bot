import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import viteTsconfigPaths from 'vite-tsconfig-paths';
import svgr from 'vite-plugin-svgr';

export default defineConfig({
  // depending on your application, base can also be "/"
  base: '',
  plugins: [
    react(),
    viteTsconfigPaths(),
    svgr(),
  ],
  server: {
    open: true,
    port: 3000,
    proxy: {
      '^/load|/oauth2|/tracks|/playlist|/player': 'http://localhost:2468',
      '/websocket': {
        target: 'ws://localhost:2468',
        ws: true,
      },
    },
  },
  build: {
    outDir: './build',
  },
});