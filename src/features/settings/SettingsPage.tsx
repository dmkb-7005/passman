import { useEffect, useState } from 'react';
import { BUILD_INFO, buildLinks, shortCommit } from '../../app/buildInfo';
import { NAV_HEIGHT } from '../../app/TabLayout';
import { useUpdates } from '../../app/UpdateProvider';
import { useSnackbar, useSnackbarPlacement } from '../../components/Snackbar';
import { CheckIcon, ExternalIcon, InfoIcon, RestoreIcon, WarnIcon } from '../../components/icons';
import { formatDateTime } from '../../domain/backupStatus';
import shell from '../shell/Screen.module.css';
import styles from './Settings.module.css';

/** Settings (SCOPE §2.10). For now: storage and "About this version" with the update check. */
export function SettingsPage() {
  const snackbar = useSnackbar();
  const updates = useUpdates();
  useSnackbarPlacement(NAV_HEIGHT + 12);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(null));
  }, []);

  async function requestPersistence() {
    const granted = (await navigator.storage?.persist?.().catch(() => false)) ?? false;
    setPersisted(granted);
    snackbar.show({ message: granted ? 'Persistent storage granted' : 'The browser did not grant persistent storage' });
  }

  async function checkForUpdates() {
    setChecking(true);
    const result = await updates.check();
    setChecking(false);
    if (result === 'none') snackbar.show({ message: "You're up to date" });
    if (result === 'unavailable') snackbar.show({ message: 'Update check unavailable (offline or not installed yet)' });
  }

  const links = buildLinks(BUILD_INFO);
  const deployed = Number.isNaN(Date.parse(BUILD_INFO.deployedAt)) ? BUILD_INFO.deployedAt : formatDateTime(BUILD_INFO.deployedAt);

  return (
    <div className={shell.screen}>
      <header className={shell.header}><h1 className={shell.title}>Settings</h1></header>
      <div className={shell.scroll}>
        <h2 className={shell.sectionLabel}>STORAGE</h2>
        <section className={shell.card}>
          {persisted === true && <div className={styles.note}><CheckIcon size={16} />Persistent storage granted.</div>}
          {persisted === false && (
            <>
              <div className={`${styles.note} ${styles.noteWarn}`}><WarnIcon size={16} />Persistent storage not granted. The browser may clear app data when space runs low.</div>
              <button type="button" className={styles.secondary} onClick={() => void requestPersistence()}>Request persistent storage</button>
            </>
          )}
          {persisted === null && <div className={styles.note}><InfoIcon size={16} />This browser does not report whether storage is persistent.</div>}
        </section>

        <h2 className={shell.sectionLabel}>ABOUT THIS VERSION</h2>
        <section className={shell.card}>
          <dl className={styles.about}>
            <div><dt>Version</dt><dd>{BUILD_INFO.version}</dd></div>
            <div><dt>Commit</dt><dd><span className={styles.mono}>{shortCommit(BUILD_INFO.commit)}</span>{BUILD_INFO.commitMessage ? ` · ${BUILD_INFO.commitMessage}` : ''}</dd></div>
            <div><dt>Deployed</dt><dd>{deployed}</dd></div>
            <div><dt>By</dt><dd>{BUILD_INFO.deployedBy}</dd></div>
          </dl>
          {(links.commitUrl || links.runUrl) && (
            <div className={styles.links}>
              {links.commitUrl && <a href={links.commitUrl} target="_blank" rel="noreferrer">View commit<ExternalIcon size={14} /></a>}
              {links.runUrl && <a href={links.runUrl} target="_blank" rel="noreferrer">View deploy run<ExternalIcon size={14} /></a>}
            </div>
          )}
          <button type="button" className={styles.secondary} disabled={checking} onClick={() => void checkForUpdates()}>
            <RestoreIcon size={18} />{checking ? 'Checking…' : 'Check for updates'}
          </button>
          <div className={styles.hint}>Updates are never applied without your confirmation.</div>
        </section>
      </div>
    </div>
  );
}
