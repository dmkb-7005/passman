import { useNavigate } from 'react-router-dom';
import { AlertIcon, ChevronRight, CloudCheckIcon, CloudOffIcon, RefreshIcon } from '../../components/icons';
import s from './Logins.module.css';

export type SyncState = 'synced' | 'syncing' | 'offline' | 'problem' | 'not-connected';

const LABEL: Record<SyncState, string> = {
  synced: 'Synced',
  syncing: 'Syncing…',
  offline: 'Not synced yet',
  problem: 'Sync problem',
  'not-connected': 'Not synced',
};

/** Sync status in the Logins header (brief 03). Until Dropbox sync exists, it is always "not connected". */
export function SyncChip({ state }: { state: SyncState }) {
  const navigate = useNavigate();
  const icon =
    state === 'synced' ? <CloudCheckIcon /> :
    state === 'syncing' ? <span className={s.spin}><RefreshIcon size={16} /></span> :
    state === 'problem' ? <AlertIcon /> :
    <CloudOffIcon />;
  return (
    <button type="button" className={s.chipButton} aria-label={`Sync status: ${LABEL[state]}`} onClick={() => navigate('/settings')}>
      <span className={`${s.chip} ${s[`chip-${state}`] ?? ''}`}>
        <span className={s.chipIcon}>{icon}</span>
        {LABEL[state]}
        {state === 'not-connected' && <ChevronRight size={14} />}
      </span>
    </button>
  );
}
