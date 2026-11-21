import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { syncedLabel } from '../../app/format';
import { FieldMessage, FormScreen, formStyles, Note, PasswordField, StepIndicator } from '../../components/form/Form';
import { CheckIcon, CloudIcon, ExternalIcon } from '../../components/icons';
import { WrongSecretError, type VaultFile } from '../../crypto/vaultFile';
import { DROPBOX_APP_KEY, tokenSource, type Tokens } from '../../sync/dropboxAuth';
import { createDropboxClient, DropboxError, VAULT_PATH, type RemoteMeta } from '../../sync/dropboxClient';
import { downloadVault, fileVersion } from '../../sync/syncEngine';
import { useSync } from '../../sync/SyncProvider';
import { useVault } from '../../vault/VaultProvider';
import w from './Welcome.module.css';

type View =
  | { kind: 'connect'; note?: { tone: 'warn' | 'error'; text: string } }
  | { kind: 'looking'; email?: string }
  | { kind: 'offline'; email?: string; message: string; retry: () => void }
  | { kind: 'found'; email: string; tokens: Tokens; file: VaultFile; meta: RemoteMeta }
  | { kind: 'none'; email: string; tokens: Tokens };

const OFFLINE = 'PassMan can’t reach Dropbox. Check the connection and try again.';

/** "Use my vault from Dropbox" (brief 08 · 1): sign in to Dropbox, find the vault, unlock it. */
export function DropboxJoinPage() {
  const vault = useVault();
  const sync = useSync();
  const navigate = useNavigate();
  const [view, setView] = useState<View>(() => (sync.redirectHandled && !sync.joinResult ? { kind: 'connect' } : { kind: 'looking' }));
  const [leaving, setLeaving] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);

  async function look(tokens: Tokens, email: string) {
    setView({ kind: 'looking', email });
    try {
      const api = createDropboxClient(tokenSource(DROPBOX_APP_KEY, tokens.refreshToken, tokens));
      const meta = await api.getMetadata(VAULT_PATH);
      if (!meta) {
        setView({ kind: 'none', email, tokens });
        return;
      }
      const remote = await downloadVault(api);
      setView({ kind: 'found', email, tokens, file: remote.file, meta: remote.meta });
    } catch (err) {
      const offline = err instanceof DropboxError && err.kind === 'network';
      setView({
        kind: 'offline',
        email,
        message: offline ? OFFLINE : err instanceof Error ? `${err.message}.` : 'Something went wrong.',
        retry: () => void look(tokens, email),
      });
    }
  }

  useEffect(() => {
    if (!sync.redirectHandled) return;
    const result = sync.joinResult;
    if (!result) {
      setView((v) => (v.kind === 'looking' && !v.email ? { kind: 'connect' } : v));
      return;
    }
    sync.clearJoinResult();
    if (result.kind === 'ok') void look(result.tokens, result.email);
    else if (result.kind === 'cancelled') setView({ kind: 'connect', note: { tone: 'warn', text: 'You cancelled the Dropbox sign-in. Nothing was changed.' } });
    else if (result.offline) setView({ kind: 'offline', message: OFFLINE, retry: () => setView({ kind: 'connect' }) });
    else setView({ kind: 'connect', note: { tone: 'error', text: result.message } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sync.redirectHandled, sync.joinResult]);

  useEffect(() => {
    if (view.kind === 'found') field.current?.focus();
  }, [view.kind]);

  async function signIn(anotherAccount = false) {
    setLeaving(true);
    try {
      await sync.beginJoin({ anotherAccount });
    } catch {
      setLeaving(false);
    }
  }

  async function unlock(e: FormEvent) {
    e.preventDefault();
    if (view.kind !== 'found' || !password || busy) return;
    setBusy(true);
    setError(null);
    try {
      await vault.adoptVault(view.file, password);
      sync.connectWhenUnlocked({ tokens: view.tokens, email: view.email, base: { rev: view.meta.rev, version: fileVersion(view.file) } });
      // unlocked: the router continues to the logins
    } catch (err) {
      setBusy(false);
      setError(err instanceof WrongSecretError ? 'Wrong master password' : 'PassMan couldn’t open the vault from Dropbox');
      requestAnimationFrame(() => field.current?.select());
    }
  }

  async function openRecovery() {
    if (view.kind !== 'found') return;
    await vault.installVault(view.file, {});
    sync.connectWhenUnlocked({ tokens: view.tokens, email: view.email, base: { rev: view.meta.rev, version: fileVersion(view.file) } });
    navigate('/recover', { replace: true });
  }

  const title = 'Use my vault from Dropbox';
  const backToStart = () => setView({ kind: 'connect' });

  if (view.kind === 'looking') {
    return (
      <FormScreen title={title}>
        <StepIndicator step={1} total={2} />
        <div role="status" className={w.securing}>
          <div className={w.ring}>
            <div className={w.ringTrack} />
            <div className={w.ringSpin} />
            <div className={w.ringCore}><CloudIcon size={36} /></div>
          </div>
          <div className={w.securingCopy}>
            <div className={w.securingTitle}>{view.email ? 'Looking for your vault…' : 'Connecting to Dropbox…'}</div>
            {view.email && <div className={w.securingText}>Connected to {view.email}</div>}
          </div>
        </div>
      </FormScreen>
    );
  }

  if (view.kind === 'offline') {
    return (
      <FormScreen title={title} onBack={backToStart} footer={<button type="button" className={formStyles.primary} onClick={view.retry}>Try again</button>}>
        <StepIndicator step={1} total={2} />
        <div className={formStyles.intro}>
          <h1 className={formStyles.title}>Couldn&#8217;t reach Dropbox</h1>
          {view.email && <p className={formStyles.lead}>Signed in as {view.email}.</p>}
        </div>
        <Note kind="error">{view.message}</Note>
      </FormScreen>
    );
  }

  if (view.kind === 'none') {
    return (
      <FormScreen
        title={title}
        onBack={backToStart}
        footer={
          <div className={w.footerStack}>
            <button type="button" className={`${formStyles.secondary} ${w.tallSecondary}`} disabled={leaving} onClick={() => void signIn(true)}><CloudIcon />Use another Dropbox account</button>
            <button
              type="button"
              className={w.accentLink}
              onClick={() => {
                sync.connectWhenUnlocked({ tokens: view.tokens, email: view.email });
                navigate('/welcome/create');
              }}
            >
              Create a new vault here
            </button>
          </div>
        }
      >
        <StepIndicator step={1} total={2} />
        <div className={formStyles.intro}><h1 className={formStyles.title}>No vault found</h1></div>
        <Note kind="warn">There&#8217;s no PassMan vault in this Dropbox ({view.email}) yet.</Note>
        <p className={formStyles.lead}>Connect Dropbox in Settings on the device that has your vault first, or start a new vault here.</p>
      </FormScreen>
    );
  }

  if (view.kind === 'found') {
    return (
      <form onSubmit={(e) => void unlock(e)}>
        <FormScreen
          title={title}
          onBack={backToStart}
          footer={
            <button type="submit" className={formStyles.primary} disabled={!password && !busy} aria-busy={busy}>
              {busy ? <><span className={formStyles.spinner} aria-hidden="true" />Unlocking…</> : 'Unlock'}
            </button>
          }
        >
          <StepIndicator step={2} total={2} />
          <div className={formStyles.badgeOk}><CheckIcon size={14} />Vault found</div>
          <div className={w.titleBlock}>
            <h1 className={formStyles.title}>Unlock your vault</h1>
            <p className={w.meta}>Last changed {syncedLabel(view.meta.serverModified)} in Dropbox ({view.email})</p>
          </div>
          <div className={formStyles.fieldGroup}>
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
          <button type="button" className={`${formStyles.textLink} ${w.linkStart}`} disabled={busy} onClick={() => void openRecovery()}>Forgot it? Use your recovery key</button>
        </FormScreen>
      </form>
    );
  }

  return (
    <FormScreen
      title={title}
      onBack={() => navigate('/welcome')}
      footer={
        <button type="button" className={formStyles.primary} disabled={leaving} onClick={() => void signIn()}>
          {leaving ? <><span className={formStyles.spinner} aria-hidden="true" />Opening Dropbox…</> : <>Continue to Dropbox<ExternalIcon size={18} /></>}
        </button>
      }
    >
      <StepIndicator step={1} total={2} />
      <div className={formStyles.intro}>
        <h1 className={formStyles.title}>Connect your Dropbox</h1>
        <p className={formStyles.lead}>Sign in to the Dropbox account where your other device keeps PassMan&#8217;s vault. PassMan only sees its own folder there, and everything in it is encrypted.</p>
      </div>
      {view.note && <Note kind={view.note.tone}>{view.note.text}</Note>}
      <Note kind="info">First device? Go back and choose <b className={w.strong}>Create a new vault</b>, then connect Dropbox in Settings.</Note>
    </FormScreen>
  );
}
