// Checks a Firebase sign-in token without a service account, so a copy of the app on any laptop
// can tell who is signed in. A token is a signed statement from Google; this verifies the
// signature against Google's published keys and that it was made for this Firebase project.
import { createPublicKey, createVerify } from 'node:crypto';

const CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

export interface IdTokenClaims {
  sub: string;
  name?: string;
  email?: string;
  email_verified?: boolean;
  picture?: string;
  firebase?: { sign_in_provider?: string };
  [claim: string]: unknown;
}

export type CertFetcher = () => Promise<{ certs: Record<string, string>; maxAgeMs: number }>;

/** Google's current signing certificates, by key id. They change every few days. */
const fetchCerts: CertFetcher = async () => {
  const res = await fetch(CERTS_URL);
  if (!res.ok) throw new Error(`could not fetch sign-in keys (${res.status})`);
  const maxAge = /max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')?.[1];
  return { certs: (await res.json()) as Record<string, string>, maxAgeMs: (maxAge ? Number(maxAge) : 3600) * 1000 };
};

const decode = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));

export function idTokenVerifier(projectId: string, opts: { fetchCerts?: CertFetcher; now?: () => number } = {}) {
  const now = opts.now ?? Date.now;
  const load = opts.fetchCerts ?? fetchCerts;
  let cached: { certs: Record<string, string>; until: number } | null = null;
  const certFor = async (kid: string) => {
    // A key id not seen before means Google rotated its keys, so they are fetched again once.
    if (!cached || cached.until < now() || !cached.certs[kid]) {
      const fresh = await load();
      cached = { certs: fresh.certs, until: now() + fresh.maxAgeMs };
    }
    return cached.certs[kid] ?? null;
  };

  return async (token: string): Promise<IdTokenClaims> => {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('not a sign-in token');
    let header: { alg?: string; kid?: string };
    let claims: IdTokenClaims & { aud?: string; iss?: string; exp?: number; iat?: number; auth_time?: number };
    try {
      header = decode(parts[0]!);
      claims = decode(parts[1]!);
    } catch {
      throw new Error('not a sign-in token');
    }
    if (header.alg !== 'RS256' || !header.kid) throw new Error('unexpected token signing');
    const cert = await certFor(header.kid);
    if (!cert) throw new Error('token signed with an unknown key');
    const valid = createVerify('RSA-SHA256').update(`${parts[0]}.${parts[1]}`).verify(createPublicKey(cert), Buffer.from(parts[2]!, 'base64url'));
    if (!valid) throw new Error('token signature does not match');

    const seconds = now() / 1000;
    const SKEW = 300;
    if (claims.aud !== projectId) throw new Error('token is for another project');
    if (claims.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('token has the wrong issuer');
    if (typeof claims.exp !== 'number' || claims.exp < seconds - SKEW) throw new Error('token expired');
    if (typeof claims.iat !== 'number' || claims.iat > seconds + SKEW) throw new Error('token is from the future');
    if (typeof claims.sub !== 'string' || claims.sub.length === 0 || claims.sub.length > 128) throw new Error('token names no account');
    return claims;
  };
}
