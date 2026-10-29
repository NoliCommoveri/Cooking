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

## Requirements and recommendations

- Items marked **Requirement** in the plan do not change without the owner's
  say-so.
- Items marked **Recommendation** may be proposed or questioned, but ask the
  owner before building to one that hasn't been confirmed.

---

## Hard rule: no unclean foods

No lesson, ingredient, substitution, or family setting may include
biblically unclean foods (Leviticus 11, Deuteronomy 14), for any family. There
is no override, exception, or setting that turns this off. The plan (§2.1)
lists what counts and the hidden sources to watch for.

---

## How the app words its rules

Families keep these rules because they want to (owner, 2026-10-28). Wording
for anything the app checks or holds back (unclean foods, the unleavened
days, the Sabbath) isn't framed as "we aren't letting you do this". It's the
app helping them plan, and making it hard to do something by accident
without meaning to. Show it as a calm note, not a red error.

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
- **Every destructive control on `/ops` has a restore on `/ops`.** Anything
  the owner can delete or reset from the browser, they must be able to
  restore from the browser (for example, a backup export with an import
  beside it). Don't add a destructive control without one.

---

## Parent screens

- **Adding something new opens in a dialog** over the page, from a button,
  not a form on the page. A flow too big for a dialog (several steps, or a
  long editor) opens as its own page from a button.

---

## Screenshots

- **Send the owner screenshots of everything built, as it's built** (owner,
  2026-10-24): every screen added or changed, at phone width, in both themes
  where the theme changes the look. Send them in the session; don't commit
  them to the repo.
- **Chef Ruth's floating button (`.ruth-fab`) covers the bottom right of
  every parent screen** and gets in the way of screenshot scripts' clicks and
  pictures (owner, 2026-10-26: sessions keep hitting it). Hide it in the
  script first, e.g.
  `page.addStyleTag({ content: '.ruth-fab{display:none!important}' })`
  after each page load. Opening a kitchen locks the parent screens again, so
  a script that goes back to them must enter the parent PIN.

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
