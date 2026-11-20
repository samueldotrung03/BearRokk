// Sign-in for the desktop app through the system browser.
//
// The desktop window does not show Google's or X's sign-in itself. It makes a random secret
// (the verifier), opens the system browser at /auth/desktop with the secret's SHA-256 hash as the
// session id, and waits. The browser page signs the student in and posts the result under that
// session id. Only the app, which knows the verifier, can collect it, and only once.
// Results are held in memory for a few minutes and never written anywhere.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Hono } from 'hono';

interface Handoff {
  provider: 'google' | 'x';
  idToken: string | null;
  accessToken: string | null;
  secret: string | null;
  expires: number;
}

const TTL_MS = 5 * 60_000;
const SESSION = /^[a-f0-9]{64}$/;
const text = (v: unknown, max = 8192) => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : null);

export function mountDesktopAuth(app: Hono, now: () => number = Date.now) {
  const waiting = new Map<string, Handoff>();
  const sweep = () => {
    for (const [id, h] of waiting) if (h.expires < now()) waiting.delete(id);
  };

  // The page the system browser opens.
  app.get('/auth/desktop', (c) => c.html(readFileSync(new URL('../public/desktop-signin.html', import.meta.url), 'utf8')));

  // The browser page leaves the sign-in result here.
  app.post('/api/auth/desktop/:session', async (c) => {
    sweep();
    const session = c.req.param('session');
    const body = await c.req.json().catch(() => ({}));
    if (!SESSION.test(session)) return c.json({ error: 'bad session' }, 400);
    if (body.provider !== 'google' && body.provider !== 'x') return c.json({ error: 'unknown provider' }, 400);
    const handoff: Handoff = { provider: body.provider, idToken: text(body.idToken), accessToken: text(body.accessToken), secret: text(body.secret), expires: now() + TTL_MS };
    if (!handoff.idToken && !handoff.accessToken) return c.json({ error: 'no credential' }, 400);
    // First result wins; a second post cannot replace it.
    if (waiting.has(session)) return c.json({ error: 'already used' }, 409);
    if (waiting.size > 200) return c.json({ error: 'busy' }, 503);
    waiting.set(session, handoff);
    return c.json({ ok: true });
  });

  // The desktop app collects it by proving it holds the verifier.
  app.post('/api/auth/desktop/:session/claim', async (c) => {
    sweep();
    const session = c.req.param('session');
    const body = await c.req.json().catch(() => ({}));
    const verifier = text(body.verifier, 256);
    if (!SESSION.test(session) || !verifier) return c.json({ error: 'bad request' }, 400);
    if (createHash('sha256').update(verifier).digest('hex') !== session) return c.json({ error: 'wrong verifier' }, 403);
    const handoff = waiting.get(session);
    if (!handoff) return c.json({ pending: true }, 202);
    waiting.delete(session);
    const { expires: _expires, ...credential } = handoff;
    return c.json({ credential });
  });
}
