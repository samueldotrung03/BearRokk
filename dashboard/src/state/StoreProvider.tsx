import { createContext, useContext, useEffect, useMemo, useReducer, type Dispatch, type ReactNode } from 'react';
import { initialState } from '../data/sample.ts';
import { loadState, reducer, saveState, type Action, type AppState } from './store.ts';

const StoreContext = createContext<{ state: AppState; dispatch: Dispatch<Action> } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState, loadState);
  useEffect(() => {
    saveState(state);
  }, [state]);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreContext value={value}>{children}</StoreContext>;
}

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}
