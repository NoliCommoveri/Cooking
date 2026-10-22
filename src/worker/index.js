// The Worker: /ops, the API, and the app's static files from public/ (plan §8.1).
import { handleOps } from './ops.js';
import { handleApi } from './api.js';
import { json } from './lib/http.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/ops' || url.pathname.startsWith('/ops/')) return handleOps(request, env);
    if (url.pathname === '/api/health') return json({ ok: true, database: Boolean(env.DB) });
    if (url.pathname.startsWith('/api/')) return handleApi(request, env);
    return env.ASSETS.fetch(request);
  },
};
