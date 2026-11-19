import { config } from '../config.ts';
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
}

export async function openStore(): Promise<Store> {
  if (config.firebaseServiceAccount) {
    const { FirestoreStore } = await import('./firestore.ts');
    return FirestoreStore.open(config.firebaseServiceAccount);
  }
  return new LocalStore(config.localDataFile);
}
