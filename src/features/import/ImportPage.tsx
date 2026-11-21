import { useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { displayDateTime } from '../../app/format';
import { BottomSheet } from '../../components/BottomSheet';
import { ConfirmDialog, FormScreen, formStyles, Note, StepIndicator } from '../../components/form/Form';
import { HIDDEN_DOTS, PasswordText } from '../../components/form/PasswordText';
import { CheckIcon, ChevronRight, CloudIcon, DeviceIcon, DownloadIcon, EyeIcon, EyeOffIcon, FileIcon, LockIcon, NotEqualIcon, PlusIcon, RingIcon, WarnIcon } from '../../components/icons';
import { readChromeCsv, type SkippedRow } from '../../domain/chromeCsv';
import { defaultDecision, importCount, planImport, type Decision, type DuplicateItem, type ImportPlan, type ImportResult } from '../../domain/importPlan';
import { hostOf } from '../../domain/logins';
import { useSync } from '../../sync/SyncProvider';
import { useVault } from '../../vault/VaultProvider';
import t from '../shared/TabScreen.module.css';
import s from './Import.module.css';

/** A Chrome export with a few thousand logins is well under 2 MB. */
const MAX_BYTES = 5 * 1024 * 1024;
const TITLE = 'Import from Chrome';

interface Loaded {
  fileName: string;
  rowCount: number;
  skipped: SkippedRow[];
  notesIgnored: number;
  plan: ImportPlan;
}

type Step =
  | { kind: 'start'; error?: ReactNode }
  | ({ kind: 'summary' } & Loaded)
  | ({ kind: 'review'; decisions: Map<number, Decision>; order: DuplicateItem[] } & Loaded)
  | { kind: 'done'; fileName: string; result: ImportResult; skipped: number };

const Num = ({ children }: { children: ReactNode }) => <span className={s.num}>{children}</span>;
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Import from Chrome (brief 09): choose the CSV → summary → decide duplicates → import → delete the file. */
export function ImportPage() {
  const vault = useVault();
  const sync = useSync();
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>({ kind: 'start' });
  const [discarding, setDiscarding] = useState(false);
  const [applyAll, setApplyAll] = useState(false);
  const [revealed, setRevealed] = useState<ReadonlySet<number>>(new Set());
  const [busy, setBusy] = useState(false);

  const pickFile = () => {
    if (input.current) input.current.value = '';
    input.current?.click();
  };

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = <b>{file.name}</b>;
    const fail = (error: ReactNode) => setStep({ kind: 'start', error });
    if (file.size > MAX_BYTES) return fail(<>{name} is too large for a Chrome passwords export.</>);
    let text: string;
    try {
      text = await file.text();
    } catch {
      return fail(<>PassMan couldn&#8217;t read {name}. Choose the file again.</>);
    }
    if (!text.trim()) return fail(<>{name} is empty. Choose the file Chrome exported.</>);
    const read = readChromeCsv(text);
    if (!read.ok) return fail(<>{name} doesn&#8217;t look like a Chrome passwords export. Choose the file Chrome exported.</>);
    if (read.rows.length === 0 && read.skipped.length === 0) return fail(<>{name} has no passwords to import.</>);
    setRevealed(new Set());
    setStep({
      kind: 'summary',
      fileName: file.name,
      rowCount: read.rows.length + read.skipped.length,
      skipped: read.skipped,
      notesIgnored: read.notesIgnored,
      plan: planImport(vault.logins, read.rows),
    });
  }

  async function runImport(loaded: Loaded, decisions: Map<number, Decision>) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await vault.importLogins(loaded.plan, decisions);
      setStep({ kind: 'done', fileName: loaded.fileName, result, skipped: loaded.skipped.length });
    } catch {
      setBusy(false);
    }
  }

  const fileInput = <input ref={input} type="file" accept=".csv,text/csv,text/comma-separated-values" className={s.hiddenInput} onChange={(e) => void onFile(e)} />;

  // ---------- 1 · start ----------
  if (step.kind === 'start') {
    return (
      <FormScreen
        title={TITLE}
        onBack={() => navigate('/settings')}
        footer={
          <button type="button" className={`${formStyles.primary} ${s.fileButton}`} onClick={pickFile}>
            <FileIcon />{step.error ? 'Choose another file' : 'Choose CSV file'}
          </button>
        }
      >
        {fileInput}
        <StepIndicator step={1} total={3} />
        <div className={formStyles.intro}>
          <h1 className={formStyles.title}>Import your Chrome passwords</h1>
          <p className={formStyles.lead}>Choose the passwords file exported from Chrome (.csv).</p>
        </div>
        <Note kind="warn"><b className={s.warn}>The file contains all your passwords unencrypted.</b> Delete it as soon as the import is done.</Note>
        {step.error ? (
          <Note kind="error">{step.error}</Note>
        ) : (
          <div className={s.infoLine}><DeviceIcon />The file is read on this device only. Nothing is uploaded.</div>
        )}
      </FormScreen>
    );
  }

  // ---------- 4 · done ----------
  if (step.kind === 'done') {
    const { result } = step;
    return (
      <FormScreen title={TITLE} footer={<button type="button" className={formStyles.primary} onClick={() => navigate('/', { replace: true })}>Go to my logins</button>}>
        <StepIndicator step={3} total={3} />
        <div role="status" className={s.hero}>
          <div className={s.heroCircle}><CheckIcon size={36} /></div>
          <h1 className={s.heroTitle}>Imported <Num>{result.added + result.replaced}</Num> {plural(result.added + result.replaced, 'login', 'logins')}</h1>
          <p className={s.heroText}>
            <Num>{result.added}</Num> new · <Num>{result.replaced}</Num> replaced · <Num>{result.skipped}</Num> kept as they were · <Num>{step.skipped}</Num> skipped
          </p>
        </div>
        <section aria-labelledby="delete-file" className={s.deleteCard}>
          <div className={s.deleteHead}>
            <span className={s.deleteIcon}><WarnIcon size={22} /></span>
            <h2 id="delete-file" className={s.deleteTitle}>Delete the file now</h2>
          </div>
          <p className={s.deleteText}><b>{step.fileName}</b> still has all your passwords unencrypted. Delete it now, and empty the recycle bin on Windows.</p>
          <div className={s.whereBlock}>
            <span className={s.whereLabel}>Where it usually is</span>
            <div className={s.where}><b>Android:</b> Files › Downloads</div>
            <div className={s.where}><b>Windows:</b> Downloads folder</div>
          </div>
        </section>
        {sync.connection && <div className={s.syncLine}><CloudIcon size={16} />Your other devices get these logins at their next sync.</div>}
      </FormScreen>
    );
  }

  const loaded: Loaded = step;
  const { plan } = loaded;
  const dupes = plan.duplicates.length;

  // ---------- 2 · summary ----------
  if (step.kind === 'summary') {
    const startReview = () => {
      const decisions = initialDecisions(plan.duplicates);
      // undecided first (then file order); the order stays put while deciding, so cards don't jump
      const order = [...plan.duplicates].sort((a, b) => Number(decisions.has(a.row.row)) - Number(decisions.has(b.row.row)) || a.row.row - b.row.row);
      setStep({ ...loaded, kind: 'review', decisions, order });
    };
    return (
      <FormScreen
        title={TITLE}
        onBack={() => setStep({ kind: 'start' })}
        footer={
          <div className={s.footerStack}>
            {dupes > 0 ? (
              <button type="button" className={formStyles.primary} onClick={startReview}>Review {dupes} {plural(dupes, 'duplicate', 'duplicates')}</button>
            ) : (
              <button type="button" className={formStyles.primary} disabled={busy || plan.fresh.length === 0} aria-busy={busy} onClick={() => void runImport(loaded, new Map())}>
                {plan.fresh.length === 0 ? 'Nothing to import' : `Import ${plan.fresh.length} ${plural(plan.fresh.length, 'login', 'logins')}`}
              </button>
            )}
            <button type="button" className={s.choiceLink} onClick={pickFile}>Choose another file</button>
          </div>
        }
      >
        {fileInput}
        <StepIndicator step={2} total={3} />
        <div className={s.titleBlock}>
          <h1 className={formStyles.title}>Ready to import</h1>
          <div className={s.fileLine}><FileIcon size={16} /><span className={s.fileName}>{loaded.fileName}</span> · <Num>{loaded.rowCount}</Num> {plural(loaded.rowCount, 'row', 'rows')}</div>
        </div>
        <div className={s.facts}>
          <Fact n={plan.fresh.length} tone={s.positive} word={plural(plan.fresh.length, 'new login', 'new logins')} />
          <Fact n={dupes} tone={dupes ? s.warn : s.muted} word={dupes ? plural(dupes, 'possible duplicate', 'possible duplicates') : 'duplicates'} />
          <Fact n={loaded.skipped.length} tone={s.muted} word="skipped" />
        </div>
        {loaded.skipped.length > 0 && <SkippedCard skipped={loaded.skipped} />}
        {loaded.notesIgnored > 0 && (
          <Note kind="info"><Num>{loaded.notesIgnored}</Num> Chrome {plural(loaded.notesIgnored, 'note is', 'notes are')} not imported (PassMan has no notes).</Note>
        )}
      </FormScreen>
    );
  }

  // ---------- 3 · review ----------
  const { decisions } = step;
  const decided = plan.duplicates.filter((d) => decisions.has(d.row.row)).length;
  const remaining = dupes - decided;
  const count = importCount(plan, decisions);
  const decide = (row: number, d: Decision) => setStep({ ...step, decisions: new Map(decisions).set(row, d) });
  const decideRemaining = (d: Decision) => {
    const next = new Map(decisions);
    for (const item of plan.duplicates) if (!next.has(item.row.row)) next.set(item.row.row, d);
    setStep({ ...step, decisions: next });
    setApplyAll(false);
  };
  const toggleReveal = (row: number) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      if (!next.delete(row)) next.add(row);
      return next;
    });

  return (
    <>
      <FormScreen
        title={TITLE}
        onBack={() => setDiscarding(true)}
        footer={
          <div className={s.footerStack}>
            <div className={`${s.footerLine} ${remaining === 0 ? s.footerDone : ''}`} aria-live="polite">
              {remaining === 0 ? <><CheckIcon size={16} />All duplicates decided.</> : <><RingIcon size={16} />Decide <Num>{remaining}</Num> more to import.</>}
            </div>
            <button type="button" className={formStyles.primary} disabled={remaining > 0 || busy} aria-busy={busy} onClick={() => void runImport(loaded, decisions)}>
              {busy ? <><span className={formStyles.spinner} aria-hidden="true" />Importing…</> : remaining > 0 ? 'Import' : `Import ${count} ${plural(count, 'login', 'logins')}`}
            </button>
          </div>
        }
      >
        <StepIndicator step={2} total={3} />
        <div className={s.progressHead}>
          <div className={s.progressRow}>
            <span className={s.progressText}>
              <Num>{dupes}</Num> {plural(dupes, 'duplicate', 'duplicates')} · <span className={remaining === 0 ? s.positive : undefined}><Num>{decided}</Num> decided</span>
            </span>
            {remaining > 0 && <button type="button" className={s.applyAll} onClick={() => setApplyAll(true)}>Apply to all remaining</button>}
          </div>
          <div role="progressbar" aria-label="Duplicates decided" aria-valuemin={0} aria-valuemax={dupes} aria-valuenow={decided} className={s.bar}>
            <div className={`${s.barFill} ${remaining === 0 ? s.barDone : ''}`} style={{ width: `${dupes ? (decided / dupes) * 100 : 100}%` }} />
          </div>
        </div>
        {step.order.map((item) => (
          <DuplicateCard
            key={item.row.row}
            item={item}
            decision={decisions.get(item.row.row) ?? null}
            revealed={revealed.has(item.row.row)}
            onReveal={() => toggleReveal(item.row.row)}
            onDecide={(d) => decide(item.row.row, d)}
          />
        ))}
      </FormScreen>
      {applyAll && (
        <BottomSheet title="Apply to all remaining" onClose={() => setApplyAll(false)}>
          <p className={s.sheetText}>
            <Num>{remaining}</Num> {plural(remaining, 'duplicate isn’t', 'duplicates aren’t')} decided yet. Pick one choice for all of them. Decided cards stay as they are, and you can still change any card afterwards.
          </p>
          <div className={s.choices}>
            <ChoiceRow icon={<LockIcon size={20} />} title="Keep existing" sub="Nothing changes in PassMan." onClick={() => decideRemaining('keep-existing')} />
            <ChoiceRow icon={<DownloadIcon size={20} />} title="Use imported" sub="Chrome’s password replaces the one in PassMan." onClick={() => decideRemaining('use-imported')} />
            <ChoiceRow icon={<PlusIcon size={20} />} title="Keep both" sub="The imported login is added next to the existing one." onClick={() => decideRemaining('keep-both')} />
          </div>
        </BottomSheet>
      )}
      {discarding && (
        <ConfirmDialog
          icon={<WarnIcon size={24} />}
          title="Discard this import?"
          text="Nothing has been imported yet."
          dangerLabel="Discard"
          onDanger={() => navigate('/settings', { replace: true })}
          safeLabel="Keep reviewing"
          onSafe={() => setDiscarding(false)}
        />
      )}
    </>
  );
}

/** Same-password duplicates start on "Keep existing"; the rest wait for the user. */
function initialDecisions(items: readonly DuplicateItem[]): Map<number, Decision> {
  const map = new Map<number, Decision>();
  for (const item of items) {
    const d = defaultDecision(item);
    if (d) map.set(item.row.row, d);
  }
  return map;
}

function Fact({ n, tone, word }: { n: number; tone: string | undefined; word: string }) {
  return (
    <div className={`${t.glass} ${s.fact}`}>
      <span className={`${s.factNum} ${tone ?? ''}`}>{n}</span>
      <span className={s.factWord}>{word}</span>
    </div>
  );
}

function SkippedCard({ skipped }: { skipped: SkippedRow[] }) {
  const noPassword = skipped.every((r) => r.reason === 'No password');
  const shown = skipped.slice(0, 12);
  return (
    <div className={`${t.glass} ${s.skippedCard}`}>
      <span className={s.skippedTitle}>
        Skipped <Num>{skipped.length}</Num> {plural(skipped.length, 'row', 'rows')}{noPassword ? ' without a password' : ''}
      </span>
      <span className={s.skippedList}>
        {shown.map((r, i) => (
          <span key={r.row}>
            {i > 0 && ' · '}
            {r.name === 'Untitled' ? <span className={s.noName}>(no name)</span> : r.name}
            {!noPassword && r.reason !== 'No password' && ` (${r.reason.toLowerCase()})`}
          </span>
        ))}
        {skipped.length > shown.length && ` · and ${skipped.length - shown.length} more`}
      </span>
    </div>
  );
}

const CHOICES: { value: Decision; label: string }[] = [
  { value: 'keep-existing', label: 'Keep existing' },
  { value: 'use-imported', label: 'Use imported' },
  { value: 'keep-both', label: 'Keep both' },
];

function DuplicateCard({ item, decision, revealed, onReveal, onDecide }: {
  item: DuplicateItem;
  decision: Decision | null;
  revealed: boolean;
  onReveal: () => void;
  onDecide: (d: Decision) => void;
}) {
  const { row, target } = item;
  const host = hostOf(row.url);
  const inVault = target.kind === 'vault';
  const existingPassword = inVault ? target.login.password : target.row.password;
  const pw = (p: string) => (revealed ? <PasswordText password={p} /> : HIDDEN_DOTS);
  const groupLabel = `${row.name}${row.username ? `, ${row.username}` : ''}`;
  return (
    <article className={`${s.card} ${decision ? t.glass : s.undecided}`} aria-label={`Duplicate: ${groupLabel}`}>
      <div className={s.cardHead}>
        <div className={s.cardName}><b>{row.name}</b>{host && <span className={s.cardHost}> · {host}</span>}</div>
        <button type="button" className={s.eye} aria-label={revealed ? 'Hide both passwords' : 'Show both passwords'} aria-pressed={revealed} onClick={onReveal}>
          {revealed ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
        </button>
      </div>
      <div className={s.cardSub}>
        <span className={s.username}>{row.username || 'No username'}</span>
        {item.identical ? (
          <span className={`${s.badge} ${s.badgeSame}`}><CheckIcon size={14} />Same password</span>
        ) : (
          <span className={`${s.badge} ${s.badgeDiff}`}><NotEqualIcon size={14} />Different password</span>
        )}
      </div>
      <div className={s.sides}>
        <div className={s.side}>
          <span className={s.sideLabel}>{inVault ? 'In PassMan' : 'First in file'}</span>
          <span className={s.sideMeta}>{inVault ? `Changed ${displayDateTime(target.login.updatedAt, false)}` : `Row ${target.row.row}`}</span>
          <span className={s.sidePw}>{pw(existingPassword)}</span>
        </div>
        <div className={s.side}>
          <span className={s.sideLabel}>{inVault ? 'From Chrome' : 'Later in file'}</span>
          <span className={s.sideMeta}>{inVault ? 'In the file' : `Row ${row.row}`}</span>
          <span className={s.sidePw}>{pw(row.password)}</span>
        </div>
      </div>
      {!decision && <div className={s.notDecided}><RingIcon size={14} />Not decided yet</div>}
      <div role="radiogroup" aria-label={`Choice for ${groupLabel}`} className={s.segmented}>
        {CHOICES.map((c) => (
          <button key={c.value} type="button" role="radio" aria-checked={decision === c.value} className={`${s.segment} ${decision === c.value ? s.segmentOn : ''}`} onClick={() => onDecide(c.value)}>
            {c.label}
          </button>
        ))}
      </div>
    </article>
  );
}

function ChoiceRow({ icon, title, sub, onClick }: { icon: ReactNode; title: string; sub: string; onClick: () => void }) {
  return (
    <button type="button" className={s.choice} onClick={onClick}>
      <span className={s.choiceIcon}>{icon}</span>
      <span className={s.choiceText}>
        <span className={s.choiceTitle}>{title}</span>
        <span className={s.choiceSub}>{sub}</span>
      </span>
      <ChevronRight size={18} />
    </button>
  );
}
