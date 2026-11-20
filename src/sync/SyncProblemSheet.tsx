import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { syncedLabel } from '../app/format';
import { BottomSheet } from '../components/BottomSheet';
import { formStyles } from '../components/form/Form';
import { AlertIcon } from '../components/icons';
import { useSync } from './SyncProvider';
import s from './Sync.module.css';

/** "Sync problem" details from the chip (brief 08 · 3): the cause and the one action that fixes it. */
export function SyncProblemSheet({ onClose }: { onClose: () => void }) {
  const sync = useSync();
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);
  const problem = sync.problem;
  if (!problem) return null;
  const last = sync.connection?.lastSyncedAt;
  return (
    <BottomSheet title="Sync problem" onClose={onClose}>
      <div className={s.problemBody}>
        <div className={s.problemLine}>
          <span className={s.dangerCircle}><AlertIcon size={20} /></span>
          <p className={s.problemText} role="alert">{problem.message}</p>
        </div>
        <p className={s.lead}>Your changes are kept on this device.{last ? ` Last synced ${syncedLabel(last)}.` : ''}</p>
      </div>
      <div className={s.problemActions}>
        {problem.kind === 'auth' ? (
          <button type="button" className={formStyles.primary} disabled={leaving} onClick={() => { setLeaving(true); void sync.reconnect().catch(() => setLeaving(false)); }}>Reconnect Dropbox</button>
        ) : (
          <button type="button" className={formStyles.primary} onClick={() => { sync.syncNow(); onClose(); }}>Try again</button>
        )}
        <button type="button" className={s.accentLink} onClick={() => { onClose(); navigate('/settings'); }}>Open Settings</button>
      </div>
    </BottomSheet>
  );
}
