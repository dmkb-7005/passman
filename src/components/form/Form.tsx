import { useEffect, useId, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertIcon, BackIcon, CheckIcon, EyeIcon, EyeOffIcon, InfoIcon, RingIcon, WarnIcon } from '../icons';
import { useSnackbarPlacement } from '../Snackbar';
import { PasswordText } from './PasswordText';
import s from './Form.module.css';

export { s as formStyles };

/** Full-screen form: back chevron + title, scrolling body, pinned footer (primary action). */
export function FormScreen({
  title,
  onBack,
  backLabel = 'Back',
  right,
  footer,
  children,
}: {
  title: string;
  onBack?: () => void;
  backLabel?: string;
  right?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  // never cover the pinned button: 56 px button + 24 px below it + 12 px gap
  useSnackbarPlacement(footer ? 92 : 24);
  return (
    <div className={s.screen}>
      <header className={s.header}>
        {onBack ? (
          <button type="button" className={s.iconButton} aria-label={backLabel} onClick={onBack}><BackIcon /></button>
        ) : (
          <span className={s.headerSpacer} />
        )}
        {title && <h1 className={s.headerTitle}>{title}</h1>}
        {right}
      </header>
      <div className={s.body}>{children}</div>
      {footer && <div className={s.footer}>{footer}</div>}
    </div>
  );
}

export function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className={s.steps}>
      <div className={s.stepsText}>Step {step} of {total}</div>
      <div className={s.stepBars} aria-hidden="true">
        {Array.from({ length: total }, (_, i) => <div key={i} className={`${s.stepBar} ${i < step ? s.stepBarOn : ''}`} />)}
      </div>
    </div>
  );
}

export type MessageKind = 'error' | 'ok' | 'hint' | 'requirement' | 'requirement-met';

/** Fixed-height slot under a field, so hints and errors never move the layout. */
export function FieldMessage({ kind, height = 20, lead, plain, children }: { kind?: MessageKind; height?: 20 | 40; lead?: ReactNode; plain?: boolean; children?: ReactNode }) {
  const cls = `${s.message} ${height === 40 ? s.message40 : s.message20}`;
  if (!kind || (!children && !lead)) return <div className={cls} />;
  const icon =
    kind === 'error' ? <AlertIcon className={s.danger} /> :
    kind === 'ok' || kind === 'requirement-met' ? <CheckIcon className={s.ok} /> :
    <RingIcon className={s.muted} />;
  const textClass = plain ? undefined : kind === 'error' ? s.danger : kind === 'ok' ? s.ok : kind === 'hint' || kind === 'requirement' ? s.muted : undefined;
  return (
    <div className={cls} role={kind === 'error' ? 'alert' : undefined}>
      <span className={s.messageIcon}>{icon}</span>
      {lead ? <span><span className={textClass}>{lead}</span> {children}</span> : <span className={textClass}>{children}</span>}
    </div>
  );
}

/** The master password rule line (SCOPE §5.1): muted ring until met, then a positive check. */
export function RequirementLine({ met }: { met: boolean }) {
  return (
    <FieldMessage kind={met ? 'requirement-met' : 'requirement'} height={40}>
      {met ? <><span className={s.okStrong}>At least 12 characters.</span> A few unrelated words work well, e.g. <i>harbour lemon cable seventy</i>.</> : <>At least 12 characters. A few unrelated words work well, e.g. <i>harbour lemon cable seventy</i>.</>}
    </FieldMessage>
  );
}

type InputProps = Omit<ComponentProps<'input'>, 'onChange' | 'value' | 'className'>;

export function TextField({
  label,
  value,
  onChange,
  error,
  inputRef,
  ...rest
}: InputProps & { label: string; value: string; onChange: (value: string) => void; error?: boolean; inputRef?: React.Ref<HTMLInputElement> }) {
  const id = useId();
  return (
    <div className={s.fieldGroup}>
      <label htmlFor={id} className={s.label}>{label}</label>
      <div className={`${s.field} ${error ? s.fieldError : ''}`}>
        <input ref={inputRef} id={id} className={s.input} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
      </div>
    </div>
  );
}

/**
 * Password input with show/hide. While shown and not focused, the text is drawn with the digit/symbol tinting
 * (the input itself can't colour single characters).
 */
export function PasswordField({
  label,
  value,
  onChange,
  error,
  disabled,
  showToggle = true,
  revealed: revealedProp,
  onRevealedChange,
  inputRef,
  selectOnError,
  ...rest
}: InputProps & {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  showToggle?: boolean;
  revealed?: boolean;
  onRevealedChange?: (revealed: boolean) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  /** keep the content selected after an error, so retyping replaces it */
  selectOnError?: boolean;
}) {
  const id = useId();
  const [revealedState, setRevealedState] = useState(false);
  const revealed = revealedProp ?? revealedState;
  const [focused, setFocused] = useState(false);
  const ownRef = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? ownRef;

  useEffect(() => {
    if (error && selectOnError) ref.current?.select();
  }, [error, selectOnError, ref]);

  const toggle = () => {
    const next = !revealed;
    setRevealedState(next);
    onRevealedChange?.(next);
  };
  const mirror = revealed && !focused && value.length > 0;

  return (
    <div className={s.fieldGroup}>
      <label htmlFor={id} className={s.label}>{label}</label>
      <div className={`${s.field} ${showToggle ? s.fieldWithButton : ''} ${error ? s.fieldError : ''} ${disabled ? s.fieldDisabled : ''}`}>
        <span className={s.secretWrap}>
          <input
            ref={ref}
            id={id}
            type={revealed ? 'text' : 'password'}
            className={`${s.input} ${s.secret} ${mirror ? s.secretTransparent : ''}`}
            value={value}
            disabled={disabled}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(e) => onChange(e.target.value)}
            {...rest}
          />
          {mirror && <span className={`${s.secretMirror} ${s.secret}`} aria-hidden="true"><PasswordText password={value} /></span>}
        </span>
        {showToggle && (
          <button
            type="button"
            className={`${s.iconButton} ${s.fieldButton}`}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={toggle}
          >
            {revealed ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>
    </div>
  );
}

export function Note({ kind, children }: { kind: 'info' | 'warn' | 'error'; children: ReactNode }) {
  return (
    <div className={`${s.note} ${kind === 'info' ? s.noteInfo : kind === 'warn' ? s.noteWarn : s.noteError}`} role={kind === 'error' ? 'alert' : undefined}>
      <span className={s.noteIcon}>{kind === 'info' ? <InfoIcon /> : kind === 'warn' ? <WarnIcon /> : <AlertIcon size={18} />}</span>
      <span>{children}</span>
    </div>
  );
}

/** Centred confirmation dialog: icon in a circle, a risky action as a danger-outlined pill, the safe one as primary. */
export function ConfirmDialog({
  icon,
  tone = 'warn',
  title,
  text,
  dangerLabel,
  onDanger,
  safeLabel,
  onSafe,
}: {
  icon: ReactNode;
  tone?: 'warn' | 'info';
  title: string;
  text: string;
  dangerLabel: string;
  onDanger: () => void;
  safeLabel: string;
  onSafe: () => void;
}) {
  const id = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSafe();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSafe]);
  return createPortal(
    <div className={s.dialogBackdrop}>
      <div className={s.dialog} role="alertdialog" aria-modal="true" aria-labelledby={`${id}-t`} aria-describedby={`${id}-d`}>
        <div className={`${s.dialogIcon} ${tone === 'warn' ? s.dialogIconWarn : s.dialogIconInfo}`}>{icon}</div>
        <div className={s.intro}>
          <h2 id={`${id}-t`} className={s.dialogTitle}>{title}</h2>
          <p id={`${id}-d`} className={s.dialogText}>{text}</p>
        </div>
        <div className={s.dialogButtons}>
          <button type="button" className={s.dangerOutline} onClick={onDanger}>{dangerLabel}</button>
          <button type="button" className={s.primary} autoFocus onClick={onSafe}>{safeLabel}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
