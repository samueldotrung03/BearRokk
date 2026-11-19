// Fallback store used until Firebase credentials are configured. Keeps everything in one JSON file.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Opportunity, Search } from '../types.ts';
import type { Store } from './index.ts';

type Data = { searches: Record<string, Search>; opportunities: Record<string, Opportunity[]> };

export class LocalStore implements Store {
  kind = 'local' as const;
  private data: Data = { searches: {}, opportunities: {} };
  private file: string | null;

  /** Pass null to keep data in memory only (tests). */
  constructor(file: string | null) {
    this.file = file;
    if (!file) return;
    try {
      this.data = JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      // first run, or unreadable file: start empty
    }
  }

  private flush() {
    if (!this.file) return;
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify(this.data, null, 2));
  }

  async createSearch(search: Search) {
    this.data.searches[search.id] = search;
    this.flush();
  }

  async getSearch(id: string) {
    return this.data.searches[id] ?? null;
  }

  async updateSearch(id: string, patch: Partial<Search>) {
    const current = this.data.searches[id];
    if (!current) throw new Error(`search ${id} not found`);
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
    this.data.searches[id] = next;
    this.flush();
    return next;
  }

  async listSearches(limit: number) {
    return Object.values(this.data.searches)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async saveOpportunities(searchId: string, opportunities: Opportunity[]) {
    this.data.opportunities[searchId] = opportunities;
    this.flush();
  }

  async getOpportunities(searchId: string) {
    return this.data.opportunities[searchId] ?? [];
  }
}
