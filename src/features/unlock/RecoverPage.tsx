import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FieldMessage, FormScreen, formStyles, PasswordField, RequirementLine, StepIndicator } from '../../components/form/Form';
import { CheckIcon } from '../../components/icons';
import { useSnackbar } from '../../components/Snackbar';
import { InvalidRecoveryKeyError } from '../../crypto/recoveryKey';
import { WrongSecretError } from '../../crypto/vaultFile';
import { masterPasswordProblem, MASTER_PASSWORD_MIN, passwordLength } from '../../domain/masterPassword';
import { useVault } from '../../vault/VaultProvider';
import s from './Unlock.module.css';

/** What the field shows: upper case, look-alikes fixed (O→0, I/L→1), a dash after every 4 characters. */
export function formatRecoveryInput(text: string): string {
  const clean = text
    .toUpperCase()
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/[^0-9A-Z]/g, '')
    .slice(0, 32);
  return clean.match(/.{1,4}/g)?.join('-') ?? '';
}

type KeyProblem = 'invalid' | 'wrong-vault' | null;

/** Forgotten master password (brief 02): recovery key, then a new master password. */
export function RecoverPage() {
  const vault = useVault();
  const navigate = useNavigate();
  const snackbar = useSnackbar();
  const id = useId();
  // restoring a backup on Welcome with its recovery key: the key is already checked, go straight to the new password
  const given = vault.recoveryHandoff?.recoveryKey ?? (useLocation().state as { recoveryKey?: string } | null)?.recoveryKey;
  const [step, setStep] = useState<1 | 2>(given ? 2 : 1);
  const [key, setKey] = useState(given ?? '');
  const [problem, setProblem] = useState<KeyProblem>(null);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const keyField = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (step === 1) keyField.current?.focus();
  }, [step]);

  // taken over from installVault: from now on "back" leads to Unlock as usual
  const { clearRecoveryHandoff } = vault;
  useEffect(() => clearRecoveryHandoff(), [clearRecoveryHandoff]);

  const complete = key.replace(/-/g, '').length === 32;

  async function checkKey(e: FormEvent) {
    e.preventDefault();
    if (!complete || busy) return;
    setBusy(true);
    try {
      await vault.checkRecoveryKey(key);
      setStep(2);
    } catch (err) {
      setProblem(err instanceof InvalidRecoveryKeyError ? 'invalid' : err instanceof WrongSecretError ? 'wrong-vault' : 'invalid');
    } finally {
      setBusy(false);
    }
  }

  async function setNewPassword(e: FormEvent) {
    e.preventDefault();
    if (masterPasswordProblem(password, confirm) || busy) return;
    setBusy(true);
    try {
      await vault.recover(key, password);
      snackbar.show({ message: 'New master password set. Use it on your other devices after they sync.' });
    } catch {
      setBusy(false);
      setStep(1);
      setProblem('wrong-vault');
    }
  }

  if (step === 2) {
    const mismatch = confirm.length > 0 && confirm.length >= password.length && confirm.normalize('NFC') !== password.normalize('NFC');
    return (
      <form onSubmit={(e) => void setNewPassword(e)}>
        <FormScreen
          title="Use recovery key"
          backLabel="Back to the recovery key"
          onBack={() => setStep(1)}
          footer={
            <button type="submit" className={formStyles.primary} disabled={masterPasswordProblem(password, confirm) !== null && !busy} aria-busy={busy}>
              {busy ? <><span className={formStyles.spinner} aria-hidden="true" />Setting the password…</> : 'Set new password'}
            </button>
          }
        >
          <StepIndicator step={2} total={2} />
          <div className={formStyles.badgeOk}><CheckIcon size={14} />Recovery key accepted</div>
          <div className={formStyles.intro}>
            <h1 className={formStyles.title}>Choose a new master password</h1>
            <p className={formStyles.lead}>Your logins are untouched. Your other devices accept the new password after they sync.</p>
          </div>
          <div className={formStyles.fieldGroup}>
            <PasswordField label="New master password" value={password} onChange={setPassword} autoComplete="new-password" autoFocus disabled={busy} />
            <RequirementLine met={passwordLength(password) >= MASTER_PASSWORD_MIN} />
          </div>
          <div className={formStyles.fieldGroup}>
            <PasswordField label="Type it again" value={confirm} onChange={setConfirm} autoComplete="new-password" showToggle={false} error={mismatch} disabled={busy} />
            {mismatch ? <FieldMessage kind="error">The two passwords don&#8217;t match. Check the second one.</FieldMessage> : <FieldMessage />}
          </div>
        </FormScreen>
      </form>
    );
  }

  return (
    <form onSubmit={(e) => void checkKey(e)}>
      <FormScreen
        title="Use recovery key"
        backLabel="Back to unlock"
        onBack={() => navigate('/unlock', { replace: true })}
        footer={<button type="submit" className={formStyles.primary} disabled={!complete || busy}>Continue</button>}
      >
        <StepIndicator step={1} total={2} />
        <div className={formStyles.intro}>
          <h1 className={formStyles.title}>Enter your recovery key</h1>
          <p className={formStyles.lead}>Enter the recovery key you saved when you created your vault. Then choose a new master password.</p>
        </div>
        <div className={formStyles.fieldGroup}>
          <div className={formStyles.fieldGroup}>
            <label htmlFor={id} className={formStyles.label}>Recovery key</label>
            <textarea
              ref={keyField}
              id={id}
              rows={2}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
              className={`${s.keyArea} ${problem ? s.keyAreaError : ''}`}
              value={key}
              onChange={(e) => {
                setKey(formatRecoveryInput(e.target.value));
                setProblem(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void checkKey(e);
                }
              }}
            />
          </div>
          {problem === 'invalid' ? (
            <FieldMessage kind="error" height={40} lead={<>That isn&#8217;t a valid recovery key.</>}>Check for a missing, extra or wrong character.</FieldMessage>
          ) : problem === 'wrong-vault' ? (
            <FieldMessage kind="error" height={40} lead={<>This recovery key doesn&#8217;t open this vault.</>}>If you made a new key in Settings, use that one.</FieldMessage>
          ) : (
            <FieldMessage kind="hint" height={40}>Upper or lower case, with or without dashes. Mix-ups like O and 0 or I and 1 are fixed as you type.</FieldMessage>
          )}
        </div>
      </FormScreen>
    </form>
  );
}
