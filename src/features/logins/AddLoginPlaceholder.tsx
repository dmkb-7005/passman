import { Link } from 'react-router-dom';
import { BackIcon } from '../../components/icons';
import styles from '../shell/Screen.module.css';

/** Target of the app shortcut (./#/logins/new). The real form arrives with the logins milestone. */
export function AddLoginPlaceholder() {
  return (
    <div className={styles.formScreen}>
      <header className={styles.formHeader}>
        <Link to="/" className={styles.backButton} aria-label="Back"><BackIcon /></Link>
        <h1 className={styles.formTitle}>Add login</h1>
      </header>
      <section className={styles.card}>
        <p className={styles.cardText}>Adding logins arrives in a later milestone. The shortcut already opens this screen.</p>
      </section>
    </div>
  );
}
