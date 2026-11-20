import { execFileSync } from 'node:child_process';
import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import type { BuildInfo } from './src/app/buildInfo';
import { APP_VERSION } from './src/app/version';

// GitHub Pages serves the app from https://dmkb-7005.github.io/passman/  → base MUST be '/passman/'
const REPO = 'passman';

/** Build metadata (docs/ARCHITECTURE.md §5.2). The deploy workflow sets the BUILD_* variables. */
function readBuildInfo(): BuildInfo {
  const git = (format: string) => {
    try {
      return execFileSync('git', ['log', '-1', `--format=${format}`], { encoding: 'utf8' }).trim();
    } catch {
      return '';
    }
  };
  const env = process.env;
  return {
    version: APP_VERSION,
    commit: env.BUILD_COMMIT || git('%H') || 'dev',
    commitMessage: git('%s'),
    commitAuthor: git('%an'),
    committedAt: git('%cI'),
    deployedAt: new Date().toISOString(),
    deployedBy: env.BUILD_DEPLOYED_BY || 'local build',
    repoUrl: env.BUILD_REPO_URL || `https://github.com/dmkb-7005/${REPO}`,
    runUrl: env.BUILD_RUN_URL || '',
  };
}

const buildInfo = readBuildInfo();

/** Writes version.json next to index.html (precached, so a pending build's details can be shown). */
function versionJson(): Plugin {
  return {
    name: 'passman-version-json',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: `${JSON.stringify(buildInfo, null, 2)}\n` });
    },
  };
}

/**
 * Content Security Policy (docs/ARCHITECTURE.md §6). Build only: the dev server needs inline scripts.
 * Any new network destination must be added to connect-src.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self'",
  "connect-src 'self' https://api.dropboxapi.com https://content.dropboxapi.com",
  "img-src 'self' data:",
  "style-src 'self'",
  "font-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

function contentSecurityPolicy(): Plugin {
  return {
    name: 'passman-csp',
    apply: 'build',
    transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' }],
  };
}

export default defineConfig({
  base: `/${REPO}/`,
  define: { __BUILD_INFO__: JSON.stringify(buildInfo) },
  plugins: [
    react(),
    versionJson(),
    contentSecurityPolicy(),
    VitePWA({
      // Own service worker with the approved-build gate (src/sw.ts): updates apply only after the user confirms.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // registered by src/app/updates.ts
      injectRegister: false,
      manifest: {
        name: 'PassMan',
        short_name: 'PassMan',
        description: 'Local-first password manager',
        start_url: './',
        scope: './',
        display: 'standalone',
        // phone, tablet and laptop: don't lock the orientation
        orientation: 'any',
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
            name: 'Add login',
            short_name: 'Add',
            url: './#/logins/new',
            icons: [
              { src: 'icons/shortcut-add-96.png', sizes: '96x96', type: 'image/png' },
              { src: 'icons/shortcut-add-192.png', sizes: '192x192', type: 'image/png' },
            ],
          },
        ],
      },
      // App shell only (incl. version.json and, later, the Argon2 WASM). The worker never touches IndexedDB.
      injectManifest: { globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2,wasm,json}'], rollupFormat: 'iife' },
      devOptions: { enabled: false },
    }),
  ],
  test: { globals: true, environment: 'node' },
});
