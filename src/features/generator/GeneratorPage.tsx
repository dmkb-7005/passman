import { DiceIcon } from '../../components/icons';
import styles from '../shell/Screen.module.css';

/** Placeholder: the password generator arrives with its milestone (SCOPE §5.4). */
export function GeneratorPage() {
  return (
    <div className={styles.screen}>
      <header className={styles.header}><h1 className={styles.title}>Generator</h1></header>
      <div className={styles.scroll}>
        <section className={styles.card}>
          <span className={styles.emptyIcon}><DiceIcon size={24} /></span>
          <h2 className={styles.emptyTitle}>Password generator</h2>
          <p className={styles.cardText}>Generate strong passwords here, without creating a login. Coming in a later milestone.</p>
        </section>
      </div>
    </div>
  );
}
