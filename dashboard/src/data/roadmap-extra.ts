// Hand-set extras for the Roadmap page: rough hours per step and a few free places to start.
// These are planning estimates picked for the demo, not measurements, and the page labels them
// that way. In the product the agents would set them from the posting and from what the
// profiles say people spent.
import { fieldStepHours } from './fields.ts';

/** Rough hours each goal step takes, for "Plan my week". Steps not listed fall back to their kind. */
export const stepHours: Record<string, number> = {
  ...fieldStepHours,
  'step-ds': 10,
  'step-sql': 8,
  'step-club': 3,
  'step-hack': 10,
  'step-project': 6,
  'step-resume': 2,
  // The posting says the application takes about forty minutes.
  'step-apply-northwind': 1,
  'step-fair': 4,
  'step-apply-ten': 8,

  'step-ml-math': 12,
  'step-ml-lib': 10,
  'step-ml-model': 10,
  'step-ml-research': 2,
  'step-ml-fair': 4,
  'step-ml-apply': 6,

  'step-data-sql': 6,
  'step-data-cloud': 6,
  'step-data-pipeline': 10,
  'step-data-club': 3,
  'step-data-apply': 1.5,
  'step-data-fair': 4,

  'step-pm-writing': 6,
  'step-pm-users': 5,
  'step-pm-lead': 10,
  'step-pm-info': 2,
  'step-pm-scholar': 3,
  'step-pm-fair': 4,
};

/**
 * Hours for the steps of a roadmap the student started for one opportunity, keyed by the part
 * of the step id after the colon (`extra-opp-x:review` becomes `review`).
 */
export const extraStepHours: Record<string, number> = {
  read: 0.5,
  login: 0.25,
  review: 1,
  submit: 0.5,
  register: 0.25,
  team: 1,
  idea: 1,
  writeup: 1.5,
  prepare: 0.5,
  follow: 0.25,
  first: 1.5,
  join: 2,
};

export interface Resource {
  label: string;
  url: string;
}

/** Well-known free places to start on a goal step. A starting point, not a requirement. */
export const stepResources: Record<string, Resource[]> = {
  'step-ds': [
    { label: 'VisuAlgo: data structures, animated', url: 'https://visualgo.net' },
    { label: 'NeetCode roadmap of practice problems', url: 'https://neetcode.io/roadmap' },
  ],
  'step-sql': [
    { label: 'SQLBolt interactive lessons', url: 'https://sqlbolt.com' },
    { label: 'Mode SQL tutorial', url: 'https://mode.com/sql-tutorial' },
  ],
  'step-data-sql': [
    { label: 'SQLBolt interactive lessons', url: 'https://sqlbolt.com' },
    { label: 'Mode SQL tutorial', url: 'https://mode.com/sql-tutorial' },
  ],
  'step-club': [{ label: 'GitHub issues labeled "good first issue"', url: 'https://github.com/topics/good-first-issue' }],
  'step-data-club': [{ label: 'GitHub issues labeled "good first issue"', url: 'https://github.com/topics/good-first-issue' }],
  'step-project': [
    { label: 'Make a README', url: 'https://www.makeareadme.com' },
    { label: 'GitHub Pages for a free demo site', url: 'https://pages.github.com' },
  ],
  'step-resume': [{ label: 'Tech Interview Handbook: resume guide', url: 'https://www.techinterviewhandbook.org/resume/' }],
  'step-apply-ten': [{ label: 'Tech Interview Handbook', url: 'https://www.techinterviewhandbook.org' }],
  'step-ml-math': [
    { label: '3Blue1Brown: Essence of linear algebra', url: 'https://www.3blue1brown.com/topics/linear-algebra' },
    { label: 'MIT OpenCourseWare 18.06 Linear Algebra', url: 'https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/' },
  ],
  'step-ml-lib': [
    { label: 'PyTorch tutorials', url: 'https://pytorch.org/tutorials/' },
    { label: 'fast.ai Practical Deep Learning', url: 'https://course.fast.ai' },
  ],
  'step-ml-model': [{ label: 'Kaggle Learn', url: 'https://www.kaggle.com/learn' }],
  'step-data-pipeline': [
    { label: 'Data Engineering Zoomcamp', url: 'https://github.com/DataTalksClub/data-engineering-zoomcamp' },
  ],
  'step-pm-users': [{ label: 'The Mom Test, on asking useful interview questions', url: 'https://www.momtestbook.com' }],
};
