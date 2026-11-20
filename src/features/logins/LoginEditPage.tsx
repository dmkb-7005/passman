import { useRef, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog, FieldMessage, FormScreen, formStyles, PasswordField, TextField } from '../../components/form/Form';
import { DiceIcon, WarnIcon } from '../../components/icons';
import { useSnackbar } from '../../components/Snackbar';
import { validateLoginInput, type LoginField, type LoginInput } from '../../domain/logins';
import { useVault } from '../../vault/VaultProvider';
import { GeneratorSheet } from './GeneratorSheet';
import { useGoBack } from './LoginDetailPage';
import s from './LoginEdit.module.css';

/** Values handed over by other screens: "Add “xyz”" from an empty search, "Save as new login" from the generator. */
interface Prefill {
  name?: string;
  password?: string;
}

/** Add login (`/logins/new`) and Edit login (`/logins/:id/edit`), with the generator sheet (brief 05). */
export function LoginEditPage() {
  const { id } = useParams();
  const vault = useVault();
  const navigate = useNavigate();
  const location = useLocation();
  const snackbar = useSnackbar();
  const goBack = useGoBack();
  const existing = id ? vault.logins.find((l) => l.id === id) : undefined;
  const prefill = (location.state as Prefill | null) ?? {};

  const initial: LoginInput = existing
    ? { name: existing.name, url: existing.url, username: existing.username, password: existing.password }
    : { name: prefill.name ?? '', url: '', username: '', password: prefill.password ?? '' };
  const [values, setValues] = useState<LoginInput>(initial);
  const [errors, setErrors] = useState<Partial<Record<LoginField, string>>>({});
  const [revealed, setRevealed] = useState(!!prefill.password);
  const [sheet, setSheet] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  if (id && !existing) return <Navigate to="/" replace />;

  const dirty = (Object.keys(initial) as LoginField[]).some((k) => initial[k] !== values[k]);
  const set = (field: LoginField) => (value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  async function save(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const result = validateLoginInput(values);
    if (!result.ok) {
      setErrors(result.errors);
      (result.errors.name ? nameRef : passwordRef).current?.focus();
      return;
    }
    setSaving(true);
    try {
      if (existing) await vault.updateLogin(existing.id, result.value);
      else await vault.addLogin(result.value);
      snackbar.show({ message: 'Login saved' });
      goBack();
    } catch {
      setSaving(false);
      snackbar.show({ message: "The login couldn't be saved. Try again.", icon: 'info' });
    }
  }

  async function remove() {
    if (!existing) return;
    const undo = await vault.deleteLogin(existing.id);
    navigate('/', { replace: true });
    snackbar.show({ message: `${existing.name} deleted`, actionLabel: 'Undo', onAction: () => void undo() });
  }

  const back = () => (dirty ? setDiscard(true) : goBack());

  return (
    <form onSubmit={(e) => void save(e)} noValidate>
      <FormScreen
        title={existing ? 'Edit login' : 'Add login'}
        onBack={back}
        right={existing && (
          <button type="button" className={s.deleteButton} onClick={() => void remove()}>
            <span className={s.deletePill}>Delete</span>
          </button>
        )}
        footer={<button type="submit" className={formStyles.primary} disabled={saving}>Save</button>}
      >
        <div className={s.fields}>
          <div className={s.withMessage}>
            <TextField label="Name" value={values.name} onChange={set('name')} placeholder="e.g. Amazon" autoFocus={!existing} inputRef={nameRef} error={!!errors.name} autoComplete="off" />
            {errors.name ? <FieldMessage kind="error">{errors.name}</FieldMessage> : <FieldMessage />}
          </div>
          <TextField label="URL" type="url" inputMode="url" value={values.url} onChange={set('url')} placeholder="e.g. amazon.de" autoComplete="off" autoCapitalize="off" error={!!errors.url} />
          <div className={s.spacer} />
          <TextField label="Username or email" value={values.username} onChange={set('username')} autoComplete="off" autoCapitalize="off" spellCheck={false} error={!!errors.username} />
          <div className={s.spacer} />
          <div className={s.withMessage}>
            <PasswordField label="Password" value={values.password} onChange={set('password')} autoComplete="new-password" inputRef={passwordRef} error={!!errors.password} revealed={revealed} onRevealedChange={setRevealed} />
            {errors.password ? <FieldMessage kind="error">{errors.password}</FieldMessage> : <FieldMessage />}
          </div>
          <button type="button" className={formStyles.secondary} onClick={() => setSheet(true)}><DiceIcon />Generate password</button>
        </div>
      </FormScreen>
      {sheet && (
        <GeneratorSheet
          onClose={() => setSheet(false)}
          onUse={(password) => {
            set('password')(password);
            setRevealed(true);
            setSheet(false);
          }}
        />
      )}
      {discard && (
        <ConfirmDialog
          icon={<WarnIcon size={24} />}
          title="Discard changes?"
          text={existing ? `Your changes to ${existing.name} haven’t been saved.` : 'This login hasn’t been saved.'}
          dangerLabel="Discard"
          onDanger={() => {
            setDiscard(false);
            goBack();
          }}
          safeLabel="Keep editing"
          onSafe={() => setDiscard(false)}
        />
      )}
    </form>
  );
}
