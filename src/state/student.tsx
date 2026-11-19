import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'bearrok.discovery';

export type Reaction = 'like' | 'dislike';

interface PersistedChoices {
  saved: string[];
  reactions: Record<string, Reaction>;
}

interface StudentChoices extends PersistedChoices {
  savedSet: ReadonlySet<string>;
  toggleSaved: (id: string) => void;
  react: (id: string, reaction: Reaction) => void;
}

const StudentContext = createContext<StudentChoices | null>(null);

function emptyChoices(): PersistedChoices {
  return { saved: [], reactions: {} };
}

function loadChoices(): PersistedChoices {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyChoices();
    const parsed = JSON.parse(raw) as Partial<PersistedChoices>;
    const reactions: Record<string, Reaction> = {};
    for (const [id, value] of Object.entries(parsed.reactions ?? {})) {
      if (value === 'like' || value === 'dislike') reactions[id] = value;
    }
    const saved = Array.isArray(parsed.saved) ? parsed.saved.filter((id): id is string => typeof id === 'string') : [];
    return { saved, reactions };
  } catch {
    return emptyChoices();
  }
}

export function StudentProvider({ children }: { children: ReactNode }) {
  const [choices, setChoices] = useState<PersistedChoices>(loadChoices);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(choices));
  }, [choices]);

  const value = useMemo<StudentChoices>(() => {
    return {
      ...choices,
      savedSet: new Set(choices.saved),
      toggleSaved: (id) => {
        setChoices((current) => {
          const saved = current.saved.includes(id) ? current.saved.filter((item) => item !== id) : [...current.saved, id];
          return { ...current, saved };
        });
      },
      react: (id, reaction) => {
        setChoices((current) => {
          const reactions = { ...current.reactions };
          if (reactions[id] === reaction) delete reactions[id];
          else reactions[id] = reaction;
          return { ...current, reactions };
        });
      },
    };
  }, [choices]);

  return <StudentContext.Provider value={value}>{children}</StudentContext.Provider>;
}

export function useStudent() {
  const value = useContext(StudentContext);
  if (!value) throw new Error('Save and like state is only available inside the app.');
  return value;
}
