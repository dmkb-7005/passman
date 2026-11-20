import { ExternalIcon, UploadIcon, WarnIcon } from '../components/icons';
import { formatDateTime } from '../domain/backupStatus';
import { BUILD_INFO, buildLinks, shortCommit } from './buildInfo';
import type { PendingUpdate } from './updates';
import styles from './UpdateDialog.module.css';

interface Props {
  update: PendingUpdate;
  busy: boolean;
  onLater: () => void;
  onUpdate: () => void;
}

function safeDate(iso: string): string {
  return Number.isNaN(Date.parse(iso)) ? iso || 'unknown' : formatDateTime(iso);
}

/** Centred dialog over everything (SCOPE §5.8): what the new build is, who deployed it, links to check it. */
export function UpdateDialog({ update, busy, onLater, onUpdate }: Props) {
  const info = update.info;
  const links = info ? buildLinks(info) : { commitUrl: null, runUrl: null };
  return (
    <div className={styles.backdrop}>
      <div className={styles.dialog} role="alertdialog" aria-modal="true" aria-labelledby="update-title" aria-describedby="update-text">
        <span className={styles.icon}><UploadIcon size={24} /></span>
        <h2 id="update-title" className={styles.title}>Update available</h2>
        <p id="update-text" className={styles.text}>Only update if you recognise this change.</p>

        {info ? (
          <dl className={styles.details}>
            <div className={styles.detailRow}>
              <dt>Version</dt>
              <dd>{info.version} <span className={styles.muted}>(installed {BUILD_INFO.version})</span></dd>
            </div>
            <div className={styles.detailRow}>
              <dt>Deployed</dt>
              <dd>{safeDate(info.deployedAt)}</dd>
            </div>
            <div className={styles.detailRow}>
              <dt>By</dt>
              <dd>{info.deployedBy || 'unknown'}</dd>
            </div>
            <div className={styles.detailRow}>
              <dt>Commit</dt>
              <dd><span className={styles.mono}>{shortCommit(info.commit)}</span>{info.commitMessage ? ` · ${info.commitMessage}` : ''}</dd>
            </div>
          </dl>
        ) : (
          <div className={styles.warning}><WarnIcon size={16} />The details of this update couldn't be read. If you didn't deploy a new version, choose Later.</div>
        )}

        {(links.commitUrl || links.runUrl) && (
          <div className={styles.links}>
            {links.commitUrl && <a href={links.commitUrl} target="_blank" rel="noreferrer">View commit<ExternalIcon size={14} /></a>}
            {links.runUrl && <a href={links.runUrl} target="_blank" rel="noreferrer">View deploy run<ExternalIcon size={14} /></a>}
          </div>
        )}

        <div className={styles.buttons}>
          <button type="button" className={styles.ignore} disabled={busy} onClick={onLater}>Later</button>
          <button type="button" className={styles.reload} disabled={busy} onClick={onUpdate}>{busy ? 'Updating…' : 'Update now'}</button>
        </div>
        <p className={styles.footnote}>Updating reloads PassMan. Anything not saved on this screen is lost.</p>
      </div>
    </div>
  );
}
