// A lasting Google connection for Calendar and Sheets. The student agrees once in their browser;
// Google hands this backend a refresh token, kept with the student's account, and the backend
// trades it for a fresh access token whenever one is needed. Nobody is asked to connect again
// until they disconnect (or, while the Google app is in Testing mode, after Google's 7-day limit).
//
// Uses a "Desktop app" OAuth client from the Google Cloud project, with PKCE and a loopback
// redirect, which is how Google expects an app installed on the student's own computer to sign in.
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

export type GoogleService = 'calendar' | 'sheets';

export const GOOGLE_SCOPES: Record<GoogleService, string> = {
  calendar: 'https://www.googleapis.com/auth/calendar.events',
  sheets: 'https://www.googleapis.com/auth/spreadsheets',
};

export interface OAuthClient {
  clientId: string;
  clientSecret: string;
}

/** What is kept with the student's account once they connect. */
export interface GoogleGrant {
  refreshToken: string;
  services: GoogleService[];
  connectedAt: string;
}

/** The OAuth client from GOOGLE_OAUTH_CLIENT_ID and _SECRET, or from the JSON file Google Cloud downloads. */
export function oauthClientFrom(env: NodeJS.ProcessEnv): OAuthClient | null {
  const id = env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const secret = env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (id && secret) return { clientId: id, clientSecret: secret };
  const file = env.GOOGLE_OAUTH_CLIENT_FILE?.trim();
  if (!file) return null;
  try {
    const json = JSON.parse(readFileSync(file, 'utf8'));
    const c = json.installed ?? json.web;
    return c?.client_id && c?.client_secret ? { clientId: c.client_id, clientSecret: c.client_secret } : null;
  } catch {
    return null;
  }
}

const b64url = (buf: Buffer) => buf.toString('base64url');

/** A PKCE pair: the verifier stays here, the challenge goes to Google. */
export function pkce() {
  const verifier = b64url(randomBytes(32));
  return { verifier, challenge: b64url(createHash('sha256').update(verifier).digest()) };
}

export function consentUrl(client: OAuthClient, opts: { redirectUri: string; services: GoogleService[]; state: string; challenge: string; loginHint?: string | null; chooseAccount?: boolean }) {
  const params = new URLSearchParams({
    client_id: client.clientId,
    redirect_uri: opts.redirectUri,
    response_type: 'code',
    scope: [...opts.services.map((s) => GOOGLE_SCOPES[s]), ...(opts.services.includes('calendar') ? [ALL_CALENDARS_SCOPE] : [])].join(' '),
    // offline + consent: Google returns a refresh token, so the student is not asked again.
    access_type: 'offline',
    // select_account shows Google's account picker, for switching to another account.
    prompt: opts.chooseAccount ? 'consent select_account' : 'consent',
    include_granted_scopes: 'true',
    state: opts.state,
    code_challenge: opts.challenge,
    code_challenge_method: 'S256',
    ...(opts.loginHint ? { login_hint: opts.loginHint } : {}),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

interface TokenReply {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

async function tokenCall(body: Record<string, string>, fetchImpl: typeof fetch): Promise<TokenReply> {
  const res = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  if (!res.ok) {
    let reason = text.slice(0, 200);
    try {
      reason = JSON.parse(text).error ?? reason;
    } catch {
      // not JSON
    }
    throw Object.assign(new Error(`Google sign-in ${res.status}: ${reason}`), { revoked: reason === 'invalid_grant' });
  }
  return JSON.parse(text) as TokenReply;
}

/** Trade the code from the consent screen for tokens. */
export function exchangeCode(client: OAuthClient, code: string, verifier: string, redirectUri: string, fetchImpl: typeof fetch = fetch) {
  return tokenCall({ client_id: client.clientId, client_secret: client.clientSecret, code, code_verifier: verifier, grant_type: 'authorization_code', redirect_uri: redirectUri }, fetchImpl);
}

/** A fresh access token from the stored refresh token. */
export function refreshAccess(client: OAuthClient, refreshToken: string, fetchImpl: typeof fetch = fetch) {
  return tokenCall({ client_id: client.clientId, client_secret: client.clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }, fetchImpl);
}

/** Tell Google to forget the grant. Best effort: the token is dropped here either way. */
export async function revoke(token: string, fetchImpl: typeof fetch = fetch) {
  await fetchImpl(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST', signal: AbortSignal.timeout(10_000) }).catch(() => {});
}

/** Which services a granted scope string covers. */
/**
 * Seeing every calendar on the account (shared, school, holidays), not only the main one. Asked
 * for with Calendar; without it BearRok shows the main calendar only.
 */
export const ALL_CALENDARS_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

export const allCalendarsIn = (scope: string | undefined) => (scope ?? '').split(' ').includes(ALL_CALENDARS_SCOPE);

export const servicesIn = (scope: string | undefined): GoogleService[] =>
  (Object.keys(GOOGLE_SCOPES) as GoogleService[]).filter((s) => (scope ?? '').split(' ').includes(GOOGLE_SCOPES[s]));
