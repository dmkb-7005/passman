import { useState } from 'react';
import { syncedLabel } from '../../app/format';
import { ConfirmDialog, formStyles } from '../../components/form/Form';
import { AlertIcon, CloudCheckIcon, CloudIcon, CloudOffIcon, RefreshIcon } from '../../components/icons';
import { useSnackbar } from '../../components/Snackbar';
import { useSync } from '../../sync/SyncProvider';
import t from '../shared/TabScreen.module.css';
import s from './Settings.module.css';

/** Settings › Sync (brief 07): not connected / connected / sync problem. */
export function DropboxCard() {
  const sync = useSync();
  const snackbar = useSnackbar();
  const [leaving, setLeaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const connection = sync.connection;

  const signIn = (how: () => Promise<void>) => {
    setLeaving(true);
    how().catch(() => {
      setLeaving(false);
      snackbar.show({ message: 'PassMan couldn’t open the Dropbox sign-in', icon: 'info' });
    });
  };

  if (!connection) {
    return (
      <div className={`${t.glass} ${s.card}`}>
        <div className={s.cardHead}>
          <span className={s.circle}><CloudIcon /></span>
          <div className={s.cardTitles}>
            <span className={s.cardTitle}>Dropbox</span>
            <span className={s.cardSub}>{sync.running ? 'Connecting…' : 'Not connected'}</span>
          </div>
        </div>
        <p className={s.cardText}>Sync this vault between your phone, tablet and laptop. PassMan only sees its own folder in your Dropbox, and everything in it is encrypted.</p>
        <button type="button" className={formStyles.primary} disabled={leaving || sync.running} onClick={() => signIn(sync.connect)}>
          {leaving || sync.running ? <><span className={formStyles.spinner} aria-hidden="true" />{sync.running ? 'Connecting Dropbox…' : 'Opening Dropbox…'}</> : 'Connect Dropbox'}
        </button>
      </div>
    );
  }

  const last = connection.lastSyncedAt ? syncedLabel(connection.lastSyncedAt) : null;
  const head = (danger: boolean) => (
    <div className={s.cardHead}>
      <span className={`${s.circle} ${danger ? s.circleDanger : ''}`}>{danger ? <AlertIcon size={20} /> : <CloudIcon />}</span>
      <div className={s.cardTitles}>
        <span className={s.cardTitle}>Dropbox</span>
        <span className={`${s.cardSub} ${s.ellipsis}`}>{connection.email}</span>
      </div>
    </div>
  );

  if (sync.problem && !sync.running) {
    const auth = sync.problem.kind === 'auth';
    return (
      <div className={`${s.card} ${s.problemCard}`}>
        {head(true)}
        <p role="alert" className={s.problemText}><b className={s.danger}>Sync problem:</b> {sync.problem.message}{auth ? ' Connect again.' : ''}</p>
        <div className={s.hint}>{last ? `Last synced ${last}. ` : ''}Your changes are kept on this device.</div>
        <button type="button" className={formStyles.primary} disabled={leaving} onClick={() => (auth ? signIn(sync.reconnect) : sync.syncNow())}>
          {auth ? 'Reconnect' : 'Try again'}
        </button>
      </div>
    );
  }

  const status =
    sync.running ? <><span className={`${s.statusIcon} ${s.spinIcon}`}><RefreshIcon size={18} /></span>{last ? 'Syncing…' : 'Connecting Dropbox…'}</> :
    sync.chip === 'offline' ? <><span className={`${s.statusIcon} ${s.warn}`}><CloudOffIcon size={18} /></span>Not synced yet · changes are saved here</> :
    last ? <><span className={`${s.statusIcon} ${s.ok}`}><CloudCheckIcon size={18} /></span>Synced {last}</> :
    <><span className={`${s.statusIcon} ${s.spinIcon}`}><RefreshIcon size={18} /></span>Syncing…</>;

  return (
    <div className={`${t.glass} ${s.card}`}>
      {head(false)}
      <div className={s.statusLine} role="status">{status}</div>
      <div className={s.syncActions}>
        <button type="button" className={`${formStyles.secondary} ${s.syncNow}`} disabled={sync.running} onClick={sync.syncNow}><RefreshIcon />Sync now</button>
        <button type="button" className={s.disconnect} onClick={() => setConfirming(true)}>Disconnect</button>
      </div>
      {confirming && (
        <ConfirmDialog
          tone="info"
          icon={<CloudOffIcon size={24} />}
          title="Disconnect Dropbox?"
          text="Your logins stay on this device. Other devices keep syncing."
          dangerLabel="Disconnect"
          onDanger={() => {
            setConfirming(false);
            void sync.disconnect().then(() => snackbar.show({ message: 'Dropbox disconnected' }));
          }}
          safeLabel="Cancel"
          onSafe={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
