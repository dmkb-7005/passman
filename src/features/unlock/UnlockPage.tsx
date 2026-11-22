import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { FieldMessage, formStyles, PasswordField } from '../../components/form/Form';
import { KeyIcon, LockIcon } from '../../components/icons';
import { NightRidges } from '../../components/NightRidges';
import { VaultFormatError, WrongSecretError } from '../../crypto/vaultFile';
import { useVault, type LockInfo } from '../../vault/VaultProvider';
import s from './Unlock.module.css';

function lockedText(info: LockInfo): string | null {
  if (!info) return null;
  if (info.kind === 'idle') return `Locked after ${info.minutes} ${info.minutes === 1 ? 'minute' : 'minutes'} without use`;
  if (info.kind === 'background') return 'Locked when PassMan went to the background';
  return null;
}

/** The most frequent screen (brief 02): field focused, one tap or Enter to unlock. */
export function UnlockPage() {
  const vault = useVault();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const status = lockedText(vault.lockInfo);

  useEffect(() => {
    field.current?.focus();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      await vault.unlock(password);
      // the router continues to the requested screen
    } catch (err) {
      setBusy(false);
      setError(err instanceof WrongSecretError ? 'Wrong master password' : err instanceof VaultFormatError ? err.message : 'PassMan couldn’t open the vault on this device');
      requestAnimationFrame(() => field.current?.select());
    }
  }

  return (
    <div className={s.screen}>
      <NightRidges />
      <form className={s.form} onSubmit={(e) => void submit(e)}>
        <div className={s.top}>
          <div className={s.hero}>
            <div role="img" aria-label="PassMan" className={s.mark}><KeyIcon size={30} /></div>
            <h1 className={s.name}>PassMan</h1>
            <div className={s.status}>{status && <><LockIcon size={14} /><span>{status}</span></>}</div>
          </div>
          <div className={s.fields}>
            <PasswordField
              label="Master password"
              value={password}
              onChange={(v) => {
                setPassword(v);
                if (error) setError(null);
              }}
              autoComplete="current-password"
              inputRef={field}
              disabled={busy}
              error={error !== null}
            />
            {error ? <FieldMessage kind="error">{error}</FieldMessage> : <FieldMessage />}
          </div>
        </div>
        {/* pinned to the bottom, so on the phone it rides up with the keyboard (like Save on the form screens) */}
        <div className={s.dock}>
          <button type="submit" className={formStyles.primary} disabled={!password && !busy} aria-busy={busy}>
            {busy ? <><span className={formStyles.spinner} aria-hidden="true" />Unlocking…</> : 'Unlock'}
          </button>
          <button type="button" className={formStyles.textLink} onClick={() => navigate('/recover')}>Forgot it? Use your recovery key</button>
          <div className={s.enterHint}>Press Enter to unlock</div>
        </div>
      </form>
    </div>
  );
}
