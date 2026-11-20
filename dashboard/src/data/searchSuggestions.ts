// What the Search box suggests as the student types: companies (with their logos), keyword
// completions, intern roles and suggested searches; with an empty box, recent and suggested
// searches. Picking one runs an ordinary search with its filters set.
import type { SearchFilters, SearchKind, SearchTime } from '../lib/search.ts';

export interface Company {
  name: string;
  /** The company's main website, for its logo. */
  domain: string;
  /** Brand colour for the letter shown when the logo cannot load. */
  color: string;
  /** Other names and common misspellings people type, such as "invidia" or "jpm". */
  aka?: string[];
}

/**
 * Large S&P 500 companies that hire students, roughly biggest first by market value as of late
 * 2026. The order moves with the market; it only decides which company shows first in a tie.
 */
export const COMPANIES: Company[] = [
  { name: 'Nvidia', domain: 'nvidia.com', color: '#76b900', aka: ['invidia', 'nvda'] },
  { name: 'Microsoft', domain: 'microsoft.com', color: '#0078d4', aka: ['msft'] },
  { name: 'Apple', domain: 'apple.com', color: '#1d1d1f', aka: ['aapl'] },
  { name: 'Google', domain: 'google.com', color: '#4285f4', aka: ['alphabet', 'goog', 'deepmind'] },
  { name: 'Amazon', domain: 'amazon.com', color: '#ff9900', aka: ['aws', 'amzn'] },
  { name: 'Meta', domain: 'meta.com', color: '#0866ff', aka: ['facebook', 'fb', 'instagram'] },
  { name: 'Broadcom', domain: 'broadcom.com', color: '#cc092f', aka: ['avgo'] },
  { name: 'Tesla', domain: 'tesla.com', color: '#e31937', aka: ['tsla'] },
  { name: 'Berkshire Hathaway', domain: 'berkshirehathaway.com', color: '#1b365d' },
  { name: 'JPMorgan Chase', domain: 'jpmorganchase.com', color: '#117aca', aka: ['jpm', 'jp morgan', 'chase'] },
  { name: 'Eli Lilly', domain: 'lilly.com', color: '#d52b1e', aka: ['lilly'] },
  { name: 'Visa', domain: 'visa.com', color: '#1a1f71' },
  { name: 'Walmart', domain: 'walmart.com', color: '#0071ce' },
  { name: 'Oracle', domain: 'oracle.com', color: '#c74634' },
  { name: 'Mastercard', domain: 'mastercard.com', color: '#eb001b' },
  { name: 'Netflix', domain: 'netflix.com', color: '#e50914' },
  { name: 'Palantir', domain: 'palantir.com', color: '#101113', aka: ['pltr'] },
  { name: 'Exxon Mobil', domain: 'exxonmobil.com', color: '#ed1c24', aka: ['exxon'] },
  { name: 'Costco', domain: 'costco.com', color: '#005daa' },
  { name: 'Johnson & Johnson', domain: 'jnj.com', color: '#d51900', aka: ['jnj', 'j&j'] },
  { name: 'AMD', domain: 'amd.com', color: '#ed1c24', aka: ['advanced micro devices'] },
  { name: 'Procter & Gamble', domain: 'pg.com', color: '#003da5', aka: ['p&g', 'pg'] },
  { name: 'Bank of America', domain: 'bankofamerica.com', color: '#e31837', aka: ['bofa', 'boa'] },
  { name: 'Salesforce', domain: 'salesforce.com', color: '#00a1e0' },
  { name: 'Home Depot', domain: 'homedepot.com', color: '#f96302' },
  { name: 'UnitedHealth Group', domain: 'unitedhealthgroup.com', color: '#002677', aka: ['unitedhealth', 'optum'] },
  { name: 'Cisco', domain: 'cisco.com', color: '#049fd9' },
  { name: 'IBM', domain: 'ibm.com', color: '#0f62fe' },
  { name: 'Goldman Sachs', domain: 'goldmansachs.com', color: '#7399c6', aka: ['gs', 'goldman'] },
  { name: 'Morgan Stanley', domain: 'morganstanley.com', color: '#002b51' },
  { name: 'Wells Fargo', domain: 'wellsfargo.com', color: '#d71e28' },
  { name: 'Citigroup', domain: 'citigroup.com', color: '#003b70', aka: ['citi', 'citibank'] },
  { name: 'American Express', domain: 'americanexpress.com', color: '#006fcf', aka: ['amex'] },
  { name: 'Capital One', domain: 'capitalone.com', color: '#004977' },
  { name: 'BlackRock', domain: 'blackrock.com', color: '#000000' },
  { name: 'Coca-Cola', domain: 'coca-colacompany.com', color: '#f40009', aka: ['coke', 'coca cola'] },
  { name: 'PepsiCo', domain: 'pepsico.com', color: '#004b93', aka: ['pepsi'] },
  { name: 'Disney', domain: 'thewaltdisneycompany.com', color: '#113ccf', aka: ['walt disney'] },
  { name: 'Adobe', domain: 'adobe.com', color: '#fa0f00' },
  { name: 'Intuit', domain: 'intuit.com', color: '#236cff', aka: ['turbotax'] },
  { name: 'ServiceNow', domain: 'servicenow.com', color: '#62d84e' },
  { name: 'Qualcomm', domain: 'qualcomm.com', color: '#3253dc' },
  { name: 'Texas Instruments', domain: 'ti.com', color: '#cc0000', aka: ['ti'] },
  { name: 'Intel', domain: 'intel.com', color: '#0068b5' },
  { name: 'Micron', domain: 'micron.com', color: '#0055a4' },
  { name: 'Applied Materials', domain: 'appliedmaterials.com', color: '#0072c6', aka: ['amat'] },
  { name: 'Uber', domain: 'uber.com', color: '#000000' },
  { name: 'Airbnb', domain: 'airbnb.com', color: '#ff5a5f' },
  { name: 'Boeing', domain: 'boeing.com', color: '#0033a1' },
  { name: 'Lockheed Martin', domain: 'lockheedmartin.com', color: '#00447c', aka: ['lockheed'] },
  { name: 'GE Aerospace', domain: 'geaerospace.com', color: '#005eb8', aka: ['general electric', 'ge'] },
  { name: 'Pfizer', domain: 'pfizer.com', color: '#0093d0' },
  { name: 'Merck', domain: 'merck.com', color: '#00857c' },
  { name: 'Chevron', domain: 'chevron.com', color: '#0054a4' },
  { name: 'Nike', domain: 'nike.com', color: '#111111' },
  { name: "McDonald's", domain: 'mcdonalds.com', color: '#da291c', aka: ['mcdonalds'] },
  { name: 'Starbucks', domain: 'starbucks.com', color: '#00704a' },
];

/** The search picking a company runs. */
export const companyQuery = (c: Company) => `Internships at ${c.name} for college students`;

/** The company's logo, from Google's public favicon service: only the company's domain is sent. */
export const logoUrl = (domain: string, size = 128) => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;

export interface Role {
  label: string;
  query: string;
  /** Short word put after a company's name for a keyword completion, such as "Nvidia software engineering internship". */
  keyword: string;
  aka?: string[];
}

/** Intern roles students look for most, across fields. */
export const ROLES: Role[] = [
  { label: 'Software engineering', query: 'Software engineering internships', keyword: 'software engineering internship', aka: ['swe', 'developer', 'programming', 'coding'] },
  { label: 'Machine learning and AI', query: 'Machine learning and AI internships', keyword: 'machine learning internship', aka: ['ml', 'ai', 'artificial intelligence'] },
  { label: 'Data science', query: 'Data science and analytics internships', keyword: 'data science internship', aka: ['analytics', 'data analyst'] },
  { label: 'Product management', query: 'Product management internships', keyword: 'product management internship', aka: ['pm', 'apm'] },
  { label: 'Quant and trading', query: 'Quantitative trading and research internships', keyword: 'quant internship', aka: ['quantitative', 'trader'] },
  { label: 'Investment banking', query: 'Investment banking summer analyst internships', keyword: 'summer analyst internship', aka: ['ib', 'banking', 'summer analyst'] },
  { label: 'Consulting', query: 'Management consulting internships', keyword: 'consulting internship', aka: ['strategy'] },
  { label: 'Hardware and chips', query: 'Hardware and semiconductor engineering internships', keyword: 'hardware engineering internship', aka: ['semiconductor', 'electrical', 'asic', 'fpga'] },
  { label: 'Cybersecurity', query: 'Cybersecurity internships', keyword: 'security internship', aka: ['security', 'infosec'] },
  { label: 'UX and product design', query: 'UX and product design internships', keyword: 'design internship', aka: ['ux', 'ui', 'design'] },
  { label: 'Marketing', query: 'Marketing and brand internships', keyword: 'marketing internship', aka: ['brand', 'growth'] },
  { label: 'Finance and accounting', query: 'Corporate finance and accounting internships', keyword: 'finance internship', aka: ['accounting', 'audit'] },
  { label: 'Biotech and pharma', query: 'Biotech and pharma research internships', keyword: 'research internship', aka: ['biology', 'pharmaceutical', 'life sciences'] },
  { label: 'Mechanical and aerospace', query: 'Mechanical and aerospace engineering internships', keyword: 'mechanical engineering internship', aka: ['aerospace', 'mechanical'] },
  { label: 'Policy and government', query: 'Public policy and government internships', keyword: 'policy internship', aka: ['government', 'public policy'] },
  { label: 'Startups', query: 'Startup internships for students', keyword: 'internship', aka: ['startup', 'early stage'] },
];

export interface SuggestedSearch {
  query: string;
  kind: SearchKind;
  time: SearchTime;
  /** One line on why it is worth a look. */
  note: string;
}

/**
 * Searches worth running for most students, each with its filters set. Chosen by hand, not
 * counted from what students search, so the page calls them suggested, not popular.
 */
export const SUGGESTED: SuggestedSearch[] = [
  { query: 'Internships that match my background', kind: 'internship', time: 'open', note: 'Ranked against your profile and résumé' },
  { query: 'Summer 2027 internships still taking applications', kind: 'internship', time: 'open', note: 'Only ones whose deadline has not passed' },
  { query: 'First- and second-year internship programs at big tech companies', kind: 'internship', time: 'open', note: 'Made for students early in college' },
  { query: 'Paid undergraduate research programs (REUs)', kind: 'research', time: 'open', note: 'Funded summer research' },
  { query: 'Early insight and diversity programs at banks and trading firms', kind: 'internship', time: 'open', note: 'Short programs that lead to internships' },
  { query: 'Remote internships for students', kind: 'internship', time: 'any', note: 'Work from anywhere' },
  { query: 'Scholarships closing this month', kind: 'scholarship', time: 'month', note: 'Deadlines in the next 31 days' },
  { query: 'Hackathons coming up near me', kind: 'hackathon', time: 'open', note: 'Uses your location' },
  { query: 'Career fairs and recruiting events near me', kind: 'event', time: 'month', note: 'Where recruiters will be' },
  { query: 'Fellowships for first-year college students', kind: 'scholarship', time: 'open', note: 'Funding, mentors and a cohort' },
  { query: 'Research labs that take undergraduates', kind: 'research', time: 'any', note: 'Labs and professors to contact' },
  { query: 'Internship application deadlines this month', kind: 'internship', time: 'month', note: 'What closes soon' },
];

// ----- matching -------------------------------------------------------------------------------

export type Suggestion =
  | { type: 'recent'; label: string; query: string; patch: Partial<SearchFilters> }
  | { type: 'company'; label: string; query: string; patch: Partial<SearchFilters>; company: Company }
  | { type: 'keyword'; label: string; query: string; patch: Partial<SearchFilters>; company: Company }
  | { type: 'role'; label: string; query: string; patch: Partial<SearchFilters> }
  | { type: 'search'; label: string; query: string; patch: Partial<SearchFilters>; note: string };

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9&]+/g, ' ').trim();

/**
 * How well what was typed matches some names, 0 for no match: 3 when a name starts with it,
 * 2 when every typed word starts a word in one name, 1 when a typed word of three letters or more
 * appears inside a name.
 */
export function matchStrength(typed: string, names: string[]): number {
  const t = norm(typed);
  if (!t) return 0;
  const ws = t.split(' ');
  let best = 0;
  for (const name of names.map(norm)) {
    if (name.startsWith(t) || name.replace(/ /g, '').startsWith(t.replace(/ /g, ''))) return 3;
    const parts = name.split(' ');
    if (ws.every((w) => parts.some((p) => p.startsWith(w)))) best = Math.max(best, 2);
    else if (ws.every((w) => w.length >= 3 && name.includes(w))) best = Math.max(best, 1);
  }
  return best;
}

const internship: Partial<SearchFilters> = { kind: 'internship', time: 'any' };

/** Suggestions for what is typed so far, best first, at most `limit`. */
export function suggest(typed: string, recent: { q: string; kind: SearchKind }[], limit = 10): Suggestion[] {
  const t = typed.trim();
  if (!t) {
    return [
      ...recent.slice(0, 4).map((r): Suggestion => ({ type: 'recent', label: r.q, query: r.q, patch: { kind: r.kind } })),
      ...SUGGESTED.slice(0, 8).map((s): Suggestion => ({ type: 'search', label: s.query, query: s.query, patch: { kind: s.kind, time: s.time }, note: s.note })),
    ];
  }
  const ranked = <T,>(list: T[], names: (x: T) => string[], typedNow = t) =>
    list
      .map((x, i) => ({ x, s: matchStrength(typedNow, names(x)), i }))
      .filter((m) => m.s > 0)
      .sort((a, b) => b.s - a.s || a.i - b.i)
      .map((m) => m.x);

  const recentHits = ranked(recent, (r) => [r.q]).filter((r) => r.q.toLowerCase() !== t.toLowerCase()).slice(0, 2);
  // The company may be only the first words ("nvidia data"): the rest then picks the roles.
  const companyNames = (c: Company) => [c.name, ...(c.aka ?? [])];
  const typedWords = norm(t).split(' ');
  let companies: Company[] = [];
  let after = '';
  for (let k = typedWords.length; k >= 1 && !companies.length; k--) {
    companies = ranked(COMPANIES, companyNames, typedWords.slice(0, k).join(' ')).slice(0, 4);
    after = typedWords.slice(k).join(' ');
  }
  // A company plus a role: "Nvidia software engineering internship".
  const top = companies[0];
  const roleFor = after ? ranked(ROLES, (r) => [r.label, r.keyword, ...(r.aka ?? [])], after) : ROLES.slice(0, 3);
  const keywords = top ? roleFor.filter((r) => r.label !== 'Startups').slice(0, 3) : [];
  const roles = ranked(ROLES, (r) => [r.label, ...(r.aka ?? [])]).slice(0, 3);
  const searches = ranked(SUGGESTED, (s) => [s.query]).slice(0, 4);

  const out: Suggestion[] = [
    ...recentHits.map((r): Suggestion => ({ type: 'recent', label: r.q, query: r.q, patch: { kind: r.kind } })),
    ...companies.map((c): Suggestion => ({ type: 'company', label: c.name, query: companyQuery(c), patch: internship, company: c })),
    ...keywords.map((r): Suggestion => ({ type: 'keyword', label: `${top!.name} ${r.keyword}`, query: `${top!.name} ${r.keyword}`, patch: internship, company: top! })),
    ...roles.map((r): Suggestion => ({ type: 'role', label: r.query, query: r.query, patch: { kind: 'internship', time: 'open' } })),
    ...searches.map((s): Suggestion => ({ type: 'search', label: s.query, query: s.query, patch: { kind: s.kind, time: s.time }, note: s.note })),
  ];
  const seen = new Set<string>();
  return out.filter((s) => !seen.has(s.query.toLowerCase()) && seen.add(s.query.toLowerCase())).slice(0, limit);
}
