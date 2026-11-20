/** Master password rules (SCOPE §5.1). */

export const MASTER_PASSWORD_MIN = 12;

/** Length in characters as people count them (after NFC, by code point). */
export function passwordLength(password: string): number {
  return [...password.normalize('NFC')].length;
}

/** UI message, or null when the password is acceptable. */
export function masterPasswordProblem(password: string, confirmation?: string): string | null {
  if (passwordLength(password) < MASTER_PASSWORD_MIN) return `Use at least ${MASTER_PASSWORD_MIN} characters. A few unrelated words work well.`;
  if (password.trim() !== password) return "Don't start or end with a space";
  if (confirmation !== undefined && confirmation.normalize('NFC') !== password.normalize('NFC')) return "The passwords don't match";
  return null;
}
