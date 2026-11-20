import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { SnackbarProvider } from '../components/Snackbar';
import { GeneratorPage } from '../features/generator/GeneratorPage';
import { LoginDetailPage } from '../features/logins/LoginDetailPage';
import { LoginEditPage } from '../features/logins/LoginEditPage';
import { LoginsPage } from '../features/logins/LoginsPage';
import { ChangePasswordPage } from '../features/settings/ChangePasswordPage';
import { NewRecoveryKeyPage } from '../features/settings/NewRecoveryKeyPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { RecoverPage } from '../features/unlock/RecoverPage';
import { UnlockPage } from '../features/unlock/UnlockPage';
import { CreateVaultPage } from '../features/welcome/CreateVaultPage';
import { DonePage } from '../features/welcome/DonePage';
import { WelcomePage } from '../features/welcome/WelcomePage';
import { useVault, VaultProvider } from '../vault/VaultProvider';
import { TabLayout } from './TabLayout';
import { UpdateProvider } from './UpdateProvider';

/** HashRouter: GitHub Pages has no SPA fallback, and the manifest shortcut points at `./#/…`. */
export function App() {
  return (
    <HashRouter>
      <SnackbarProvider>
        <VaultProvider>
          <UpdateProvider>
            <GatedRoutes />
          </UpdateProvider>
        </VaultProvider>
      </SnackbarProvider>
    </HashRouter>
  );
}

/** Where to go after unlocking: the screen that was asked for (e.g. the "Add login" shortcut). */
export interface ReturnState {
  from?: string;
}

/** Only the screens of the current vault state are reachable: first run, locked, or unlocked. */
function GatedRoutes() {
  const { status } = useVault();
  const location = useLocation();
  if (status === 'loading') return null;

  if (status === 'empty') {
    return (
      <Routes>
        <Route path="/welcome" element={<WelcomePage />} />
        <Route path="/welcome/create" element={<CreateVaultPage />} />
        <Route path="*" element={<Navigate to="/welcome" replace />} />
      </Routes>
    );
  }

  if (status === 'locked') {
    const from = location.pathname === '/unlock' || location.pathname === '/recover' ? undefined : location.pathname + location.search;
    return (
      <Routes>
        <Route path="/unlock" element={<UnlockPage />} />
        <Route path="/recover" element={<RecoverPage />} />
        <Route path="*" element={<Navigate to="/unlock" replace state={{ from } satisfies ReturnState} />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<TabLayout />}>
        <Route path="/" element={<LoginsPage />} />
        <Route path="/generator" element={<GeneratorPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="/logins/new" element={<LoginEditPage />} />
      <Route path="/logins/:id" element={<LoginDetailPage />} />
      <Route path="/logins/:id/edit" element={<LoginEditPage />} />
      <Route path="/settings/password" element={<ChangePasswordPage />} />
      <Route path="/settings/recovery-key" element={<NewRecoveryKeyPage />} />
      <Route path="/welcome/done" element={<DonePage />} />
      {/* just unlocked / recovered / created: continue where the user was going */}
      <Route path="/unlock" element={<Navigate to={(location.state as ReturnState | null)?.from ?? '/'} replace />} />
      <Route path="/recover" element={<Navigate to="/" replace />} />
      <Route path="/welcome/create" element={<Navigate to="/welcome/done" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
