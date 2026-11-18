import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { APP_VERSION } from '../../app/version';
import { NAV_HEIGHT } from '../../app/TabLayout';
import { backupFileName, buildBackup } from '../../backup/build';
import { downloadText, shareOrDownload } from '../../backup/files';
import { restoreBackup } from '../../backup/restore';
import { parseBackup } from '../../backup/schema';
import { useSnackbar, useSnackbarPlacement } from '../../components/Snackbar';
import { CheckIcon, InfoIcon, RestoreIcon, UploadIcon, WarnIcon } from '../../components/icons';
import { db } from '../../db/db';
import { setMeta, useSettings } from '../../db/meta';
import { DATA_TABLES } from '../../db/schema';
import { backupStatus, daysAgo, formatDateTime } from '../../domain/backupStatus';
import { RestoreSheet, type RestoreCandidate } from './RestoreSheet';
import styles from './Setup.module.css';

/**
 * Starter Setup screen: backup, restore, storage and version. Add the app's lists and settings above BACKUP.
 * Backup rules (docs/PLAYBOOK.md §9): share as .json.txt, lastBackupAt only on success, recovery copy, one transaction.
 */
export function SetupPage() {
  const settings = useSettings();
  const rows = useLiveQuery(async () => (await Promise.all(DATA_TABLES.map((t) => db.table(t).count()))).reduce((a, b) => a + b, 0), []);
  const snackbar = useSnackbar();
  useSnackbarPlacement(NAV_HEIGHT + 12);
  const fileInput = useRef<HTMLInputElement>(null);
  const [candidate, setCandidate] = useState<RestoreCandidate | null>(null);
  const [busy, setBusy] = useState(false);
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(null));
  }, []);

  if (settings === undefined || rows === undefined) return null;
  const status = backupStatus(settings.lastBackupAt, settings.backupReminderDays);

  async function exportJson() {
    const name = backupFileName();
    // Chrome on Android won't share .json files: share as .json.txt (text/plain), download keeps .json
    const result = await shareOrDownload(name, JSON.stringify(await buildBackup(db)), 'application/json', { filename: `${name}.txt`, mime: 'text/plain' });
    if (result === 'cancelled') return; // nothing was saved
    await setMeta('lastBackupAt', new Date().toISOString());
    snackbar.show({ message: result === 'shared' ? 'Backup shared' : 'Backup downloaded' });
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    input.value = ''; // picking the same file again must fire a new change event
    if (!file) return;
    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      setCandidate({ ok: false, name: file.name, size: file.size, errors: ['Not a JSON file.'] });
      return;
    }
    const result = parseBackup(raw);
    setCandidate(result.ok
      ? { ok: true, name: file.name, size: file.size, backup: result.backup }
      : { ok: false, name: file.name, size: file.size, errors: result.errors });
  }

  async function replace(current: RestoreCandidate) {
    if (!current.ok || busy) return;
    setBusy(true);
    try {
      if ((rows ?? 0) > 0) downloadText(backupFileName(new Date(), 'backup-recovery'), JSON.stringify(await buildBackup(db)));
      await restoreBackup(db, current.backup);
      snackbar.show({ message: 'Backup restored' });
      setCandidate(null);
    } catch (err) {
      setCandidate({ ok: false, name: current.name, size: current.size, errors: [err instanceof Error ? err.message : String(err)] });
    } finally {
      setBusy(false);
    }
  }

  async function requestPersistence() {
    const granted = (await navigator.storage?.persist?.().catch(() => false)) ?? false;
    setPersisted(granted);
    snackbar.show({ message: granted ? 'Persistent storage granted' : 'Android did not grant persistent storage' });
  }

  const tone = status.state === 'overdue' ? styles.cardWarn : status.state === 'never' ? styles.cardDanger : '';
  const icon = status.state === 'ok'
    ? <span className={`${styles.statusIcon} ${styles.iconOk}`}><CheckIcon size={22} /></span>
    : <span className={`${styles.statusIcon} ${status.state === 'overdue' ? styles.iconWarn : styles.iconDanger}`}><WarnIcon size={22} /></span>;
  const title = status.state === 'never' ? 'Never backed up' : status.state === 'overdue' ? 'Backup overdue' : `Last backup ${daysAgo(status.days)}`;
  const sub = status.state === 'never' ? 'Your data exists only on this phone' : formatDateTime(settings.lastBackupAt!);

  return (
    <div className={styles.screen}>
      <header className={styles.header}><h1 className={styles.title}>Setup</h1></header>
      <div className={styles.scroll}>
        <h2 className={styles.label}>BACKUP</h2>
        <section className={`${styles.card} ${tone}`}>
          <div className={styles.status}>
            {icon}
            <div>
              <div className={`${styles.statusTitle} ${status.state === 'overdue' ? styles.statusWarn : status.state === 'never' ? styles.statusDanger : ''}`}>{title}</div>
              <div className={styles.statusSub}>{sub}</div>
            </div>
          </div>
          <button type="button" className={styles.primary} onClick={() => void exportJson()}><UploadIcon />Export full backup</button>
          <button type="button" className={styles.secondary} onClick={() => fileInput.current?.click()}><RestoreIcon size={18} />Restore from backup</button>
          <input ref={fileInput} type="file" accept=".json,.txt,application/json,text/plain" hidden onChange={(e) => void onFile(e)} />
          <div className={styles.hint}>Opens the share sheet, so you can send the file to Dropbox or pCloud.</div>
        </section>

        <h2 className={styles.label}>STORAGE</h2>
        <section className={styles.card}>
          <div className={styles.statRow}><span>Entries on this phone</span><span>{rows.toLocaleString('de-DE')}</span></div>
          {persisted === true && <div className={styles.note}><CheckIcon size={16} />Persistent storage granted.</div>}
          {persisted === false && (
            <>
              <div className={`${styles.note} ${styles.noteWarn}`}><WarnIcon size={16} />Persistent storage not granted. Android may clear app data when space runs low. Keep backups current.</div>
              <button type="button" className={styles.secondary} onClick={() => void requestPersistence()}>Request persistent storage</button>
            </>
          )}
          {persisted === null && <div className={styles.note}><InfoIcon size={16} />This browser does not report whether storage is persistent.</div>}
        </section>
        <div className={styles.version}>Version {APP_VERSION}</div>
      </div>

      {candidate && (
        <RestoreSheet candidate={candidate} currentRows={rows} busy={busy}
          onReplace={() => void replace(candidate)}
          onChooseAnother={() => { setCandidate(null); fileInput.current?.click(); }}
          onClose={() => setCandidate(null)} />
      )}
    </div>
  );
}
