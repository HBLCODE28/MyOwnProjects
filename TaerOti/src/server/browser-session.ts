import { randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

export const BROWSER_SESSION_COOKIE = 'taer_oti_session';
const SESSION_BYTES = 32;
const SESSION_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SESSION_MAX_AGE_SECONDS = 6 * 60 * 60;

export function createBrowserSessionId() {
  return randomBytes(SESSION_BYTES).toString('base64url');
}

export function parseCookies(header: string | undefined) {
  const cookies = new Map<string, string>();
  if (!header) return cookies;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index <= 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    try {
      cookies.set(key, decodeURIComponent(value));
    } catch {
      cookies.set(key, value);
    }
  }
  return cookies;
}

export function readBrowserSessionId(req: IncomingMessage) {
  const value = parseCookies(req.headers.cookie).get(BROWSER_SESSION_COOKIE) || '';
  return SESSION_PATTERN.test(value) ? value : '';
}

export function ensureBrowserSession(req: IncomingMessage, res: ServerResponse) {
  const existing = readBrowserSessionId(req);
  if (existing) return existing;

  const value = createBrowserSessionId();
  const secure = process.env.NODE_ENV === 'production'
    || req.headers['x-forwarded-proto'] === 'https';
  const attributes = [
    `${BROWSER_SESSION_COOKIE}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    secure ? 'Secure' : '',
  ].filter(Boolean);
  res.setHeader('Set-Cookie', attributes.join('; '));
  return value;
}
