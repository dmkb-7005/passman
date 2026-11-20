import { HashRouter, Link, Route, Routes } from 'react-router-dom';
import { SnackbarProvider } from '../components/Snackbar';
import { GeneratorPage } from '../features/generator/GeneratorPage';
import { AddLoginPlaceholder } from '../features/logins/AddLoginPlaceholder';
import { LoginsPage } from '../features/logins/LoginsPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { TabLayout } from './TabLayout';
import { UpdateProvider } from './UpdateProvider';

/** HashRouter: GitHub Pages has no SPA fallback, and the manifest shortcut points at `./#/…`. */
export function App() {
  return (
    <HashRouter>
      <SnackbarProvider>
        <UpdateProvider>
          <Routes>
            <Route element={<TabLayout />}>
              <Route path="/" element={<LoginsPage />} />
              <Route path="/generator" element={<GeneratorPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            {/* full-screen forms: no bottom navigation */}
            <Route path="/logins/new" element={<AddLoginPlaceholder />} />
            <Route path="*" element={<div className="page"><p>This page doesn't exist.</p><Link to="/">Back to Logins</Link></div>} />
          </Routes>
        </UpdateProvider>
      </SnackbarProvider>
    </HashRouter>
  );
}
