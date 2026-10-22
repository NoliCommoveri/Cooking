// Drives the real Worker against the D1 stand-in: a fresh, migrated database,
// and a browser-like client per family that keeps its own cookies.
import worker from '../../src/worker/index.js';
import { applyPending } from '../../src/worker/migrate.js';
import { makeDb } from './d1.js';

export const ORIGIN = 'https://cook.test';

// Every email the Worker sends to Resend lands here instead.
export const outbox = [];
globalThis.fetch = async (url, init) => {
  if (String(url) !== 'https://api.resend.com/emails') throw new Error(`unexpected fetch ${url}`);
  outbox.push(JSON.parse(init.body));
  return new Response('{"id":"test"}', { status: 200 });
};
export const lastEmailTo = (addr) => [...outbox].reverse().find((m) => m.to.includes(addr));
export const codeFor = (addr) => lastEmailTo(addr)?.text.match(/\b(\d{6})\b/)?.[1];

export async function makeEnv({ migrate = true, ...extra } = {}) {
  const DB = makeDb();
  if (migrate) await applyPending(DB);
  return {
    DB,
    OPS_TOKEN: 'ops-secret',
    RESEND_API_KEY: 'test-key',
    MAIL_FROM: 'Clean Plate <cook@example.com>',
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

// A family signed up through the emailed code, with its name and PIN set (so
// parent screens are unlocked). With pin: null it stops before the first run.
export async function family(env, name, emailAddr, { pin = '1234' } = {}) {
  const c = client(env);
  const start = await c.post('/api/signup/start', { email: emailAddr, password: 'password123' });
  if (start.status !== 200) throw new Error(JSON.stringify(start.body));
  const res = await c.post('/api/signup/verify', { email: emailAddr, code: codeFor(emailAddr) });
  if (res.status !== 200) throw new Error(JSON.stringify(res.body));
  if (pin) await c.post('/api/pin/set', { family_name: name, pin });
  return c;
}

export async function opsClient(env) {
  const c = client(env);
  await c.form('/ops/login', { token: env.OPS_TOKEN });
  return c;
}

// A course plan with only the four sample lessons kept, so tests that count or
// order a course's lessons don't change each time another lesson is written.
export const SAMPLES = ['shakshuka', 'beef-bulgogi', 'buttermilk-biscuits', 'brown-butter-cookies'];
export async function samplePlan(c) {
  return (await c.get('/api/courses')).body.default_plan.map((x) => ({ ...x, removed: !SAMPLES.includes(x.id) }));
}
