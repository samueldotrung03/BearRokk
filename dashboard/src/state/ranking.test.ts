import { describe, expect, it } from 'vitest';
import { opportunityPaths } from '../data/opportunities-more.ts';
import { careerPaths, initialState, opportunities } from '../data/sample.ts';
import type { Opportunity } from '../types.ts';
import { explain, rankFeedDetailed } from './ranking.ts';
import type { AppState } from './store.ts';

const top = (goalId: string, count: number) =>
  rankFeedDetailed(opportunities, { ...initialState, goalId, doneSteps: [] }).slice(0, count);

describe('feed ranking follows the chosen career goal', () => {
  it('puts something that leads to the goal first, for every career path', () => {
    for (const path of careerPaths) {
      const first = top(path.id, 1)[0]!;
      expect(opportunityPaths[first.opportunity.id], path.id).toContain(path.id);
      expect(first.signals).toContain('goal');
    }
  });

  it('gives a student outside technology a feed that is not led by technology postings', () => {
    const techOnly = (id: string) => (opportunityPaths[id] ?? []).length > 0 && (opportunityPaths[id] ?? []).every((p) => ['path-swe', 'path-ml', 'path-data', 'path-pm'].includes(p));
    expect(top('path-health', 6).filter((r) => techOnly(r.opportunity.id))).toHaveLength(0);
    // The same postings still lead for a software student.
    expect(top('path-swe', 6).filter((r) => techOnly(r.opportunity.id)).length).toBeGreaterThan(2);
  });

  it('only points at career paths that exist', () => {
    const ids = new Set(careerPaths.map((path) => path.id));
    for (const paths of Object.values(opportunityPaths)) for (const id of paths) expect(ids.has(id), id).toBe(true);
  });
});

describe('why a card is shown', () => {
  const NOW = Date.now();
  const DAY = 86_400_000;
  const blank: AppState = { ...initialState, saved: [], liked: [], opened: [], dismissed: [], doneSteps: [], extraSteps: [], goalId: 'path-swe' };
  const template = opportunities.find((o) => o.id === 'opp-northwind-swe')!;
  const club = opportunities.find((o) => o.type === 'club')!;
  // A card with nothing going for or against it: no recorded field, a middling fit, no deadline, found a month ago.
  const plain: Opportunity = { ...template, id: 'plain', baseScore: 0.5, deadline: null, foundAt: new Date(NOW - 30 * DAY).toISOString() };
  const otherInternship: Opportunity = { ...plain, id: 'other-internship' };

  const reasonsFor = (o: Opportunity, state: AppState, list: Opportunity[]) => {
    const ranked = rankFeedDetailed(list, state, NOW).find((r) => r.opportunity.id === o.id)!;
    return { ranked, reasons: explain(ranked, state, list, NOW) };
  };
  // Sorted by name, so the checks are about which reasons appear, not their order.
  const kinds = (o: Opportunity, state: AppState, list: Opportunity[] = [o]) => reasonsFor(o, state, list).reasons.map((r) => r.kind).sort();

  it('gives a card with nothing in its favour only the reason that actually moved it', () => {
    // Out of network is the one ingredient that changes this card's score; anything else would be invented.
    expect(kinds(plain, blank)).toEqual(['explore']);
  });

  it('adds a reason only when the matching ingredient moves the score', () => {
    expect(kinds({ ...plain, deadline: new Date(NOW + 4.5 * DAY).toISOString() }, blank)).toEqual(['closing', 'explore']);
    expect(kinds({ ...plain, deadline: new Date(NOW + 30 * DAY).toISOString() }, blank)).toEqual(['explore']);
    expect(kinds({ ...plain, foundAt: new Date(NOW - DAY / 2).toISOString() }, blank)).toContain('new');
    expect(kinds({ ...plain, baseScore: 0.9 }, blank)).toContain('fit');

    // A save of another internship moves this one and brings it in network.
    const saved = { ...blank, saved: ['other-internship'] };
    expect(kinds(plain, saved, [plain, otherInternship])).toEqual(['saved']);
    // A saved club is in another family and does not touch an internship's score, so it is not a reason.
    expect(kinds(plain, { ...blank, saved: [club.id] }, [plain, club])).toEqual(['explore']);
    expect(kinds(plain, { ...blank, dismissed: [club.id] }, [plain, club])).toEqual(['explore']);
    expect(kinds(plain, { ...blank, dismissed: ['other-internship'] }, [plain, otherInternship])).toEqual(['disliked', 'explore']);
  });

  it('states each reason in the direction the score really moved', () => {
    const disliked = reasonsFor(plain, { ...blank, dismissed: ['other-internship'] }, [plain, otherInternship]).reasons.find((r) => r.kind === 'disliked')!;
    expect(disliked.direction).toBe('down');
    expect(disliked.text).toBe('You disliked 1 other internship, so internships are shown less');

    // Taking the save away really does lower the score, as the reason says.
    const withSave = reasonsFor(plain, { ...blank, saved: ['other-internship'] }, [plain, otherInternship]);
    const withoutSave = reasonsFor(plain, blank, [plain, otherInternship]);
    expect(withSave.reasons.find((r) => r.kind === 'saved')!.direction).toBe('up');
    expect(withSave.ranked.score).toBeGreaterThan(withoutSave.ranked.score);

    for (const ranked of rankFeedDetailed(opportunities, initialState, NOW)) {
      for (const reason of explain(ranked, initialState, opportunities, NOW)) {
        expect(Math.abs(reason.effect), reason.text).toBeGreaterThan(0);
        expect(reason.direction, reason.text).toBe(reason.effect > 0 ? 'up' : 'down');
      }
    }
  });

  it('agrees with the chips and the candidate source on every card', () => {
    for (const ranked of rankFeedDetailed(opportunities, initialState, NOW)) {
      const found = explain(ranked, initialState, opportunities, NOW).map((r) => r.kind);
      expect(found.includes('goal'), ranked.opportunity.id).toBe(ranked.signals.includes('goal'));
      expect(found.includes('roadmap'), ranked.opportunity.id).toBe(ranked.signals.includes('roadmap'));
      expect(found.includes('explore'), ranked.opportunity.id).toBe(ranked.source === 'out-of-network');
    }
  });

  it('names the goal for an opportunity that leads to it, with the size of the goal boost', () => {
    for (const path of careerPaths) {
      const state = { ...initialState, goalId: path.id, doneSteps: [] };
      const first = rankFeedDetailed(opportunities, state, NOW)[0]!;
      const goal = explain(first, state, opportunities, NOW).find((r) => r.kind === 'goal');
      expect(goal, path.id).toBeDefined();
      expect(goal!.text).toBe(`It leads toward your goal, ${path.title}`);
      expect(goal!.direction).toBe('up');
      expect(goal!.effect).toBeCloseTo(first.score - first.score / 1.45, 10);
    }
  });

  it('says when a card is from a field the student is not aiming at', () => {
    const state = { ...blank, goalId: 'path-health' };
    const other = reasonsFor(template, state, opportunities).reasons.find((r) => r.kind === 'other-field');
    expect(other?.direction).toBe('down');
    expect(other?.text).toContain('Technology');
    expect(kinds(template, { ...blank, goalId: 'path-swe' }, opportunities)).not.toContain('other-field');
  });
});
