// Finds a picture for a posting, best first:
//   1. event:     a real picture of the event or posting, from its own pages and listings
//   2. logo:      the organizer's logo
//   3. stock:     a free, openly licensed photo on the same topic (Openverse), with its credit
//   4. generated: an illustration drawn by the agents' model, labelled as AI-generated
// Every picture is fetched once to check it is really an image of a usable size, so a card never
// points at a broken link or a tiny icon stretched to fill the screen.
import { limiter } from './fleet.ts';
import type { Candidate } from './types.ts';

export type ImageKind = 'event' | 'logo' | 'stock' | 'generated';

export interface FoundImage {
  url: string;
  kind: ImageKind;
  /** Who made a stock photo and under which licence; null for the posting's own pictures. */
  credit: string | null;
  creditUrl: string | null;
}

/** What the finder needs to know about a posting. */
export type ImageSubject = Pick<Candidate, 'title' | 'organizer' | 'type' | 'field' | 'tags' | 'sourceUrl' | 'actionUrl' | 'image'> & { id?: string; alsoSeenAt?: string[] };

interface Options {
  fetch?: typeof fetch;
  timeoutMs?: number;
  /** Turn the free stock photo search off (tests). */
  stock?: boolean;
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 BearRok';
const LOGO_WORDS = /logo|favicon|icon|avatar|brand|social[_-]?(share|card|icon)|default[_-]?(og|share|image)|placeholder|sprite/i;
/** Job boards and event sites: their own logo says nothing about the organizer. */
const HOSTS_NOT_THE_ORGANIZER = /(^|\.)(greenhouse\.io|lever\.co|myworkdayjobs\.com|workday\.com|ashbyhq\.com|smartrecruiters\.com|icims\.com|jobvite\.com|eventbrite\.[a-z.]+|lu\.ma|luma\.com|devpost\.com|mlh\.io|joinhandshake\.com|linkedin\.com|indeed\.com|glassdoor\.com|wellfound\.com|ycombinator\.com|meetup\.com|google\.com|forms\.gle|typeform\.com|notion\.site|campusgroups\.com|callink\.berkeley\.edu)$/i;

/** Only public web addresses: the backend never fetches a page on this computer or its network. */
export function safeUrl(raw: string | null | undefined, base?: string): URL | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.trim(), base);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || !host.includes('.')) return null;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const [a, b] = host.split('.').map(Number) as [number, number];
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)) return null;
  }
  if (host.includes(':')) return null; // IPv6 literals
  return url;
}

// ---- reading a page ------------------------------------------------------------------------

const attr = (tag: string, name: string) => new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag)?.slice(2).find((v) => v !== undefined) ?? null;
const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

/** Pictures a page offers: preview images first, then the organizer's logo and icons. */
export function picturesOn(html: string, pageUrl: string): { event: string[]; logo: string[] } {
  const event: string[] = [];
  const logo: string[] = [];
  const add = (list: string[], raw: string | null) => {
    const url = raw ? safeUrl(decode(raw), pageUrl) : null;
    if (url && !list.includes(url.href)) list.push(url.href);
  };
  const head = html.slice(0, 400_000);
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = (attr(tag, 'property') ?? attr(tag, 'name') ?? attr(tag, 'itemprop') ?? '').toLowerCase();
    if (['og:image', 'og:image:secure_url', 'og:image:url', 'twitter:image', 'twitter:image:src', 'image', 'thumbnailurl'].includes(key)) add(event, attr(tag, 'content'));
  }
  for (const tag of head.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = (attr(tag, 'rel') ?? '').toLowerCase();
    if (rel === 'image_src') add(event, attr(tag, 'href'));
    if (/\b(apple-touch-icon|icon|mask-icon)\b/.test(rel)) add(logo, attr(tag, 'href'));
  }
  // Structured data: an Event's or JobPosting's image, and an Organization's logo.
  for (const block of head.match(/<script[^>]*application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi) ?? []) {
    let data: unknown;
    try {
      data = JSON.parse(block.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, ''));
    } catch {
      continue;
    }
    const walk = (node: unknown, depth: number) => {
      if (!node || typeof node !== 'object' || depth > 5) return;
      if (Array.isArray(node)) return node.forEach((n) => walk(n, depth + 1));
      const o = node as Record<string, unknown>;
      const one = (v: unknown, list: string[]) => {
        if (typeof v === 'string') add(list, v);
        else if (Array.isArray(v)) v.forEach((x) => one(x, list));
        else if (v && typeof v === 'object') one((v as Record<string, unknown>).url ?? (v as Record<string, unknown>).contentUrl, list);
      };
      one(o.image, event);
      one(o.logo, logo);
      for (const [k, v] of Object.entries(o)) if (k !== 'image' && k !== 'logo') walk(v, depth + 1);
    };
    walk(data, 0);
  }
  return { event, logo };
}

// ---- checking a picture --------------------------------------------------------------------

/** Width and height read from the first bytes of a PNG, JPEG, GIF or WebP file. */
export function imageSize(bytes: Uint8Array): { width: number; height: number } | null {
  const b = bytes;
  const u16 = (i: number) => (b[i]! << 8) | b[i + 1]!;
  const u16le = (i: number) => b[i]! | (b[i + 1]! << 8);
  const u32 = (i: number) => ((b[i]! << 24) | (b[i + 1]! << 16) | (b[i + 2]! << 8) | b[i + 3]!) >>> 0;
  if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { width: u32(16), height: u32(20) };
  if (b.length >= 10 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return { width: u16le(6), height: u16le(8) };
  if (b.length >= 30 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    const chunk = String.fromCharCode(b[12]!, b[13]!, b[14]!, b[15]!);
    if (chunk === 'VP8X') return { width: 1 + (b[24]! | (b[25]! << 8) | (b[26]! << 16)), height: 1 + (b[27]! | (b[28]! << 8) | (b[29]! << 16)) };
    if (chunk === 'VP8 ' && b.length >= 30) return { width: u16le(26) & 0x3fff, height: u16le(28) & 0x3fff };
    if (chunk === 'VP8L' && b.length >= 25) {
      const bits = b[21]! | (b[22]! << 8) | (b[23]! << 16) | (b[24]! << 24);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = b[i + 1]!;
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return { width: u16(i + 7), height: u16(i + 5) };
      i += 2 + u16(i + 2);
    }
  }
  return null;
}

interface Probe {
  url: string;
  type: string;
  width: number | null;
  height: number | null;
}

/** A generated illustration is only kept if it is plain drawing: no scripts, links or embedded files. */
export function cleanSvg(raw: string, maxBytes = 9000): string | null {
  const svg = raw.trim().replace(/^```(?:svg|xml)?\s*/i, '').replace(/```$/, '').trim();
  if (!/^<svg[\s>]/i.test(svg) || !/<\/svg>$/i.test(svg)) return null;
  if (Buffer.byteLength(svg) > maxBytes) return null;
  if (/<script|<foreignobject|<iframe|<object|<embed|<image\b|<use\b|<style|javascript:|data:|\bon[a-z]+\s*=|<!entity|<!doctype/i.test(svg)) return null;
  if (/\b(?:xlink:)?href\s*=\s*["'](?!#)/i.test(svg)) return null;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

export class ImageFinder {
  private fetch: typeof fetch;
  private timeoutMs: number;
  private stock: boolean;
  /** The free stock search allows few requests at once without an account, so they queue. */
  private stockQueue = limiter(1);

  constructor(opts: Options = {}) {
    this.fetch = opts.fetch ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 7000;
    this.stock = opts.stock ?? true;
  }

  private async get(url: string, accept: string): Promise<Response | null> {
    try {
      const res = await this.fetch(url, { headers: { 'user-agent': UA, accept }, redirect: 'follow', signal: AbortSignal.timeout(this.timeoutMs) });
      return res.ok ? res : null;
    } catch {
      return null;
    }
  }

  private async page(url: string): Promise<string | null> {
    const res = await this.get(url, 'text/html,application/xhtml+xml');
    if (!res || !/html/i.test(res.headers.get('content-type') ?? '')) return null;
    const text = await res.text().catch(() => '');
    return text.slice(0, 1_500_000);
  }

  /** Fetches the start of a picture to learn what it is and how big. */
  async probe(url: string): Promise<Probe | null> {
    if (!safeUrl(url)) return null;
    const res = await this.get(url, 'image/avif,image/webp,image/png,image/jpeg,image/*');
    if (!res) return null;
    const type = (res.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
    if (!type.startsWith('image/')) return null;
    const final = safeUrl(res.url || url)?.href ?? url;
    if (type === 'image/svg+xml') {
      await res.body?.cancel().catch(() => {});
      return { url: final, type, width: null, height: null };
    }
    // The size is in the first few kilobytes; the rest is not downloaded.
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (reader && size < 96_000) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        chunks.push(value);
        size += value.length;
        const dims = imageSize(Buffer.concat(chunks));
        if (dims) {
          await reader.cancel().catch(() => {});
          return { url: final, type, ...dims };
        }
      }
    } catch {
      // A broken download is treated like a missing picture.
    }
    await reader?.cancel().catch(() => {});
    const dims = imageSize(Buffer.concat(chunks));
    return { url: final, type, width: dims?.width ?? null, height: dims?.height ?? null };
  }

  /** A picture of the event or posting itself: large, not square and small, not named like a logo. */
  static isEventPicture(p: Probe) {
    if (p.type === 'image/svg+xml' || p.type === 'image/x-icon' || p.type === 'image/vnd.microsoft.icon') return false;
    if (!p.width || !p.height || p.width < 400 || p.height < 200) return false;
    const ratio = p.width / p.height;
    if (ratio < 0.5 || ratio > 3.5) return false;
    if (Math.abs(ratio - 1) < 0.15 && p.width <= 600) return false;
    return !LOGO_WORDS.test(p.url);
  }

  static isLogo(p: Probe) {
    if (p.type === 'image/svg+xml') return true;
    return (p.width ?? 0) >= 96 && (p.height ?? 0) >= 48;
  }

  async find(o: ImageSubject, illustrate?: () => Promise<string | null>): Promise<FoundImage | null> {
    const pages = [o.sourceUrl, o.actionUrl, ...(o.alsoSeenAt ?? [])].map((u) => safeUrl(u)?.href).filter((u): u is string => !!u);
    const unique = [...new Set(pages)].slice(0, 4);
    const eventCandidates: string[] = [];
    const logoCandidates: string[] = [];
    const agentImage = safeUrl(o.image ?? null)?.href;
    if (agentImage) eventCandidates.push(agentImage);
    const htmls = await Promise.all(unique.map((u) => this.page(u)));
    for (const [i, html] of htmls.entries()) {
      if (!html) continue;
      const found = picturesOn(html, unique[i]!);
      eventCandidates.push(...found.event);
      logoCandidates.push(...found.logo);
    }

    // 1. The event or posting's own picture.
    const checked = new Map<string, Probe | null>();
    const probe = async (u: string) => {
      if (!checked.has(u)) checked.set(u, await this.probe(u));
      return checked.get(u)!;
    };
    for (const u of [...new Set(eventCandidates)].slice(0, 6)) {
      const p = await probe(u);
      if (p && ImageFinder.isEventPicture(p)) return { url: p.url, kind: 'event', credit: null, creditUrl: null };
    }

    // 2. The organizer's logo: from those pages, then the organizer's own home page.
    const home = safeUrl(o.sourceUrl);
    const organizerSite = home && !HOSTS_NOT_THE_ORGANIZER.test(home.hostname) ? home : null;
    if (organizerSite) {
      const html = await this.page(organizerSite.origin + '/');
      if (html) {
        const found = picturesOn(html, organizerSite.origin + '/');
        logoCandidates.push(...found.logo, ...found.event.filter((u) => LOGO_WORDS.test(u)));
      }
    }
    // Preview pictures that turned out to be a logo count as one.
    for (const u of eventCandidates) {
      const p = checked.get(u);
      if (p && !ImageFinder.isEventPicture(p) && ImageFinder.isLogo(p)) logoCandidates.unshift(u);
    }
    const byPreference = [...new Set(logoCandidates)].sort((a, b) => Number(/apple-touch|logo/i.test(b)) - Number(/apple-touch|logo/i.test(a)) || Number(/\.ico(\?|$)/i.test(a)) - Number(/\.ico(\?|$)/i.test(b)));
    for (const u of byPreference.slice(0, 6)) {
      const p = await probe(u);
      if (p && ImageFinder.isLogo(p)) return { url: p.url, kind: 'logo', credit: null, creditUrl: null };
    }
    if (organizerSite) {
      const p = await probe(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(organizerSite.hostname)}&sz=256`);
      if (p && ImageFinder.isLogo(p) && (p.width ?? 0) >= 96) return { url: p.url, kind: 'logo', credit: null, creditUrl: null };
    }

    // 3. A free, openly licensed photo on the same topic.
    if (this.stock) {
      const stock = await this.stockPhoto(o);
      if (stock) return stock;
    }

    // 4. An illustration drawn by the agents' model.
    if (illustrate) {
      const svg = await illustrate().catch(() => null);
      const url = svg ? cleanSvg(svg) : null;
      if (url) return { url, kind: 'generated', credit: 'AI-generated illustration', creditUrl: null };
    }
    return null;
  }

  /** Search words for a stock photo: what kind of thing it is, and its field. */
  static stockQuery(o: ImageSubject) {
    const kind: Record<string, string> = {
      internship: 'office team working',
      event: 'conference audience',
      club: 'students club meeting',
      hackathon: 'hackathon',
      research: 'research laboratory',
      scholarship: 'university students campus',
    };
    const field: Record<string, string> = { software: 'programming', data: 'data', ai: 'artificial intelligence', design: 'design', security: 'cybersecurity', hardware: 'electronics', bio: 'biology', finance: 'finance', product: 'product' };
    return [kind[o.type] ?? 'students', o.field ? (field[o.field] ?? o.field) : ''].filter(Boolean).join(' ');
  }

  private async stockPhoto(o: ImageSubject): Promise<FoundImage | null> {
    for (const q of [ImageFinder.stockQuery(o), ImageFinder.stockQuery({ ...o, field: null })]) {
      const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=12&mature=false&license_type=commercial&aspect_ratio=wide`;
      const res = await this.stockQueue(async () => {
        // Asked too often: wait and try once more.
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const r = await this.fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(this.timeoutMs) });
            if (r.status === 429 && attempt === 0) {
              await new Promise((done) => setTimeout(done, 2500));
              continue;
            }
            return r.ok ? r : null;
          } catch {
            return null;
          }
        }
        return null;
      });
      if (!res) continue;
      const data = (await res.json().catch(() => null)) as { results?: any[] } | null;
      const usable = (data?.results ?? []).filter((r) => typeof r.url === 'string' && safeUrl(r.url) && (r.width ?? 0) >= 800);
      if (!usable.length) continue;
      // The same posting always gets the same photo, and different postings different ones.
      const seed = [...(o.id ?? o.title)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
      for (let i = 0; i < Math.min(usable.length, 4); i++) {
        const r = usable[(seed + i) % usable.length];
        const p = await this.probe(r.url);
        if (!p || !p.type.startsWith('image/')) continue;
        const code = String(r.license ?? '').toLowerCase();
        const licence = code === 'cc0' ? 'CC0' : code === 'pdm' ? 'public domain' : `CC ${code.toUpperCase()} ${r.license_version ?? ''}`.trim();
        const by = r.creator ? ` by ${r.creator}` : '';
        return { url: p.url, kind: 'stock', credit: `Photo${by}, ${licence}`, creditUrl: typeof r.foreign_landing_url === 'string' ? r.foreign_landing_url : null };
      }
    }
    return null;
  }
}
