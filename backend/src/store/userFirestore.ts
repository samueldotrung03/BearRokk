// A student's memory in Firestore, read and written as the student themselves.
//
// The copy of the app on a student's laptop has no service account: that key opens the whole
// project and must never be shipped. Instead this talks to Firestore's web API with the student's
// own sign-in token, and the project's security rules let each account reach only
// students/{its own id}. The documents are the same ones the service-account store uses, so a
// memory written by either is read by the other.
import type { StudentMemory } from '../agents/types.ts';

type Value =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { stringValue: string }
  | { arrayValue: { values?: Value[] } }
  | { mapValue: { fields?: Record<string, Value> } };

/** Plain JSON to Firestore's typed form. Undefined values are left out, as JSON does. */
export function toValue(v: unknown): Value {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isSafeInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.filter((x) => x !== undefined).map(toValue) } };
  return { mapValue: { fields: toFields(v as Record<string, unknown>) } };
}

export const toFields = (o: Record<string, unknown>): Record<string, Value> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => [k, toValue(v)]));

export function fromValue(v: any): unknown {
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(fromValue);
  if ('mapValue' in v) return fromFields(v.mapValue.fields ?? {});
  return null;
}

export const fromFields = (fields: Record<string, unknown>): Record<string, unknown> => Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, fromValue(v)]));

export class SignedOutError extends Error {
  constructor(id: string) {
    super(`no current sign-in for ${id}; their memory is saved the next time they connect`);
  }
}

export class UserFirestore {
  private base: string;
  private tokenFor: (id: string) => string | null;
  private fetch: typeof fetch;

  /** `tokenFor` returns the student's latest sign-in token, or null when the backend has none. */
  constructor(projectId: string, tokenFor: (id: string) => string | null, fetcher: typeof fetch = fetch) {
    this.base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
    this.tokenFor = tokenFor;
    this.fetch = fetcher;
  }

  private headers(id: string) {
    const token = this.tokenFor(id);
    if (!token) throw new SignedOutError(id);
    return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  }

  private path(id: string, rest = '') {
    return `students/${encodeURIComponent(id)}${rest}`;
  }

  private async get(id: string, rest: string): Promise<Record<string, unknown> | null> {
    const res = await this.fetch(`${this.base}/${this.path(id, rest)}`, { headers: this.headers(id) });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Firestore read failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
    return fromFields(((await res.json()) as any).fields ?? {});
  }

  async loadStudent(id: string): Promise<StudentMemory | null> {
    const [head, profile, learned] = await Promise.all([this.get(id, ''), this.get(id, '/memory/profile'), this.get(id, '/memory/learned')]);
    if (!head || !profile || !learned) return null;
    return { version: 1, updatedAt: String(head.updatedAt), profile, learned } as unknown as StudentMemory;
  }

  private async commit(id: string, writes: unknown[]) {
    const res = await this.fetch(`${this.base}:commit`, { method: 'POST', headers: this.headers(id), body: JSON.stringify({ writes }) });
    if (!res.ok) throw new Error(`Firestore write failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }

  private name(id: string, rest = '') {
    return `${this.base.slice('https://firestore.googleapis.com/v1/'.length)}/${this.path(id, rest)}`;
  }

  /** All three documents are written together, so a memory is never half saved. */
  async saveStudent(id: string, memory: StudentMemory) {
    const plain = JSON.parse(JSON.stringify(memory)) as StudentMemory;
    await this.commit(id, [
      { update: { name: this.name(id), fields: toFields({ version: plain.version, updatedAt: plain.updatedAt }) } },
      { update: { name: this.name(id, '/memory/profile'), fields: toFields(plain.profile as unknown as Record<string, unknown>) } },
      { update: { name: this.name(id, '/memory/learned'), fields: toFields(plain.learned as unknown as Record<string, unknown>) } },
    ]);
  }

  async deleteStudent(id: string) {
    await this.commit(id, [{ delete: this.name(id, '/memory/profile') }, { delete: this.name(id, '/memory/learned') }, { delete: this.name(id) }]);
  }
}
