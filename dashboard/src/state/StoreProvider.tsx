import { createContext, useContext, useEffect, useMemo, useReducer, useState, type Dispatch, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthProvider.tsx';
import { API_URL } from '../auth/firebase.ts';
import { initialState } from '../data/sample.ts';
import { goalForProfile } from '../lib/personalize.ts';
import { fromBackendProfile, loadState, reducer, saveState, startingState, type Action, type AppState } from './store.ts';

const StoreContext = createContext<{ state: AppState; dispatch: Dispatch<Action> } | null>(null);

/** The saved state for this account (or the guest), or a fresh start when there is none. */
const openState = (uid: string | null) => loadState(startingState(initialState, uid !== null), uid);

export function StoreProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const uid = auth.status === 'signedIn' && auth.user ? auth.user.uid : null;
  const [state, dispatch] = useReducer(reducer, uid, openState);

  // Signing in, out or into another account swaps in that account's state during this render,
  // so nothing is ever saved under the wrong account.
  const [loadedFor, setLoadedFor] = useState(uid);
  if (loadedFor !== uid) {
    setLoadedFor(uid);
    dispatch({ type: 'load', state: openState(uid) });
  }

  useEffect(() => {
    if (loadedFor === uid) saveState(state, uid);
  }, [state, uid, loadedFor]);

  // A signed-in student with no profile on this device (a new device, or after a clean demo):
  // take the profile the backend already has for them, or at least the name on their account.
  const blank = uid !== null && !state.profile.name.trim();
  const accountName = auth.user?.displayName?.trim() ?? '';
  useEffect(() => {
    if (!blank || auth.backend === 'checking') return;
    let cancelled = false;
    const fromAccount = () => {
      if (accountName) dispatch({ type: 'adoptProfile', profile: { name: accountName.split(/\s+/)[0], fullName: accountName } });
    };
    if (auth.backend !== 'connected') {
      fromAccount();
      return;
    }
    void (async () => {
      try {
        const token = await auth.getToken();
        const res = await fetch(`${API_URL}/api/students/me/state`, { headers: { Authorization: `Bearer ${token}` } });
        const own = res.ok ? fromBackendProfile(((await res.json()) as { student?: { profile?: unknown } }).student?.profile) : null;
        if (cancelled) return;
        if (!own) return fromAccount();
        const goalId = goalForProfile({
          major: own.profile.major,
          topField: own.preferences?.topField,
          fields: own.preferences?.fields,
          careerInterests: own.profile.careerInterests,
        });
        dispatch({ type: 'adoptProfile', ...own, goalId });
      } catch {
        if (!cancelled) fromAccount();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blank, uid, auth.backend, accountName]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreContext value={value}>{children}</StoreContext>;
}

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}
