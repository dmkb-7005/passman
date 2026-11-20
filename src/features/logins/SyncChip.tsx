import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertIcon, ChevronRight, CloudCheckIcon, CloudOffIcon, RefreshIcon } from '../../components/icons';
import { SyncProblemSheet } from '../../sync/SyncProblemSheet';
import { useSync } from '../../sync/SyncProvider';
import s from './Logins.module.css';

export type SyncState = 'synced' | 'syncing' | 'offline' | 'problem' | 'not-connected';

const LABEL: Record<SyncState, string> = {
  synced: 'Synced',
  syncing: 'Syncing…',
  offline: 'Not synced yet',
  problem: 'Sync problem',
  'not-connected': 'Not synced',
};

/** Sync status in the Logins header (brief 03). "Sync problem" opens the details (brief 08 · 3), the rest open Settings. */
export function SyncChip() {
  const navigate = useNavigate();
  const sync = useSync();
  const [details, setDetails] = useState(false);
  const state = sync.chip;
  const icon =
    state === 'synced' ? <CloudCheckIcon /> :
    state === 'syncing' ? <span className={s.spin}><RefreshIcon size={16} /></span> :
    state === 'problem' ? <AlertIcon /> :
    <CloudOffIcon />;
  return (
    <>
      <button type="button" className={s.chipButton} aria-label={`Sync status: ${LABEL[state]}`} onClick={() => (state === 'problem' ? setDetails(true) : navigate('/settings'))}>
        <span className={`${s.chip} ${s[`chip-${state}`] ?? ''}`}>
          <span className={s.chipIcon}>{icon}</span>
          {LABEL[state]}
          {state === 'not-connected' && <ChevronRight size={14} />}
        </span>
      </button>
      {details && sync.problem && <SyncProblemSheet onClose={() => setDetails(false)} />}
    </>
  );
}
