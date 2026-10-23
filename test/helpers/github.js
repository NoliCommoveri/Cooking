// A stand-in for the parts of GitHub's API the manager section uses (plan
// §7.5): refs, commits, trees, blobs, compare, file contents, file history,
// workflow runs, and commit comments. A tree here is a flat map of path to
// blob id, which is all the Worker reads of one. It starts with main holding
// the repo's content/ folder as it is on disk.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { walk } from '../../tools/lint-content.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const sha1 = (s) => createHash('sha1').update(s).digest('hex');
const blobId = (buf) => createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');

export class FakeGitHub {
  constructor(repo = 'NoliCommoveri/Cooking') {
    this.repo = repo;
    this.blobs = new Map();
    this.trees = new Map();
    this.commits = new Map();
    this.refs = new Map();
    this.runs = new Map();       // commit sha → { status, conclusion, html_url }
    this.comments = new Map();   // commit sha → [{ body }]
    this.requests = [];
    const files = {};
    for (const f of walk(join(ROOT, 'content'))) files[`content/${f}`] = this.putBlob(readFileSync(join(ROOT, 'content', f)));
    this.refs.set('main', this.putCommit(files, [], 'Start'));
  }

  putBlob(buf) {
    const id = blobId(buf);
    this.blobs.set(id, Buffer.from(buf));
    return id;
  }

  putCommit(files, parents, message) {
    const tree = sha1(JSON.stringify(Object.entries(files).sort()));
    this.trees.set(tree, { ...files });
    const sha = sha1(`${tree}${parents.join()}${message}${this.commits.size}`);
    this.commits.set(sha, { tree, parents, message, date: new Date(Date.now() + this.commits.size * 1000).toISOString() });
    return sha;
  }

  // A commit on a branch from a test, as a session's push to main would be.
  push(branch, changes, message = 'A change from a session') {
    const parent = this.refs.get(branch);
    const files = { ...this.trees.get(this.commits.get(parent).tree) };
    for (const [p, text] of Object.entries(changes)) {
      if (text === null) delete files[p]; else files[p] = this.putBlob(Buffer.from(text));
    }
    const sha = this.putCommit(files, [parent], message);
    this.refs.set(branch, sha);
    return sha;
  }

  filesAt(sha) {
    return this.trees.get(this.commits.get(sha).tree);
  }

  text(branch, path) {
    const id = this.filesAt(this.refs.get(branch))[path];
    return id ? this.blobs.get(id).toString('utf8') : null;
  }

  ancestors(sha) {
    const out = new Set(), stack = [sha];
    while (stack.length) {
      const s = stack.pop();
      if (out.has(s)) continue;
      out.add(s);
      stack.push(...(this.commits.get(s)?.parents ?? []));
    }
    return out;
  }

  install() {
    const prev = globalThis.fetch;
    globalThis.fetch = async (url, init = {}) => {
      if (!String(url).startsWith('https://api.github.com/')) return prev(url, init);
      return this.handle(new URL(String(url)), init);
    };
    return this;
  }

  async handle(url, init) {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : null;
    this.requests.push(`${method} ${url.pathname}${url.search}`);
    const ok = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json' } });
    const no = (status, message) => ok({ message }, status);
    const base = `/repos/${this.repo}`;
    if (!url.pathname.startsWith(base)) return no(404, 'Not Found');
    const p = url.pathname.slice(base.length);
    let m;
    if (p === '' && method === 'GET') return ok({ full_name: this.repo, permissions: { push: true } });
    if ((m = p.match(/^\/git\/ref\/heads\/(.+)$/)) && method === 'GET') {
      return this.refs.has(m[1]) ? ok({ object: { sha: this.refs.get(m[1]) } }) : no(404, 'Not Found');
    }
    if ((m = p.match(/^\/git\/commits\/([0-9a-f]+)$/)) && method === 'GET') {
      const c = this.commits.get(m[1]);
      return c ? ok({ sha: m[1], tree: { sha: c.tree }, parents: c.parents.map((sha) => ({ sha })), message: c.message }) : no(404, 'Not Found');
    }
    if ((m = p.match(/^\/git\/trees\/([0-9a-f]+)$/)) && method === 'GET') {
      const t = this.trees.get(m[1]);
      return ok({ sha: m[1], truncated: false, tree: Object.entries(t).map(([path, sha]) => ({ path, type: 'blob', mode: '100644', sha })) });
    }
    if ((m = p.match(/^\/git\/blobs\/([0-9a-f]+)$/)) && method === 'GET') {
      return ok({ sha: m[1], encoding: 'base64', content: this.blobs.get(m[1]).toString('base64') });
    }
    if (p === '/git/blobs' && method === 'POST') return ok({ sha: this.putBlob(Buffer.from(body.content, 'base64')) }, 201);
    if (p === '/git/trees' && method === 'POST') {
      const files = { ...this.trees.get(body.base_tree) };
      for (const e of body.tree) {
        if (e.sha === null) delete files[e.path];
        else files[e.path] = 'content' in e ? this.putBlob(Buffer.from(e.content, 'utf8')) : e.sha;
      }
      const sha = sha1(JSON.stringify(Object.entries(files).sort()));
      this.trees.set(sha, files);
      return ok({ sha }, 201);
    }
    if (p === '/git/commits' && method === 'POST') {
      const sha = sha1(`${body.tree}${body.parents.join()}${body.message}${this.commits.size}`);
      this.commits.set(sha, { tree: body.tree, parents: body.parents, message: body.message, date: new Date(Date.now() + this.commits.size * 1000).toISOString() });
      return ok({ sha }, 201);
    }
    if ((m = p.match(/^\/git\/refs\/heads\/(.+)$/)) && method === 'PATCH') {
      if (!body.force && !this.ancestors(body.sha).has(this.refs.get(m[1]))) return no(422, 'Update is not a fast forward');
      this.refs.set(m[1], body.sha);
      return ok({ object: { sha: body.sha } });
    }
    if (p === '/git/refs' && method === 'POST') {
      const name = body.ref.replace('refs/heads/', '');
      if (this.refs.has(name)) return no(422, 'Reference already exists');
      this.refs.set(name, body.sha);
      return ok({ object: { sha: body.sha } }, 201);
    }
    if ((m = p.match(/^\/compare\/([0-9a-f]+)\.\.\.([0-9a-f]+)$/))) {
      const [a, b] = [m[1], m[2]];
      const status = a === b ? 'identical' : this.ancestors(b).has(a) ? 'ahead' : this.ancestors(a).has(b) ? 'behind' : 'diverged';
      return ok({ status });
    }
    if ((m = p.match(/^\/contents\/(.+)$/))) {
      const ref = url.searchParams.get('ref');
      const sha = this.commits.has(ref) ? ref : this.refs.get(ref);
      const id = this.filesAt(sha)[decodeURIComponent(m[1])];
      return id ? new Response(this.blobs.get(id)) : no(404, 'Not Found');
    }
    if (p === '/commits' && method === 'GET') {
      const path = url.searchParams.get('path');
      const out = [];
      let sha = this.refs.get(url.searchParams.get('sha')) ?? url.searchParams.get('sha');
      while (sha) {
        const c = this.commits.get(sha);
        const parent = c.parents[0];
        if (!parent || this.filesAt(parent)[path] !== this.filesAt(sha)[path]) out.push({ sha, commit: { message: c.message, committer: { date: c.date } } });
        sha = parent;
      }
      return ok(out);
    }
    if ((m = p.match(/^\/actions\/workflows\/[^/]+\/runs$/))) {
      const run = this.runs.get(url.searchParams.get('head_sha'));
      return ok({ workflow_runs: run ? [run] : [] });
    }
    if ((m = p.match(/^\/commits\/([0-9a-f]+)\/comments$/))) return ok(this.comments.get(m[1]) ?? []);
    return no(404, `The stand-in doesn't know ${method} ${p}`);
  }
}
