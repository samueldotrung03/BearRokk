import { describe, expect, it } from 'vitest';
import { opportunityPaths } from '../data/opportunities-more.ts';
import { careerPaths, opportunities } from '../data/sample.ts';
import type { Opportunity } from '../types.ts';
import { countActive, emptyFilters, fieldOfGoal, fieldOptions, fieldsOf, matches, type FilterContext } from './filters.ts';

const context: FilterContext = { saved: [], liked: [], roadmap: new Set(), now: Date.now() };
const byId = (id: string) => opportunities.find((o) => o.id === id)!;
const shown = (fields: string[]) => opportunities.filter((o) => matches(o, { ...emptyFilters, fields }, context));

describe('field filter', () => {
  it('lists every career path group once', () => {
    const groups = new Set(careerPaths.map((path) => path.group));
    expect(fieldOptions).toHaveLength(groups.size);
    expect(fieldOptions).toContain('Technology');
    expect(fieldOptions).toContain('Finance and business');
  });

  it('reads an opportunity’s fields from the career paths it leads to', () => {
    expect(fieldsOf(byId('opp-northwind-swe'))).toEqual(['Technology']);
    // Robotics leads into software and mechanical engineering, so it sits in two fields.
    const robotics = fieldsOf(byId('opp-robotics-club'));
    expect(robotics).toContain('Technology');
    expect(robotics).toContain(careerPaths.find((path) => path.id === 'path-mecheng')!.group);
  });

  it('keeps only the chosen field, plus anything open to any field', () => {
    const tech = shown(['Technology']);
    expect(tech.map((o) => o.id)).toContain('opp-northwind-swe');
    for (const o of tech) {
      const fields = fieldsOf(o);
      expect(fields.length === 0 || fields.includes('Technology'), o.id).toBe(true);
    }
    // Something only in finance is hidden from a technology-only view.
    const financeOnly = opportunities.find((o) => {
      const fields = fieldsOf(o);
      return fields.length > 0 && fields.every((field) => field === 'Finance and business');
    })!;
    expect(financeOnly).toBeDefined();
    expect(tech).not.toContain(financeOnly);
    expect(shown(['Technology', 'Finance and business'])).toContain(financeOnly);
  });

  it('shows an opportunity with no recorded path for every field', () => {
    const anyField: Opportunity = { ...byId('opp-northwind-swe'), id: 'not-in-the-path-list' };
    expect(opportunityPaths[anyField.id]).toBeUndefined();
    for (const field of fieldOptions) expect(matches(anyField, { ...emptyFilters, fields: [field] }, context), field).toBe(true);
  });

  it('shows everything when no field is chosen, or when the filter is missing', () => {
    expect(shown([])).toHaveLength(opportunities.length);
    const { fields: _unused, ...older } = emptyFilters;
    expect(opportunities.every((o) => matches(o, older, context))).toBe(true);
  });

  it('counts each chosen field as an active filter', () => {
    expect(countActive(emptyFilters)).toBe(0);
    expect(countActive({ ...emptyFilters, fields: ['Technology', 'Finance and business'] })).toBe(2);
  });

  it('finds the field of the student’s goal for the "My field" shortcut', () => {
    expect(fieldOfGoal('path-swe')).toBe('Technology');
    expect(fieldOfGoal('path-health')).toBe(careerPaths.find((path) => path.id === 'path-health')!.group);
    expect(fieldOfGoal('no-such-path')).toBeNull();
  });
});
