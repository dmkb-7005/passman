import { useNavigate } from 'react-router-dom';
import { formStyles } from '../../components/form/Form';
import { KeyIcon } from '../../components/icons';
import { NightRidges } from '../../components/NightRidges';
import s from './Welcome.module.css';

/** First run on a device (brief 01): create a vault, use the one in Dropbox, or restore a backup. */
export function WelcomePage() {
  const navigate = useNavigate();

  return (
    <div className={s.screen}>
      <NightRidges variant="welcome" />
      <div className={s.content}>
        <div className={s.top} />
        <div className={s.hero}>
          <div role="img" aria-label="PassMan" className={s.mark}><KeyIcon size={44} /></div>
          <h1 className={s.name}>PassMan</h1>
          <p className={s.promise}>Your passwords, encrypted on your devices. Synced only through your own Dropbox.</p>
        </div>
        <div className={s.grow} />
        <div className={s.actions}>
          <button type="button" className={formStyles.primary} onClick={() => navigate('/welcome/create')}>Create a new vault</button>
          <div className={s.secondaryGroup}>
            <button type="button" className={formStyles.secondary} onClick={() => navigate('/welcome/dropbox')}>Use my vault from Dropbox</button>
            <div className={s.subline}>On your second or third device</div>
          </div>
          <button type="button" className={formStyles.textLink} onClick={() => navigate('/restore')}>Restore a backup file</button>
        </div>
      </div>
    </div>
  );
}
