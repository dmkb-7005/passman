import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSnackbar } from '../components/Snackbar';
import { UpdateDialog } from './UpdateDialog';
import { applyUpdate, checkForUpdate, onGateChanged, takeJustUpdated, type PendingUpdate, type UpdateCheck } from './updates';

interface UpdatesApi {
  /** "Check for updates" in Settings: asks the server, shows the dialog if something is pending. */
  check: () => Promise<UpdateCheck['kind']>;
}

const UpdatesContext = createContext<UpdatesApi>({ check: async () => 'unavailable' });

export function useUpdates(): UpdatesApi {
  return useContext(UpdatesContext);
}

const SERVER_CHECK_EVERY_MS = 15 * 60_000;

/**
 * Shows the Update dialog whenever a build is waiting for approval (SCOPE §5.8). "Later" hides it for that build
 * until the app starts again. Nothing is ever applied without "Update now".
 */
export function UpdateProvider({ children }: { children: ReactNode }) {
  const { show: showSnackbar } = useSnackbar();
  const [pending, setPending] = useState<PendingUpdate | null>(null);
  const [busy, setBusy] = useState(false);
  const dismissed = useRef(new Set<string>());
  const lastServerCheck = useRef(0);

  const refresh = useCallback(async (askServer: boolean) => {
    if (askServer) lastServerCheck.current = Date.now();
    const result = await checkForUpdate(askServer);
    if (result.kind === 'pending' && !dismissed.current.has(result.update.build)) setPending(result.update);
    if (result.kind === 'none') setPending(null);
    return result;
  }, []);

  useEffect(() => {
    const updated = takeJustUpdated();
    if (updated !== null) showSnackbar({ message: updated ? `Updated to version ${updated}` : 'PassMan was updated' });
    void refresh(true);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh(Date.now() - lastServerCheck.current > SERVER_CHECK_EVERY_MS);
    };
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(() => void refresh(true), SERVER_CHECK_EVERY_MS);
    const unsubscribe = onGateChanged(() => void refresh(false));
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
      unsubscribe();
    };
  }, [refresh, showSnackbar]);

  const check = useCallback(async () => {
    const result = await refresh(true);
    if (result.kind === 'pending') {
      dismissed.current.delete(result.update.build);
      setPending(result.update);
    }
    return result.kind;
  }, [refresh]);

  const api = useMemo(() => ({ check }), [check]);

  async function updateNow(update: PendingUpdate) {
    setBusy(true);
    const ok = await applyUpdate(update);
    if (!ok) {
      setBusy(false);
      setPending(null);
      showSnackbar({ message: "The update couldn't be applied. Try again from Settings." });
    }
  }

  return (
    <UpdatesContext.Provider value={api}>
      {children}
      {pending && (
        <UpdateDialog
          update={pending}
          busy={busy}
          onLater={() => {
            dismissed.current.add(pending.build);
            setPending(null);
          }}
          onUpdate={() => void updateNow(pending)}
        />
      )}
    </UpdatesContext.Provider>
  );
}
