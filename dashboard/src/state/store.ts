// What the student has done in the app. This is the "memory" the master agent reads on its
// next run; until the backend stores it, it lives in localStorage.
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
  profile: Profile;
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
  | { type: 'setGoal'; id: string }
  | { type: 'setYear'; year: ClassYear }
  | { type: 'setLocation'; location: string }
  | { type: 'toggleInterest'; value: string }
  | { type: 'toggleSkill'; value: string }
  | { type: 'resetHistory' };

/** The id a feed opportunity gets when it is added to the roadmap as an extra step. */
export const extraStepId = (opportunityId: string) => `extra-${opportunityId}`;

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
      return { ...state, goalId: action.id };
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
