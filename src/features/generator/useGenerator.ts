import { useCallback, useEffect, useState } from 'react';
import { updateSettings, useSettings } from '../../db/meta';
import { generatePassword, generatorProblem, type GeneratorOptions } from '../../domain/generator';

/**
 * Generator state shared by the Generator tab and the sheet in Add / Edit: options are stored per device, and a
 * new password is generated whenever they change. Undefined while the settings load.
 */
export function useGenerator() {
  const settings = useSettings();
  const options = settings?.generator;
  const [password, setPassword] = useState('');
  const key = options ? JSON.stringify(options) : '';

  const regenerate = useCallback(() => {
    if (!options) return;
    setPassword(generatorProblem(options) ? '' : generatePassword(options));
  }, [key]);

  useEffect(() => {
    regenerate();
  }, [regenerate]);

  const setOptions = useCallback((next: GeneratorOptions) => {
    void updateSettings({ generator: next });
  }, []);

  if (!options) return undefined;
  return { options, setOptions, password, regenerate, problem: generatorProblem(options) };
}
