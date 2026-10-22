// Drives the real Worker against the D1 stand-in: a fresh, migrated database,
// and a browser-like client per family that keeps its own cookies.
import worker from '../../src/worker/index.js';
import { applyPending } from '../../src/worker/migrate.js';
import { newInvite } from '../../src/worker/api.js';
import { makeDb } from './d1.js';

export const ORIGIN = 'https://cook.test';

export async function makeEnv({ migrate = true, ...extra } = {}) {
  const DB = makeDb();
  if (migrate) await applyPending(DB);
  return {
    DB,
    OPS_TOKEN: 'ops-secret',
    ASSETS: { fetch: async () => new Response('asset', { status: 200 }) },
    ...extra,
  };
}

export function client(env) {
  const jar = new Map();
  async function send(method, path, body, { form, headers = {} } = {}) {
    const h = new Headers(headers);
    if (jar.size) h.set('cookie', [...jar].map(([k, v]) => `${k}=${v}`).join('; '));
    let payload;
    if (form) payload = form;
    else if (body !== undefined) { h.set('content-type', 'application/json'); payload = JSON.stringify(body); }
    const res = await worker.fetch(new Request(ORIGIN + path, { method, headers: h, body: payload, redirect: 'manual' }), env);
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const [k, ...v] = pair.split('=');
      if (/Max-Age=0/.test(c)) jar.delete(k); else jar.set(k, v.join('='));
    }
    const type = res.headers.get('content-type') ?? '';
    return { status: res.status, body: type.includes('json') ? await res.json() : await res.text(), headers: res.headers };
  }
  return {
    jar,
    get: (p, o) => send('GET', p, undefined, o),
    post: (p, b = {}, o) => send('POST', p, b, o),
    put: (p, b = {}, o) => send('PUT', p, b, o),
    del: (p, o) => send('DELETE', p, {}, o),
    form: (p, fields) => {
      const f = new FormData();
      for (const [k, v] of Object.entries(fields)) f.append(k, v);
      return send('POST', p, undefined, { form: f });
    },
  };
}

// A family signed up with a code, PIN set (so parent screens are unlocked).
export async function family(env, name, emailAddr, { pin = '1234' } = {}) {
  const c = client(env);
  const code = await newInvite(env, 'test');
  const res = await c.post('/api/signup', { code, family_name: name, email: emailAddr, password: 'password123' });
  if (res.status !== 200) throw new Error(JSON.stringify(res.body));
  if (pin) await c.post('/api/pin/set', { pin });
  return c;
}

export async function opsClient(env) {
  const c = client(env);
  await c.form('/ops/login', { token: env.OPS_TOKEN });
  return c;
}
