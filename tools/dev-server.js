// Runs the Worker on http://localhost:8787 against an in-memory database, for
// looking at the app in a browser during a Claude session. Not part of the app.
// Emails aren't sent: GET /__outbox lists them, so a sign-up code can be read.
// Usage: node --import ./test/helpers/register.js tools/dev-server.js
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../src/worker/index.js';
import { makeEnv, outbox } from '../test/helpers/worker.js';

const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
const env = await makeEnv();
env.ASSETS = {
  async fetch(req) {
    let path = new URL(req.url).pathname;
    // Like Cloudflare's assets: /demo goes to /demo/, and a folder serves its index.html.
    if (!extname(path) && !path.endsWith('/')) return Response.redirect(new URL(path + '/', req.url), 307);
    if (path.endsWith('/')) path += 'index.html';
    try {
      return new Response(await readFile(join(PUBLIC, path)), { headers: { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' } });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  },
};

createServer(async (req, res) => {
  if (req.url === '/__outbox') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(outbox)); }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  // Cookies are Secure; a plain-http dev server drops the flag.
  const out = await worker.fetch(new Request(`http://localhost:8787${req.url}`, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body }), env);
  const headers = {};
  out.headers.forEach((v, k) => { if (k !== 'set-cookie') headers[k] = v; });
  const cookies = out.headers.getSetCookie().map((c) => c.replace('; Secure', ''));
  if (cookies.length) headers['set-cookie'] = cookies;
  res.writeHead(out.status, headers);
  res.end(Buffer.from(await out.arrayBuffer()));
}).listen(8787, () => console.log('http://localhost:8787'));
