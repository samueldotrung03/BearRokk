// What the student has done in the app. This is the "memory" the master agent reads on its
// next run; until the backend stores it, it lives in localStorage.
import type { ClassYear, Profile } from '../types.ts';
import type { Preferences } from '../data/preferences.ts';

export interface AppState {
  saved: string[];
  dismissed: string[];
  opened: string[];
  doneSteps: string[];
  goalId: string;
  profile: Profile;
  /** Answers on the profile page: career interests, restrictions and notes. */
  preferences?: Preferences;
}

export type Action =
  | { type: 'toggleSaved'; id: string }
  | { type: 'dismiss'; id: string }
  | { type: 'restore'; id: string }
  | { type: 'opened'; id: string }
  | { type: 'toggleStep'; id: string }
  | { type: 'setGoal'; id: string }
  | { type: 'setProfile'; profile: Partial<Profile> }
  | { type: 'setPreferences'; preferences: Preferences }
  | { type: 'setYear'; year: ClassYear }
  | { type: 'setLocation'; location: string }
  | { type: 'toggleInterest'; value: string }
  | { type: 'toggleSkill'; value: string }
  | { type: 'resetHistory' };

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'toggleSaved':
      return { ...state, saved: toggle(state.saved, action.id) };
    case 'dismiss':
      return {
        ...state,
        dismissed: state.dismissed.includes(action.id) ? state.dismissed : [...state.dismissed, action.id],
        saved: state.saved.filter((id) => id !== action.id),
      };
    case 'restore':
      return { ...state, dismissed: state.dismissed.filter((id) => id !== action.id) };
    case 'opened':
      return state.opened.includes(action.id) ? state : { ...state, opened: [...state.opened, action.id] };
    case 'toggleStep':
      return { ...state, doneSteps: toggle(state.doneSteps, action.id) };
    case 'setGoal':
      return { ...state, goalId: action.id };
    case 'setPreferences':
      return { ...state, preferences: action.preferences };
    case 'setProfile':
      return { ...state, profile: { ...state.profile, ...action.profile } };
    case 'setYear':
      return { ...state, profile: { ...state.profile, year: action.year } };
    case 'setLocation':
      return { ...state, profile: { ...state.profile, location: action.location } };
    case 'toggleInterest':
      return { ...state, profile: { ...state.profile, interests: toggle(state.profile.interests, action.value) } };
    case 'toggleSkill':
      return { ...state, profile: { ...state.profile, skills: toggle(state.profile.skills, action.value) } };
    case 'resetHistory':
      return { ...state, saved: [], dismissed: [], opened: [] };
  }
}

const STORAGE_KEY = 'bearrok.dashboard.v2';

export function loadState(initial: AppState): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initial;
    const stored = JSON.parse(raw) as Partial<AppState>;
    return { ...initial, ...stored, profile: { ...initial.profile, ...stored.profile } };
  } catch {
    return initial;
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode or a full quota: the session still works, it just is not remembered.
  }
}
