import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import viteTsconfigPaths from 'vite-tsconfig-paths';
import svgr from 'vite-plugin-svgr';
import browserslistToEsbuild from 'browserslist-to-esbuild';

export default defineConfig({
  base: '',
  plugins: [
    react({ jsxImportSource: (process.env.NODE_ENV === 'production') ? 'react' : '@welldone-software/why-did-you-render' }),
    viteTsconfigPaths(),
    svgr(),
  ],
  server: {
    open: true,
    port: 3000,
    proxy: {
      '^/load|/oauth2|/basicauth|/tracks|/playlist|/player|/spotify-playlist|/subsonic-art': 'http://localhost:2468',
      '/websocket': {
        target: 'ws://localhost:2468',
        ws: true,
      },
    },
  },
  build: {
    outDir: './build',
    target: browserslistToEsbuild([
      '>0.2%',
      'not dead',
      'not op_mini all',
    ]),
    rollupOptions: {
      external: ['@welldone-software/why-did-you-render'],
    },
  },
});