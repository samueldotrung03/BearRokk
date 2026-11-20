// Extra Google permissions (Calendar, Sheets) asked for from Settings. This gets a Google access
// token for the chosen permissions without changing who is signed in to the app. Tokens last about
// an hour and are kept in memory only.
import { initializeApp } from 'firebase/app';
import { GoogleAuthProvider, browserPopupRedirectResolver, inMemoryPersistence, initializeAuth, signInWithPopup, signOut, type Auth } from 'firebase/auth';
import { API_URL, auth as mainAuth } from './firebase.ts';
import { isDesktop } from './desktop.ts';

/** account: plain Google access with no extra permission. */
export type GoogleService = 'account' | 'calendar' | 'sheets';

export const ALL_CALENDARS_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

export const GOOGLE_SCOPES: Partial<Record<GoogleService, string>> = {
  calendar: 'https://www.googleapis.com/auth/calendar.events',
  sheets: 'https://www.googleapis.com/auth/spreadsheets',
};

let side: Auth | null = null;
/** A second, memory-only Firebase session used just to ask Google for a token. */
function sideAuth(): Auth {
  side ??= initializeAuth(initializeApp(mainAuth.app.options, 'google-connect'), {
    persistence: inMemoryPersistence,
    popupRedirectResolver: browserPopupRedirectResolver,
  });
  return side;
}

const hex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

/** Desktop: the permission screen opens in the system browser and the backend hands the token back. */
async function throughBrowser(services: GoogleService[], signal: AbortSignal): Promise<string> {
  const verifier = hex(crypto.getRandomValues(new Uint8Array(32)));
  const session = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  window.open(`${API_URL}/auth/desktop?session=${session}&provider=google&scopes=${services.join(',')}`, '_blank');
  const deadline = Date.now() + 5 * 60_000;
  while (Date.now() < deadline) {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 1500);
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('cancelled', 'AbortError'));
      });
    });
    const res = await fetch(`${API_URL}/api/auth/desktop/${session}/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ verifier }),
      signal,
    }).catch((e) => {
      if (signal.aborted) throw e;
      return null;
    });
    if (res?.status !== 200) continue;
    const { credential } = (await res.json()) as { credential: { accessToken: string | null } };
    if (credential.accessToken) return credential.accessToken;
    break;
  }
  throw Object.assign(new Error('timed out'), { code: 'desktop/timed-out' });
}

/** Ask Google for a token covering `services`. Rejects if the student closes the window or declines. */
export async function requestGoogleAccess(services: GoogleService[], signal: AbortSignal): Promise<string> {
  if (isDesktop) return throughBrowser(services, signal);
  const provider = new GoogleAuthProvider();
  for (const s of services) {
    const scope = GOOGLE_SCOPES[s];
    if (scope) provider.addScope(scope);
  }
  // Seeing every calendar on the account, not only the main one.
  if (services.includes('calendar')) provider.addScope(ALL_CALENDARS_SCOPE);
  // Suggest the account they are signed in with.
  const email = mainAuth.currentUser?.email;
  if (email) provider.setCustomParameters({ login_hint: email });
  const result = await signInWithPopup(sideAuth(), provider);
  const token = GoogleAuthProvider.credentialFromResult(result)?.accessToken;
  await signOut(sideAuth()).catch(() => {});
  if (!token) throw new Error('Google did not return a token');
  return token;
}
