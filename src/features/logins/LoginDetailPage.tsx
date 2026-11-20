import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { copyPlain, copySecret } from '../../app/clipboard';
import { displayDateTime } from '../../app/format';
import { formStyles } from '../../components/form/Form';
import { HIDDEN_DOTS, PasswordText } from '../../components/form/PasswordText';
import { BackIcon, CopyIcon, ExternalIcon, EyeIcon, EyeOffIcon, KeyIcon } from '../../components/icons';
import { useSnackbar } from '../../components/Snackbar';
import { hostOf, urlForOpening } from '../../domain/logins';
import { useVault } from '../../vault/VaultProvider';
import s from './LoginDetail.module.css';

const REVEAL_MS = 30_000;

/** Back to where the user came from, or to the list when the app was opened on this screen. */
export function useGoBack(fallback = '/') {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(() => {
    if (location.key !== 'default') navigate(-1);
    else navigate(fallback, { replace: true });
  }, [navigate, location.key, fallback]);
}

/** Copy username / password, reveal, open the site (brief 04). Content centred for one-handed use. */
export function LoginDetailPage() {
  const { id } = useParams();
  const vault = useVault();
  const snackbar = useSnackbar();
  const goBack = useGoBack();
  const [revealed, setRevealed] = useState(false);
  const login = vault.logins.find((l) => l.id === id);

  // the password hides again after 30 s
  useEffect(() => {
    if (!revealed) return;
    const timer = setTimeout(() => setRevealed(false), REVEAL_MS);
    return () => clearTimeout(timer);
  }, [revealed]);

  const copyPassword = useCallback(async () => {
    if (!login) return;
    const ok = await copySecret(login.password);
    snackbar.show(ok ? { message: `${login.name} password copied · clears in 30 s while PassMan is open` } : { message: "Couldn't copy the password.", icon: 'info' });
  }, [login, snackbar]);

  // laptop: Ctrl+C copies the password when nothing is selected; Esc goes back
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && !window.getSelection()?.toString()) {
        e.preventDefault();
        void copyPassword();
      }
      if (e.key === 'Escape') goBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [copyPassword, goBack]);

  if (!login) return <Navigate to="/" replace />;
  const openUrl = urlForOpening(login.url);
  const host = hostOf(login.url) || login.url;

  async function copyUsername() {
    if (!login) return;
    const ok = await copyPlain(login.username);
    snackbar.show(ok ? { message: `${login.name} username copied` } : { message: "Couldn't copy the username.", icon: 'info' });
  }

  return (
    <div className={formStyles.screen}>
      <header className={formStyles.header}>
        <button type="button" className={formStyles.iconButton} aria-label="Back to logins" onClick={goBack}><BackIcon /></button>
        <div className={formStyles.headerTitle}>{login.name}</div>
        <Link to={`/logins/${login.id}/edit`} className={s.edit}>Edit</Link>
      </header>
      <div className={s.content}>
        <div className={s.identity}>
          <h1 className={s.name}>{login.name}</h1>
          {openUrl && (
            <a href={openUrl} target="_blank" rel="noreferrer" className={s.open}>Open {host}<ExternalIcon /></a>
          )}
        </div>
        <div className={s.card}>
          {login.username && (
            <>
              <div className={s.row}>
                <div className={s.rowText}>
                  <span className={s.label}>Username or email</span>
                  <span className={s.value}>{login.username}</span>
                </div>
                <button type="button" className={s.rowButton} aria-label={`Copy ${login.name} username`} onClick={() => void copyUsername()}><CopyIcon /></button>
              </div>
              <div className={s.divider} />
            </>
          )}
          <div className={s.row}>
            <div className={s.rowText}>
              <span className={s.label}>Password</span>
              {revealed ? (
                <>
                  <span className={s.password}><PasswordText password={login.password} /></span>
                  <span className={s.hint}>Hides again in 30&#160;s</span>
                </>
              ) : (
                <span className={s.dots} aria-label="Password hidden">{HIDDEN_DOTS}</span>
              )}
            </div>
            <button type="button" className={s.rowButton} aria-label={revealed ? 'Hide password' : 'Show password'} onClick={() => setRevealed(!revealed)}>
              {revealed ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
            </button>
            <button type="button" className={s.rowButton} aria-label={`Copy ${login.name} password`} onClick={() => void copyPassword()}><KeyIcon /></button>
          </div>
          {login.url && (
            <>
              <div className={s.divider} />
              <div className={s.row}>
                <div className={s.rowText}>
                  <span className={s.label}>Website</span>
                  <span className={s.url}>{login.url}</span>
                </div>
                {openUrl && (
                  <a href={openUrl} target="_blank" rel="noreferrer" className={s.rowButton} aria-label={`Open ${host} in the browser`}><ExternalIcon size={20} /></a>
                )}
              </div>
            </>
          )}
        </div>
        <p className={s.meta}>Changed {displayDateTime(login.updatedAt)} · Added {displayDateTime(login.createdAt, false)}</p>
      </div>
    </div>
  );
}
