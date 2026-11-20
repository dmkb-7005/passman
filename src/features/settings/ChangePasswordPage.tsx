import { useState, type FormEvent } from 'react';
import { FieldMessage, FormScreen, formStyles, Note, PasswordField, RequirementLine } from '../../components/form/Form';
import { useSnackbar } from '../../components/Snackbar';
import { WrongSecretError } from '../../crypto/vaultFile';
import { masterPasswordProblem, MASTER_PASSWORD_MIN, passwordLength } from '../../domain/masterPassword';
import { useVault } from '../../vault/VaultProvider';
import { useGoBack } from '../logins/LoginDetailPage';

/** Settings › Change master password (brief 07). */
export function ChangePasswordPage() {
  const vault = useVault();
  const snackbar = useSnackbar();
  const goBack = useGoBack('/settings');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [wrongCurrent, setWrongCurrent] = useState(false);
  const [busy, setBusy] = useState(false);

  const mismatch = confirm.length > 0 && confirm.length >= next.length && confirm.normalize('NFC') !== next.normalize('NFC');
  const ready = current.length > 0 && masterPasswordProblem(next, confirm) === null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    try {
      await vault.changePassword(current, next);
      snackbar.show({ message: 'Master password changed' });
      goBack();
    } catch (err) {
      setBusy(false);
      if (err instanceof WrongSecretError) setWrongCurrent(true);
      else snackbar.show({ message: "The password couldn't be changed. Try again.", icon: 'info' });
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)}>
      <FormScreen
        title="Change master password"
        onBack={goBack}
        footer={
          <button type="submit" className={formStyles.primary} disabled={!ready && !busy} aria-busy={busy}>
            {busy ? <><span className={formStyles.spinner} aria-hidden="true" />Changing…</> : 'Change password'}
          </button>
        }
      >
        {wrongCurrent ? <Note kind="error">That isn&#8217;t your current master password.</Note> : <Note kind="info">Your other devices accept the old password until they sync.</Note>}
        <div className={formStyles.fieldGroup}>
          <PasswordField
            label="Current master password"
            value={current}
            onChange={(v) => {
              setCurrent(v);
              setWrongCurrent(false);
            }}
            autoComplete="current-password"
            autoFocus
            error={wrongCurrent}
            selectOnError
            disabled={busy}
          />
        </div>
        <div className={formStyles.fieldGroup}>
          <PasswordField label="New master password" value={next} onChange={setNext} autoComplete="new-password" disabled={busy} />
          <RequirementLine met={passwordLength(next) >= MASTER_PASSWORD_MIN} />
        </div>
        <div className={formStyles.fieldGroup}>
          <PasswordField label="Type the new one again" value={confirm} onChange={setConfirm} autoComplete="new-password" showToggle={false} error={mismatch} disabled={busy} />
          {mismatch ? <FieldMessage kind="error">The two passwords don&#8217;t match. Check the second one.</FieldMessage> : <FieldMessage />}
        </div>
      </FormScreen>
    </form>
  );
}
