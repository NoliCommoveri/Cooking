// Takes the kitchen intro's screenshots (plan §6.9) from the running app, for
// a Claude session; the owner never runs it. A test family is made on the
// in-memory database, then each screen is opened at phone width in both
// themes, and the parts a card is about are measured, so the boxes match the
// screen. Writes public/img/intro/*.webp and public/intro-shots.js.
// Usage: node --import ./test/helpers/register.js tools/intro-shots.js
// Needs Playwright (preinstalled in Claude's cloud sessions) and ImageMagick.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../src/worker/index.js';
import { makeEnv, family, samplePlan } from '../test/helpers/worker.js';
import { weekOf } from '../src/worker/schedule.js';

const require = createRequire(import.meta.url);
const { chromium } = (() => {
  try { return require('playwright'); } catch { /* fall through */ }
  const root = execFileSync('npm', ['root', '-g']).toString().trim();
  return createRequire(join(root, '/'))('playwright');
})();

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const PUBLIC = join(ROOT, 'public');
const OUT = join(PUBLIC, 'img/intro');
const PORT = 8790;
const W = 390, H = 844;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

// ---- the app, on the in-memory database, with a test family ----
const env = await makeEnv();
env.ASSETS = {
  async fetch(req) {
    let path = new URL(req.url).pathname;
    if (path.endsWith('/')) path += 'index.html';
    try { return new Response(await readFile(join(PUBLIC, path)), { headers: { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' } }); }
    catch { return new Response('Not found', { status: 404 }); }
  },
};
const server = createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const out = await worker.fetch(new Request(`http://localhost:${PORT}${req.url}`, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) }), env);
  const headers = {};
  out.headers.forEach((v, k) => { if (k !== 'set-cookie') headers[k] = v; });
  const cookies = out.headers.getSetCookie().map((c) => c.replace('; Secure', ''));
  if (cookies.length) headers['set-cookie'] = cookies;
  res.writeHead(out.status, headers);
  res.end(Buffer.from(await out.arrayBuffer()));
}).listen(PORT);

const fam = await family(env, 'Sample family', 'sample@example.com');
await fam.post('/api/setup/done');
await fam.put('/api/family', { name: 'Sample family', default_servings: 4, diet_filters: [], plan_weeks: true });
const chefs = {
  quest: { name: 'Ava', color: 'tomato', audience: 'kid' },
  passport: { name: 'Ben', color: 'sky', audience: 'kid' },
  'quest-adult': { name: 'Mom', color: 'plum', audience: 'adult' },
  'passport-adult': { name: 'Dad', color: 'basil', audience: 'adult' },
};
for (const [key, c] of Object.entries(chefs)) {
  c.id = (await fam.post('/api/profiles', { people: [{ name: c.name, color: c.color }], audience: c.audience })).body.id;
  await fam.put(`/api/profiles/${c.id}/theme`, { theme: key.startsWith('quest') ? 'quest' : 'passport' });
  await fam.post(`/api/profiles/${c.id}/intro`);
}
const today = new Date().toISOString().slice(0, 10);
await fam.post('/api/courses', { profile_ids: [chefs.quest.id, chefs.passport.id], start_date: weekOf(today), per_week: 1, plan: await samplePlan(fam) });
// Its step 8 has a timer, a safety banner, Why?, and a kitchen word, all on one screen.
const COOK = 'ratatouille';
for (const kid of [chefs.quest, chefs.passport]) await fam.post('/api/queue', { lesson_id: COOK, profile_ids: [kid.id] });
const ASK = 'chimichurri-steak'; // not on anyone's list

// ---- the browser ----
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
await ctx.addCookies([...fam.jar].map(([name, value]) => ({ name, value, url: `http://localhost:${PORT}` })));
const page = await ctx.newPage();
page.on('pageerror', (e) => { throw e; });
const go = async (hash) => { await page.goto(`http://localhost:${PORT}/${hash}`); await page.waitForLoadState('networkidle'); await page.waitForTimeout(400); };
const click = async (sel) => { await page.click(sel); await page.waitForTimeout(250); };

// A screenshot of the part of the screen around these elements, with each
// one's box as a share of the picture. Missing elements fail the run, so a
// renamed button shows up here.
const shots = {};
async function shot(key, sels) {
  await page.locator(sels[0]).first().waitFor();
  // The highest of them just below the top of the screen.
  const tops = await Promise.all(sels.map((s) => page.locator(s).first().evaluate((n) => n.getBoundingClientRect().top + window.scrollY)));
  await page.evaluate((y) => window.scrollTo(0, y), Math.min(...tops) - 90);
  await page.waitForTimeout(250);
  const rects = [];
  for (const s of sels) {
    const r = await page.locator(s).first().evaluate((n) => { const b = n.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
    if (!r.w) throw new Error(`${key}: ${s} isn't showing`);
    rects.push(r);
  }
  const top = Math.max(0, Math.min(...rects.map((r) => r.y)) - 80);
  const bottom = Math.min(H, Math.max(...rects.map((r) => r.y + r.h)) + 80);
  const clip = { x: 0, y: top, width: W, height: Math.max(bottom - top, 320) };
  if (clip.y + clip.height > H) clip.y = H - clip.height;
  const png = join(OUT, `${key}.png`);
  await page.screenshot({ path: png, clip });
  execFileSync('convert', [png, '-quality', '72', join(OUT, `${key}.webp`)]);
  await rm(png);
  const pct = (v, of) => +((v / of) * 100).toFixed(2);
  const pad = 4;
  shots[key] = {
    img: `img/intro/${key}.webp`, w: W, h: Math.round(clip.height),
    boxes: rects.map((r) => {
      const x = Math.max(0, r.x - pad), y = Math.max(0, r.y - clip.y - pad);
      return { x: pct(x, W), y: pct(y, clip.height), w: pct(Math.min(W - x, r.w + 2 * pad), W), h: pct(Math.min(clip.height - y, r.h + 2 * pad), clip.height) };
    }),
  };
  console.log(key, shots[key].boxes.length);
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
for (const theme of ['quest', 'passport']) {
  const q = theme === 'quest';
  const kid = chefs[theme], adult = chefs[`${theme}-adult`];
  const tab = (n) => `.k-tabs a:nth-child(${n})`;
  // The three tabs.
  await go(`#/kitchen/${kid.id}/@path`);
  await shot(`${theme}-path`, ['.k-next', tab(1)]);
  await go(`#/kitchen/${kid.id}/@more`);
  await shot(`${theme}-more`, ['.k-search', tab(2)]);
  await go(`#/kitchen/${kid.id}/@progress`);
  await shot(`${theme}-progress`, [q ? '.q-lvl' : '.p-rank', tab(3)]);
  // Asking to cook, and Cook this.
  await go(`#/kitchen/${kid.id}/${ASK}`);
  await shot(`${theme}-ask`, ['[data-act="ask"]']);
  await go(`#/kitchen/${adult.id}/${ASK}`);
  await shot(`${theme}-ask-adult`, ['[data-act="ask"]']);
  // A cook: the lesson card, Learn, Prep, cook mode, and Plate it.
  await go(`#/kitchen/${kid.id}/${COOK}`);
  await shot(`${theme}-card`, [q ? '.serve:not(.crew)' : '.p-serve:not(.crew)', '.crew']);
  await click('[data-act="start"]');
  await shot(`${theme}-learn`, ['.learn article', '[data-act="goto"][data-to="prep"]']);
  await click('[data-act="goto"][data-to="prep"]');
  // Most things checked off, so the screen shows how it goes.
  const items = page.locator('[data-act="got"]');
  for (let i = 0, n = await items.count(); i < n - 1; i++) await items.nth(i).click();
  await shot(`${theme}-prep`, [q ? '.q-inv' : '.p-list']);
  for (let i = 0, n = await items.count(); i < n; i++) if ((await items.nth(i).getAttribute('aria-pressed')) !== 'true') await items.nth(i).click();
  const gear = page.locator('[data-act="gear"]');
  for (let i = 0, n = await gear.count(); i < n; i++) await gear.nth(i).click();
  await click('[data-act="goto"][data-to="cook"]');
  // The first step with a timer, a safety banner, Why?, and a kitchen word.
  const has = async (s) => (await page.locator(s).count()) > 0;
  const cookSels = ['.q-nav, .p-nav', '[data-act="tstart"]', '.q-banner, .p-banner', '[data-act="why"]', '.kw'];
  for (let guard = 0; guard < 40; guard++) {
    if ((await Promise.all(cookSels.map(has))).every(Boolean)) break;
    if (!(await has('[data-act="step"][data-i="1"]'))) throw new Error(`${COOK} has no step with all of: ${cookSels.join(' ')}`);
    await click('[data-act="step"][data-i="1"]');
  }
  await shot(`${theme}-cook`, cookSels.map((s) => s.split(', ').map((x) => `${q ? '.q-cook' : '.p-cook'} ${x}`).join(', ')));
  await shot(`${theme}-fix`, ['.fixbtn[data-step]:not([data-step=""])']);
  while (await has('[data-act="step"][data-i="1"]')) await click('[data-act="step"][data-i="1"]');
  await click('[data-act="finish"]');
  await shot(`${theme}-plate`, [q ? '.gems' : '.p-hats', 'textarea[data-f="notes"]']);
}

await writeFile(join(PUBLIC, 'intro-shots.js'), `// Made by tools/intro-shots.js: the kitchen intro's screenshots and boxes.\nexport default ${JSON.stringify(shots, null, 2)};\n`);
await browser.close();
server.close();
