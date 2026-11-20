import { DROPBOX_APP_KEY, finishSignIn, startSignIn, tokenSource, type Tokens } from './dropboxAuth';
import { createDropboxClient, DropboxError } from './dropboxClient';

/*
 * The Dropbox sign-in leaves the app and comes back to the base URL with `?code&state`. That reload must be
 * caught before the router starts (main.tsx), and the code exchanged right away: the exchange needs no vault key,
 * so the tokens wait in memory until the vault is unlocked and can encrypt the refresh token.
 */

/** join: second device, from Welcome · connect: from Settings · reconnect: after Dropbox rejected the sign-in */
export type SignInPurpose = 'join' | 'connect' | 'reconnect';

const STORAGE_KEY = 'passman.dropboxSignIn';
const MAX_AGE_MS = 30 * 60_000;

interface Started {
  verifier: string;
  state: string;
  purpose: SignInPurpose;
  /** the hash route to return to, e.g. `#/settings` */
  returnTo: string;
  at: number;
}

export type SignInResult =
  | { kind: 'ok'; purpose: SignInPurpose; tokens: Tokens; email: string }
  | { kind: 'cancelled'; purpose: SignInPurpose }
  | { kind: 'error'; purpose: SignInPurpose; message: string; offline: boolean };

/** The registered redirect URI: the app's base URL, e.g. https://dmkb-7005.github.io/passman/ */
export function redirectUri(): string {
  return new URL(import.meta.env.BASE_URL, window.location.origin).href;
}

/** Leaves the app for Dropbox's sign-in page. */
export async function beginSignIn(purpose: SignInPurpose, returnTo: string, options: { anotherAccount?: boolean } = {}): Promise<void> {
  const request = await startSignIn(DROPBOX_APP_KEY, redirectUri(), options);
  // localStorage, not sessionStorage: an installed app may come back in a new window
  const started: Started = { verifier: request.verifier, state: request.state, purpose, returnTo, at: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(started));
  window.location.assign(request.url);
}

let returned: { code: string | null; state: string | null; error: string | null } | null = null;

/**
 * Call once before the router renders: takes `?code&state` (or `?error`) out of the address and restores the
 * hash route the sign-in started from.
 */
export function captureSignInRedirect(): void {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('state') || !(params.has('code') || params.has('error'))) return;
  returned = { code: params.get('code'), state: params.get('state'), error: params.get('error') };
  const started = readStarted();
  const hash = started?.returnTo ?? window.location.hash;
  window.history.replaceState(null, '', `${window.location.pathname}${hash}`);
}

function readStarted(): Started | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Started) : null;
  } catch {
    return null;
  }
}

let result: Promise<SignInResult | null> | null = null;

/** Exchanges the returned code for tokens (once; later calls get the same answer). Null when there was no sign-in. */
export function completeSignIn(): Promise<SignInResult | null> {
  result ??= exchange();
  return result;
}

async function exchange(): Promise<SignInResult | null> {
  if (!returned) return null;
  const started = readStarted();
  localStorage.removeItem(STORAGE_KEY);
  const back = returned;
  returned = null;
  if (!started || started.state !== back.state || Date.now() - started.at > MAX_AGE_MS) {
    return { kind: 'error', purpose: started?.purpose ?? 'connect', message: 'The Dropbox sign-in expired. Please try again.', offline: false };
  }
  const { purpose } = started;
  if (back.error || !back.code) return { kind: 'cancelled', purpose };
  try {
    const tokens = await finishSignIn(DROPBOX_APP_KEY, redirectUri(), back.code, started.verifier);
    const account = await createDropboxClient(tokenSource(DROPBOX_APP_KEY, tokens.refreshToken, tokens)).account();
    return { kind: 'ok', purpose, tokens: { ...tokens, accountId: account.accountId || tokens.accountId }, email: account.email };
  } catch (err) {
    const offline = err instanceof DropboxError && err.kind === 'network';
    return { kind: 'error', purpose, message: offline ? 'PassMan can’t reach Dropbox. Check the connection and try again.' : 'Dropbox didn’t accept the sign-in. Please try again.', offline };
  }
}
