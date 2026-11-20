import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckIcon, InfoIcon } from './icons';
import styles from './Snackbar.module.css';

export interface SnackbarOptions {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  /** leading icon; default: a positive check when there is no action */
  icon?: 'success' | 'info' | 'none';
}

interface SnackbarApi {
  show: (options: SnackbarOptions) => void;
  /** a message is on screen */
  visible: boolean;
}

const SnackbarContext = createContext<SnackbarApi>({ show: () => {}, visible: false });

/**
 * Where the snackbar sits on the current screen, in px from the bottom (safe area added automatically).
 * Tab screens: 12 px above the navigation. Screens without a call: 24 px from the bottom.
 */
export function useSnackbarPlacement(bottom: number): void {
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--snackbar-bottom', `${bottom}px`);
    return () => {
      root.removeProperty('--snackbar-bottom');
    };
  }, [bottom]);
}

export function useSnackbar(): SnackbarApi {
  return useContext(SnackbarContext);
}

const VISIBLE_MS = 6000;

/**
 * One message at a time. It survives navigation, so "Deleted · Undo" can outlive the screen that deleted.
 * While a message shows, `--snackbar-lift` holds how far a floating Add button must move up.
 */
export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<(SnackbarOptions & { id: number }) | null>(null);
  const counter = useRef(0);
  const element = useRef<HTMLDivElement>(null);

  const show = useCallback((options: SnackbarOptions) => {
    counter.current += 1;
    setCurrent({ ...options, id: counter.current });
  }, []);

  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(() => setCurrent(null), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [current]);

  useLayoutEffect(() => {
    const root = document.documentElement.style;
    const height = element.current?.offsetHeight ?? 0;
    if (current && height) root.setProperty('--snackbar-lift', `${height + 8}px`);
    else root.removeProperty('--snackbar-lift');
  }, [current]);

  const api = useMemo(() => ({ show, visible: current !== null }), [show, current]);
  const icon = current?.icon ?? (current?.actionLabel ? 'none' : 'success');

  return (
    <SnackbarContext.Provider value={api}>
      {children}
      {current && (
        <div ref={element} key={current.id} className={`${styles.snackbar} ${current.actionLabel ? styles.withAction : ''}`} role="status">
          {icon === 'success' && <span className={styles.success}><CheckIcon size={18} /></span>}
          {icon === 'info' && <span className={styles.info}><InfoIcon size={18} /></span>}
          <span className={styles.message}>{current.message}</span>
          {current.actionLabel && (
            <button
              type="button"
              className={styles.action}
              onClick={() => {
                current.onAction?.();
                setCurrent(null);
              }}
            >
              {current.actionLabel}
            </button>
          )}
        </div>
      )}
    </SnackbarContext.Provider>
  );
}
