// Firestore layout:
//   searches/{searchId}                         one Search document
//   searches/{searchId}/opportunities/{oppId}   one Opportunity document per validated result
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { firebaseApp } from '../firebase.ts';
import type { Opportunity, Search } from '../types.ts';
import type { Store } from './index.ts';

export class FirestoreStore implements Store {
  kind = 'firestore' as const;
  private db: Firestore;

  private constructor(db: Firestore) {
    this.db = db;
  }

  static open() {
    const app = firebaseApp();
    if (!app) throw new Error('Firebase is not configured');
    return new FirestoreStore(getFirestore(app));
  }

  private searchRef(id: string) {
    return this.db.collection('searches').doc(id);
  }

  async createSearch(search: Search) {
    await this.searchRef(search.id).set(search);
  }

  async getSearch(id: string) {
    const snap = await this.searchRef(id).get();
    return snap.exists ? (snap.data() as Search) : null;
  }

  async updateSearch(id: string, patch: Partial<Search>) {
    const ref = this.searchRef(id);
    await ref.update({ ...patch, updatedAt: new Date().toISOString() });
    return (await ref.get()).data() as Search;
  }

  async listSearches(limit: number) {
    const snap = await this.db.collection('searches').orderBy('createdAt', 'desc').limit(limit).get();
    return snap.docs.map((d) => d.data() as Search);
  }

  async saveOpportunities(searchId: string, opportunities: Opportunity[]) {
    const col = this.searchRef(searchId).collection('opportunities');
    const existing = await col.get();
    const batch = this.db.batch();
    for (const doc of existing.docs) batch.delete(doc.ref);
    for (const opp of opportunities) batch.set(col.doc(opp.id), opp);
    await batch.commit();
  }

  async getOpportunities(searchId: string) {
    const snap = await this.searchRef(searchId).collection('opportunities').get();
    return snap.docs.map((d) => d.data() as Opportunity);
  }
}
