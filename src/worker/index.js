// The Worker: /ops, the API, the manager section, and the app's static files
// from public/ (plan §8.1, §7.5).
import { handleOps } from './ops.js';
import { handleApi } from './api.js';
import { handleManage } from './manage.js';
import { json } from './lib/http.js';
import { eraseDeleted } from './backup.js';
import { releaseState, LEVELS_RELEASE } from './release.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/ops' || url.pathname.startsWith('/ops/')) return handleOps(request, env);
    if (url.pathname === '/api/health') return json({ ok: true, database: Boolean(env.DB) });
    if (url.pathname.startsWith('/api/')) return handleApi(request, env);
    // The manager section (plan §7.5): its own app and its own sign-in.
    if (url.pathname === '/manage' || url.pathname.startsWith('/manage/')) return handleManage(request, env);
    // The public demo and syllabus show the Levels once their release is
    // launched for everyone (§8.6); until then there are none to show.
    if (url.pathname === '/content/levels.json' && (await releaseState(env.DB)).live < LEVELS_RELEASE) {
      return json({ levels: [] });
    }
    return env.ASSETS.fetch(request);
  },

  // Cloudflare runs this daily (the cron in wrangler.toml): families deleted
  // more than 30 days ago are erased (plan §6.14). A failure is logged and the
  // next day tries again.
  async scheduled(event, env) {
    try {
      const n = await eraseDeleted(env.DB);
      if (n) console.log(`Erased ${n} deleted famil${n === 1 ? 'y' : 'ies'}.`);
    } catch (err) {
      console.log(`Erasing deleted families failed: ${err?.stack ?? err}`);
    }
  },
};
