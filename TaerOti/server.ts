import { createServer } from 'node:http';
import next from 'next';
import { attachGameSocketServer } from './src/server/socket-server';
import { ensureBrowserSession } from './src/server/browser-session';

const dev = process.env.NODE_ENV !== 'production';
// HOSTNAME is set by many hosting platforms to the machine/container name.
// Binding to it can make the server unreachable, so use an application-specific
// variable and listen on every interface by default.
const hostname = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT || 3000);
const trustProxy = process.env.TAER_OTI_TRUST_PROXY === 'true';

function publicOrigin(req: import('node:http').IncomingMessage) {
  const configured = process.env.TAER_OTI_PUBLIC_ORIGIN?.trim().replace(/\/$/, '');
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      console.warn('Ignoring invalid TAER_OTI_PUBLIC_ORIGIN.');
    }
  }

  const forwardedProto = trustProxy
    ? String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim()
    : '';
  const proto = forwardedProto === 'https' || forwardedProto === 'http'
    ? forwardedProto
    : (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  const host = req.headers.host || `localhost:${port}`;
  try {
    return new URL(`${proto}://${host}`).origin;
  } catch {
    return `http://localhost:${port}`;
  }
}

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();

const httpServer = createServer((req, res) => {
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  const requestUrl = new URL(req.url || '/', 'http://localhost');
  if (requestUrl.pathname === '/healthz') {
    if (req.method !== 'GET') {
      res.statusCode = 405;
      res.setHeader('Allow', 'GET');
      res.end('Method Not Allowed');
      return;
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (requestUrl.pathname === '/api/browser-session') {
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Allow', 'POST');
      res.end('Method Not Allowed');
      return;
    }
    ensureBrowserSession(req, res);
    res.statusCode = 204;
    res.end();
    return;
  }

  if (requestUrl.pathname === '/api/runtime-config') {
    if (req.method !== 'GET') {
      res.statusCode = 405;
      res.setHeader('Allow', 'GET');
      res.end('Method Not Allowed');
      return;
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ publicOrigin: publicOrigin(req) }));
    return;
  }

  handle(req, res);
});
attachGameSocketServer(httpServer);

httpServer.listen(port, hostname, () => {
  console.log(`Taer Oti running at http://${hostname}:${port}`);
});
