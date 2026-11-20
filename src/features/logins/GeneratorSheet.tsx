import { BottomSheet } from '../../components/BottomSheet';
import { FieldMessage, formStyles } from '../../components/form/Form';
import { PasswordText } from '../../components/form/PasswordText';
import { GeneratorControls, StrengthHint } from '../../components/generator/GeneratorControls';
import { RefreshIcon } from '../../components/icons';
import { useGenerator } from '../generator/useGenerator';
import s from './LoginEdit.module.css';

/** "Generate password" sheet in Add / Edit login (brief 05). Choices are remembered on this device. */
export function GeneratorSheet({ onUse, onClose }: { onUse: (password: string) => void; onClose: () => void }) {
  const gen = useGenerator();
  if (!gen) return null;
  return (
    <BottomSheet
      title="Generate password"
      onClose={onClose}
      footer={<button type="button" className={formStyles.primary} disabled={!gen.password} onClick={() => onUse(gen.password)}>Use this password</button>}
    >
      <div className={s.sheetBody}>
        <div className={s.generated}>
          <div className={s.generatedPanel}>
            <span className={s.generatedText}>{gen.password ? <PasswordText password={gen.password} /> : <span className={s.generatedNone}>– – – –</span>}</span>
            <button type="button" className={s.regenerate} aria-label="Regenerate" disabled={!gen.password} onClick={gen.regenerate}><RefreshIcon size={22} /></button>
          </div>
          {gen.password ? <StrengthHint options={gen.options} /> : <div className={s.noneHint}>No password to show</div>}
        </div>
        <GeneratorControls options={gen.options} onChange={gen.setOptions} />
        {gen.problem ? <FieldMessage kind="error">{gen.problem}</FieldMessage> : <FieldMessage />}
      </div>
    </BottomSheet>
  );
}
