import s from './Form.module.css';

/** Splits a password into runs of letters, digits and symbols (pure, for tests and rendering). */
export function passwordRuns(password: string): { kind: 'letter' | 'digit' | 'symbol'; text: string }[] {
  const runs: { kind: 'letter' | 'digit' | 'symbol'; text: string }[] = [];
  for (const ch of password) {
    const kind = /\p{L}/u.test(ch) ? 'letter' : /\p{Nd}/u.test(ch) ? 'digit' : 'symbol';
    const last = runs[runs.length - 1];
    if (last && last.kind === kind) last.text += ch;
    else runs.push({ kind, text: ch });
  }
  return runs;
}

/** Revealed password: digits in accent, symbols in warn, letters in the text colour (a reading aid only). */
export function PasswordText({ password }: { password: string }) {
  return (
    <>
      {passwordRuns(password).map((run, i) =>
        run.kind === 'letter' ? run.text : <span key={i} className={run.kind === 'digit' ? s.pwDigit : s.pwSymbol}>{run.text}</span>,
      )}
    </>
  );
}

/** Hidden password: always 10 dots, whatever the real length. */
export const HIDDEN_DOTS = '••••••••••';
