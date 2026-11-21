import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { syncedLabel } from '../../app/format';
import { backupFileName, encodeBackup, readBackup, saveFile } from '../../backup/backupFile';
import { FieldMessage, FormScreen, formStyles, Note, PasswordField, StepIndicator } from '../../components/form/Form';
import { CheckIcon, CloudIcon, EditIcon, FileIcon, MinusCircleIcon, RestoreIcon } from '../../components/icons';
import { deriveKeyInWorker } from '../../crypto/kdfWorkerClient';
import { InvalidRecoveryKeyError } from '../../crypto/recoveryKey';
import { openWithPassword, openWithRecoveryKey, WrongSecretError, type VaultFile } from '../../crypto/vaultFile';
import type { Entry } from '../../domain/logins';
import { planRestore, type RestorePlan } from '../../domain/restore';
import { useSync } from '../../sync/SyncProvider';
import { useVault } from '../../vault/VaultProvider';
import { formatRecoveryInput } from '../unlock/RecoverPage';
import u from '../unlock/Unlock.module.css';
import t from '../shared/TabScreen.module.css';
import s from './Restore.module.css';

const TITLE = 'Restore from backup';

type Step =
  | { kind: 'choose'; error?: ReactNode }
  | { kind: 'unlock'; fileName: string; file: VaultFile }
  | { kind: 'summary'; fileName: string; backup: Entry[]; plan: RestorePlan }
  | { kind: 'done'; restored?: number; plan?: RestorePlan; safetyCopy?: string };

const Num = ({ children }: { children: ReactNode }) => <span className={s.num}>{children}</span>;
const logins = (n: number) => (n === 1 ? 'login' : 'logins');

/**
 * Restore from backup (brief 10). With a vault (Settings): the logins become the backup's, one change that syncs.
 * Without (Welcome): the backup becomes this device's vault.
 */
export function RestorePage() {
  const vault = useVault();
  const sync = useSync();
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  // Welcome: unlocking the backup switches the app to "unlocked", which mounts this page again with this state
  const welcomeDone = (useLocation().state as { restoredOnWelcome?: boolean } | null)?.restoredOnWelcome === true;
  // the mode this page started in: restoring on Welcome unlocks the vault while the page stays on screen
  const [replacing] = useState(() => vault.status === 'unlocked' && !welcomeDone);
  const [step, setStep] = useState<Step>(() => (welcomeDone ? { kind: 'done' } : { kind: 'choose' }));
  const total = replacing ? 3 : 2;
  const [busy, setBusy] = useState(false);
  const [useKey, setUseKey] = useState(false);
  const [password, setPassword] = useState('');
  const [key, setKey] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const passwordField = useRef<HTMLInputElement>(null);
  const keyField = useRef<HTMLTextAreaElement>(null);
  const keyId = useId();

  useEffect(() => {
    if (step.kind !== 'unlock') return;
    (useKey ? keyField.current : passwordField.current)?.focus();
  }, [step.kind, useKey]);

  const back = () => navigate(replacing ? '/settings' : '/welcome', { replace: true });
  const pickFile = () => {
    if (input.current) input.current.value = '';
    input.current?.click();
  };

  function toSummary(fileName: string, backup: Entry[]) {
    setStep({ kind: 'summary', fileName, backup, plan: planRestore(vault.logins, backup) });
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    const name = <b>{picked.name}</b>;
    let text: string;
    try {
      text = await picked.text();
    } catch {
      setStep({ kind: 'choose', error: <>PassMan couldn&#8217;t read {name}. Choose the file again.</> });
      return;
    }
    const read = readBackup(text, picked.size);
    if (!read.ok) {
      const error =
        read.problem === 'newer-version' ? <>{name} was made by a newer version of PassMan. Update PassMan first.</> :
        read.problem === 'damaged' ? <>{name} is damaged and can&#8217;t be opened.</> :
        <>{name} isn&#8217;t a PassMan backup. Choose a file named <b>passman-backup-….json.txt</b>.</>;
      setStep({ kind: 'choose', error });
      return;
    }
    setPassword('');
    setKey('');
    setProblem(null);
    setUseKey(false);
    if (replacing) {
      const own = await vault.openOwnBackup(read.file).catch(() => null);
      if (own) return toSummary(picked.name, own);
    }
    setStep({ kind: 'unlock', fileName: picked.name, file: read.file });
  }

  async function unlockBackup(e: FormEvent) {
    e.preventDefault();
    if (step.kind !== 'unlock' || busy) return;
    const secret = useKey ? key : password;
    if (useKey ? key.replace(/-/g, '').length !== 32 : !password) return;
    setBusy(true);
    setProblem(null);
    try {
      if (!replacing && !useKey) {
        // Welcome: the backup becomes this device's vault
        await vault.adoptVault(step.file, password);
        setBusy(false);
        setStep({ kind: 'done' });
        navigate('/restore', { replace: true, state: { restoredOnWelcome: true } });
        return;
      }
      const opened = useKey ? await openWithRecoveryKey(step.file, secret, deriveKeyInWorker) : await openWithPassword(step.file, secret, deriveKeyInWorker);
      if (!replacing) {
        // Welcome with the recovery key: store the backup, then choose a new master password
        await vault.installVault(step.file, { recoveryKey: key });
        return; // the app continues in Recover with the new master password step
      }
      setBusy(false);
      toSummary(step.fileName, opened.payload.logins);
    } catch (err) {
      setBusy(false);
      if (useKey) {
        setProblem(err instanceof InvalidRecoveryKeyError ? 'invalid' : 'wrong');
      } else {
        setProblem(err instanceof WrongSecretError ? 'wrong' : 'other');
        requestAnimationFrame(() => passwordField.current?.select());
      }
    }
  }

  async function replaceAll() {
    if (step.kind !== 'summary' || busy) return;
    setBusy(true);
    try {
      const current = vault.sync.current();
      const safetyCopy = backupFileName(new Date(), 'before-restore');
      if (current) await saveFile(safetyCopy, encodeBackup(current.file), false);
      await vault.restoreLogins(step.backup);
      setStep({ kind: 'done', restored: step.plan.backupCount, plan: step.plan, safetyCopy });
    } catch {
      setBusy(false);
    }
  }

  const fileInput = <input ref={input} type="file" accept=".txt,.json,text/plain,application/json" className={s.hiddenInput} onChange={(e) => void onFile(e)} />;

  // ---------- choose ----------
  if (step.kind === 'choose') {
    const count = vault.logins.length;
    return (
      <FormScreen
        title={TITLE}
        onBack={back}
        footer={<button type="button" className={`${formStyles.primary} ${s.iconButton}`} onClick={pickFile}><FileIcon />{step.error ? 'Choose another file' : 'Choose backup file'}</button>}
      >
        {fileInput}
        <StepIndicator step={1} total={total} />
        <div className={formStyles.intro}>
          <h1 className={formStyles.title}>Choose a backup file</h1>
          <p className={formStyles.lead}>Pick a PassMan backup (<span className={s.num}>passman-backup-….json.txt</span>).</p>
        </div>
        {replacing ? (
          <Note kind="warn">
            <b className={s.warn}>Restoring replaces all <Num>{count}</Num> {logins(count)} on this device</b> with the ones in the backup.
            {sync.connection ? ' Your other devices get the same logins at their next sync.' : ''}
          </Note>
        ) : (
          <Note kind="info">The backup becomes this device&#8217;s vault. It opens with the master password or recovery key that were current when it was made.</Note>
        )}
        {step.error && <Note kind="error">{step.error}</Note>}
      </FormScreen>
    );
  }

  // ---------- unlock ----------
  if (step.kind === 'unlock') {
    const ready = useKey ? key.replace(/-/g, '').length === 32 : password.length > 0;
    return (
      <form onSubmit={(e) => void unlockBackup(e)}>
        <FormScreen
          title={TITLE}
          onBack={() => setStep({ kind: 'choose' })}
          footer={
            <button type="submit" className={formStyles.primary} disabled={!ready && !busy} aria-busy={busy}>
              {busy ? <><span className={formStyles.spinner} aria-hidden="true" />Unlocking…</> : 'Unlock backup'}
            </button>
          }
        >
          <StepIndicator step={2} total={total} />
          <div className={s.titleBlock}>
            <h1 className={formStyles.title}>Unlock the backup</h1>
            <div className={s.fileLine}><FileIcon size={16} /><span className={s.fileName}>{step.fileName}</span></div>
          </div>
          <p className={formStyles.lead}>Enter the {useKey ? 'recovery key' : 'master password'} that was current when this backup was made.</p>
          {useKey ? (
            <div className={formStyles.fieldGroup}>
              <div className={formStyles.fieldGroup}>
                <label htmlFor={keyId} className={formStyles.label}>Recovery key</label>
                <textarea
                  ref={keyField}
                  id={keyId}
                  rows={2}
                  spellCheck={false}
                  autoComplete="off"
                  autoCapitalize="characters"
                  placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                  className={`${u.keyArea} ${problem ? u.keyAreaError : ''}`}
                  value={key}
                  disabled={busy}
                  onChange={(e) => {
                    setKey(formatRecoveryInput(e.target.value));
                    setProblem(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void unlockBackup(e);
                    }
                  }}
                />
              </div>
              {problem === 'invalid' ? (
                <FieldMessage kind="error" height={40} lead={<>That isn&#8217;t a valid recovery key.</>}>Check for a missing, extra or wrong character.</FieldMessage>
              ) : problem ? (
                <FieldMessage kind="error" height={40} lead={<>This recovery key doesn&#8217;t open this backup.</>}>Use the key that was current when it was made.</FieldMessage>
              ) : (
                <FieldMessage height={40} />
              )}
            </div>
          ) : (
            <div className={formStyles.fieldGroup}>
              <PasswordField
                label="Master password"
                value={password}
                onChange={(v) => {
                  setPassword(v);
                  setProblem(null);
                }}
                autoComplete="off"
                inputRef={passwordField}
                disabled={busy}
                error={problem !== null}
              />
              {problem ? <FieldMessage kind="error">{problem === 'wrong' ? 'Wrong master password' : 'PassMan couldn’t open this backup'}</FieldMessage> : <FieldMessage />}
            </div>
          )}
          <button
            type="button"
            className={s.switchLink}
            disabled={busy}
            onClick={() => {
              setUseKey(!useKey);
              setProblem(null);
            }}
          >
            {useKey ? 'Use the master password instead' : 'Use the recovery key instead'}
          </button>
        </FormScreen>
      </form>
    );
  }

  // ---------- summary ----------
  if (step.kind === 'summary') {
    const { plan } = step;
    const fact = (label: string, n: number, last: string | null) => (
      <div className={s.fact}>
        <span className={s.factLabel}>{label}</span>
        <span className={s.factMain}><span className={s.factNum}>{n}</span> {logins(n)}</span>
        <span className={s.factSub}>{last ? `Last change ${syncedLabel(last, false)}` : 'No logins'}</span>
      </div>
    );
    return (
      <FormScreen
        title={TITLE}
        onBack={() => setStep({ kind: 'choose' })}
        footer={
          plan.same ? (
            <button type="button" className={formStyles.primary} onClick={back}>Done</button>
          ) : (
            <div className={s.footerStack}>
              <button type="button" className={`${formStyles.primary} ${s.dangerPrimary}`} disabled={busy} aria-busy={busy} onClick={() => void replaceAll()}>
                {busy ? <><span className={formStyles.spinner} aria-hidden="true" />Restoring…</> : 'Replace all logins'}
              </button>
              <button type="button" className={s.cancel} disabled={busy} onClick={back}>Cancel</button>
            </div>
          )
        }
      >
        <StepIndicator step={3} total={3} />
        <div className={s.titleBlock}>
          <h1 className={formStyles.title}>{plan.same ? 'Nothing to restore' : 'Replace all logins?'}</h1>
          <div className={s.fileLine}><FileIcon size={16} /><span className={s.fileName}>{step.fileName}</span></div>
        </div>
        <div className={s.facts}>
          {fact('Backup', plan.backupCount, plan.backupLastChange)}
          {fact('This vault now', plan.currentCount, plan.currentLastChange)}
        </div>
        {plan.same ? (
          <Note kind="success">The backup has the same logins as this vault. There&#8217;s nothing to restore.</Note>
        ) : (
          <>
            <div className={s.sectionLabel}>What changes</div>
            <ul className={`${t.glass} ${s.changes}`}>
              {plan.removed > 0 && <li><MinusCircleIcon /><span><Num>{plan.removed}</Num> {plan.removed === 1 ? 'login added since the backup is removed' : 'logins added since the backup are removed'}</span></li>}
              {plan.added > 0 && <li><RestoreIcon /><span><Num>{plan.added}</Num> {plan.added === 1 ? 'deleted login comes back' : 'deleted logins come back'}</span></li>}
              {plan.reverted > 0 && <li><EditIcon /><span><Num>{plan.reverted}</Num> {plan.reverted === 1 ? 'edited login goes' : 'edited logins go'} back to the backup&#8217;s version</span></li>}
            </ul>
            <Note kind="info">PassMan first saves a copy of your current vault (<span className={s.num}>{backupFileName(new Date(), 'before-restore')}</span>), so you can undo this by restoring that copy.</Note>
            {sync.connection && <div className={s.syncLine}><CloudIcon size={16} />Your other devices get the same logins at their next sync.</div>}
          </>
        )}
      </FormScreen>
    );
  }

  // ---------- done ----------
  const { plan } = step;
  const restored = step.restored ?? vault.logins.length;
  return (
    <FormScreen title={TITLE} footer={<button type="button" className={formStyles.primary} onClick={() => navigate('/', { replace: true })}>Go to my logins</button>}>
      <StepIndicator step={total} total={total} />
      <div role="status" className={s.hero}>
        <div className={s.heroCircle}><CheckIcon size={36} /></div>
        <h1 className={s.heroTitle}>Restored <Num>{restored}</Num> {logins(restored)}</h1>
        <p className={s.heroText}>
          {plan ? <><Num>{plan.removed}</Num> removed · <Num>{plan.added}</Num> back · <Num>{plan.reverted}</Num> restored to the backup&#8217;s version</> : 'This is now this device’s vault.'}
        </p>
      </div>
      {step.safetyCopy && (
        <div className={`${t.glass} ${s.copyCard}`}>
          <FileIcon size={18} />
          <div className={s.copyText}>
            <span>Copy of the previous vault saved</span>
            <span className={s.copyName}>{step.safetyCopy}</span>
            <span className={s.copyHint}>On Android it&#8217;s in Downloads.</span>
          </div>
        </div>
      )}
      {plan && sync.connection && <div className={s.syncLine}><CloudIcon size={16} />Your other devices get the same logins at their next sync.</div>}
      {!plan && <Note kind="info">To sync with your other devices, connect Dropbox in Settings.</Note>}
    </FormScreen>
  );
}
