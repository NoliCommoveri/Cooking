// The manager section's way into the repo (plan §7.5). The Worker reads the
// content files from GitHub and writes the owner's saves back as commits on the
// content-edits branch; a GitHub workflow (.github/workflows/content-publish.yml)
// builds, checks, and moves each save onto main, and Cloudflare deploys main.
//
// GITHUB_TOKEN is a Worker secret: a fine-grained token for this one repository
// with Contents read and write and Actions read (docs/setup.md). GITHUB_REPO is
// a variable in wrangler.toml.
import { FILES, SHAS } from './content-data.js';

const API = 'https://api.github.com';
export const EDIT_BRANCH = 'content-edits';
export const MAIN_BRANCH = 'main';
export const PUBLISH_WORKFLOW = 'content-publish.yml';

export class GitHubError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const githubReady = (env) => Boolean(env.GITHUB_TOKEN && env.GITHUB_REPO);

async function gh(env, method, path, body, { accept = 'application/vnd.github+json', raw = false } = {}) {
  if (!githubReady(env)) throw new GitHubError(503, 'GitHub is not connected yet. Set the GITHUB_TOKEN secret (docs/setup.md).');
  const res = await fetch(`${API}/repos/${env.GITHUB_REPO}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      accept,
      'user-agent': 'clean-plate-recipes',
      'x-github-api-version': '2022-11-28',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 404 && method === 'GET') return null;
  if (!res.ok) {
    let message = `GitHub said ${res.status}`;
    try { message += `: ${(await res.json()).message}`; } catch { /* not JSON */ }
    if (res.status === 401) message = 'GitHub refused the token. It may have expired; make a new one (docs/setup.md).';
    if (res.status === 403) message = "GitHub refused the token for that. Check it has Contents read and write on this repository (docs/setup.md).";
    throw new GitHubError(res.status, message);
  }
  if (raw) return res.text();
  return res.status === 204 ? null : res.json();
}

const utf8 = new TextDecoder();
const fromBase64 = (b64) => Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0));
// The git id GitHub gives a file with this text (as tools/build-library.js works it out).
async function blobSha(text) {
  const body = new TextEncoder().encode(text);
  const head = new TextEncoder().encode(`blob ${body.length}\0`);
  const all = new Uint8Array(head.length + body.length);
  all.set(head);
  all.set(body, head.length);
  return [...new Uint8Array(await crypto.subtle.digest('SHA-1', all))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function branchHead(env, branch) {
  return (await gh(env, 'GET', `/git/ref/heads/${branch}`))?.object.sha ?? null;
}

// The commit the next save builds on (§7.5). content-edits holds saves still
// on their way to main; once main has everything it has (or it doesn't exist
// yet), a save starts from main, so commits made in a session are kept.
export async function workingHead(env) {
  const main = await branchHead(env, MAIN_BRANCH);
  if (!main) throw new GitHubError(404, `The repository ${env.GITHUB_REPO} has no ${MAIN_BRANCH} branch, or the token can't see it.`);
  const edits = await branchHead(env, EDIT_BRANCH);
  if (!edits || edits === main) return { sha: main, exists: Boolean(edits) };
  const cmp = await gh(env, 'GET', `/compare/${main}...${edits}`);
  return cmp.status === 'behind' || cmp.status === 'identical' ? { sha: main, exists: true } : { sha: edits, exists: true };
}

// The content folder at a commit: each content file's git id, the JSON files'
// text, and the pictures. A file with the same git id as the Worker's bundle is
// read from the bundle, so usually nothing but the tree is fetched.
export async function snapshot(env, sha) {
  const commit = await gh(env, 'GET', `/git/commits/${sha}`);
  const tree = await gh(env, 'GET', `/git/trees/${commit.tree.sha}?recursive=1`);
  if (tree.truncated) throw new GitHubError(500, 'The repository is too big for GitHub to list in one go.');
  const blobs = {}, images = [];
  for (const e of tree.tree) {
    if (e.type !== 'blob' || !e.path.startsWith('content/')) continue;
    const p = e.path.slice('content/'.length);
    if (p.startsWith('images/')) { if (!p.endsWith('.md')) images.push(p.slice('images/'.length)); continue; }
    if (p.endsWith('.json')) blobs[p] = e.sha;
  }
  const texts = {};
  await Promise.all(Object.entries(blobs).map(async ([p, b]) => {
    texts[p] = SHAS[p] === b ? FILES[p] : utf8.decode(fromBase64((await gh(env, 'GET', `/git/blobs/${b}`)).content));
  }));
  return { sha, blobs, texts, images: images.sort() };
}

// One file's text at a commit, or null if it isn't there.
export const fileAt = (env, path, ref) => gh(env, 'GET', `/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${ref}`, null, { accept: 'application/vnd.github.raw+json', raw: true });

// Writes one commit on content-edits with these files changed: { path in the
// repo: text, or { base64 } for a picture, or null to remove it }. The branch
// only moves forward from `parent`: if anything else moved it first, GitHub
// refuses and the save is tried again from the new head.
export async function commitFiles(env, { parent, files, message }) {
  const base = await gh(env, 'GET', `/git/commits/${parent}`);
  // Text goes inside the tree request, so a save of many files is still a
  // handful of requests (a Worker may make only so many); a picture is a blob.
  const tree = [], blobs = {};
  for (const [path, v] of Object.entries(files)) {
    if (v === null) { tree.push({ path, mode: '100644', type: 'blob', sha: null }); blobs[path] = null; continue; }
    if (typeof v === 'string') { tree.push({ path, mode: '100644', type: 'blob', content: v }); blobs[path] = await blobSha(v); continue; }
    const blob = await gh(env, 'POST', '/git/blobs', { content: v.base64, encoding: 'base64' });
    tree.push({ path, mode: '100644', type: 'blob', sha: blob.sha });
    blobs[path] = blob.sha;
  }
  const newTree = await gh(env, 'POST', '/git/trees', { base_tree: base.tree.sha, tree });
  const commit = await gh(env, 'POST', '/git/commits', { message, tree: newTree.sha, parents: [parent] });
  if (await branchHead(env, EDIT_BRANCH)) await gh(env, 'PATCH', `/git/refs/heads/${EDIT_BRANCH}`, { sha: commit.sha, force: false });
  else await gh(env, 'POST', '/git/refs', { ref: `refs/heads/${EDIT_BRANCH}`, sha: commit.sha });
  return { sha: commit.sha, blobs };
}

// The publish workflow's run for a commit, and what it said if it failed.
export async function publishRun(env, sha) {
  const out = await gh(env, 'GET', `/actions/workflows/${PUBLISH_WORKFLOW}/runs?head_sha=${sha}&per_page=5`);
  const run = out?.workflow_runs?.[0];
  if (!run) return null;
  let detail = null;
  if (run.conclusion === 'failure') {
    const comments = await gh(env, 'GET', `/commits/${sha}/comments`);
    detail = comments?.at(-1)?.body ?? null;
  }
  return { status: run.status, conclusion: run.conclusion, url: run.html_url, detail };
}

// The commits that changed a file on the working branch, newest first.
export async function fileHistory(env, path, ref) {
  const list = await gh(env, 'GET', `/commits?path=${encodeURIComponent(path)}&sha=${ref}&per_page=30`);
  return (list ?? []).map((c) => ({ sha: c.sha, message: c.commit.message.split('\n')[0], date: c.commit.committer?.date ?? c.commit.author?.date }));
}

// For /ops: can the token see the repository and write to it?
export async function githubCheck(env) {
  if (!env.GITHUB_TOKEN) return { ok: false, message: 'GITHUB_TOKEN is not set.' };
  try {
    const repo = await gh(env, 'GET', '');
    if (!repo) return { ok: false, message: `The token can't see ${env.GITHUB_REPO}.` };
    if (!repo.permissions?.push) return { ok: false, message: `The token can read ${env.GITHUB_REPO} but not write to it. Give it Contents: read and write.` };
    return { ok: true, message: `Connected to ${env.GITHUB_REPO}.` };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}
