// The Worker: /ops, the API, the manager section, and the app's static files
// from public/ (plan §8.1, §7.5).
import { handleOps } from './ops.js';
import { handleApi } from './api.js';
import { handleManage } from './manage.js';
import { json } from './lib/http.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/ops' || url.pathname.startsWith('/ops/')) return handleOps(request, env);
    if (url.pathname === '/api/health') return json({ ok: true, database: Boolean(env.DB) });
    if (url.pathname.startsWith('/api/')) return handleApi(request, env);
    // The manager section (plan §7.5): its own app and its own sign-in.
    if (url.pathname === '/manage' || url.pathname.startsWith('/manage/')) return handleManage(request, env);
    return env.ASSETS.fetch(request);
  },
};
