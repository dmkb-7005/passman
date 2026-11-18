import { HashRouter, Link, Route, Routes } from 'react-router-dom';
import { SnackbarProvider } from '../components/Snackbar';
import { HomePage } from '../features/home/HomePage';
import { SetupPage } from '../features/setup/SetupPage';
import { TabLayout } from './TabLayout';
import { UpdateBanner } from './UpdateBanner';

/** HashRouter: GitHub Pages has no SPA fallback, and the manifest shortcut points at `./#/…`. */
export function App() {
  return (
    <HashRouter>
      <SnackbarProvider>
        <Routes>
          <Route element={<TabLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/setup" element={<SetupPage />} />
            {/* tab screens (e.g. /items) go here; full-screen forms (e.g. /items/new) go outside this layout */}
          </Route>
          <Route path="*" element={<div className="page"><p>This page doesn't exist.</p><Link to="/">Back to Home</Link></div>} />
        </Routes>
        <UpdateBanner />
      </SnackbarProvider>
    </HashRouter>
  );
}
