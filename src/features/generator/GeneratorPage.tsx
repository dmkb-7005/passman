import { useNavigate } from 'react-router-dom';
import { copySecret } from '../../app/clipboard';
import { NAV_HEIGHT } from '../../app/TabLayout';
import { FieldMessage, formStyles } from '../../components/form/Form';
import { PasswordText } from '../../components/form/PasswordText';
import { GeneratorControls, StrengthHint } from '../../components/generator/GeneratorControls';
import { KeyIcon, PlusIcon, RefreshIcon } from '../../components/icons';
import { useSnackbar, useSnackbarPlacement } from '../../components/Snackbar';
import t from '../shared/TabScreen.module.css';
import s from './Generator.module.css';
import { useGenerator } from './useGenerator';

/** Generate and copy a password without creating a login (brief 06). */
export function GeneratorPage() {
  const gen = useGenerator();
  const navigate = useNavigate();
  const snackbar = useSnackbar();
  useSnackbarPlacement(NAV_HEIGHT + 12);

  async function copy() {
    if (!gen?.password) return;
    const ok = await copySecret(gen.password);
    snackbar.show(ok ? { message: 'Password copied · clears in 30 s while PassMan is open' } : { message: "Couldn't copy the password.", icon: 'info' });
  }

  return (
    <div className={t.screen}>
      <header className={t.header}><h1 className={t.title}>Generator</h1></header>
      {gen && (
        <div className={`${t.scroll} ${s.body}`}>
          <section aria-label="Generated password" className={`${t.glass} ${s.hero}`}>
            <div className={s.heroText}>
              {gen.password ? (
                <>
                  <p aria-live="polite" className={s.password}><PasswordText password={gen.password} /></p>
                  <StrengthHint options={gen.options} />
                </>
              ) : (
                <>
                  <p className={s.none} aria-label="No password">– – – –</p>
                  <div className={s.noneHint}>No password to show</div>
                </>
              )}
            </div>
            <div className={s.heroButtons}>
              <button type="button" className={`${formStyles.primary} ${s.heroButton}`} disabled={!gen.password} onClick={() => void copy()}><KeyIcon />Copy</button>
              <button type="button" className={`${formStyles.secondary} ${s.heroButton}`} disabled={!gen.password} onClick={gen.regenerate}><RefreshIcon />Regenerate</button>
            </div>
          </section>
          <section aria-label="Options" className={`${t.glass} ${s.options}`}>
            <GeneratorControls options={gen.options} onChange={gen.setOptions} />
            {gen.problem ? <FieldMessage kind="error">{gen.problem}</FieldMessage> : null}
          </section>
          <button type="button" className={s.saveLink} disabled={!gen.password} onClick={() => navigate('/logins/new', { state: { password: gen.password } })}>
            <PlusIcon size={18} />Save as new login
          </button>
        </div>
      )}
    </div>
  );
}
