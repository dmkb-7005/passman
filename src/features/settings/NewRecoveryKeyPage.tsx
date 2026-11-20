import { useState, type FormEvent } from 'react';
import { ConfirmDialog, FieldMessage, FormScreen, formStyles, PasswordField } from '../../components/form/Form';
import { WarnIcon } from '../../components/icons';
import { lastGroupMatches, RecoveryKeyPanel } from '../../components/recovery/RecoveryKey';
import { useSnackbar } from '../../components/Snackbar';
import { WrongSecretError, type VaultFile } from '../../crypto/vaultFile';
import { useVault } from '../../vault/VaultProvider';
import { useGoBack } from '../logins/LoginDetailPage';

/** Settings › New recovery key (brief 07). The new key only replaces the old one once it is confirmed. */
export function NewRecoveryKeyPage() {
  const vault = useVault();
  const snackbar = useSnackbar();
  const goBack = useGoBack('/settings');
  const [password, setPassword] = useState('');
  const [wrong, setWrong] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ file: VaultFile; recoveryKey: string; createdAt: Date } | null>(null);
  const [typed, setTyped] = useState('');
  const [leaving, setLeaving] = useState(false);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    try {
      setPending(await vault.prepareRecoveryKey(password));
      setTyped('');
    } catch (err) {
      if (err instanceof WrongSecretError) setWrong(true);
      else snackbar.show({ message: "The recovery key couldn't be created. Try again.", icon: 'info' });
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!pending) return;
    await vault.commitRecoveryKey(pending.file);
    snackbar.show({ message: 'New recovery key saved. The old one stops working once your devices sync.' });
    goBack();
  }

  if (pending) {
    const confirmed = typed.length === 4 && lastGroupMatches(pending.recoveryKey, typed);
    return (
      <FormScreen
        title="New recovery key"
        onBack={() => setLeaving(true)}
        footer={<button type="button" className={formStyles.primary} disabled={!confirmed} onClick={() => void confirm()}>I&#8217;ve saved it, continue</button>}
      >
        <h1 className={formStyles.title}>Save your new recovery key</h1>
        <RecoveryKeyPanel
          keyText={pending.recoveryKey}
          createdAt={pending.createdAt}
          advice="Print it or write it down. Keep it with your important papers, not on this device. Destroy the old one."
          typed={typed}
          onTyped={setTyped}
        />
        {leaving && (
          <ConfirmDialog
            icon={<WarnIcon size={24} />}
            title="Leave without saving the new key?"
            text="Your current recovery key keeps working. You can create a new one at any time."
            dangerLabel="Leave"
            onDanger={() => {
              setLeaving(false);
              goBack();
            }}
            safeLabel="Stay"
            onSafe={() => setLeaving(false)}
          />
        )}
      </FormScreen>
    );
  }

  return (
    <form onSubmit={(e) => void create(e)}>
      <FormScreen
        title="New recovery key"
        onBack={goBack}
        footer={
          <button type="submit" className={formStyles.primary} disabled={!password && !busy} aria-busy={busy}>
            {busy ? <><span className={formStyles.spinner} aria-hidden="true" />Creating…</> : 'Create new recovery key'}
          </button>
        }
      >
        <div className={`${formStyles.note} ${formStyles.noteWarn}`}>
          <span className={formStyles.noteIcon}><WarnIcon /></span>
          <span><b>Your current recovery key stops working</b> once your devices sync.</span>
        </div>
        <p className={formStyles.lead}>Enter your master password to create a new recovery key. You&#8217;ll see it once, so have paper or a printer ready.</p>
        <div className={formStyles.fieldGroup}>
          <PasswordField
            label="Master password"
            value={password}
            onChange={(v) => {
              setPassword(v);
              setWrong(false);
            }}
            autoComplete="current-password"
            autoFocus
            error={wrong}
            selectOnError
            disabled={busy}
          />
          {wrong && <FieldMessage kind="error">Wrong master password</FieldMessage>}
        </div>
      </FormScreen>
    </form>
  );
}
