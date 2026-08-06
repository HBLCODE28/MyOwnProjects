import { createServer } from 'node:http';
import next from 'next';
import { attachGameSocketServer } from './src/server/socket-server';
import { ensureBrowserSession } from './src/server/browser-session';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = Number(process.env.PORT || 3000);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();

const httpServer = createServer((req, res) => {
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
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
    const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
    const proto = forwardedProto || (process.env.NODE_ENV === 'production' ? 'https' : 'http');
    const fallbackOrigin = `${proto}://${req.headers.host || `localhost:${port}`}`;
    const publicOrigin = (process.env.TAER_OTI_PUBLIC_ORIGIN || fallbackOrigin).replace(/\/$/, '');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ publicOrigin }));
    return;
  }

  handle(req, res);
});
attachGameSocketServer(httpServer);

httpServer.listen(port, hostname, () => {
  console.log(`Taer Oti running at http://${hostname}:${port}`);
});
