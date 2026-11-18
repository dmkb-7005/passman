import { BottomSheet } from '../../components/BottomSheet';
import { CheckIcon, DownloadIcon, FileIcon, WarnIcon } from '../../components/icons';
import { DATA_TABLES } from '../../db/schema';
import type { Backup } from '../../backup/schema';
import { formatDateTime } from '../../domain/backupStatus';
import styles from './Sheets.module.css';

export type RestoreCandidate =
  | { ok: true; name: string; size: number; backup: Backup }
  | { ok: false; name: string; size: number; errors: string[] };

interface Props {
  candidate: RestoreCandidate;
  /** rows currently on the phone */
  currentRows: number;
  busy: boolean;
  onReplace: () => void;
  onChooseAnother: () => void;
  onClose: () => void;
}

const n = (v: number) => v.toLocaleString('de-DE');
const SHOWN_ERRORS = 3;
const kb = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(1).replace('.', ',')} MB`);
const LABEL: Record<(typeof DATA_TABLES)[number], string> = { categories: 'Categories', items: 'Items' };

/** Step two of restore: what the file holds (or why it can't be used), and an explicit "Replace all data". */
export function RestoreSheet({ candidate, currentRows, busy, onReplace, onChooseAnother, onClose }: Props) {
  const fileRow = (
    <div className={styles.fileRow}>
      <FileIcon />
      <div style={{ minWidth: 0 }}>
        <div className={styles.fileName}>{candidate.name}</div>
        <div className={styles.fileSize}>{kb(candidate.size)}</div>
      </div>
    </div>
  );

  if (!candidate.ok) {
    const shown = candidate.errors.slice(0, SHOWN_ERRORS);
    const more = candidate.errors.length - shown.length;
    return (
      <BottomSheet title="Restore backup" onClose={onClose} headerAction={<span />}
        footer={
          <div className={styles.buttons}>
            <button type="button" className={styles.primary} onClick={onChooseAnother}>Choose another file</button>
            <button type="button" className={styles.cancel} onClick={onClose}>Cancel</button>
          </div>
        }>
        {fileRow}
        <div className={`${styles.verdict} ${styles.bad}`}><WarnIcon size={16} />This file can't be restored</div>
        <ul className={styles.errors}>
          {shown.map((e) => <li key={e}>{e}</li>)}
          {more > 0 && <li>…and {more} more {more === 1 ? 'error' : 'errors'}</li>}
        </ul>
        <p className={styles.unchanged}>Nothing was changed on this phone.</p>
      </BottomSheet>
    );
  }

  const b = candidate.backup;
  return (
    <BottomSheet title="Restore backup" onClose={onClose} headerAction={<span />}
      footer={
        <div className={styles.buttons}>
          <button type="button" className={styles.danger} disabled={busy} onClick={onReplace}>{busy ? 'Restoring…' : 'Replace all data'}</button>
          <button type="button" className={styles.cancel} disabled={busy} onClick={onClose}>Cancel</button>
        </div>
      }>
      {fileRow}
      <div className={`${styles.verdict} ${styles.ok}`}><CheckIcon size={16} />Backup file is valid</div>
      {DATA_TABLES.map((t) => <div key={t} className={styles.stat}><span>{LABEL[t]}</span><span>{n(b[t].length)}</span></div>)}
      <div className={styles.stat}><span>Created</span><span>{formatDateTime(b.exportedAt)}</span></div>
      <div className={styles.warn}>
        <div className={styles.warnLine}>
          <WarnIcon size={14} />
          <span><b>All data on this phone will be replaced.</b>{' '}
            {currentRows > 0 ? `${n(currentRows)} entries here will be overwritten by the backup.` : 'There is no data here yet.'}</span>
        </div>
        {currentRows > 0 && <div className={styles.warnLine}><DownloadIcon size={14} /><span>A recovery copy of your current data downloads first.</span></div>}
      </div>
    </BottomSheet>
  );
}
