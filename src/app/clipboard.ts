/*
 * Copying secrets (SCOPE §5.3): the clipboard is cleared after 30 s, but browsers only allow writing it while
 * PassMan is in the foreground, so the clearing is best effort.
 */

export const CLIPBOARD_CLEAR_MS = 30_000;

let timer: ReturnType<typeof setTimeout> | null = null;
let pendingSecret = false;

async function write(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function canClear(): boolean {
  return document.visibilityState === 'visible' && document.hasFocus();
}

/** Clears now if a secret copied by PassMan may still be on the clipboard (e.g. when locking). */
export function clearCopiedSecret(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  if (pendingSecret && canClear()) void write('');
  pendingSecret = false;
}

/** Copies a password or recovery key and schedules the clearing. Returns false if the browser refused. */
export async function copySecret(text: string): Promise<boolean> {
  const ok = await write(text);
  if (!ok) return false;
  if (timer) clearTimeout(timer);
  pendingSecret = true;
  timer = setTimeout(() => {
    timer = null;
    if (canClear()) void write('');
    pendingSecret = false;
  }, CLIPBOARD_CLEAR_MS);
  return true;
}

/** Copies something that is not a secret (a username): no clearing. */
export function copyPlain(text: string): Promise<boolean> {
  return write(text);
}
