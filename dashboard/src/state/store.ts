// What the student has done in the app. This is the "memory" the master agent reads on its
// next run; until the backend stores it, it lives in localStorage.
import { withDefaults, type Preferences } from '../data/preferences.ts';
import type { Application, ApplicationStatus, ClassYear, Profile } from '../types.ts';

export interface AppState {
  saved: string[];
  dismissed: string[];
  opened: string[];
  liked: string[];
  doneSteps: string[];
  /** Opportunities the student added to the roadmap from the feed, as extra steps. */
  extraSteps: string[];
  applications: Record<string, Application>;
  goalId: string;
  /** The student picked the goal themselves (Roadmap or Career discovery), so suggestions leave it alone. */
  goalChosen?: boolean;
  profile: Profile;
  /** Answers on the profile page: career interests, restrictions and notes. */
  preferences?: Preferences;
}

export type Action =
  | { type: 'toggleSaved'; id: string }
  | { type: 'dismiss'; id: string }
  | { type: 'restore'; id: string }
  | { type: 'opened'; id: string }
  | { type: 'toggleLiked'; id: string }
  | { type: 'toggleStep'; id: string }
  | { type: 'addStep'; id: string }
  | { type: 'removeStep'; id: string }
  | { type: 'setApplication'; id: string; status: ApplicationStatus | null }
  | { type: 'setDraft'; id: string; index: number; text: string }
  | { type: 'toggleMaterial'; id: string; name: string }
  /** The student picked a goal by hand. */
  | { type: 'setGoal'; id: string }
  /** A goal worked out from the student's answers; ignored once they have picked one themselves. */
  | { type: 'suggestGoal'; id: string | null }
  /** Fills a blank profile from what the account or the backend already knows; ignored once there is a name. */
  | { type: 'adoptProfile'; profile: Partial<Profile>; preferences?: Preferences; goalId?: string | null }
  /** Swaps in another account's saved state. */
  | { type: 'load'; state: AppState }
  | { type: 'setProfile'; profile: Partial<Profile> }
  | { type: 'setPreferences'; preferences: Preferences }
  | { type: 'setYear'; year: ClassYear }
  | { type: 'setLocation'; location: string }
  | { type: 'toggleInterest'; value: string }
  | { type: 'toggleSkill'; value: string }
  | { type: 'resetHistory' };

/** The id a feed opportunity gets when it is added to the roadmap as an extra step. */
export const extraStepId = (opportunityId: string) => `extra-${opportunityId}`;

function suggest(state: AppState, id: string | null): AppState {
  return !id || state.goalChosen || id === state.goalId ? state : { ...state, goalId: id };
}

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
        liked: state.liked.filter((id) => id !== action.id),
      };
    case 'restore':
      return { ...state, dismissed: state.dismissed.filter((id) => id !== action.id) };
    case 'opened':
      return state.opened.includes(action.id) ? state : { ...state, opened: [...state.opened, action.id] };
    case 'toggleLiked':
      return { ...state, liked: toggle(state.liked, action.id) };
    case 'addStep':
      return state.extraSteps.includes(action.id) ? state : { ...state, extraSteps: [...state.extraSteps, action.id] };
    case 'removeStep':
      return {
        ...state,
        extraSteps: state.extraSteps.filter((id) => id !== action.id),
        doneSteps: state.doneSteps.filter((id) => !id.startsWith(extraStepId(action.id))),
      };
    case 'setApplication': {
      const { [action.id]: current, ...rest } = state.applications;
      if (action.status === null) return { ...state, applications: rest };
      const next: Application = { drafts: {}, materialsDone: [], ...current, status: action.status };
      return { ...state, applications: { ...rest, [action.id]: next } };
    }
    case 'setDraft': {
      const current = state.applications[action.id];
      if (!current) return state;
      const drafts = { ...current.drafts, [action.index]: action.text };
      return { ...state, applications: { ...state.applications, [action.id]: { ...current, drafts } } };
    }
    case 'toggleMaterial': {
      const current = state.applications[action.id];
      if (!current) return state;
      const materialsDone = toggle(current.materialsDone, action.name);
      return { ...state, applications: { ...state.applications, [action.id]: { ...current, materialsDone } } };
    }
    case 'toggleStep':
      return { ...state, doneSteps: toggle(state.doneSteps, action.id) };
    case 'setGoal':
      return { ...state, goalId: action.id, goalChosen: true };
    case 'suggestGoal':
      return suggest(state, action.id);
    case 'adoptProfile': {
      if (state.profile.name.trim() || !action.profile.name?.trim()) return state;
      const next = { ...state, profile: { ...state.profile, ...action.profile }, preferences: state.preferences ?? action.preferences };
      return suggest(next, action.goalId ?? null);
    }
    case 'load':
      return action.state;
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
      return { ...state, saved: [], liked: [], dismissed: [], opened: [] };
  }
}

const STORAGE_KEY = 'bearrok.dashboard.v3';

/**
 * Where a student's state is kept. A guest keeps the original key; each signed-in account gets its
 * own, so a new account never opens on the sample student's progress or on another account's.
 */
export const storageKey = (uid: string | null) => (uid ? `${STORAGE_KEY}.${uid}` : STORAGE_KEY);

/**
 * What a student starts with before anything is saved. A guest gets the sample student; a signed-in
 * student gets the same app with nothing done yet and a blank profile that sign-up fills in.
 */
export function startingState(sample: AppState, signedIn: boolean): AppState {
  if (!signedIn) return sample;
  return {
    ...sample,
    saved: [],
    dismissed: [],
    opened: [],
    liked: [],
    doneSteps: [],
    extraSteps: [],
    applications: {},
    goalChosen: false,
    preferences: undefined,
    profile: { name: '', fullName: '', major: '', about: '', school: '', year: 'Freshman', location: '', interests: [], skills: [], careerInterests: [], eventTypes: [] },
  };
}

const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : undefined);
const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const YEARS: ClassYear[] = ['Freshman', 'Sophomore', 'Junior', 'Senior'];

/**
 * The student's own profile from the backend's `/state`, or null when the backend only has its
 * built-in demo student (it starts every account as Maya until the student's profile is sent).
 */
export function fromBackendProfile(raw: unknown): { profile: Partial<Profile>; preferences?: Preferences } | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const name = text(p.name);
  if (!name) return null;
  const careerInterests = strings(p.careerInterests) ?? [];
  const preferences = p.preferences && typeof p.preferences === 'object' ? withDefaults(p.preferences as Partial<Preferences>) : undefined;
  const demoSeed = name === 'Maya' && p.school === 'UC Berkeley' && p.major === 'Computer Science' && !preferences && careerInterests.length === 0;
  if (demoSeed) return null;
  const profile: Partial<Profile> = { name, fullName: name, careerInterests };
  for (const key of ['school', 'major', 'location'] as const) {
    const value = text(p[key]);
    if (value) profile[key] = value;
  }
  if (YEARS.includes(p.year as ClassYear)) profile.year = p.year as ClassYear;
  const interests = strings(p.interests);
  if (interests) profile.interests = interests;
  const skills = strings(p.skills);
  if (skills) profile.skills = skills;
  const eventTypes = strings(p.eventTypes);
  if (eventTypes) profile.eventTypes = eventTypes;
  return { profile, ...(preferences ? { preferences } : {}) };
}

/** localStorage keys "Start a clean demo" leaves alone: whether each account has finished sign-up. */
const keptOnReset = (key: string) => key.startsWith('bearrok.onboarded.');

/** Removes everything the app keeps on this device except sign-in and sign-up records. Returns the keys removed. */
export function clearDemoStorage(storage: Pick<Storage, 'length' | 'key' | 'removeItem'>): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith('bearrok.') && !keptOnReset(key)) keys.push(key);
  }
  for (const key of keys) storage.removeItem(key);
  return keys;
}

export function loadState(initial: AppState, uid: string | null = null): AppState {
  try {
    const raw = localStorage.getItem(storageKey(uid));
    if (!raw) return initial;
    const stored = JSON.parse(raw) as Partial<AppState>;
    return { ...initial, ...stored, profile: { ...initial.profile, ...stored.profile } };
  } catch {
    return initial;
  }
}

export function saveState(state: AppState, uid: string | null = null): void {
  try {
    localStorage.setItem(storageKey(uid), JSON.stringify(state));
  } catch {
    // Private mode or a full quota: the session still works, it just is not remembered.
  }
}
