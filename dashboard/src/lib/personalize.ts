// Picks the career path a student's own answers point to, so a new account starts on a roadmap
// that fits them instead of the sample student's. Pure: no storage, no React.

type PathId =
  | 'path-swe'
  | 'path-ml'
  | 'path-data'
  | 'path-pm'
  | 'path-health'
  | 'path-research'
  | 'path-finance'
  | 'path-consulting'
  | 'path-marketing'
  | 'path-policy'
  | 'path-design'
  | 'path-education'
  | 'path-media'
  | 'path-mecheng';

/**
 * Every choice the app offers by name: the profile page's fields (`fieldGroups`) and the sign-up
 * careers (`careerOptions`). Matched whole, so a label never falls through to a looser keyword.
 */
const exactLabels: Record<string, PathId | null> = {
  // Technology
  'software engineering': 'path-swe',
  'ai / machine learning': 'path-ml',
  'ai and machine learning': 'path-ml',
  'data science / analytics': 'path-data',
  'data science': 'path-data',
  'product management': 'path-pm',
  cybersecurity: 'path-swe',
  'cloud / infrastructure / devops': 'path-swe',
  'hardware / robotics': 'path-mecheng',
  'hardware and robotics': 'path-mecheng',
  'electrical / embedded engineering': 'path-mecheng',
  'game development': 'path-swe',
  'design / ux': 'path-design',
  'design and ux': 'path-design',
  'it / technical support': 'path-swe',
  // Finance and business
  'quant trading / quant research': 'path-finance',
  'investment banking': 'path-finance',
  'asset management / hedge funds': 'path-finance',
  'venture capital / private equity': 'path-finance',
  'sales and trading': 'path-finance',
  'corporate finance / accounting': 'path-finance',
  fintech: 'path-finance',
  'insurance / actuarial': 'path-finance',
  'real estate': 'path-finance',
  finance: 'path-finance',
  consulting: 'path-consulting',
  'business operations / strategy': 'path-consulting',
  'supply chain / logistics': 'path-consulting',
  'startups (any role)': 'path-consulting',
  entrepreneurship: 'path-consulting',
  'marketing / growth': 'path-marketing',
  marketing: 'path-marketing',
  'sales / business development': 'path-marketing',
  sales: 'path-marketing',
  // Science, engineering and health
  'academic research (lab or professor)': 'path-research',
  research: 'path-research',
  'biotech / pharma': 'path-research',
  'biotech and life sciences': 'path-research',
  'chemistry / materials': 'path-research',
  'energy / climate / sustainability': 'path-research',
  'environment and sustainability': 'path-research',
  'healthcare / medicine': 'path-health',
  healthcare: 'path-health',
  'public health': 'path-health',
  'mechanical / aerospace engineering': 'path-mecheng',
  'civil / environmental engineering': 'path-mecheng',
  'mechanical and civil engineering': 'path-mecheng',
  // Policy, law and society
  'economics / policy research': 'path-policy',
  'government / public service': 'path-policy',
  'public policy and government': 'path-policy',
  'law / legal': 'path-policy',
  law: 'path-policy',
  'nonprofit / social impact': 'path-policy',
  'nonprofit and social impact': 'path-policy',
  'international relations': 'path-policy',
  'education / teaching': 'path-education',
  'teaching and education': 'path-education',
  // Media and creative
  'journalism / writing': 'path-media',
  'journalism and media': 'path-media',
  'media / entertainment': 'path-media',
  'arts and entertainment': 'path-media',
  'film / video production': 'path-media',
  'music / arts': 'path-media',
  'communications / pr': 'path-marketing',
  'graphic / visual design': 'path-design',
  // Other
  'sports business / analytics': 'path-consulting',
  'hospitality / tourism': 'path-consulting',
  'human resources / people': 'path-consulting',
  'human resources': 'path-consulting',
  // Undecided points nowhere; the major decides instead.
  'not sure yet': null,
};

/**
 * Free text (majors, fields a student typed in, careers in their own words). Checked in this order,
 * most specific first, so "data science" is data before "science" is research and "computer
 * science" is software before either.
 */
const keywords: [PathId, RegExp][] = [
  ['path-ml', /machine learning|artificial intelligence|deep learning|\bai\b|\bml\b/],
  ['path-data', /\bdata\b|statistic|\bstats?\b|analytics|\bmath/],
  ['path-pm', /product manage|\bproduct\b(?! design)/],
  ['path-swe', /computer science|computer engineering|\bcs\b|\beecs\b|software|programming|coding|developer|\bweb\b|cyber|security|devops|cloud|informatics|information technology|game dev/],
  ['path-design', /design|\bux\b|\bui\b|user experience|human-computer|\bhci\b|graphic|illustration|animation|\bart\b|fine arts?|visual arts?|architect/],
  ['path-media', /journalism|\bmedia\b|film|cinema|video|music|theat(?:er|re)|english|literature|writing|\bwriter|rhetoric|creative/],
  ['path-marketing', /marketing|advertising|public relations|\bpr\b|communication|\bsales\b|brand/],
  ['path-policy', /politic|government|policy|\blaw\b|legal|pre-?law|international (?:relations|affairs|studies)|global studies|sociology|public service|nonprofit|social impact|history/],
  ['path-finance', /financ|accounting|accountant|actuar|\bbank|invest|\bquant|fintech|real estate|econ|trading/],
  ['path-health', /nurs|pre-?med|medic|health|clinical|pharmacy|kinesiology|dental|dentist|physician|doctor|hospital/],
  ['path-education', /educat|teach|tutor|child development|pedagog/],
  ['path-mecheng', /mechanical|aerospace|aeronaut|civil|robot|hardware|electrical|embedded|industrial|nuclear|\bengineering\b/],
  ['path-research', /research|biolog|\bbio|chemi|physics|neuro|molecular|genetic|biotech|cognitive science|psycholog|ecolog|environmental|climate|sustainab|energy|materials|\blab\b|science/],
  ['path-consulting', /consult|business|management|operations|strategy|entrepreneur|startup|supply chain|logistics|human resources|\bhr\b|hospitality|tourism|\bsports?\b|\bmba\b|commerce/],
];

const normalize = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ');

/** The path one label or phrase points to, or null when nothing in it is recognised. */
export function pathForText(text: string): string | null {
  const t = normalize(text);
  if (!t) return null;
  if (Object.hasOwn(exactLabels, t)) return exactLabels[t] ?? null;
  for (const [id, pattern] of keywords) if (pattern.test(t)) return id;
  return null;
}

/** The path most entries point to; a tie goes to the one listed first. */
function mostCommon(list: string[] | undefined): string | null {
  const counts = new Map<string, number>();
  for (const entry of list ?? []) {
    const id = pathForText(entry);
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  let best: string | null = null;
  for (const [id, n] of counts) if (best === null || n > counts.get(best)!) best = id;
  return best;
}

/**
 * The career path that fits what the student told us. The field they marked as most important wins,
 * then the fields they ticked, then the careers they named at sign-up, then their major.
 */
export function goalForProfile(input: { major?: string; topField?: string | null; fields?: string[]; careerInterests?: string[] }): string | null {
  return (
    (input.topField ? pathForText(input.topField) : null) ??
    mostCommon(input.fields) ??
    mostCommon(input.careerInterests) ??
    (input.major ? pathForText(input.major) : null)
  );
}
