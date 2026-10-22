// Runs the Worker on http://localhost:8787 against an in-memory database, for
// looking at the app in a browser during a Claude session. Not part of the app.
// Usage: node --import ./test/helpers/register.js tools/dev-server.js
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../src/worker/index.js';
import { makeEnv } from '../test/helpers/worker.js';

const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png' };
const env = await makeEnv();
env.ASSETS = {
  async fetch(req) {
    let path = new URL(req.url).pathname;
    if (path.endsWith('/')) path += 'index.html';
    try {
      return new Response(await readFile(join(PUBLIC, path)), { headers: { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' } });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  },
};

createServer(async (req, res) => {
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
