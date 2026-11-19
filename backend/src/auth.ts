// Sign-in through Firebase Authentication, with Google, X (Twitter), or email and password. The browser
// signs in and sends the Firebase ID token with each request; the backend verifies it and uses
// the uid as the student id.
import { config } from './config.ts';
import { idTokenVerifier } from './idToken.ts';

export interface AuthUser {
  uid: string;
  name: string | null;
  email: string | null;
  picture: string | null;
  provider: 'google' | 'x' | 'password';
  /** Always true for Google. For email sign-in, true once the student has clicked the link Firebase emails them. */
  emailVerified: boolean;
}

/** Sign-in methods the backend accepts, by Firebase provider id. */
export const PROVIDERS = { 'google.com': 'google', 'twitter.com': 'x', password: 'password' } as const;

export type Verifier = (token: string) => Promise<AuthUser>;

/** Settings the browser needs to start sign-in. These identify the project; they are not secrets. */
export function webConfig(): { apiKey: string; authDomain: string; projectId: string } | null {
  const { apiKey, projectId } = config.firebaseWeb;
  if (!apiKey || !projectId) return null;
  return { apiKey, projectId, authDomain: config.firebaseWeb.authDomain ?? `${projectId}.firebaseapp.com` };
}

/**
 * Null when sign-in is not configured. Only the project id is needed: tokens are checked against
 * Google's public keys, so this works the same with or without a service account.
 */
export function firebaseVerifier(): Verifier | null {
  const web = webConfig();
  if (!web) return null;
  const verifyToken = idTokenVerifier(web.projectId);
  return async (token) => {
    const t = await verifyToken(token);
    const provider = PROVIDERS[t.firebase?.sign_in_provider as keyof typeof PROVIDERS];
    if (!provider) throw new Error('sign-in method not accepted');
    return {
      uid: t.sub,
      name: t.name ?? null,
      email: t.email ?? null,
      picture: t.picture ?? null,
      provider,
      emailVerified: t.email_verified === true,
    };
  };
}
