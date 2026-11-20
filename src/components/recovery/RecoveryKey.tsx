import { useId } from 'react';
import { createPortal } from 'react-dom';
import { copySecret } from '../../app/clipboard';
import { describeDevice, printDateTime } from '../../app/format';
import { CheckIcon, CopyIcon, KeyIcon, PrintIcon } from '../icons';
import { FieldMessage, Note, formStyles } from '../form/Form';
import { useSnackbar } from '../Snackbar';
import s from './RecoveryKey.module.css';

const groups = (key: string) => key.split('-');

/** The last group the user must type back (upper case, look-alikes allowed as in the parser). */
export function lastGroupMatches(key: string, typed: string): boolean {
  const last = groups(key).at(-1) ?? '';
  const clean = typed.toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1');
  return clean === last;
}

function KeyCard({ keyText }: { keyText: string }) {
  const g = groups(keyText);
  const row = (part: string[]) => (
    <div className={s.keyRow}>
      {part.map((group, i) => (
        <span key={group + i} className={s.keyGroupWrap}>
          {i > 0 && <span aria-hidden="true" className={s.dash} />}
          <span>{group}</span>
        </span>
      ))}
    </div>
  );
  return (
    <div role="group" aria-label={`Recovery key ${keyText}`} className={s.keyCard}>
      {row(g.slice(0, 4))}
      {row(g.slice(4))}
    </div>
  );
}

/**
 * "Save your recovery key" content (Create step 3, Settings › New recovery key): warning, the key, Print and
 * Copy, advice and the last-group confirmation. The parent pins the continue button below it.
 */
export function RecoveryKeyPanel({
  keyText,
  advice,
  typed,
  onTyped,
  createdAt,
}: {
  keyText: string;
  advice: string;
  typed: string;
  onTyped: (value: string) => void;
  createdAt: Date;
}) {
  const id = useId();
  const snackbar = useSnackbar();
  const complete = typed.length === 4;
  const matches = complete && lastGroupMatches(keyText, typed);

  async function copy() {
    const ok = await copySecret(keyText);
    snackbar.show(ok ? { message: 'Recovery key copied · clears in 30 s while PassMan is open' } : { message: "Couldn't copy. Write the key down instead.", icon: 'info' });
  }

  return (
    <>
      <Note kind="warn"><b>Shown only now.</b> Without it and without your master password, your vault can&#8217;t be opened by anyone, including you.</Note>
      <div className={s.keyBlock}>
        <KeyCard keyText={keyText} />
        <div className={s.keyButtons}>
          <button type="button" className={formStyles.secondary} onClick={() => window.print()}><PrintIcon />Print</button>
          <button type="button" className={formStyles.secondary} onClick={() => void copy()}><CopyIcon />Copy</button>
        </div>
      </div>
      <p className={formStyles.text}>{advice}</p>
      <div className={s.confirm}>
        <div className={formStyles.fieldGroup}>
          <label htmlFor={id} className={formStyles.label}>Type the last group to confirm you saved it</label>
          <div className={`${formStyles.field} ${s.groupField} ${matches ? formStyles.fieldOk : complete ? formStyles.fieldError : ''}`}>
            <input
              id={id}
              className={`${formStyles.input} ${s.groupInput}`}
              maxLength={4}
              placeholder="XXXX"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={typed}
              onChange={(e) => onTyped(e.target.value.replace(/[^0-9a-z]/gi, '').toUpperCase().slice(0, 4))}
            />
            {matches && <span className={s.groupOk}><CheckIcon size={20} /></span>}
          </div>
        </div>
        {matches ? <FieldMessage kind="ok">That&#8217;s the last group.</FieldMessage> : complete ? <FieldMessage kind="error" plain>That&#8217;s not the last group</FieldMessage> : <FieldMessage />}
      </div>
      <PrintSheet keyText={keyText} createdAt={createdAt} />
    </>
  );
}

/** A4 sheet for printing (design: "Print sheet"); hidden on screen, the only light page of the app. */
function PrintSheet({ keyText, createdAt }: { keyText: string; createdAt: Date }) {
  const g = groups(keyText);
  const row = (part: string[]) => (
    <div className={s.printRow}>
      {part.map((group, i) => (
        <span key={group + i} className={s.keyGroupWrap}>
          {i > 0 && <span aria-hidden="true" className={s.printDash} />}
          <span>{group}</span>
        </span>
      ))}
    </div>
  );
  return createPortal(
    <div className={s.print} aria-hidden="true">
      <div className={s.printMark}>
        <span className={s.printLogo}><KeyIcon size={24} /></span>
        <span className={s.printBrand}>PassMan</span>
      </div>
      <h1 className={s.printTitle}>PassMan recovery key</h1>
      <p className={s.printLead}>The only way back into your vault if you forget your master password. Keep this sheet with your important papers, not next to your devices.</p>
      <div className={s.printKey}>
        {row(g.slice(0, 4))}
        {row(g.slice(4))}
      </div>
      <table className={s.printTable}>
        <tbody>
          <tr><th scope="row">Created</th><td>{printDateTime(createdAt)}</td></tr>
          <tr><th scope="row">Created on</th><td>{describeDevice()}</td></tr>
        </tbody>
      </table>
      <h2 className={s.printH2}>How to use it</h2>
      <ol className={s.printList}>
        <li>Open PassMan and choose <b>Forgot it? Use your recovery key</b>.</li>
        <li>Type the key above. Upper or lower case, with or without dashes.</li>
        <li>Choose a new master password.</li>
      </ol>
      <p className={s.printNote}>If you create a new recovery key in Settings, this one stops working once your devices sync. Destroy this sheet then.</p>
      <div className={s.printStored}><span>Stored at:</span><span className={s.printLine} /></div>
    </div>,
    document.body,
  );
}
