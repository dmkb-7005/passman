import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the app from https://<owner>.github.io/<repo>/  → base MUST be '/<repo>/'
const REPO = 'myapp';

export default defineConfig({
  base: `/${REPO}/`,
  plugins: [
    react(),
    VitePWA({
      // never update silently: the app shows an "Update available" dialog (src/app/UpdateBanner.tsx)
      registerType: 'prompt',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/icon.svg', 'icons/favicon-32.png'],
      manifest: {
        name: 'MyApp',
        short_name: 'MyApp',
        description: 'Local-first personal app',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        // = --bg; Android keeps these from install time (reinstall after changing)
        background_color: '#1a1f2b',
        theme_color: '#1a1f2b',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // long-press on the app icon; the route uses the hash router
        shortcuts: [
          {
            name: 'Add item',
            short_name: 'Add',
            url: './#/items/new',
            icons: [
              { src: 'icons/shortcut-add-96.png', sizes: '96x96', type: 'image/png' },
              { src: 'icons/shortcut-add-192.png', sizes: '192x192', type: 'image/png' },
            ],
          },
        ],
      },
      // App shell only. The service worker never touches IndexedDB.
      workbox: { globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'] },
    }),
  ],
  test: { globals: true, environment: 'node' },
});
