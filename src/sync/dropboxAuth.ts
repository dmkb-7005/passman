import { randomBytes, toBase64Url, utf8 } from '../crypto/bytes';
import { DropboxError, type TokenSource } from './dropboxClient';

/*
 * Dropbox sign-in with PKCE (no app secret, no server), offline access = a long-lived refresh token.
 * Verified in the spike: token exchange, refresh and revoke all work from the browser.
 */

/** The Dropbox app's key. Public by design: PKCE needs no app secret, and Dropbox only redirects to the registered URIs. */
export const DROPBOX_APP_KEY = '21ejcdw2nfsd2fm';
const TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';

export interface PkceRequest {
  verifier: string;
  state: string;
  url: string;
}

/** Builds the authorize URL; keep `verifier` and `state` (sessionStorage) until Dropbox redirects back. */
export async function startSignIn(appKey: string, redirectUri: string, options: { anotherAccount?: boolean } = {}): Promise<PkceRequest> {
  const verifier = toBase64Url(randomBytes(32));
  const challenge = toBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', utf8(verifier))));
  const state = toBase64Url(randomBytes(16));
  const url = new URL('https://www.dropbox.com/oauth2/authorize');
  url.search = new URLSearchParams({
    client_id: appKey,
    response_type: 'code',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    token_access_type: 'offline',
    redirect_uri: redirectUri,
    state,
    ...(options.anotherAccount ? { force_reauthentication: 'true' } : {}),
  }).toString();
  return { verifier, state, url: url.toString() };
}

export interface Tokens {
  accessToken: string;
  /** epoch ms */
  expiresAt: number;
  refreshToken: string;
  accountId: string;
}

async function tokenRequest(params: Record<string, string>, fetchImpl: typeof fetch): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetchImpl(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params) });
  } catch {
    throw new DropboxError('PassMan can’t reach Dropbox', 'network');
  }
  const text = await response.text();
  if (!response.ok) throw new DropboxError(`Dropbox sign-in failed (${response.status}): ${text.slice(0, 120)}`, response.status === 400 || response.status === 401 ? 'auth' : 'server');
  return JSON.parse(text) as Record<string, unknown>;
}

export async function finishSignIn(appKey: string, redirectUri: string, code: string, verifier: string, fetchImpl: typeof fetch = (...a) => fetch(...a)): Promise<Tokens> {
  const body = await tokenRequest({ grant_type: 'authorization_code', code, code_verifier: verifier, client_id: appKey, redirect_uri: redirectUri }, fetchImpl);
  if (typeof body.refresh_token !== 'string' || typeof body.access_token !== 'string') throw new DropboxError('Dropbox sent no refresh token', 'auth');
  return {
    accessToken: body.access_token,
    expiresAt: Date.now() + Number(body.expires_in ?? 0) * 1000,
    refreshToken: body.refresh_token,
    accountId: String(body.account_id ?? ''),
  };
}

export async function refreshAccess(appKey: string, refreshToken: string, fetchImpl: typeof fetch = (...a) => fetch(...a)): Promise<{ accessToken: string; expiresAt: number }> {
  const body = await tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: appKey }, fetchImpl);
  if (typeof body.access_token !== 'string') throw new DropboxError('Dropbox sent no access token', 'auth');
  return { accessToken: body.access_token, expiresAt: Date.now() + Number(body.expires_in ?? 0) * 1000 };
}

/** Access tokens live in memory only and are refreshed a minute before they expire (or after a 401). */
export function tokenSource(appKey: string, refreshToken: string, initial?: { accessToken: string; expiresAt: number }, fetchImpl?: typeof fetch): TokenSource {
  let current = initial ?? null;
  let pending: Promise<{ accessToken: string; expiresAt: number }> | null = null;
  return {
    async accessToken(force = false) {
      if (!force && current && current.expiresAt - 60_000 > Date.now()) return current.accessToken;
      pending ??= refreshAccess(appKey, refreshToken, fetchImpl).finally(() => {
        pending = null;
      });
      current = await pending;
      return current.accessToken;
    },
  };
}

/** Disconnect: revoke the token at Dropbox (best effort; the local copy is deleted anyway). */
export async function revoke(tokens: TokenSource, fetchImpl: typeof fetch = (...a) => fetch(...a)): Promise<void> {
  try {
    const token = await tokens.accessToken();
    await fetchImpl('https://api.dropboxapi.com/2/auth/token/revoke', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  } catch {
    // offline or already revoked
  }
}
