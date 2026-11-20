import { config } from '../config.ts';
import type { StudentMemory } from '../agents/types.ts';
import type { Opportunity, Search } from '../types.ts';
import { LocalStore } from './local.ts';

export interface Store {
  kind: 'firestore' | 'local';
  createSearch(search: Search): Promise<void>;
  getSearch(id: string): Promise<Search | null>;
  updateSearch(id: string, patch: Partial<Search>): Promise<Search>;
  listSearches(limit: number): Promise<Search[]>;
  /** Replaces the result set of a search. */
  saveOpportunities(searchId: string, opportunities: Opportunity[]): Promise<void>;
  getOpportunities(searchId: string): Promise<Opportunity[]>;
  /**
   * A student's memory, kept under their account id: the profile they wrote, and what the app
   * learned from their reactions and the agents' searches. Null for a student never seen before.
   */
  loadStudent(id: string): Promise<StudentMemory | null>;
  saveStudent(id: string, memory: StudentMemory): Promise<void>;
  deleteStudent(id: string): Promise<void>;
}

export async function openStore(): Promise<Store> {
  if (config.firebaseServiceAccount) {
    const { FirestoreStore } = await import('./firestore.ts');
    return FirestoreStore.open();
  }
  return new LocalStore(config.localDataFile);
}
