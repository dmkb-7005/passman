import { useId } from 'react';
import { estimateBits, LENGTH_MAX, LENGTH_MIN, SYMBOLS, type GeneratorOptions } from '../../domain/generator';
import { MinusIcon, PlusIcon, WarnIcon } from '../icons';
import s from './GeneratorControls.module.css';

/** Strength words (brief 05): under 60 bits weak, 60–79 fair, 80–99 strong, 100+ very strong. */
export function strengthWord(bits: number): 'weak' | 'fair' | 'strong' | 'very strong' {
  return bits < 60 ? 'weak' : bits < 80 ? 'fair' : bits < 100 ? 'strong' : 'very strong';
}

export function StrengthHint({ options }: { options: GeneratorOptions }) {
  const bits = estimateBits(options);
  const word = strengthWord(bits);
  return (
    <div className={`${s.strength} ${word === 'weak' ? s.weak : ''}`}>
      {word === 'weak' && <span className={s.strengthIcon}><WarnIcon size={16} /></span>}
      <span>≈ <span className={s.num}>{bits}</span> bits · {word}</span>
    </div>
  );
}

const SWITCHES: { key: keyof Omit<GeneratorOptions, 'length'>; label: string; sub: string }[] = [
  { key: 'lower', label: 'Lowercase', sub: 'a–z' },
  { key: 'upper', label: 'Uppercase', sub: 'A–Z' },
  { key: 'digits', label: 'Digits', sub: '0–9' },
  { key: 'symbols', label: 'Symbols', sub: SYMBOLS },
  { key: 'avoidLookAlikes', label: 'Avoid look-alikes', sub: '0 O o 1 l I' },
];

export function Switch({ label, sub, checked, onChange }: { label: string; sub?: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className={s.switchRow} onClick={() => onChange(!checked)}>
      <span className={s.switchText}>
        <span className={s.switchLabel}>{label}</span>
        {sub && <span className={s.switchSub}>{sub}</span>}
      </span>
      <span aria-hidden="true" className={`${s.track} ${checked ? s.trackOn : ''}`}><span className={s.knob} /></span>
    </button>
  );
}

/** Length (− / slider / +) and the five switches: shared by the generator sheet and the Generator tab. */
export function GeneratorControls({ options, onChange }: { options: GeneratorOptions; onChange: (options: GeneratorOptions) => void }) {
  const id = useId();
  const setLength = (length: number) => onChange({ ...options, length: Math.min(LENGTH_MAX, Math.max(LENGTH_MIN, length)) });
  return (
    <>
      <div className={s.length}>
        <div className={s.lengthHead}>
          <label htmlFor={id} className={s.lengthLabel}>Length</label>
          <span className={s.lengthValue}>{options.length}</span>
        </div>
        <div className={s.lengthRow}>
          <button type="button" className={s.stepper} aria-label="Shorter" disabled={options.length <= LENGTH_MIN} onClick={() => setLength(options.length - 1)}><MinusIcon /></button>
          <input
            id={id}
            type="range"
            className={s.slider}
            min={LENGTH_MIN}
            max={LENGTH_MAX}
            value={options.length}
            style={{ '--fill': `${((options.length - LENGTH_MIN) / (LENGTH_MAX - LENGTH_MIN)) * 100}%` } as React.CSSProperties}
            onChange={(e) => setLength(Number(e.target.value))}
          />
          <button type="button" className={s.stepper} aria-label="Longer" disabled={options.length >= LENGTH_MAX} onClick={() => setLength(options.length + 1)}><PlusIcon /></button>
        </div>
      </div>
      <div className={s.switches}>
        {SWITCHES.map(({ key, label, sub }) => (
          <Switch key={key} label={label} sub={sub} checked={options[key]} onChange={(checked) => onChange({ ...options, [key]: checked })} />
        ))}
      </div>
    </>
  );
}
