// Firestore layout:
//   searches/{searchId}                         one Search document
//   searches/{searchId}/opportunities/{oppId}   one Opportunity document per validated result
//   students/{accountId}                        when the student's memory was last saved
//   students/{accountId}/memory/profile         section 1: what the student told the app
//   students/{accountId}/memory/learned         section 2: what the app learned (reactions, searches, results)
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { firebaseApp } from '../firebase.ts';
import type { StudentMemory } from '../agents/types.ts';
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

  private studentRef(id: string) {
    return this.db.collection('students').doc(id);
  }

  async loadStudent(id: string) {
    const ref = this.studentRef(id);
    const [head, profile, learned] = await Promise.all([ref.get(), ref.collection('memory').doc('profile').get(), ref.collection('memory').doc('learned').get()]);
    if (!head.exists || !profile.exists || !learned.exists) return null;
    return { version: 1, updatedAt: String(head.data()!.updatedAt), profile: profile.data(), learned: learned.data() } as StudentMemory;
  }

  async saveStudent(id: string, memory: StudentMemory) {
    const ref = this.studentRef(id);
    // Firestore refuses undefined values; a JSON round trip drops them.
    const plain = JSON.parse(JSON.stringify(memory)) as StudentMemory;
    const batch = this.db.batch();
    batch.set(ref, { version: plain.version, updatedAt: plain.updatedAt });
    batch.set(ref.collection('memory').doc('profile'), plain.profile);
    batch.set(ref.collection('memory').doc('learned'), plain.learned);
    await batch.commit();
  }

  async deleteStudent(id: string) {
    const ref = this.studentRef(id);
    const batch = this.db.batch();
    batch.delete(ref.collection('memory').doc('profile'));
    batch.delete(ref.collection('memory').doc('learned'));
    batch.delete(ref);
    await batch.commit();
  }
}
