import { useNavigate } from 'react-router-dom';
import { FormScreen, formStyles } from '../../components/form/Form';
import { CheckIcon, ChevronRight, CloudIcon, DownloadIcon } from '../../components/icons';
import { useSnackbar } from '../../components/Snackbar';
import s from './Welcome.module.css';

/** "Your vault is ready" with the next steps (brief 01). */
export function DonePage() {
  const navigate = useNavigate();
  const snackbar = useSnackbar();
  const later = (what: string) => snackbar.show({ message: `${what} arrives in the next version of PassMan.`, icon: 'info' });

  return (
    <FormScreen title="" footer={<button type="button" className={formStyles.primary} onClick={() => navigate('/', { replace: true })}>Go to my logins</button>}>
      <div className={s.done}>
        <div role="status" className={s.doneHero}>
          <div className={s.doneIcon}><CheckIcon size={44} /></div>
          <h1 className={s.doneTitle}>Your vault is ready</h1>
          <p className={s.doneText}>PassMan is set up on this device. Your logins stay encrypted here.</p>
        </div>
        <div className={s.nextCard}>
          <div className={s.nextLabel}>Next steps</div>
          <button type="button" className={s.nextRow} onClick={() => later('Dropbox sync')}>
            <span className={s.nextIcon}><CloudIcon /></span>
            <span className={s.nextText}>
              <span className={`${s.nextTitle} ${s.nextTitleAccent}`}>Connect Dropbox to sync your devices</span>
              <span className={s.nextSub}>Use the same vault on your tablet and laptop</span>
            </span>
            <span className={s.chevron}><ChevronRight /></span>
          </button>
          <div className={s.divider} />
          <button type="button" className={s.nextRow} onClick={() => later('Importing from Chrome')}>
            <span className={s.nextIcon}><DownloadIcon /></span>
            <span className={s.nextText}>
              <span className={s.nextTitle}>Import your passwords from Chrome</span>
              <span className={s.nextSub}>From Chrome&#8217;s password export file</span>
            </span>
            <span className={s.chevron}><ChevronRight /></span>
          </button>
        </div>
      </div>
    </FormScreen>
  );
}
