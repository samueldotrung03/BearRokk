// Who is using the app. Sign-in goes through Firebase; the backend checks the same token and
// gives each signed-in student their own agents.
import {
  GoogleAuthProvider,
  TwitterAuthProvider,
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isDesktop, signInThroughBrowser } from './desktop.ts';
import { API_URL, auth } from './firebase.ts';
import { requestGoogleAccess, type GoogleService } from './google.ts';
import { storageKey } from '../state/store.ts';

/** loading: still finding out. guest: looking around on sample data without an account. */
export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'guest';
/** Whether the agent backend accepted this sign-in. offline: it is not running or unreachable. */
export type BackendStatus = 'checking' | 'connected' | 'offline' | 'rejected';

interface AuthValue {
  status: AuthStatus;
  user: User | null;
  backend: BackendStatus;
  /**
   * In the browser this opens the provider's window. In the desktop app it opens the system browser
   * and waits; abort `signal` to stop waiting.
   */
  signInWithProvider: (provider: 'google' | 'x', remember: boolean, signal: AbortSignal) => Promise<void>;
  signInWithEmail: (email: string, password: string, remember: boolean) => Promise<void>;
  /** Creates the account, stores the name on it, and emails a link to confirm the address. */
  createAccount: (name: string, email: string, password: string) => Promise<void>;
  /** Store the student's name on their account (Google and X accounts can correct theirs at set-up). */
  setDisplayName: (name: string) => Promise<void>;
  /** Emails a link for choosing a new password. Resolves the same way whether or not the address has an account. */
  resetPassword: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  /** Send the student's profile to the agent backend. Resolves false if it could not be reached. */
  saveProfile: (profile: Record<string, unknown>) => Promise<boolean>;
  continueAsGuest: () => void;
  signOut: () => Promise<void>;
  /** A fresh token for calls to the backend, or null when not signed in. */
  getToken: () => Promise<string | null>;
  /** Google access tokens for services connected in Settings this session; null when not connected. */
  google: Record<GoogleService, string | null>;
  connectGoogle: (service: GoogleService, signal: AbortSignal) => Promise<void>;
  disconnectGoogle: (service: GoogleService) => void;
  /** Removes the account and what the backend holds for it. Firebase may ask for a fresh sign-in first. */
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);
const GUEST_KEY = 'bearrok.guest';

const readGuest = () => {
  try {
    return sessionStorage.getItem(GUEST_KEY) === '1';
  } catch {
    return false;
  }
};

const remembering = (remember: boolean) => setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [guest, setGuest] = useState(readGuest);
  const [backend, setBackend] = useState<BackendStatus>('checking');
  const [google, setGoogle] = useState<Record<GoogleService, string | null>>({ account: null, calendar: null, sheets: null });

  useEffect(
    () =>
      onAuthStateChanged(auth, (next) => {
        setUser(next);
        setReady(true);
      }),
    [],
  );

  // Ask the backend whether it accepts this sign-in.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setBackend('checking');
    user
      .getIdToken()
      .then((token) => fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } }))
      .then((res) => !cancelled && setBackend(res.ok ? 'connected' : 'rejected'))
      .catch(() => !cancelled && setBackend('offline'));
    return () => {
      cancelled = true;
    };
  }, [user]);

  const setGuestFlag = useCallback((on: boolean) => {
    setGuest(on);
    try {
      if (on) sessionStorage.setItem(GUEST_KEY, '1');
      else sessionStorage.removeItem(GUEST_KEY);
    } catch {
      // Private mode: the choice just is not remembered.
    }
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      status: !ready ? 'loading' : user ? 'signedIn' : guest ? 'guest' : 'signedOut',
      user,
      backend,
      signInWithProvider: async (provider, remember, signal) => {
        await remembering(remember);
        if (isDesktop) {
          await signInWithCredential(auth, await signInThroughBrowser(provider, signal));
          return;
        }
        await signInWithPopup(auth, provider === 'x' ? new TwitterAuthProvider() : new GoogleAuthProvider());
      },
      signInWithEmail: async (email, password, remember) => {
        await remembering(remember);
        await signInWithEmailAndPassword(auth, email, password);
      },
      createAccount: async (name, email, password) => {
        await remembering(true);
        const { user: created } = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (name.trim()) await updateProfile(created, { displayName: name.trim() });
        // Confirming the address is asked for, not required to get in.
        await sendEmailVerification(created).catch(() => {});
      },
      setDisplayName: async (name) => {
        if (auth.currentUser && name.trim() && auth.currentUser.displayName !== name.trim()) await updateProfile(auth.currentUser, { displayName: name.trim() });
      },
      resetPassword: (email) => sendPasswordResetEmail(auth, email.trim()),
      resendVerification: async () => {
        if (auth.currentUser) await sendEmailVerification(auth.currentUser);
      },
      saveProfile: async (profile) => {
        const token = await auth.currentUser?.getIdToken();
        if (!token) return false;
        try {
          const res = await fetch(`${API_URL}/api/students/me/profile`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(profile),
          });
          return res.ok;
        } catch {
          return false;
        }
      },
      continueAsGuest: () => setGuestFlag(true),
      google,
      connectGoogle: async (service, signal) => {
        const token = await requestGoogleAccess([service], signal);
        setGoogle((g) => ({ ...g, [service]: token }));
      },
      disconnectGoogle: (service) => setGoogle((g) => ({ ...g, [service]: null })),
      deleteAccount: async () => {
        const current = auth.currentUser;
        if (!current) return;
        const token = await current.getIdToken();
        // Firebase first: if it refuses (it wants a recent sign-in), nothing has been removed yet.
        await deleteUser(current);
        await fetch(`${API_URL}/api/students/me`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
        try {
          localStorage.removeItem(`bearrok.onboarded.${current.uid}`);
          localStorage.removeItem(storageKey(current.uid));
        } catch {
          // nothing to clear
        }
        setGoogle({ account: null, calendar: null, sheets: null });
      },
      signOut: async () => {
        setGuestFlag(false);
        setGoogle({ account: null, calendar: null, sheets: null });
        await firebaseSignOut(auth);
      },
      getToken: async () => (auth.currentUser ? auth.currentUser.getIdToken() : null),
    }),
    [ready, user, guest, backend, google, setGuestFlag],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
