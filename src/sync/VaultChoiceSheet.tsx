import { useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { syncedLabel } from '../app/format';
import sheet from '../components/BottomSheet.module.css';
import { FieldMessage, formStyles, Note, PasswordField } from '../components/form/Form';
import { WarnIcon } from '../components/icons';
import { WrongSecretError } from '../crypto/vaultFile';
import type { Login } from '../domain/logins';
import type { VaultChoice } from './SyncProvider';
import s from './Sync.module.css';

const logins = (n: number) => (n === 1 ? 'login' : 'logins');
const are = (n: number) => (n === 1 ? 'is' : 'are');

/**
 * "Dropbox already has a vault" (brief 08 · 2): another vault (another vault id) is in Dropbox. Only one can sync,
 * and the user decides which. The Dropbox vault's login count is unknown until it is unlocked (it has its own key).
 */
export function VaultChoiceSheet({
  choice,
  localLogins,
  onUseDropbox,
  onKeepDevice,
  onCancel,
}: {
  choice: VaultChoice;
  localLogins: Login[];
  onUseDropbox: (password: string) => Promise<void>;
  onKeepDevice: () => Promise<'ok' | 'changed'>;
  onCancel: () => void;
}) {
  const [pick, setPick] = useState<'dropbox' | 'device'>('dropbox');
  const [step, setStep] = useState<'choose' | 'password'>('choose');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const count = localLogins.length;
  const lastChange = localLogins.reduce<string | null>((max, l) => (max === null || l.updatedAt > max ? l.updatedAt : max), null);

  async function confirm() {
    if (pick === 'dropbox') {
      setStep('password');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if ((await onKeepDevice()) === 'changed') setError('The vault in Dropbox changed meanwhile. Close this and sync again.');
    } catch {
      setError('PassMan couldn’t replace the vault in Dropbox. Check the connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function unlock(e: FormEvent) {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onUseDropbox(password);
    } catch (err) {
      setBusy(false);
      setError(err instanceof WrongSecretError ? 'Wrong master password' : 'PassMan couldn’t open the vault from Dropbox');
    }
  }

  return createPortal(
    <div className={sheet.backdrop}>
      <div className={sheet.sheet} role="dialog" aria-modal="true" aria-labelledby="vault-choice-title">
        <div className={sheet.handleArea} aria-hidden="true"><span className={sheet.handle} /></div>
        {step === 'choose' ? (
          <>
            <div className={s.choiceBody}>
              <div className={s.choiceHead}>
                <span className={s.warnCircle}><WarnIcon size={24} /></span>
                <h2 id="vault-choice-title" className={s.choiceTitle}>Dropbox already has a vault</h2>
              </div>
              <p className={s.lead}>Only one vault can sync. Choose which one to keep.</p>
              <div className={s.facts}>
                <div className={s.fact}>
                  <span className={s.factLabel}>This device</span>
                  <span className={s.factMain}><span className={s.factNum}>{count}</span> {logins(count)}</span>
                  <span className={s.factSub}>{lastChange ? `Changed ${syncedLabel(lastChange)}` : 'No changes yet'}</span>
                </div>
                <div className={s.fact}>
                  <span className={s.factLabel}>Dropbox</span>
                  <span className={s.factMain}>Another vault</span>
                  <span className={s.factSub}>Changed {syncedLabel(choice.meta.serverModified, false)}</span>
                </div>
              </div>
              <div role="radiogroup" aria-labelledby="vault-choice-title" className={s.options}>
                <button type="button" role="radio" aria-checked={pick === 'dropbox'} className={`${s.option} ${pick === 'dropbox' ? s.optionOn : ''}`} onClick={() => setPick('dropbox')}>
                  <span aria-hidden="true" className={s.radio}>{pick === 'dropbox' && <span className={s.dot} />}</span>
                  <span className={s.optionText}>
                    <span className={s.optionTitle}>Use the vault in Dropbox</span>
                    <span className={s.optionSub}>This device&#8217;s {count} {logins(count)} {are(count)} replaced.</span>
                    <span className={s.tag}>Recommended for a second device</span>
                  </span>
                </button>
                <button type="button" role="radio" aria-checked={pick === 'device'} className={`${s.option} ${s.optionDanger} ${pick === 'device' ? s.optionOn : ''}`} onClick={() => setPick('device')}>
                  <span aria-hidden="true" className={s.radio}>{pick === 'device' && <span className={s.dot} />}</span>
                  <span className={s.optionText}>
                    <span className={s.optionTitle}>Keep this device&#8217;s vault</span>
                    <span className={s.optionSub}>The vault in Dropbox is replaced on all devices.</span>
                  </span>
                </button>
              </div>
              {pick === 'device' && (
                <Note kind="warn"><b>The vault in Dropbox will be replaced</b> by this device&#8217;s {count} {logins(count)}, on all your devices. This can&#8217;t be undone.</Note>
              )}
              {error && <Note kind="error">{error}</Note>}
            </div>
            <div className={s.actions}>
              <button type="button" className={`${formStyles.primary} ${pick === 'device' ? s.dangerPrimary : ''}`} disabled={busy} aria-busy={busy} onClick={() => void confirm()}>
                {busy ? <><span className={formStyles.spinner} aria-hidden="true" />Replacing…</> : pick === 'device' ? 'Replace the vault in Dropbox' : 'Use the vault in Dropbox'}
              </button>
              <button type="button" className={s.cancel} disabled={busy} onClick={onCancel}>Cancel</button>
            </div>
          </>
        ) : (
          <form onSubmit={(e) => void unlock(e)}>
            <div className={s.choiceBody}>
              <h2 id="vault-choice-title" className={s.choiceTitle}>Unlock the vault in Dropbox</h2>
              <p className={s.lead}>Enter the master password of the vault in Dropbox. This device&#8217;s {count} {logins(count)} {are(count)} replaced by it.</p>
              <div className={formStyles.fieldGroup}>
                <PasswordField label="Master password" value={password} onChange={(v) => { setPassword(v); setError(null); }} autoComplete="current-password" autoFocus disabled={busy} error={error !== null} />
                {error ? <FieldMessage kind="error">{error}</FieldMessage> : <FieldMessage />}
              </div>
            </div>
            <div className={s.actions}>
              <button type="submit" className={formStyles.primary} disabled={!password && !busy} aria-busy={busy}>
                {busy ? <><span className={formStyles.spinner} aria-hidden="true" />Unlocking…</> : 'Unlock'}
              </button>
              <button type="button" className={s.cancel} disabled={busy} onClick={() => { setStep('choose'); setError(null); }}>Back</button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
