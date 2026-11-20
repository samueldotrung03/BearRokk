// Which kind of opportunity each search manager works on. Every manager has one kind, so the
// Agents page can show it: one kind ticked means all four managers work on it; more than four
// kinds means the first four in the list get a manager each, and the rest share the manager of
// the same category (only programs have more than one kind: hackathons, research, scholarships).
import { CATEGORY_OF, type Category, type OppType } from './types.ts';

export const KIND_ORDER: OppType[] = ['internship', 'event', 'club', 'hackathon', 'research', 'scholarship'];

export const KIND_TITLE: Record<OppType, string> = {
  internship: 'Internships',
  event: 'Events',
  club: 'Clubs',
  hackathon: 'Hackathons',
  research: 'Research',
  scholarship: 'Scholarships',
};

export interface LineupSlot {
  kind: OppType;
  /** Kinds past the first four that this manager also covers. */
  also: OppType[];
}

export function planLineup(kinds: OppType[], weights: Record<Category, number>, slots: number, focus: OppType | null = null): LineupSlot[] {
  if (focus) return Array.from({ length: slots }, () => ({ kind: focus, also: [] }));
  const wanted = KIND_ORDER.filter((k) => kinds.includes(k));
  if (wanted.length === 0) return [];
  if (wanted.length >= slots) {
    const top: LineupSlot[] = wanted.slice(0, slots).map((kind) => ({ kind, also: [] }));
    for (const rest of wanted.slice(slots)) {
      const host = [...top].reverse().find((s) => CATEGORY_OF[s.kind] === CATEGORY_OF[rest]) ?? top[top.length - 1]!;
      host.also.push(rest);
    }
    return top;
  }
  // Fewer kinds than managers: one each, and the spare managers go to the kinds the student engages
  // with most, in turn.
  const count = new Map(wanted.map((k) => [k, 1]));
  const byWeight = [...wanted].sort((a, b) => (weights[CATEGORY_OF[b]] ?? 0) - (weights[CATEGORY_OF[a]] ?? 0) || KIND_ORDER.indexOf(a) - KIND_ORDER.indexOf(b));
  for (let spare = slots - wanted.length, i = 0; spare > 0; spare--, i++) {
    const k = byWeight[i % byWeight.length]!;
    count.set(k, count.get(k)! + 1);
  }
  return wanted.flatMap((kind) => Array.from({ length: count.get(kind)! }, () => ({ kind, also: [] as OppType[] })));
}

/** Names as the Agents page shows them: "Internships manager 2". */
export function lineupNames(lineup: LineupSlot[]): string[] {
  const total = new Map<OppType, number>();
  for (const s of lineup) total.set(s.kind, (total.get(s.kind) ?? 0) + 1);
  const seen = new Map<OppType, number>();
  return lineup.map((s) => {
    const n = (seen.get(s.kind) ?? 0) + 1;
    seen.set(s.kind, n);
    return `${KIND_TITLE[s.kind]} manager${total.get(s.kind)! > 1 ? ` ${n}` : ''}`;
  });
}
