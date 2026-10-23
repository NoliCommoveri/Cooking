// The token-gated /ops page (plan §8.5), modeled on the MCCE repo's src/ops.js.
// The owner has no command line, so this page is the whole setup and recovery
// path: migrations, the owner flag, backups, and the
// destructive controls, each with its restore beside it.
import { migrationStatus, applyPending } from './migrate.js';
import {
  exportAll, importAll, clearEverything, exportFamily, removeFamily, restoreFamily, tableNames,
  Refused, CLEAR_PHRASE, REMOVE_PHRASE,
} from './backup.js';
import { emailReady } from './email.js';
import { githubCheck } from './github.js';
import { hmacHex, timingSafeEqual } from './lib/crypto.js';
import { readCookie } from './lib/http.js';
import { escapeHtml as esc } from './lib/html.js';

const COOKIE = 'ops_session';
const SESSION_SECONDS = 7 * 24 * 60 * 60;

// A separate OPS_TOKEN secret, not a parent login, so a parent session can never
// run a migration or a reset.
async function mintCookie(secret) {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  return `${expires}.${await hmacHex(secret, `ops:${expires}`)}`;
}

async function cookieValid(secret, value) {
  const [expires, sig] = String(value ?? '').split('.');
  if (!(Number(expires) * 1000 > Date.now())) return false;
  return timingSafeEqual(sig ?? '', await hmacHex(secret, `ops:${expires}`));
}

// ---------- rendering ----------

function page(title, body, status = 200) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — Clean Plate ops</title>
<style>
  :root { color-scheme: light dark; --bg: #F1EFEA; --fg: #1F2328; --line: #D7D2C8; --card: #fff; --acc: #2E6B5B; }
  @media (prefers-color-scheme: dark) { :root { --bg: #14161A; --fg: #ECEDEF; --line: #2B2F36; --card: #1D2025; --acc: #7CC5AE; } }
  body { font: 16px/1.5 system-ui, sans-serif; margin: 0 auto; padding: 16px; max-width: 48rem; background: var(--bg); color: var(--fg); }
  h1 { font-size: 1.4rem; margin: 0 0 .25rem; }
  h2 { font-size: 1.1rem; margin: 2rem 0 .5rem; border-bottom: 1px solid var(--line); padding-bottom: .25rem; }
  table { border-collapse: collapse; width: 100%; font-size: .9rem; }
  td, th { text-align: left; padding: .35rem .5rem .35rem 0; vertical-align: top; border-bottom: 1px solid var(--line); }
  .scroll { overflow-x: auto; }
  code, pre { font-family: ui-monospace, monospace; font-size: .85em; }
  pre { overflow-x: auto; background: var(--card); padding: .6rem; border-radius: 6px; white-space: pre-wrap; }
  button, .btn { font: inherit; padding: .5rem .9rem; min-height: 44px; border-radius: 8px; border: 1px solid var(--line); background: var(--card); color: inherit; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; }
  button.danger { border-color: #b3261e; color: #b3261e; }
  input { font: inherit; padding: .45rem; min-height: 44px; box-sizing: border-box; border-radius: 8px; border: 1px solid var(--line); background: var(--card); color: inherit; max-width: 100%; }
  form { margin: .5rem 0; }
  .row { display: flex; gap: .5rem; flex-wrap: wrap; align-items: center; }
  .muted { opacity: .7; }
  .bad { color: #b3261e; font-weight: 600; }
  .ok { color: #2E7D46; }
  .note { background: var(--card); border: 1px solid var(--line); padding: .6rem .8rem; border-radius: 8px; margin: .75rem 0; }
  .code { font: 700 1.5rem ui-monospace, monospace; letter-spacing: .1em; }
</style></head><body>${body}</body></html>`, {
    status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

const loginPage = (message) => page('Sign in', `<h1>Clean Plate ops</h1>
${message ? `<p class="bad">${esc(message)}</p>` : ''}
<form method="post" action="/ops/login">
  <p><label>Ops token<br><input type="password" name="token" autocomplete="current-password" autofocus></label></p>
  <button type="submit">Sign in</button>
</form>`);

const back = '<p><a href="/ops">Back to ops</a></p>';

const migrationTable = (rows) => `<div class="scroll"><table><tr><th>id</th><th>name</th><th>state</th><th>applied</th></tr>${rows.map((m) => `<tr>
  <td><code>${esc(m.id)}</code></td><td>${esc(m.name)}</td>
  <td class="${m.state === 'applied' ? 'ok' : m.state === 'pending' ? '' : 'bad'}"><b>${esc(m.state)}</b></td>
  <td class="muted">${esc(m.applied_at ?? '—')}</td></tr>`).join('')}</table></div>`;

const migrateLog = ({ log, halted }) => log.map((e) => (e.ok
  ? `<p class="ok">Applied <code>${esc(e.id)}</code> ${esc(e.name)}: ${esc(e.statements)} statements.</p>`
  : `<p class="bad">Failed on <code>${esc(e.id)}</code> ${esc(e.name)}. Nothing from this migration was applied.</p>
     <pre>${esc(e.error)}</pre>
     <details><summary>The statements in this migration</summary><pre>${esc(e.statementList.map((s, i) => `${i + 1}.  ${s};`).join('\n\n'))}</pre></details>`)).join('')
  + (halted ? '<p class="bad">Stopped. Later migrations were not tried.</p>' : '') || '<p>Nothing was pending.</p>';

function check(ok, good, badText) {
  return `<li class="${ok ? 'ok' : 'bad'}">${ok ? '✓' : '✗'} ${ok ? good : badText}</li>`;
}

async function dashboard(env, flash = '') {
  if (!env.DB) {
    return page('Ops', `<h1>Clean Plate ops</h1>${flash}<div class="note"><strong>No database is connected.</strong>
      Create the D1 database in the Cloudflare dashboard and put its id in <code>wrangler.toml</code>
      (the setup steps in <code>docs/setup.md</code> say exactly where). Everything else on this page waits for it.</div>`);
  }
  const migrations = await migrationStatus(env.DB);
  const pending = migrations.filter((m) => m.state === 'pending').length;
  const ready = migrations.length > 0 && migrations.every((m) => m.state === 'applied');

  // Nothing below the migrations runs until the database matches this deploy,
  // so a deploy that lands before Apply pending never breaks this page, which is
  // the only way to press Apply pending.
  let families = [], owners = 0, error = null;
  if (ready) {
    try {
      families = (await env.DB.prepare(`SELECT f.id, f.name, f.created_at, f.last_active_at, f.photos_enabled,
          (SELECT COUNT(*) FROM parents p WHERE p.family_id = f.id) AS parents,
          (SELECT COUNT(*) FROM profiles p WHERE p.family_id = f.id) AS profiles,
          (SELECT GROUP_CONCAT(email, ', ') FROM parents p WHERE p.family_id = f.id) AS emails
        FROM families f ORDER BY f.created_at`).all()).results;
      owners = (await env.DB.prepare('SELECT COUNT(*) AS n FROM parents WHERE is_owner = 1').first()).n;
    } catch (err) {
      error = String(err?.message ?? err);
    }
  }
  const notReady = '<p class="muted">Apply the pending migrations first.</p>';
  // The manager section saves content through GitHub (§7.5).
  const github = await githubCheck(env);

  return page('Ops', `<h1>Clean Plate ops</h1>
<form method="post" action="/ops/logout"><button type="submit">Sign out of ops</button></form>
${flash}
${error ? `<p class="bad">A query failed, so part of this page is missing.</p><pre>${esc(error)}</pre>` : ''}

<h2>Setup</h2>
<ul>
  ${check(true, 'Database connected.', '')}
  ${check(ready, 'Migrations applied.', 'Migrations are not all applied. Press Apply pending below.')}
  ${check(emailReady(env), 'Email is set up (Resend).', 'Email is not set up: add the RESEND_API_KEY secret and the MAIL_FROM variable. Until then nobody can sign up, because sign-up emails a code.')}
  ${check(owners > 0, 'An owner is set.', 'No owner yet. Sign up in the app, then make your email the owner below.')}
  ${check(github.ok, `GitHub: ${esc(github.message)} The manager section at <a href="/manage/">/manage</a> can save.`, `GitHub: ${esc(github.message)} Until it's connected, the manager section at <a href="/manage/">/manage</a> can show the content but not save it. docs/setup.md has the steps.`)}
</ul>

<h2>Migrations</h2>
${migrationTable(migrations)}
<form method="post" action="/ops/migrate"><button type="submit"${pending ? '' : ' disabled'}>Apply pending${pending ? ` (${pending})` : ''}</button></form>

<h2>The owner</h2>
${ready ? `<form method="post" action="/ops/owner" class="row">
  <input type="email" name="email" placeholder="parent email" required>
  <button type="submit">Make this parent the owner</button>
</form>` : notReady}

<h2>Families</h2>
${ready ? (families.length ? families.map((f) => `<div class="note">
  <b>${esc(f.name)}</b> <span class="muted">${esc(f.emails ?? '')}</span><br>
  <span class="muted">${esc(f.parents)} parent login(s) · ${esc(f.profiles)} profile(s) · last active ${esc((f.last_active_at ?? f.created_at).slice(0, 10))} · photos ${f.photos_enabled ? 'on' : 'off'}</span>
  <div class="row" style="margin-top:.4rem"><a class="btn" href="/ops/family/${esc(f.id)}.json">Download</a>
  <form method="post" action="/ops/photos/${esc(f.id)}"><input type="hidden" name="on" value="${f.photos_enabled ? '0' : '1'}"><button type="submit">${f.photos_enabled ? 'Turn photos off' : 'Turn photos on'}</button></form>
  <a class="btn" href="/ops/remove/${esc(f.id)}">Remove…</a></div></div>`).join('') : '<p class="muted">No families yet.</p>')
  + `<form method="post" action="/ops/restore-family" enctype="multipart/form-data" class="row">
  <input type="file" name="file" accept="application/json,.json" required>
  <button type="submit">Restore a family</button></form>
<p class="muted">Restore a family puts back a family from its own download, after it was removed.</p>` : notReady}

<h2>Backup</h2>
${ready ? `<p><a class="btn" href="/ops/export.json">Download export.json</a> Every table, as one file.</p>
<form method="post" action="/ops/import" enctype="multipart/form-data" class="row">
  <input type="file" name="file" accept="application/json,.json" required>
  <button type="submit">Restore from export.json</button></form>
<p class="muted">Restore fills an empty database from a download. It never merges into one that has data.</p>` : notReady}

<h2>Clear everything</h2>
<p>Deletes every table and every row. The way back is
<em>Apply pending</em>, then <em>Restore from export.json</em> above, so download one first.</p>
<p><a class="btn" href="/ops/clear">Clear everything…</a></p>`);
}

// ---------- confirm pages ----------

const clearPage = async (env, message = '') => {
  const tables = await tableNames(env.DB);
  return page('Clear everything', `<h1>Clear everything</h1>${message}
<div class="note"><strong>This deletes all ${tables.length} tables and every row in them.</strong>
<a href="/ops/export.json">Download export.json first</a>. To bring it back: Apply pending, then Restore from export.json.</div>
<form method="post" action="/ops/clear">
  <p><label>Type <code>${CLEAR_PHRASE}</code> to confirm<br><input name="phrase" autocomplete="off" required></label></p>
  <button type="submit" class="danger">Clear everything</button>
</form>${back}`);
};

const removePage = async (env, familyId, message = '') => {
  const fam = await env.DB.prepare('SELECT name FROM families WHERE id = ?').bind(familyId).first();
  if (!fam) return page('Remove a family', `<h1>No such family</h1>${back}`, 404);
  return page('Remove a family', `<h1>Remove ${esc(fam.name)}</h1>${message}
<div class="note"><strong>This deletes the family, its parent logins, and its profiles.</strong>
<a href="/ops/family/${esc(familyId)}.json">Download this family first</a>. To bring it back, use Restore a family with that file.</div>
<form method="post" action="/ops/remove/${esc(familyId)}">
  <p><label>Type <code>${REMOVE_PHRASE}</code> to confirm<br><input name="phrase" autocomplete="off" required></label></p>
  <button type="submit" class="danger">Remove this family</button>
</form>${back}`);
};

const download = (body, filename) => new Response(JSON.stringify(body, null, 2), {
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'content-disposition': `attachment; filename="${filename}"`,
    'cache-control': 'no-store',
  },
});

async function uploadedJson(request) {
  const file = (await request.formData()).get('file');
  if (!file || typeof file.text !== 'function') throw new Refused('Choose a file first.');
  try {
    return JSON.parse(await file.text());
  } catch {
    throw new Refused('That file is not valid JSON.');
  }
}

const restoredNote = (loaded) => `<p class="ok">Restored ${esc(loaded.reduce((n, t) => n + t.rows, 0))} rows:
  ${esc(loaded.map((t) => `${t.table} (${t.rows})`).join(', ') || 'the file had no rows')}.</p>`;

// ---------- routing ----------

export async function handleOps(request, env) {
  // Every failure renders as an ops page with a way back, never a raw error.
  try {
    return await route(request, env);
  } catch (err) {
    if (err instanceof Refused) return dashboard(env, `<p class="bad">Nothing was changed. ${esc(err.message)}</p>`);
    return page('Something went wrong', `<h1>Something went wrong</h1>
<div class="note">The action did not finish. This is what the database said:</div>
<pre>${esc(String(err?.message ?? err))}</pre>${back}`, 500);
  }
}

async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const post = request.method === 'POST';

  if (!env.OPS_TOKEN) {
    return page('Not set up', `<h1>Clean Plate ops</h1><div class="note"><strong>OPS_TOKEN is not set.</strong>
In the Cloudflare dashboard: Workers &amp; Pages → <code>clean-plate-recipes</code> → Settings →
Variables and Secrets → Add, type <em>Secret</em>, name <code>OPS_TOKEN</code>. Ops stays closed until it's set.</div>`);
  }

  if (path === '/ops/login' && post) {
    const form = await request.formData();
    if (!timingSafeEqual(String(form.get('token') ?? ''), env.OPS_TOKEN)) return loginPage("That token didn't match.");
    return new Response(null, {
      status: 303,
      headers: { location: '/ops', 'set-cookie': `${COOKIE}=${await mintCookie(env.OPS_TOKEN)}; Path=/ops; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}` },
    });
  }

  if (!(await cookieValid(env.OPS_TOKEN, readCookie(request, COOKIE)))) return loginPage('');

  if (path === '/ops/logout' && post) {
    return new Response(null, { status: 303, headers: { location: '/ops', 'set-cookie': `${COOKIE}=; Path=/ops; HttpOnly; Secure; SameSite=Strict; Max-Age=0` } });
  }
  if (path === '/ops' && !post) return dashboard(env);
  if (!env.DB) return dashboard(env);

  if (path === '/ops/migrate' && post) return dashboard(env, migrateLog(await applyPending(env.DB)));

  if (path === '/ops/owner' && post) {
    const addr = String((await request.formData()).get('email') ?? '').trim().toLowerCase();
    const res = await env.DB.prepare('UPDATE parents SET is_owner = 1 WHERE email = ?').bind(addr).run();
    if (!res.meta.changes) throw new Refused(`No parent has the email ${addr}. Sign up first.`);
    return dashboard(env, `<p class="ok">${esc(addr)} is now the owner. The owner screens are in the app's parent area.</p>`);
  }

  if (path === '/ops/export.json' && !post) {
    return download(await exportAll(env.DB), `clean-plate-export-${new Date().toISOString().slice(0, 10)}.json`);
  }
  if (path === '/ops/import' && post) return dashboard(env, restoredNote(await importAll(env.DB, await uploadedJson(request))));

  if (path === '/ops/clear' && !post) return clearPage(env);
  if (path === '/ops/clear' && post) {
    const phrase = String((await request.formData()).get('phrase') ?? '').trim();
    if (phrase !== CLEAR_PHRASE) return clearPage(env, `<p class="bad">Type ${CLEAR_PHRASE} exactly. Nothing was deleted.</p>`);
    const dropped = await clearEverything(env.DB);
    return dashboard(env, `<p class="ok">Cleared ${esc(dropped.length)} tables. Press Apply pending to rebuild them, then restore a download if you have one.</p>`);
  }

  const fam = path.match(/^\/ops\/family\/([0-9a-f]{16})\.json$/);
  if (fam && !post) {
    const out = await exportFamily(env.DB, fam[1]);
    const slug = out.tables.families[0].name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'family';
    return download(out, `clean-plate-family-${slug}-${new Date().toISOString().slice(0, 10)}.json`);
  }

  const rm = path.match(/^\/ops\/remove\/([0-9a-f]{16})$/);
  if (rm && !post) return removePage(env, rm[1]);
  if (rm && post) {
    const phrase = String((await request.formData()).get('phrase') ?? '').trim();
    if (phrase !== REMOVE_PHRASE) return removePage(env, rm[1], `<p class="bad">Type ${REMOVE_PHRASE} exactly. Nothing was deleted.</p>`);
    const name = await removeFamily(env.DB, rm[1]);
    return dashboard(env, `<p class="ok">Removed ${esc(name)}. Restore a family brings it back from its download.</p>`);
  }

  // Photos for one family (§2.6). Turning them off hides the photo step,
  // gallery, and download, and deletes nothing; turning them on brings them back.
  const ph = path.match(/^\/ops\/photos\/([0-9a-f]{16})$/);
  if (ph && post) {
    const on = String((await request.formData()).get('on')) === '1';
    const fam = await env.DB.prepare('SELECT name FROM families WHERE id = ?').bind(ph[1]).first();
    if (!fam) throw new Refused('No such family.');
    await env.DB.prepare('UPDATE families SET photos_enabled = ? WHERE id = ?').bind(on ? 1 : 0, ph[1]).run();
    return dashboard(env, `<p class="ok">Photos are ${on ? 'on' : 'off'} for ${esc(fam.name)}.${on ? '' : ' Nothing was deleted.'}</p>`);
  }

  if (path === '/ops/restore-family' && post) return dashboard(env, restoredNote(await restoreFamily(env.DB, await uploadedJson(request))));

  return page('Not found', `<h1>Not found</h1>${back}`, 404);
}

