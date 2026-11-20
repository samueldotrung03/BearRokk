import { describe, expect, it } from 'vitest';
import { fieldGroups } from '../data/preferences.ts';
import { careerOptions, careerPaths } from '../data/sample.ts';
import { goalForProfile, pathForText } from './personalize.ts';

const pathIds = new Set(careerPaths.map((p) => p.id));

describe('goalForProfile', () => {
  it('can reach every one of the career paths', () => {
    const reached = new Set<string | null>();
    for (const group of fieldGroups) for (const field of group.fields) reached.add(goalForProfile({ topField: field }));
    for (const option of careerOptions) reached.add(goalForProfile({ careerInterests: [option] }));
    reached.delete(null);
    expect([...reached].sort()).toEqual([...pathIds].sort());
  });

  it('maps every field and sign-up career to a path that exists', () => {
    for (const group of fieldGroups) for (const field of group.fields) expect(pathIds.has(pathForText(field) ?? ''), field).toBe(true);
    for (const option of careerOptions.filter((o) => o !== 'Not sure yet')) expect(pathIds.has(pathForText(option) ?? ''), option).toBe(true);
  });

  it('places common majors on a fitting path', () => {
    const majors: Record<string, string> = {
      Nursing: 'path-health',
      'Molecular and Cell Biology': 'path-research',
      Chemistry: 'path-research',
      Psychology: 'path-research',
      'Cognitive Science': 'path-research',
      Economics: 'path-finance',
      'Business Administration': 'path-consulting',
      Accounting: 'path-finance',
      Marketing: 'path-marketing',
      'Political Science': 'path-policy',
      'Legal Studies': 'path-policy',
      English: 'path-media',
      Journalism: 'path-media',
      'Film and Media': 'path-media',
      Art: 'path-design',
      Design: 'path-design',
      Education: 'path-education',
      'Mechanical Engineering': 'path-mecheng',
      'Aerospace Engineering': 'path-mecheng',
      'Civil Engineering': 'path-mecheng',
      'Computer Science': 'path-swe',
      'Electrical Engineering and Computer Sciences': 'path-swe',
      'Data Science': 'path-data',
      Statistics: 'path-data',
      'Applied Mathematics': 'path-data',
    };
    for (const [major, path] of Object.entries(majors)) expect(goalForProfile({ major }), major).toBe(path);
  });

  it('lets the top field beat the major', () => {
    expect(goalForProfile({ major: 'Computer Science', topField: 'Investment banking' })).toBe('path-finance');
  });

  it('uses ticked fields before sign-up careers, and sign-up careers before the major', () => {
    expect(goalForProfile({ major: 'Computer Science', fields: ['Healthcare / medicine'], careerInterests: ['Law'] })).toBe('path-health');
    expect(goalForProfile({ major: 'Computer Science', careerInterests: ['Law'] })).toBe('path-policy');
  });

  it('goes with the path most ticked fields point to', () => {
    expect(goalForProfile({ fields: ['Software engineering', 'Investment banking', 'Fintech'] })).toBe('path-finance');
  });

  it('falls back to the major when the student is not sure yet', () => {
    expect(goalForProfile({ major: 'Nursing', careerInterests: ['Not sure yet'] })).toBe('path-health');
  });

  it('returns null when nothing is recognised', () => {
    expect(goalForProfile({})).toBeNull();
    expect(goalForProfile({ major: 'Undeclared', topField: 'Zzz', fields: ['qwerty'], careerInterests: ['Not sure yet'] })).toBeNull();
    expect(pathForText('constructor')).toBeNull();
  });
});
