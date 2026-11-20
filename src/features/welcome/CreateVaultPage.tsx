import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConfirmDialog, FieldMessage, FormScreen, formStyles, PasswordField, RequirementLine, StepIndicator } from '../../components/form/Form';
import { KeyIcon, WarnIcon } from '../../components/icons';
import { lastGroupMatches, RecoveryKeyPanel } from '../../components/recovery/RecoveryKey';
import { masterPasswordProblem, MASTER_PASSWORD_MIN, passwordLength } from '../../domain/masterPassword';
import { useVault, type PendingVault } from '../../vault/VaultProvider';
import s from './Welcome.module.css';

/** Create vault, steps 1–3 (brief 01). Nothing is stored until the recovery key is confirmed. */
export function CreateVaultPage() {
  const navigate = useNavigate();
  const vault = useVault();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState<PendingVault | null>(null);
  const [typed, setTyped] = useState('');
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 1) firstField.current?.focus();
  }, [step]);

  const longEnough = passwordLength(password) >= MASTER_PASSWORD_MIN;
  const mismatch = confirm.length > 0 && confirm.normalize('NFC') !== password.normalize('NFC') && confirm.length >= password.length;
  const problem = masterPasswordProblem(password, confirm);

  async function submitPassword(e: FormEvent) {
    e.preventDefault();
    if (problem) return;
    setStep(2);
    setError(null);
    try {
      const created = await vault.prepareVault(password);
      setPending(created);
      setTyped('');
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep(1);
    }
  }

  async function finish() {
    if (!pending) return;
    // The router moves on to "Your vault is ready" once the vault is stored.
    await vault.commitVault(pending);
  }

  if (step === 2) {
    return (
      <FormScreen title="New vault">
        <StepIndicator step={2} total={3} />
        <div role="status" className={s.securing}>
          <div className={s.ring}>
            <div className={s.ringTrack} />
            <div className={s.ringSpin} />
            <div className={s.ringCore}><KeyIcon size={36} /></div>
          </div>
          <div>
            <div className={s.securingTitle}>Securing your vault…</div>
            <div className={s.securingText}>This can take a few seconds on some phones.</div>
          </div>
        </div>
      </FormScreen>
    );
  }

  if (step === 3 && pending) {
    const confirmed = typed.length === 4 && lastGroupMatches(pending.recoveryKey, typed);
    return (
      <FormScreen
        title="New vault"
        backLabel="Back to step 1"
        onBack={() => setLeaving(true)}
        footer={<button type="button" className={formStyles.primary} disabled={!confirmed} onClick={() => void finish()}>I&#8217;ve saved it, continue</button>}
      >
        <StepIndicator step={3} total={3} />
        <h1 className={formStyles.title}>Save your recovery key</h1>
        <RecoveryKeyPanel
          keyText={pending.recoveryKey}
          createdAt={pending.createdAt}
          advice="Print it or write it down. Keep it with your important papers, not on this device."
          typed={typed}
          onTyped={setTyped}
        />
        {leaving && (
          <ConfirmDialog
            icon={<WarnIcon size={24} />}
            title="Leave without saving your recovery key?"
            text="Leaving discards the new vault. You’ll choose a master password again and get a new recovery key."
            dangerLabel="Leave"
            onDanger={() => {
              setLeaving(false);
              setPending(null);
              setStep(1);
            }}
            safeLabel="Stay"
            onSafe={() => setLeaving(false)}
          />
        )}
      </FormScreen>
    );
  }

  return (
    <form onSubmit={(e) => void submitPassword(e)}>
      <FormScreen
        title="New vault"
        onBack={() => navigate('/welcome')}
        footer={<button type="submit" className={formStyles.primary} disabled={problem !== null}>Continue</button>}
      >
        <StepIndicator step={1} total={3} />
        <div className={formStyles.intro}>
          <h1 className={formStyles.title}>Choose a master password</h1>
          <p className={formStyles.lead}>It unlocks PassMan on all your devices. It can&#8217;t be reset by anyone: if you forget it, only your recovery key gets you back in.</p>
        </div>
        <div className={formStyles.fieldGroup}>
          <PasswordField label="Master password" value={password} onChange={setPassword} autoComplete="new-password" inputRef={firstField} />
          <RequirementLine met={longEnough} />
        </div>
        <div className={formStyles.fieldGroup}>
          <PasswordField label="Type it again" value={confirm} onChange={setConfirm} autoComplete="new-password" showToggle={false} error={mismatch} />
          {mismatch ? <FieldMessage kind="error">The two passwords don&#8217;t match. Check the second one.</FieldMessage> : error ? <FieldMessage kind="error">{error}</FieldMessage> : <FieldMessage />}
        </div>
      </FormScreen>
    </form>
  );
}
