import { Link } from 'react-router-dom';
import { CloudCheckIcon, WarnIcon } from '../../components/icons';
import { useSettings } from '../../db/meta';
import { backupStatus, daysAgo } from '../../domain/backupStatus';
import styles from './Home.module.css';

/** Placeholder Home: header with the backup status (same rule as Setup). Replace the body with the app's cards. */
export function HomePage() {
  const settings = useSettings();
  if (settings === undefined) return null;
  const { state, days } = backupStatus(settings.lastBackupAt, settings.backupReminderDays);
  const text = state === 'never' ? 'Never backed up' : days === 0 ? 'Backed up today' : `Backup ${daysAgo(days)}`;
  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>Home</h1>
        <Link to="/setup" className={`${styles.backup} ${state === 'overdue' ? styles.backupWarn : state === 'never' ? styles.backupDanger : ''}`}>
          {state === 'ok' ? <CloudCheckIcon /> : <WarnIcon />}{text}
        </Link>
      </header>
      <section className={styles.card}>
        <div className={styles.label}>Getting started</div>
        <p className={styles.text}>Replace this card with the app's main figures. Restore a backup in Setup.</p>
      </section>
    </div>
  );
}
