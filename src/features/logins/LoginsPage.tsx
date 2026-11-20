import { KeyIcon } from '../../components/icons';
import styles from '../shell/Screen.module.css';

/** Placeholder: the vault, list and search arrive with the "vault" milestone (SCOPE §4). */
export function LoginsPage() {
  return (
    <div className={styles.screen}>
      <header className={styles.header}><h1 className={styles.title}>Logins</h1></header>
      <div className={styles.scroll}>
        <section className={styles.card}>
          <span className={styles.emptyIcon}><KeyIcon size={24} /></span>
          <h2 className={styles.emptyTitle}>PassMan is being built</h2>
          <p className={styles.cardText}>
            This is the empty app shell: it installs, works offline and asks before every update.
            Your vault, logins and Dropbox sync arrive in the next milestones.
          </p>
        </section>
      </div>
    </div>
  );
}
