import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { registerServiceWorker } from './app/updates';
import { db } from './db/db';
import { ensureDefaults } from './db/meta';
// Fonts are bundled (and precached by the service worker), never loaded from the network.
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/space-grotesk/latin-500.css';
import '@fontsource/space-grotesk/latin-600.css';
import '@fontsource/space-grotesk/latin-700.css';
import './styles/global.css';

async function start() {
  await ensureDefaults(db);
  // Only reduces eviction pressure; the Dropbox copy and backups remain essential.
  void navigator.storage?.persist?.();
  // Approved-build gate: updates are applied only after the user confirms (src/sw.ts).
  await registerServiceWorker();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void start();
