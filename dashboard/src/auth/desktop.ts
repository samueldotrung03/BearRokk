// Sign-in for the desktop app. Google and X sign-in happen in the system browser, not in a window
// of the app: the app opens the browser, waits for the backend to hand the result over, and
// signs in with it. See backend/src/desktopAuth.ts for the other half.
import { GoogleAuthProvider, TwitterAuthProvider, type OAuthCredential } from 'firebase/auth';
import { API_URL } from './firebase.ts';

export const isDesktop = /Electron/.test(navigator.userAgent);

const hex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('cancelled', 'AbortError'));
    });
  });

/**
 * Opens the system browser for sign-in and resolves with the credential once the student has
 * finished there. Rejects with an AbortError if `signal` is aborted, or after five minutes.
 */
export async function signInThroughBrowser(provider: 'google' | 'x', signal: AbortSignal): Promise<OAuthCredential> {
  // A secret only this window knows. The browser sees its hash; collecting the result needs the secret.
  const verifier = hex(crypto.getRandomValues(new Uint8Array(32)));
  const session = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));

  // The desktop shell sends any outside address to the system browser.
  window.open(`${API_URL}/auth/desktop?session=${session}&provider=${provider}`, '_blank');

  const deadline = Date.now() + 5 * 60_000;
  while (Date.now() < deadline) {
    await wait(1500, signal);
    const res = await fetch(`${API_URL}/api/auth/desktop/${session}/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ verifier }),
      signal,
    }).catch((e) => {
      if (signal.aborted) throw e;
      return null; // backend briefly unreachable: keep waiting
    });
    if (res?.status !== 200) continue;
    const { credential } = (await res.json()) as { credential: { idToken: string | null; accessToken: string | null; secret: string | null } };
    if (provider === 'x') return TwitterAuthProvider.credential(credential.accessToken ?? '', credential.secret ?? '');
    return GoogleAuthProvider.credential(credential.idToken, credential.accessToken);
  }
  throw Object.assign(new Error('timed out'), { code: 'desktop/timed-out' });
}
