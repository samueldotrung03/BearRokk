// Links between the quick panel and the Search page: the panel opens Search with a query in the
// address, and Search starts that query when it arrives.

/** The Search page with this query already running. */
export function searchPath(text: string): string {
  return `/search?q=${encodeURIComponent(text.trim())}`;
}

/** The query a link asked Search to run (?q=...), or null when there is none worth running. */
export function askedQuery(params: URLSearchParams): string | null {
  const q = params.get('q')?.trim() ?? '';
  return q.length >= 2 ? q : null;
}

/** "Fri, Nov 21": the day a deadline falls on. */
export function dueDay(at: number): string {
  return new Date(at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
