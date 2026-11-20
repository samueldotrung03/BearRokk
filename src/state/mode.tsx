import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type BrowseMode = 'foryou' | 'feed';

const ModeContext = createContext<{ mode: BrowseMode; setMode: (mode: BrowseMode) => void } | null>(null);

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<BrowseMode>('foryou');
  const value = useMemo(() => ({ mode, setMode }), [mode]);
  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

export function useBrowseMode() {
  const value = useContext(ModeContext);
  if (!value) throw new Error('Browse mode is only available inside the app shell.');
  return value;
}
