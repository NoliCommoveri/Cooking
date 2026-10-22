# CLAUDE.md

Rules for every session in this repo. The design lives in
`cooking-class-app-PLAN.md`.

---

## This file

- **Capped at 500 lines.**
- It holds only high-level instructions for how to work with the owner, and
  hard rules for the app. No design detail, no schema, no history.
- **Claude does not add to this file on its own.** If something seems to
  belong here, ask the owner first and add it only on a yes.

---

## Browser-only operations

**The owner has no command line.** Every setup, migration, seed, deploy, and
recovery step must be doable from a browser:

- the app's own token-gated **ops page** (`/ops`)
- the GitHub web editor
- the Cloudflare dashboard

Migrations are bundled into the Worker and applied by pressing a button on
`/ops`. The pattern to follow is the ops page and migration runner in the
`NoliCommoveri/MCCE_Coop_Learning` repo (`src/ops.js`, `src/migrate.js`).

- Never give the owner an instruction that starts with `npm`, `npx`,
  `wrangler`, or any other terminal command. Commands Claude runs itself in a
  session are fine.
- Anything the owner must do by hand in a web console (create a D1 database,
  set a secret, bind an R2 bucket) is a blocker. Say it plainly at the start of
  the session, before building.

---

## Build log, README, and this file

Each document has one job.

**`docs/build-log.md`** is the only record of what was built, changed, and
why.
- Every session that changes the repo adds a new numbered, dated section at
  the bottom.
- Past sections are not rewritten.
- How things used to work, and why they changed, goes here and nowhere else.

**`README.md`** describes the app as it is **now**.
- It links to the most recent section of the build log, and that link is
  updated every session.
- It lists current features as short blurbs: one or two lines each.
- No long descriptions, no full schema, no history, no explanations of
  changes.

**`CLAUDE.md`** (this file) is never used as a build log.
