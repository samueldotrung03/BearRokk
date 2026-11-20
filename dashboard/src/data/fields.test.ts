// Checks that every career path, the four technology ones and the other fields alike, has the
// whole set of data the Roadmap and Career discovery pages read, and that the quiz can lead a
// student in any field to their own path.
import { describe, expect, it } from 'vitest';
import { rankPaths, type QuizAnswers } from '../lib/discover/match.ts';
import type { Profile } from '../types.ts';
import { pathExtras, quizQuestions } from './discover-extra.ts';
import { pathGroups } from './fields.ts';
import { stepHours } from './roadmap-extra.ts';
import { careerPaths, initialState, interestOptions, opportunities, pathProfiles, roadmaps } from './sample.ts';

const stepsOf = (pathId: string) => roadmaps.find((r) => r.goalId === pathId)?.phases.flatMap((phase) => phase.steps) ?? [];
const techPaths = ['path-swe', 'path-ml', 'path-data', 'path-pm'];

describe('career paths in every field', () => {
  it('has fourteen paths, each in a known field', () => {
    expect(careerPaths).toHaveLength(14);
    for (const path of careerPaths) expect(pathGroups, path.id).toContain(path.group);
    for (const group of pathGroups) expect(careerPaths.some((p) => p.group === group), group).toBe(true);
  });

  it('gives every path a roadmap, an extra and hours for every step', () => {
    for (const path of careerPaths) {
      const roadmap = roadmaps.find((r) => r.goalId === path.id);
      expect(roadmap, path.id).toBeDefined();
      expect(pathExtras.find((e) => e.pathId === path.id), path.id).toBeDefined();
      const steps = stepsOf(path.id);
      expect(steps.length, path.id).toBeGreaterThanOrEqual(6);
      for (const step of steps) expect(stepHours[step.id], step.id).toBeGreaterThan(0);
      // A requirement or an expected skill that points at a step must point at one in this roadmap.
      const ids = new Set(steps.map((s) => s.id));
      for (const r of roadmap!.requirements) if (r.stepId) expect(ids.has(r.stepId), r.id).toBe(true);
      for (const s of pathExtras.find((e) => e.pathId === path.id)!.skills) if (s.stepId) expect(ids.has(s.stepId), s.label).toBe(true);
    }
  });

  it('backs every roadmap with at least eight sample profiles whose steps exist in it', () => {
    for (const path of careerPaths) {
      const ids = new Set(stepsOf(path.id).map((s) => s.id));
      const people = pathProfiles.filter((p) => p.goalId === path.id);
      expect(people.length, path.id).toBeGreaterThanOrEqual(8);
      for (const person of people) for (const id of person.did) expect(ids.has(id), `${person.id}: ${id}`).toBe(true);
    }
  });

  it('keeps step and profile ids unique across all paths', () => {
    const stepIds = careerPaths.flatMap((p) => stepsOf(p.id).map((s) => s.id));
    expect(new Set(stepIds).size).toBe(stepIds.length);
    const profileIds = pathProfiles.map((p) => p.id);
    expect(new Set(profileIds).size).toBe(profileIds.length);
  });

  it('only uses interests the profile page offers', () => {
    for (const extra of pathExtras) for (const interest of extra.interests) expect(interestOptions, extra.pathId).toContain(interest);
  });
});

describe('the quiz', () => {
  const pathIds = new Set(careerPaths.map((p) => p.id));

  it('has six or seven questions with four options each, scored only against real paths', () => {
    expect(quizQuestions.length).toBeGreaterThanOrEqual(6);
    expect(quizQuestions.length).toBeLessThanOrEqual(7);
    for (const question of quizQuestions) {
      expect(question.options, question.id).toHaveLength(4);
      for (const option of question.options) for (const key of Object.keys(option.fit)) expect(pathIds.has(key), `${option.id}: ${key}`).toBe(true);
    }
  });

  it('does not assume the student codes', () => {
    const text = quizQuestions.flatMap((q) => [q.prompt, ...q.options.flatMap((o) => [o.label, o.because])]).join(' ');
    expect(text).not.toMatch(/\b(code|coding|program|programming|software|algorithm|bug)s?\b/i);
  });

  it('can lead a student with no technology background to each path outside technology', () => {
    const blank: Profile = { ...initialState.profile, major: 'Undeclared', interests: [], skills: [] };
    const answersFor = (pathId: string): QuizAnswers =>
      Object.fromEntries(quizQuestions.map((q) => [q.id, [...q.options].sort((a, b) => (b.fit[pathId] ?? 0) - (a.fit[pathId] ?? 0))[0]!.id]));
    const others = careerPaths.filter((p) => !techPaths.includes(p.id));
    expect(others.length).toBeGreaterThanOrEqual(4);
    for (const path of others) {
      const ranked = rankPaths({
        paths: careerPaths,
        extras: pathExtras,
        roadmaps,
        opportunities,
        questions: quizQuestions,
        answers: answersFor(path.id),
        profile: blank,
        history: { saved: [], liked: [], dismissed: [] },
        doneSteps: [],
      });
      expect(ranked[0]!.pathId, path.id).toBe(path.id);
    }
  });
});
