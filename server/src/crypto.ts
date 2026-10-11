/**
 * Zero-dependency auth primitives built on node:crypto.
 *
 * Replaces bcryptjs (pure-JS, slow) with scrypt — a memory-hard KDF that is
 * both stronger and native (C++), so hashing is faster on low-power hardware.
 * Replaces jsonwebtoken (11 transitive deps) with an HMAC-SHA256 signed token,
 * which is exactly what a JWT HS256 is, minus the dependency tree.
 */
import { scryptSync, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';

// scrypt cost parameters — N=16384 uses ~16MB per hash, fine for a small VPS.
const SCRYPT = { N: 16384, r: 8, p: 1 } as const;
const KEYLEN = 64;

/** Hash a password -> "scrypt$<salt-b64url>$<hash-b64url>" */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN, SCRYPT);
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

/** Constant-time password check. Returns false for malformed/legacy hashes. */
export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, saltB64, hashB64] = stored.split('$');
    if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
    const salt = Buffer.from(saltB64, 'base64url');
    const expected = Buffer.from(hashB64, 'base64url');
    const actual = scryptSync(password, salt, expected.length, SCRYPT);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** Sign a payload -> "<base64url(json)>.<base64url(hmac)>" with an expiry. */
export function signToken(payload: Record<string, unknown>, secret: string, ttlSeconds: number): string {
  // `jti` (unique token id) guarantees two logins in the same second never
  // produce an identical token — HMAC output is otherwise deterministic.
  const body = {
    ...payload,
    jti: randomBytes(9).toString('base64url'),
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const data = Buffer.from(JSON.stringify(body)).toString('base64url');
  const sig = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

/** Verify + decode a token. Returns null when invalid, tampered with, or expired. */
export function verifyToken(token: string, secret: string): Record<string, any> | null {
  if (!token) return null;
  const idx = token.lastIndexOf('.');
  if (idx <= 0) return null;
  const data = token.slice(0, idx);
  const sig = token.slice(idx + 1);

  const expected = createHmac('sha256', secret).update(data).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const body = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (typeof body.exp === 'number' && body.exp < Math.floor(Date.now() / 1000)) return null;
    return body;
  } catch {
    return null;
  }
}

/** Short, URL-safe id generator (replaces randomUUID where a compact id is fine). */
export function shortId(bytes = 12): string {
  return randomBytes(bytes).toString('base64url');
}
