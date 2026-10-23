# Build log

What was built or changed in each session, and why. Newest section at the
bottom. Past sections are not rewritten.

---

## 1. 2026-10-22 — Project rules

- Added `CLAUDE.md` with the repo's first rules: browser-only operations
  (owner has no CLI; all ops through an `/ops` page modeled on the MCCE repo),
  the 500-line cap with ask-before-adding, and the split between this log,
  the README, and `CLAUDE.md`. On the owner's yes, also added: plan
  Requirements need her say-so, the unclean-food hard block, and a restore
  for every destructive `/ops` control. Family isolation was offered and left
  out.
- Added this build log and rewrote `README.md` to point at it.
- Reviewed `cooking-class-app-PLAN.md` and found gaps (diet-flag semantics,
  unclean-food enforcement relying on a hand-set flag, untested recipes,
  scaling rules, missing schema fields, iOS timer limits, kid access to parent
  screens, unphased features, art workload). None are folded into the plan
  yet.
- Nothing is built.

---

## 2. 2026-10-22 — Plan review fixes folded in

Folded the entry 1 review into `cooking-class-app-PLAN.md`. Plan only; nothing
is built.

- **Food rules:** the registry's `diet` flags became a `contains` tag list,
  because the old sample marked flour `gluten: false`. Animal-derived
  ingredients need an `animalSource`, which the linter checks against a
  clean-species allowlist; before this, the hard block relied on a hand-set
  `unclean` flag. A blocked-word scan of lesson text was added, and
  substitutions are now checked. Lard in masa and shortening was added to the
  hidden sources, and casing notes were added to lessons 30 and 39.
- **Food safety:** added doneness-check steps with thermometer targets,
  wash-hands steps after raw handling, pasteurized eggs for lesson 31, and a
  raw-dough tip.
- **Curriculum:** lesson 3 is broiled rather than fried, so its safety level
  stays correct. Lesson 43's safety is now plain "Adult nearby."
- **Scaling and units (§6.6–6.7):** free vs. fixed multipliers, rounding for
  countable items, notes per multiplier, measurable fractions, US customary
  display.
- **Prerequisites:** a lesson hidden by a family's filters no longer blocks
  the lessons that require it.
- **Testing:** each lesson needs a `tested` record before kids see it.
- **Schema:**
  - Lessons gained `version`, an image, `totalMinutes`, skill IDs, a cuisine
    ID, `scaling`, ingredient groups and optional ingredients, stable step IDs,
    and timer labels.
  - New registries for equipment, skills, and cuisines.
- **Data model:**
  - `kids.rank` was removed; it contradicted "rank is computed."
  - `queue` gained `id`, `servings`, and a `requested` status for kid
    requests.
  - Shopping trips replaced the undefined `list_key`.
  - `safety_overrides` is keyed by step ID, not index.
  - The `family_id` rule now covers `invites`, and the owner's endpoints are
    stated as the one exception to family scoping.
- **Owner:** removed "by default" from the owner's cross-family view, which
  conflicted with §2.5. Added owner password reset, and removal of a family
  with a restore.
- **Offline and platform:** the shopping list, attempt progress, and photo
  uploads now work offline. Added iOS limits for timers, sound, and Wake Lock.
- **Operations:** added §8.5 for `/ops` (migrations, backup export/import, a
  restore for every destructive control, setup the owner does in the
  dashboard), per `CLAUDE.md`.
- **Phases:**
  - Phase 0 includes the kids' theme pick and the core art set.
  - `/ops` and profiles moved to 1b.
  - Attempts are saved in Phase 2.
  - Safety review and per-step safety edits are in Phase 3.
  - Added a testing line for every phase.
- **Art:** added an art production plan (§5.3a).
- **Open questions:** added 7–12 (allergies per kid, lowering safety levels,
  a required PIN, rennet/blood/fat, who test-cooks, who makes the art). The PIN
  and rennet/blood/fat questions touch Requirements (§2.5, §2.1), so they are
  questions rather than changes.

---

## 3. 2026-10-22 — Test-cooking optional; helper and first run added to plan

- **Test-cooking is optional.** The owner reversed entry 2's rule that a
  lesson had to be test-cooked before kids could see it. Removed the lesson
  `tested` field, its linter warning, the test-cook conditions in the Phase 1
  and Phase 7 done-when lines, and the open question on who test-cooks.
- **Parents can mark a lesson test-cooked** for their own family. It's stored
  in a new `test_cooks` table and shows as a test-kitchen stamp, not a pill.
- **First-time parents get a warning** that the recipes may not have been
  cooked yet. It's part of the first-run wizard, and shows as a one-time notice
  until the wizard is built.
- **Helper (§6.8):** a brief entry for a scripted helper modeled on Kels from
  KennelOS, used by both kids and parents. Full spec later.
- **First-run wizard (§6.9):** a brief entry modeled on the KennelOS first run
  and "Getting Started." Full spec later.
- **Phase 8:** added for the helper and the first-run wizard.
- Open question "who makes the art" is now number 11.

---

## 4. 2026-10-22 — Allergies are per family

- The owner ruled that diet filters are per family, not per kid. §2.1 now
  says so, and the open question on it was removed. The remaining open
  questions were renumbered 7–10.

---

## 5. 2026-10-22 — Safety levels are banners only, set in content

- The owner ruled that the safety banner is enough (nothing locks a step or
  waits for an adult) and that parents can't change safety levels.
- Removed "Edit safety levels" from parent features, the `safety_overrides`
  table, and per-step safety edits from Phase 3. §3 now says a level is
  information only.
- Removed the open questions on adult hands-on unlocking and on lowering levels.
  The PIN question now covers only kids approving their own lesson requests.
  Open questions renumbered 1–8.
- Fixed a stale linter line that still named the removed `unclean` flag; it now
  points to `animalSource` and the blocked-word list.

---

## 6. 2026-10-22 — Required parent PIN; password reset by email

- **Parent PIN is required.** The owner ruled yes on requiring it. Before
  this it was optional, so a kid on a kitchen device could reach parent
  screens and approve their own lesson requests. Now:
  - Every parent-only screen asks for the PIN.
  - The PIN is set in the first run.
  - A parent resets a forgotten PIN by entering their account password.
- **Password reset by email through Resend.** This replaces "reset by the
  owner only"; the owner's reset stays as a fallback.
  - New `password_resets` table; the link expires after an hour.
  - Setup now lists the `RESEND_API_KEY` secret and verifying the sending
    domain in Resend.
  - Added to Phase 1b.
- Removed the PIN open question. Open questions renumbered 1–7.

---

## 7. 2026-10-22 — Profiles: single or shared, and lessons for several

- **Profiles can be shared.** The owner ruled that a profile can be one kid
  or several kids sharing it; the family chooses per kid, shared, or a mix.
  Before this, every attempt belonged to exactly one kid, so kids cooking
  together had no way to share credit, and the shopping list bought twice.
- **A queued lesson can be for one or more profiles**, and they cook it as one
  cook:
  - One shopping-list count and one photo.
  - Every profile on it gets the stamp and pin.
  - Each profile writes its own reflection.
- **Data model:**
  - `kids` became `profiles`.
  - `queue.kid_id` became a `queue_profiles` join table.
  - `attempts` lost `kid_id`, `rating`, and `notes`; a new `attempt_profiles`
    table holds each profile's place on the cook and its reflection.
- Updated the users section (§1 Profiles), kid and parent features, family
  settings, the shopping list's counting rule, the first run, the beginner
  track's data hooks (kids on different tracks need separate profiles), and
  Phases 1b and 2.
- Removed the "cook together or separately" open question. Open questions
  renumbered 1–6.

---

## 8. 2026-10-22 — Theme choice, open sign-up, family recipes

Owner rulings on open questions:
- **No extra diet filters for the owner's family.** Removed the question;
  per-family filters stay as a feature for other families.
- **The kids choose the theme.** §5.2 now states it as a Requirement. Whether
  each family can pick its own theme is still open.
- **Open sign-up, gated by a code or keyword.** This replaces invite-only.
  - Anyone can request a code through a public form; the owner approves it from
    a queue, which emails a single-use code through Resend.
  - The owner can also set a shared sign-up keyword, and change it or turn it
    off.
  - Added `signup_requests` and `settings`; `invites` gained `email`.
- **Family recipes, a bonus feature (§6.10, Phase 9).**
  - Families add their own recipes through a guided step-by-step flow (no CSV
    or file import) and cook them in the lesson player.
  - They can submit a recipe for owner review; released recipes go into a
    searchable community directory any family can add from.
  - The hard block and diet filters apply to all of it. Typed-in ingredients
    that aren't in the registry rely on the blocked-word scan alone until the
    owner adds them; this is stated as a known gap.
  - Added `family_recipes`, `recipe_submissions`, and `community_recipes`.
  - Family recipes live in D1; the library stays as content files.
- Replaced "cook-together mode" in the Later row with "split roles," since
  shared profiles (entry 7) already cover cooking together.
- Open questions are now 1–3.

---

## 9. 2026-10-22 — Theme per profile

- The owner ruled that **each profile picks its own theme**. This replaces
  entry 8's open question about one theme for everyone vs. one per family.
- §5.2 rewritten:
  - Themes share the same rewards underneath and draw them differently.
  - Each theme supplies every §5.4 component; §5.4 is now the Chef's Passport
    treatment.
  - The theme switches when a profile is picked. The picker and parent screens
    use a neutral house style.
  - One theme is built first, chosen by the kids in Phase 0; more come later.
- `profiles` gained `theme`. Family settings and the kids' first run include
  picking it.
- The beginner track no longer says "same theme as core"; beginner profiles
  pick from the same themes.
- The art section notes that each added theme needs its own art set.
- Open questions are now 1–2.

---

## 10. 2026-10-22 — Blood and fat blocked; Claude draws the art; adult profiles

- **Blood and fat added to the hard block (§2.1).** The owner ruled yes on
  blood and fat. Rennet and pepsin were not included.
  - Blood is blocked from any animal. Fat from cattle, sheep, and goats (suet,
    tallow, beef dripping) is blocked.
  - Suet and beef tallow were added to the hidden sources.
  - A new registry field, `animalPart`, lets the linter catch these, since the
    species check alone passes cattle. The blocked-word list gained suet,
    tallow, beef dripping, blood sausage, and black pudding.
- **Claude draws the art** as SVG, judged at the Phase 0 showcase. Removed the
  open question.
- **Adults can take the class.**
  - Each profile is marked kid or adult in the first run (`profiles.audience`);
    a shared profile with any kid on it is a kid profile.
  - On adult profiles, safety banners show only the hazard.
  - Added "Adult learner" to the users table.
- No open questions remain.

---

## 11. 2026-10-22 — Fat rule scope

- The owner ruled that the fat rule covers separable fat only (suet, tallow,
  beef dripping sold as a fat). Marbling and cooking drippings are allowed;
  §2.1 now says so. No lesson changes were needed.

---

## 12. 2026-10-22 — Phase 0: theme mockups

- Started Phase 0 with a theme picker page for the kids:
  `mockups/theme-picker.html`, published as a private claude.ai page.
- All four candidate themes from §5.2 are mocked up: Chef's Passport, Kitchen
  Quest, Food Truck, and Recipe Scrapbook.
- Each theme shows the same four screens for lesson 4 (Shakshuka, serves 4):
  lesson library, prep checklist, cook mode with timers, and progress.
  - They're interactive. Ingredients check off into the theme's container
    (bowl, inventory, crate, sticker sheet), and Next moves through 6 steps.
    Timers start, pause, ring, and show "Ended N min ago".
  - The food-safety check (160°F egg) blocks Next until it's confirmed. A
    wash-hands step follows the raw-egg step.
  - The progress screens use sample data: 8 dishes cooked, rank Prep Cook.
- All art is hand-drawn SVG, as the first test of §5.3a.
- No pill-shaped labels. Cook-mode tap targets are at least 56px.
- Nothing is saved. The page is a mockup only, and no app code exists yet.
- Next: the kids pick a theme. Then the rest of Phase 0 is built for that
  theme.

---

## 13. 2026-10-22 — Kids chose Kitchen Quest

- The owner ruled: **Kitchen Quest is built first, then Chef's Passport as
  soon as possible.** Food Truck and Recipe Scrapbook stay for later.
- §5.2: this is now a Requirement, replacing "the kids pick it in Phase 0."
  The theme list says which is built first, second, and later. Kitchen Quest's
  description gained how the skill tree works: a path per unit, a node per
  dish, and ranks shown as level and title.
- New §5.4a, Kitchen Quest's treatment of every component, drawn from the
  mockup (Recommendation). §5.4 stays as the Chef's Passport treatment.
- §9: Phase 0 now builds Kitchen Quest. New Phase 0b builds Chef's Passport
  right after Phase 0 is approved. Phase 5 covers rewards in both themes.
- §6.1's "Passport, ranks…" line now says progress is drawn by the profile's
  theme.
- Mockup page: the rewards table now says a Kitchen Quest dish lights a node on
  the skill tree and a skill earns a crest, to match §5.4a.

---


## 14. 2026-10-22 — Dish art gathered

- **The owner supplies the dish illustrations,** made with ChatGPT as sheets
  of 4–5 dishes, and Claude crops them. §5.3a updated; Claude still draws the
  rest of the art as SVG.
- **All 50 dishes have art** in `content/images/dishes/`, one transparent
  square PNG per lesson (`04-shakshuka.png` etc.), about 500–740 px each.
  - 14 source sheets are in `content/images/source/`. Seven dishes were
    redone for accuracy (14, 26, 27, 28, 32, 34, 35, 37). The redos fixed
    missing chicken, ground beef where the lesson teaches slicing, sausage and
    pulled meat that looked like pork, and the wrong style of omelet and mac
    and cheese.
  - Every picture was checked for unclean foods; none are in use. 37 Philly
    cheesesteak still looks like ground beef and is the one open redo.
- `tools/crop-dish-sheet.py` cuts a sheet into dishes: it removes the white
  background and drop shadows and drops stray edges of neighbouring dishes.
  `tools/dish-sheets.txt` maps every sheet position to its dish, with '-' for
  a dish a later sheet replaced, so re-cropping can't bring back an old one.
- `content/images/LICENSES.md` lists each sheet and the images cropped from it.
- **Working name: Clean Plate Recipes** (the owner's, not final), added to the
  plan (§1). Its logo is `content/images/brand/clean-plate-logo.png`.

---

## 15. 2026-10-22 — Phase 0: Kitchen Quest showcase

- Built the Phase 0 showcase as a private page, at the owner's choice instead
  of Cloudflare for now: `mockups/quest-showcase/index.html`, with web-sized
  dish art in `mockups/quest-showcase/img/`.
- It shows every §5.4a component in a demo state: lesson card with the
  test-kitchen seal and a locked "coming up" card, inventory grid, gear
  loadout, quest log with stage bar, cooldown-ring timer tray, safety banners
  (all three levels plus the adult-profile version), skill tree at real unit
  lengths, level and level-up screen, crest collection, gem rating, trophy hall,
  and the helper's Ask button and dialogue box (look only; the helper isn't
  specced).
- House style: the profile picker (chef's lockers, sample kid, shared, and adult
  profiles) with the per-profile theme switch, where only Kitchen Quest is
  selectable, and a parent shopping list grouped by store section.
- Core art set drawn as SVG: 9 store-section icons and 10 tool-category icons,
  plus an oven mitt for hands-on safety and the helper's guide avatar.
- Kitchen Quest tokens and type are shown on the page.
- Added a serving picker at the owner's request. It's a party-size panel on
  the quest card that starts at the queued count and updates the prep amounts
  and the egg count in the cook steps. It warns "You shopped for 4" when the
  count changes after shopping, and shows a two-skillet note above 8. A
  fixed-size baking example (biscuits: 3, 6, or 12) is also shown. In the
  plan, §6.6 now describes the picker and the after-shopping warning, and
  §5.4 and §5.4a each gained a serving-picker row.
- Nothing is saved, and no app code exists yet. Next: the owner reviews the
  look; once approved, Phase 0b builds Chef's Passport the same way.

---

## 16. 2026-10-22 — Plan: fix requests and lesson patches

- New §6.11 (Recommendation): parents and adult learners send **fix
  requests** from a lesson or step, and the owner applies them from the browser
  as **lesson patches** that go live for every family.
  - The owner said she isn't the cooking expert, so the reporter proposes the
    correction and the app checks it: the blocked-word scan, unit checks, and
    food-safety minimums. A patch that fails can't be applied.
  - Patches can change amounts, units, times, step text, notes, and doneness
    targets only. Adding or swapping an ingredient needs a content change.
  - Every patch has a Revert. Safety and unclean-ingredient reports email the
    owner right away. A patch raises the lesson's version.
  - Claude folds applied patches into the lesson files in a later session; the
    owner does nothing for that.
- Added `fix_requests` and `lesson_patches` to the data model, a Fix requests
  queue to the owner features, the work and its done-when to Phase 2, and patch
  checks and revert to the tests.
- At the owner's request, the first-run wizard (§6.9) now has a **parent tour**
  (Requirement): one card per parent task, including one on Suggest a fix.
  It can be skipped and replayed from family settings.
- Showcase: added **Suggest a fix** on the lesson card and every cook step.
  It asks for the parent PIN (adult profiles skip it), then opens a house-style
  form: problem type, where, which part, what it says now, and what it should
  say instead. A new owner fix-request queue shows the current and suggested
  text side by side, with Apply, Decline, and Revert. Applying a fix really
  changes the lesson on the page. One sample request is rejected by the
  food-safety check (an egg target below 160°F), and the blocked-word scan
  rejects unclean foods.
- The first-run wizard (§6.9) also has a **profile intro** (Requirement), at
  the owner's request: a short, skippable, replayable intro in the profile's
  own theme. It covers asking for a lesson, servings, Prep, cook mode, the
  photo and reflection, progress, what to do when something looks wrong (kids
  tell a grown-up; adults get Suggest a fix), and the helper.
- Showcase: added the **tutorial quest**, Kitchen Quest's version of the
  profile intro. It has 10 cards, each with the guide speaking and a "try it":
  ask to cook, party size, gather supplies, cook a step, timers and the
  thermometer, photo and rating, lighting a skill-tree node, what to do if
  something looks wrong (the adult version shows Suggest a fix), and a finish
  card. It has a progress bar, Back and Next, and a Skip that jumps to the
  finish card.

---

## 17. 2026-10-22 — Teaching the why

- The owner pointed out the lessons read as skills practice with no "why".
  Added to the plan (§3, Recommendation, approved): every Learn stage has a set
  shape (the move, why it works, same move in other dishes, when it goes
  wrong), plus callbacks to earlier lessons, a **Why?** button on cook steps,
  an optional transfer question in Reflect, and skills that explain
  themselves when tapped.
- The "other dishes" card is built from lesson `skills` tags, not hand-written.
  §7.3's lesson sketch gained `learn.move`, `learn.why`, `learn.wrong`,
  `learn.callback`, quiz `explain`, and a step `why` link. The linter (§7.4)
  fails a core lesson missing the move, a why card, or a when-it-goes-wrong
  entry, and warns on single-lesson skills and missing callbacks.
- Showcase: new Learn section with 8 Shakshuka cards (callback to the French
  omelet, the move, three why cards, other dishes with cooked ones marked,
  rescues, and a two-question quiz with explanations). Steps 2, 3, and 6 have
  Why?. Crests open a detail panel listing every dish that uses the skill.
  Reflect has the optional transfer question. Nine more dishes were added to
  the page's images.
- The owner ruled that **adult profiles don't ask to cook**. Their button is
  "Cook this", which queues the lesson for that profile with no approval and
  no PIN. A shared profile with a kid on it still asks (§6.1, §6.9). The
  showcase's tutorial card switches to the adult version when an adult
  profile is picked.

---

## 18. 2026-10-22 — Hands-free step advance

- The owner asked how hard a hands-free voice "next step" would be. Her
  kitchen device is likely an Android phone; Safari families may come later.
- Added §6.12 to the plan as a **Recommendation**, on the owner's yes:
  - A tap zone and Bluetooth page-turner support for every device, moved
    into Phase 2.
  - Voice stays in Later: Android Chrome first, shown only where the device
    supports it, with taps as the fallback.
  - No "switch to Chrome" prompt on iPhone, because every iOS browser runs on
    Safari's engine.
  - Food-safety checks still need a tap.
- Cook mode in §3 and the Phase 2 and Later rows in §9 now point to §6.12.
- New open question 1: whether voice needs a parent to turn it on, since
  Chrome usually sends the audio to Google.
- Nothing is built.

---

## 19. 2026-10-22 — Kitchen Quest approved; Chef's Passport built (Phase 0b)

- **The owner approved the Kitchen Quest look,** so Phase 0 is done. §5.4a is
  now a Requirement.
- **The owner ruled that voice stays off until a parent turns it on** (§6.12,
  Requirement). The switch is in family settings, behind the parent PIN.
  Open question 1 is closed; no open questions remain.
- **Phase 0b: Chef's Passport built** in the same showcase,
  `mockups/quest-showcase/index.html`, which is now a two-theme page.
  - Each sample profile has a theme: Ava and the shared profile use Kitchen
    Quest, and Leo and Mom use Chef's Passport. Picking a locker or changing a
    profile's theme redraws every panel, which meets the Phase 0b done-when.
    The page opens on Leo. The Kitchen Quest panels are unchanged.
  - Every §5.4 component has a Passport version: the taped recipe card with
    the test-kitchen stamp, the Serves line with a plate per serving, the
    mixing bowl, the pegboard, the flipping step card with the measuring cup,
    dial timers on the counter, safety banners, the passport book and world
    map, rank outfits, apron pins, chef's-hat rating, the Polaroid corkboard,
    the helper chat, the rank-up, and the welcome tour and Learn cards.
  - New art, drawn as SVG: a stamp for each of the 22 cuisines, the chef at
    all five ranks, the helper chef, the passport cover, and a stylized world
    map.
  - Passport pages are grouped into 7 regions. Churros (25, Spanish/Mexican)
    sit on the Europe page.
  - §5.4 gained the palette, type, regions, map states, and rank outfits.
  - Fix: the page now hides `hidden` overlays itself. Before this, the
    Suggest a fix sheet blocked every tap when the file was opened outside the
    published page.
- Next: the owner reviews the Passport look. Once it's approved, Phase 1
  (content core) starts.

---

## 20. 2026-10-22 — The owner's world map in Chef's Passport

- The owner supplied an illustrated world map
  (`content/images/source/world-map.png`). It replaces the hand-drawn SVG map
  in the Passport panel.
- Its yellow highlighting didn't match the passport regions: China, Korea,
  North Africa, Europe, and Africa were tan. So the app recolors the regions
  itself instead of using the owner's colors.
  - New `tools/split-world-map.py` cuts the map into a tan base, an outline
    layer, and one mask per region. The Americas follow the owner's yellow,
    split at the Mexico border. Everywhere else goes to the nearest of a set
    of hand-placed points, and the Sahara is split with a straight line.
  - The page stacks the base, one colored mask per region (butter when
    started, basil when complete, pale red for the open page), and the
    outlines on top.
- The source and its layers are listed in `content/images/LICENSES.md`, and
  §5.4 describes the map.

---

## 21. 2026-10-22 — Chef's Passport approved; churros moved

- **The owner approved the Chef's Passport look,** so Phase 0b is done. §5.4
  is now a Requirement.
- **Churros (25) moved from the Europe page to Latin America,** at the owner's
  request, and now earn the Mexican stamp. That leaves 21 cuisine stamps.
- The showcase now says both themes are approved.
- Next: Phase 1, the content core.

---

## 22. 2026-10-22 — Phase 1: content core

- **Content as data** (§7). New files: `content/ingredients.json` (35
  ingredients), `equipment.json` (26 tools), `skills.json`,
  `cuisines.json` (7 regions, 21 cuisines), `units.json`, JSON Schemas in
  `content/schema/`, and the rules in `content/rules/`: the clean-species
  allowlist, the blocked words, and the allowed phrases.
- **4 sample lessons**, written from scratch: 4 Shakshuka, 14 Beef
  bulgogi, 38 Buttermilk biscuits, and 49 Brown butter cookies. Each has the
  Learn stage, safety levels and adult hazards, timers, and the food-safety
  steps.
- **Shared code** in `src/content/`, plain modules the Worker and app can
  use later: units and kitchen-measurable display (`units.js`), scaling and
  step-text counts (`scale.js`), the hard block (`rules.js`), a small
  schema checker (`validate.js`), and the linter (`lint.js`).
- **The linter** (`tools/lint-content.js`) runs every §7.4 check, plus a few
  added in this phase (listed in §7.4): wash steps after raw food, adult
  hazards, callbacks, and a check that every lesson renders at every serving
  size. It passes with 0 errors. The 13 warnings are expected: no intro
  slides, fallback icons, and skills used by only one sample lesson.
- **Tests** (`test/`, 29 of them, `node --test`): units, scaling, and the
  linter. The linter tests break the real content on purpose (an unclean
  ingredient, a missing wash step, a prerequisite loop, and more) and confirm
  each is rejected.
- **CI:** `.github/workflows/content.yml` runs the linter and tests on every
  push and pull request.
- **Preview:** `preview/lesson-preview.html`, built by
  `tools/build-preview.js`, shows each lesson read-only at every allowed
  size. A test fails if it falls out of date. This meets the Phase 1
  done-when.
- **Open for the owner:** cookies have raw egg, and a thermometer in a
  cookie isn't practical, so their doneness check is visual. §7.4 marks this
  as a Recommendation waiting on her.

---

## 23. 2026-10-22 — Wording a kid can follow

The owner reviewed the sample lessons in the preview.
- **Cookies (49):** "cool it until it's soft again" read as if browned butter
  goes hard. The move, the "why cool it back down" card, and the biscuit
  callback now say the liquid butter is stirred over ice water until it
  thickens like frosting.
- **Biscuits (38):** "shaggy" became "lumpy and rough, not
  smooth. That's right, so stop stirring." The first "1 inch thick" also says
  "about as thick as two of your fingers stacked", and the last one says "two
  fingers thick".
- The owner ruled that version numbers don't go up on lessons that aren't
  released yet. Biscuits went back to version 1, and §7.3 now says so.
- **Cookies (49):** "2 inches apart" also says "three of your fingers wide".
- The owner approved visual doneness checks for lessons whose only raw
  ingredient is egg baked into a dough. §7.4 no longer marks it as waiting.
- **Shakshuka (4):** "mince the garlic" now says what that means: tiny bits,
  smaller than a grain of rice.

---

## 24. 2026-10-22 — Kitchen words

- The owner noticed lessons say "dice" and "mince" but nothing teaches what
  those look like, and lessons can be cooked in any order. She approved a
  kitchen words list (§6.1, Recommendation).
- `content/terms.json` defines 22 words: cuts (dice, mince, chop, slice,
  julienne, grate, zest), heat (simmer, boil, poach, sauté, sear, braise,
  shimmer), and moves (marinate, whisk, cream, fold the dough, knead, dust,
  toss, across the grain). Each has a description a kid can picture, its
  word forms, and the lesson that practices it. Drawings come later (§5.3a).
- `src/content/terms.js` finds the words in step text. In the lesson
  preview they're underlined, and tapping one opens its meaning under the
  step. Cook mode gets the same in Phase 2, in the profile's theme.
- New linter rule (§7.4): a step can't use a cooking word listed in
  `content/rules/kitchen-words.json` (sift, drizzle, deglaze, and others)
  until `terms.json` defines it, and no two words can claim the same form.
  4 new tests; 33 in all.
- Cookies (49): the creaming step now says "cream them", so the word gets
  its card.
- Shakshuka (4): the knife tip was unclear about which hand makes the claw.
  It now says the claw is the hand holding the food, with the flat of the
  blade against the knuckles.

---

## 25. 2026-10-22 — Foundation skills, choose-one lessons, knife work first

- The owner ruled (new plan §4.0, Requirement):
  - Foundation skills (the knife cuts, heat control, building a sauce, roux,
    cutting in fat, yeast dough) each get at least two lessons, from very
    different cuisines, and a family picks one. Either one counts as done.
  - Knife work is strongly suggested first. The app nudges toward it but
    doesn't block.
  - Parents see foundations clearly: a foundation marker in the library and
    the queue, choose-one lessons side by side, a nudge in the queue, and a
    parent tour card (§6.2).
- Prerequisites unlock on either lesson for a skill, except where a lesson
  serves the earlier dish itself (39 needs 38's biscuits).
- The alternate dishes are proposed to the owner and not added yet. They'll
  be numbered from 51.

---

## 26. 2026-10-22 — Three lessons per foundation skill

- The owner liked both proposed options for each foundation skill, so each
  foundation skill now has three lessons to pick from (§4.0). 16 dishes were
  added, numbered 51–66, and the course is now 66 dishes:
  - Unit 1: 51 Chicken fajitas, 52 Carrot-apple slaw, 53 Guacamole and
    chips, 54 Bruschetta, 55 Matzo ball soup, 56 Minestrone.
  - Unit 2: 57 Grilled cheese and tomato soup, 58 Challah French toast,
    59 Spaghetti marinara, 60 Sloppy joes, 61 Croque madame (turkey),
    62 Chicken gumbo (adult hands-on, for the dark roux).
  - Unit 5: 63 Rugelach, 64 Scones, 65 Challah, 66 Homemade pizza.
- §4.0 has the pick-one table. Each new row in the unit tables names its
  group and its food-rule notes: lard in tortillas, turkey not ham, chicken
  andouille casings, and no shrimp in the gumbo.
- Phase 7 is now 62 lessons to write. The stand-mixer note includes challah
  and pizza dough.
- New cuisines: Tex-Mex (United States page), Jewish, and British (Europe
  page). Where the Jewish stamp goes is open question 2.
- Open question 1: honey in challah.
- The theme showcase mockup still shows 50 stamps. It's a mockup, and the
  real counts come from the content.

---

## 27. 2026-10-22 — Honey allowed; Jewish stamp on the Europe page

- **Honey is allowed** (owner ruling, §2.1). The bee isn't added as a clean
  species. `content/rules/clean-species.json` gained `allowedProducts`, with
  honey from honeybees as its only entry. The linter accepts that exact pair
  and still rejects any other part of a bee. `honey` was added to the
  registry, and there's a new test.
- **The Jewish stamp goes on the Europe page,** as proposed: matzo ball
  soup, challah French toast, rugelach, and challah are Eastern European
  Jewish (Ashkenazi) dishes. Israeli dishes, if any are added, would get
  their own stamp on the Middle East & North Africa page.
- Both open questions are closed.

---

## 28. 2026-10-22 — Nine African dishes

- The owner asked for more African dishes that are clean and easy to shop
  for, then chose all nine proposed. They're added as extra lessons, 67–75,
  and the course is now 75 dishes:
  - Unit 3: 67 Jollof rice with chicken (Nigerian), 70 Peanut stew / maafe
    (Malian), 74 Koshari (Egyptian).
  - Unit 4: 68 Chicken yassa (Senegalese), 69 Suya (Nigerian).
  - Unit 5: 72 Chapati (Kenyan).
  - Unit 6: 71 Bobotie (South African), 73 Peri-peri chicken (Mozambican),
    75 Kelewele (Ghanaian, adult hands-on for shallow frying).
- The Africa passport page goes from 1 dish to 9. Koshari goes on the Middle
  East & North Africa page. 8 cuisines were added to `cuisines.json`.
- §2.1 hidden sources gained ground dried crayfish, shrimp powder, and
  shrimp bouillon cubes, common in West African cooking. Egusi soup and
  pepper soup were left out because they usually depend on seafood.
- Phase 7 is now 71 lessons to write.

---

## 29. 2026-10-22 — Dish art for 51–58

- The owner supplied sheets 15 and 16 (ChatGPT). They're cropped into
  `content/images/dishes/51-…` through `58-…` with `tools/crop-dish-sheet.py`,
  and listed in `tools/dish-sheets.txt` and `content/images/LICENSES.md`.
- Every picture was checked for unclean foods, and none are in them.
- A review for repeats across all 75 dishes is with the owner. It proposes
  swapping 52, 53, 54, and 55, among others; these pictures stay either way.
- Sheet 17 (59–62) was cropped the same way. 61 Croque madame needs a redo
  if it stays: the turkey came out pink and could pass for ham.

---

## 30. 2026-10-22 — Swaps to remove near-repeats

- The owner approved swapping every near-repeat found in a check of all 75
  dishes:
  - 52 Carrot-apple slaw → **Baked shoestring fries** (repeated 35's
    coleslaw)
  - 53 Guacamole → **Chimichurri steak**, Argentine (too close to 3's pico)
  - 54 Bruschetta → **Tuna salad sandwiches** (raw chopped tomato again)
  - 36 Chicken noodle soup → **Matzo ball soup from a whole chicken**, and
    55 → **Ratatouille**, French (two chicken soups)
  - 60 Sloppy joes → **Honey-garlic chicken**, Chinese-American (repeated
    33's chili)
  - 61 Croque madame → **Chicken and spinach crêpes**, French (repeated 57's
    grilled cheese)
  - 62 Chicken gumbo → **Japanese chicken curry**, roux made from scratch
    (repeated 34)
  - 34 Jambalaya → **Red beans and rice** (repeated 67's jollof)
  - 64 Scones → **Baked beef empanadas**, Argentine (repeated 38's biscuits)
  - 72 Chapati → **Ugali with sukuma wiki**, Kenyan (repeated 19's naan)
  - 73 Peri-peri chicken → **Malva pudding**, South African, now in
    Desserts (repeated 13's jerk chicken)
  - 48 Southern fried chicken → **Fish and chips**, British (repeated 23's
    katsu)
- The §4.0 pick-one table and the unit tables are updated, with food-rule
  notes: curry roux from scratch (store blocks can contain pork or beef fat),
  no lard in empanada dough, chicken andouille in the red beans, and no beef
  dripping for frying. Gumbo's adult hands-on rating went with it; fish and
  chips is adult hands-on.
- Pictures: `55-matzo-ball-soup.png` became `36-matzo-ball-soup.png`.
  Pictures of dishes swapped out moved to `content/images/dishes/retired/`,
  and `tools/dish-sheets.txt` and the licenses follow them.
- Cuisines: Argentine (Latin America page) and Chinese-American (United
  States page) added; Mozambican removed.
- The borderline pairs (tinga and pulled chicken, yassa and tagine, bobotie
  and meatloaf, the tortilla dishes) stay as they are.
- Sheet 18 (63–66: rugelach, beef empanadas, challah, pizza) was cropped and
  checked, with no unclean foods.
- Sheet 19 (67–71: jollof, yassa, suya, peanut stew, bobotie) was cropped
  and checked, with no unclean foods. Its plates touch, so the tool found
  only 4 dishes. It was split by hand, and the boxes are recorded in
  `tools/dish-sheets.txt`.
- Sheet 20 (72–75: ugali with sukuma wiki, malva pudding, koshari,
  kelewele) was split by hand, cropped, and checked, with no unclean foods.
- Sheet 21 (52–55: shoestring fries, chimichurri steak, tuna salad
  sandwiches, ratatouille) was cropped and checked. The tuna filling came out
  pinkish; it's waiting on the owner whether it reads as tuna.
- Sheet 22 (60, 61, 62, 34, 48: honey-garlic chicken, crêpes, Japanese
  curry, red beans and rice, fish and chips) was split by hand, cropped, and
  checked, with no unclean foods. **All 75 dishes now have a picture.**

---

## 31. 2026-10-22 — Phase 1b: families and accounts

- **The Worker** (`src/worker/`, `wrangler.toml`): serves `/ops`, the JSON API,
  and the app's files in `public/`. The ops page and migration runner follow
  the MCCE repo's `src/ops.js` and `src/migrate.js`; the SQL splitter and the
  test database stand-in are copied from it.
- **Database** (`src/worker/migrations/0001_families.sql`): families, parents,
  sessions, password resets, invites, sign-up requests, settings, and
  profiles. Ids are random text, so a removed family can come back without
  clashing with newer rows. Schema notes beyond the plan's sketch, now in §8.4:
  `profiles.people` (each person's name and avatar color, for shared lockers)
  and `sessions.pin_until`. Passwords and the PIN are PBKDF2 hashes.
- **`/ops`**, behind `OPS_TOKEN`: a setup checklist, migrations with Apply
  pending, **Make a sign-up code** (for the owner's own first sign-up), **Make
  this parent the owner**, and the destructive controls, each with its
  restore: Download export.json / Restore from export.json, Clear everything
  (type `DELETE EVERYTHING`), and per family Download / Remove… (type
  `REMOVE`) / Restore a family. Removing a family is on `/ops` rather than the
  owner screens so its restore sits beside it (§6.2a updated).
- **Accounts** (§8.3): sign-up with a single-use code or the owner's sign-up
  word; the public request form (one pending request per email, the owner is
  emailed); email-and-password login with a 400-day httpOnly cookie; password
  reset by a one-hour emailed link, which logs out the parent's other
  devices; the parent PIN, set on first run, unlocks parent screens on that
  device for 15 minutes, and is reset with the account password. Every family
  query takes `family_id` from the session.
- **Email** goes through Resend. Without `RESEND_API_KEY`, nothing is sent:
  `/ops` and the owner screens say so, and an approved code shows on screen to
  pass on by hand.
- **The app** (`public/`): plain ES modules, no build step, so nothing has to
  run before a deploy. Screens: welcome, log in, sign up, ask for a code,
  forgot and reset password, set PIN, the chef's lockers, each profile's
  kitchen (the lesson library as Kitchen Quest quest cards or Chef's Passport
  recipe cards, with the theme switch), and the parent area behind the PIN
  (profiles, family settings with diet filters and default servings, parent
  logins, change PIN, and the owner tab: requests, codes, sign-up word,
  families, set a parent's password). The lesson cards don't open yet; the
  lesson player is Phase 2.
- **Diet filters** (`src/content/diet.js`): a lesson is hidden if it uses an
  ingredient with a filtered tag, unless a diet-reason substitution clears it,
  in which case the card says "Made with … instead of …".
  `tools/build-library.js` bundles what the Worker needs from `content/` into
  `src/worker/library-data.js`, and a test fails if it's out of date.
- **Dish pictures for the app**: `tools/build-dish-images.py` writes 480px WebP
  copies of all 75 to `public/img/dishes/` (3.5 MB). A test checks every
  lesson has one.
- **Tests**: 85 in all, run against the real Worker on an in-memory SQLite
  database. They cover family scoping (no route reaches another family's
  profiles, settings, or logins, and a family id sent by the browser is
  ignored), the migration runner (order, drift, an atomic failed migration),
  a backup restoring cleanly into an empty database, clear-and-restore,
  remove-and-restore a family, sign-up codes and the word, the request queue,
  password reset, the PIN, and the owner routes. CI now runs `npm test`.
  `tools/dev-server.js` runs the app locally for a session's browser checks.
- **Setup steps for the owner** are in `docs/setup.md`. Phase 1b's done-when
  (two test families, a clean restore) is proven in tests. It is met live
  once the dashboard steps are done and the owner runs step 7.
- **Open for the owner:**
  - Optional ingredients count for diet filters, as the plan reads. So a
    dairy-free family loses shakshuka over its optional feta. The other choice
    is to drop a conflicting optional ingredient from the lesson instead of
    hiding it.
  - `MAIL_FROM` is set to `cook@immotus.app`, a guess. It must be on the domain
    verified in Resend.

---

## 32. 2026-10-22 — Open sign-up with an emailed code

- **The owner ruled (§8.3, now a Requirement):** families join on their own,
  like any website. She'll post the link to a group of about 3,000 and won't
  handle sign-ups by hand. This replaces the sign-up codes, the sign-up word,
  and the request queue built in section 31. None of it had been deployed, so
  `0001_families.sql` was edited in place, not migrated.
- **Sign-up now:** email and password, then a six-digit code emailed through
  Resend. Entering it creates the family and logs in; the first run then asks
  for the family name and the parent PIN together. A code works for 30
  minutes and allows 5 tries. The code screen counts down 10 minutes ("request
  a new one in 9:59") before a new code can be sent; a used-up or expired code
  can be replaced straight away. Pressing Sign up again inside the wait sends
  nothing, and keeps the newest password.
- **Beta word:** set or turned off from the Owner tab. While it's set,
  sign-up asks for it before any email is sent. The sign-up page learns only
  whether a word is needed, never the word.
- **Owner tab** now holds the beta word, the family list (with how many
  sign-ups are waiting on a code), and setting a parent's password. **`/ops`**
  lost its "Make a sign-up code" button; the owner signs up like anyone else,
  then makes herself the owner there.
- **Email is now required to sign up.** Without `RESEND_API_KEY`, sign-up
  says it couldn't send the email and stores nothing, and `/ops` says nobody
  can sign up. `docs/setup.md` puts Resend before the first sign-up and notes
  Resend's free plan stops at 100 emails a day.
- **Planned, not built:** a human check before the code email (the owner's
  "capture thing or unscramble the letters"). Added to §8.3 and the Later row
  of §9.
- Tables `invites` and `signup_requests` are gone; `signup_verifications`
  holds a sign-up until its code is entered. Tests: 87, rewritten for the new
  flow (codes, tries, expiry, the wait, the beta word, no email set up).

---

## 33. 2026-10-22 — Plan: website, leaving, and printing progress

Plan changes only; nothing new is built.
- **Address:** the app is `cleanplate.immotus.app` (§8.1). `docs/setup.md` and
  `MAIL_FROM` (now `cleanplate@immotus.app`, still to be confirmed) follow it.
- **New §6.13, website and legal pages (Requirement):** a simple landing page
  at `/` for visitors, plus a short privacy policy and terms of use. Claude
  drafts the words from the points listed there; the owner approves them. A
  recommendation to serve the fonts from the app instead of Google Fonts, so
  the privacy policy's list of third parties is true.
- **New §6.14, leaving and inactive accounts (Requirement):** a self-serve
  Delete our family, with Download our data beside it, and an automatic
  purge of families inactive for a year, run by a daily scheduled job in the
  Worker. Recommendations: warning emails 30 and 7 days before an inactive
  purge, and a 30-day grace period after a self-serve delete during which the
  owner can restore it from `/ops`.
- **New §6.15, Print our progress (Requirement):** per profile, the date,
  dish, cuisine, skill, and rating of everything cooked, as a page made for
  printing. Recommendation: the same rows as a CSV. It's in Phase 4, since
  ratings come from the Reflect stage.
- **New Phase 1c, public launch:** the landing page and legal pages, fonts
  served from the app, delete and download, the inactive purge, and the human
  check at sign-up if the owner wants it before launch. The sign-up link isn't
  posted publicly until 1c is done.

---

## 34. 2026-10-22 — Inactive purge runs every couple of weeks

- The owner ruled: no daily job. The inactive purge (§6.14) checks every couple
  of weeks, and "a year" is approximate. The app and its privacy policy don't
  promise an exact day.

---

## 35. 2026-10-22 — Optional ingredients don't hide lessons; photos off by default

- **Diet filters (owner ruling, §2.1):** an optional ingredient never hides a
  lesson. One with a filtered tag is left out for that family, and the lesson
  card says "Leave out the …". So a dairy-free family keeps shakshuka without
  its feta. `src/content/diet.js` returns the left-out list, and the library
  API and both themes' cards show it. One new test; 88 in all.
- **Photos (owner ruling, §2.6):** off unless the owner turns them on for a
  family, with a per-family switch on `/ops`, so the app doesn't pay to store
  hundreds of families' photos. With photos off, the photo step, gallery, and
  photo download don't show; progress, ratings, and Print our progress work
  the same. R2 isn't set up until photos are turned on. Plan only; it's built
  in Phase 4.
- **Sending address confirmed:** `cleanplate@immotus.app`.

---

## 36. 2026-10-22 — Database connected

- The owner created the D1 database. Its ID is in `wrangler.toml`, so the
  next deploy binds it as `DB`. `docs/setup.md` step 2 no longer asks for the
  ID to be pasted.

---

## 37. 2026-10-22 — Purge warnings and the delete grace period confirmed

- The owner confirmed both §6.14 recommendations, now Requirements: warning
  emails 30 and 7 days before an inactive purge, and a 30-day grace period
  after a self-serve delete, during which the owner can restore the family
  from `/ops`.
- The owner confirmed the kid app becomes an installable PWA (§8.2).

---

## 38. 2026-10-22 — Phase 2 rulings

Before Phase 2, the owner ruled on its four open recommendations:
- **Learn stage (§3):** confirmed as written.
- **Fix requests and lesson patches (§6.11):** confirmed as written.
- **Food-safety checks (§3):** doneness steps stay, with their thermometer
  target shown, but the app doesn't require a reading to check one off. The
  wash-hands steps after raw food stay. The linter's content checks are
  unchanged.
- **Hands-free (§6.12):** voice step control moves from Later into Phase 2;
  the tap zone and page-turner remote go on hold. On a doneness step, "next"
  reads the target aloud instead of moving on.

---

## 39. 2026-10-22 — Phase 2a: the lesson player

Phase 2 is split into slices: **2a** the lesson player, **2b** saving cooks for
every profile on them and the parents' test-cook notice, **2c** voice step
control, **2d** the installable PWA and cooking offline, **2e** fix requests and
lesson patches. This is 2a.
- **Lesson cards open.** Tapping one in a profile's kitchen opens the lesson in
  that profile's theme, with the showcase's components (§5.4, §5.4a):
  - **Lesson card:** the dish, skill, time, cuisine, and step count; the
    serving picker (free sizes, or the fixed sizes a baking lesson allows),
    starting at the family's default; and any diet swaps or left-out
    ingredients for this family.
  - **Learn:** a callback card when the lesson has one, the move, each "why it
    works" card, "same move, other dishes" (built from every lesson's skills),
    "when it goes wrong", and the quiz when there is one. Skip to Prep is
    always there.
  - **Prep:** the scaled ingredients as the inventory grid or the mixing bowl,
    then the tools as the gear loadout or the pegboard. Cook mode unlocks when
    everything is checked.
  - **Cook:** one step at a time with its safety banner (an adult profile sees
    only the hazard), the stage bar or measuring cup, tips and "should look
    like" notes, doneness steps showing the thermometer target (not required,
    per section 38), wash steps, a Why? button that opens the step's Learn
    card, and kitchen words that open their meaning under the step.
  - **Timers:** start from a step, several at once, in the timer tray or on the
    counter. They keep the end time, so they stay right when the kid moves to
    another step or leaves and comes back; one that ended while the app was
    closed shows how long ago. A ding and a buzz at zero.
  - **The screen stays awake** during Prep and Cook where the browser allows
    it; elsewhere a one-time tip says to raise the auto-lock time.
  - Where a cook is up to is kept on the device. Reopening the lesson offers
    Keep going or Start over. Plate it finishes it; saving the cook to the
    account is 2b.
- **Content for the browser:** `tools/build-library.js` now also writes
  `public/content/` (each lesson file and a registry) and copies the scaling,
  unit, kitchen-word, and diet code to `public/lib/`, so the app scales lessons
  with the same code the linter uses. A test fails if any of it is out of date.
- **Themed styles and icons:** `public/themes.css` and `public/icons.svg` are
  taken from the approved showcase.
- Tests: 92. New ones check the player's scripts parse, every icon it draws is
  in the sprite, and every lesson scales and fills at every size it offers.

---

## 40. 2026-10-22 — Plan: the demo page

- New §6.16 and Phase 1d (built after 2a, before 2b): a public `/demo` page
  for the owner to share with other moms. No account and nothing saved. It
  has a theme switch, a kid/adult switch, the sample lessons in the real
  player, a diet preview, a shopping list preview for two sample lessons, the
  whole course of 75 dishes, and a skills view: each unique skill with the
  dish that first teaches it and the dishes that practice it.
- The course and its skills need one content file, `content/course.json`,
  because the 75 dishes live only in the plan's tables today and only the
  written lessons have skill ids. The linter will check it against
  `skills.json` and the lesson files.

---

## 41. 2026-10-22 — Publisher, and a homeschool transcript

- The owner named the publisher: **Immotus Apps**. The landing page, demo page,
  privacy policy, and terms name it (§6.13, §6.16).
- **New, to be specced with the owner:** a homeschool transcript (§6.15), a
  printable course record per profile with the family's course name and code,
  school year, lessons and dates, skills, and hours. It's in Phase 4 with
  Print our progress.
- Assigning lessons to kids is the queue in Phase 3, as planned.

---

## 42. 2026-10-22 — Plan: homeschool mode and the syllabus

- New §6.17 (Requirement, details to spec): families choose **casual** (the
  default) or **homeschool** mode in family settings. Homeschool mode adds,
  for the parent: course setup per profile, due dates from the queue with a
  pacing helper, optional grading with a proposed five-row rubric, and the
  transcript. Switching modes never deletes anything. New Phase 4b.
- A public **syllabus page** ("Using this as a homeschool course? Review our
  syllabus"), linked from the landing and demo pages and built from
  `content/course.json`. It's in Phase 1d with the demo.
- Four open questions are in §10: whether kids see grades, the rubric, overdue
  reminders to kids, and suggested credit.

---

## 43. 2026-10-22 — Homeschool mode rulings

The owner answered the four §6.17 questions:
- Grades are parent-only; kids never see them.
- The rubric is the proposed five rows (skill shown, safety and cleanliness,
  following the recipe, the result, the reflection), each scored 1–4.
- Overdue shows only to the parent. Kids see the due date and nothing about
  being late.
- The syllabus suggests a credit value, worked out from the course's hours
  once every lesson has its time.

---

## 44. 2026-10-22 — Phase 1d: the demo page and the syllabus

- **`/demo`** (§6.16), public, no account, nothing saved to one:
  - A header with "By Immotus Apps", Sign up, Log in, and the syllabus link.
    Its wording is a draft for the owner.
  - **Try it:** the sample lessons in the real player, with the Kitchen Quest
    or Chef's Passport switch, cooking as a kid or an adult, and the diet
    switches. A lesson the diet rules out is listed as hidden.
  - **Shopping:** shakshuka and bulgogi at 6 servings, merged by ingredient
    and grouped by store section, with check-offs. A preview of Phase 3's list,
    without pantry staples or package rounding.
  - **Course:** all 75 dishes by unit, with cuisine, skill, pick-one groups,
    and "Try it now" on the written lessons.
  - **Skills:** the 52 skills in the order the course first teaches them, each
    with its pin, its idea, the dish or dishes that teach it, and the dishes
    that practice it. Foundation skills are marked "pick one".
- **`/syllabus`** (§6.17), public and printable (7 pages): about the course,
  objectives, the course at a glance (75 dishes, 52 skills, 59 lessons on one
  student's path once pick-one groups count once, about 84 hours), a
  suggested **½ credit** worked from those hours at 120–180 hours per credit,
  pacing (two a week is about 30 weeks), the units with their new skills and
  dishes, materials, safety, and the five-row rubric. Its wording is a draft
  for the owner.
- **`content/course.json`**: every planned dish with unit, cuisine, skill ids,
  the skill line, picture, safety, minutes, and pick-one group. Times for the
  71 unwritten lessons are estimates and marked so. 44 new skills were added
  to `skills.json` (52 in all); these tags are a draft for the owner to review
  in the skills view. The linter checks the file against the registries and
  the lesson files (one new test), and `tools/build-library.js` serves it to
  the browser.
- The player's file paths are now absolute, so it runs from `/demo/` as well
  as `/`.
- Tests: 97.

---

## 45. 2026-10-22 — Phase 2b: cooks saved for every profile on them

- **Migration 0002** (`src/worker/migrations/0002_attempts.sql`): the
  `attempts` and `attempt_profiles` tables from §8.4, and
  `parents.notice_seen_at`. **The owner presses Apply pending on `/ops`** after
  this deploys. Backups, family export, Remove a family, and Restore a family
  pick the new tables up on their own.
- **Saving a cook** (`PUT /api/attempts/{id}`): the device makes the cook's id
  when it starts and sends the whole cook (lesson, servings, who's on it,
  started and finished times, and where it's up to) at each new stage or step,
  on a servings or "who's cooking" change, and at Plate it. Sending the same
  cook again updates it rather than saving it twice. A finished cook can't be
  changed. The server checks the lesson exists, the size is one the lesson
  offers, and every profile is in the session's family; another family's cook
  id reads as not found. The lesson's `version` is recorded with the cook
  (§7.3), so `library-data.js` now carries each lesson's version and scaling.
  `queue_id` stays empty until the queue (Phase 3); ratings and notes wait for
  Reflect (Phase 4).
- **Cooking together** (§1): until the queue picks who a lesson is for, the
  lesson card has **Cooking with someone?** with the family's other profiles.
  Each one tapped is on the cook, and it counts for all of them. The done card
  says who it counts for. Its wording is a draft for the owner.
- **The outbox** (`public/cooks.js`): each send goes into an outbox on the
  device first. A send that can't reach the server stays there and goes when
  the app starts again or the connection returns, so finishing a cook with
  Wi-Fi off doesn't lose it. This is the cook-saving part of offline sync;
  caching lessons to cook offline is 2d.
- **Cooked, in the kitchen**: a lesson a profile has finished shows "Cooked
  once" or "Cooked N times" on its card (`GET /api/profiles/{id}/cooks`).
  Stamps and crests replace it with course progress (Phase 5).
- **Deleting a profile** takes it off every cook it was on; a cook nobody is
  left on is deleted with it.
- **The test-cook notice** (§6.9): until the first-run wizard, each parent sees
  "Before your kids cook" above the lockers until they press Got it, which is
  kept on the account, not the device. It leaves out "mark it test-cooked"
  until that button exists (Phase 3). Its wording is a draft for the owner.
- The demo page saves nothing and shows no "Cooking with someone?".
- `docs/setup.md` has what to do after an update with a migration, and the
  Phase 2b check.
- Tests: 106. New ones cover a shared cook counting for both profiles, a
  resent cook saving once, a finished cook staying as it was, the input checks,
  family scoping of cooks, deleting a profile, the notice per parent, and a
  cook coming back with Restore a family.

---

## 46. 2026-10-22 — Phase 2c: voice step control

- **Migration 0003** (`src/worker/migrations/0003_voice.sql`):
  `families.voice_enabled`, off for every family. **The owner presses Apply
  pending on `/ops`** after this deploys.
- **Family settings** (behind the parent PIN) has **Turn on voice step
  control**, with a line saying the browser usually sends what the mic hears
  to Google. Saving settings from an older screen that doesn't send the field
  leaves it as it was.
- **In cook mode** (`public/voice.js`, §6.12), for a family with it on and a
  device whose browser has speech recognition (checked by feature, so Android
  Chrome first; nothing shows on iPhone and no "switch to Chrome" prompt):
  - A mic button on the step card. The mic starts only on a tap, and the
    button's words say what it's doing: listening, reading out, paused with no
    connection, or blocked by the browser.
  - **"next"** moves on, **"back"** goes back, **"again"** reads the step
    aloud. "Previous" and "repeat" work too, and in "next, no wait, back" the
    last word wins.
  - On a **doneness step**, "next" reads the target aloud ("It's done at 160
    degrees. Tap Next when it is.") and stays put, so a stray "next" can't
    skip a food-safety check. On the last step, "next" says to tap Plate it.
  - "back" on the first step does nothing; leaving cook mode takes a tap.
  - Listening stops while the app reads aloud, then starts again. It also
    starts again after the browser's own pauses in quiet spells.
  - When the connection drops, the button says "Voice paused, no connection"
    and the buttons keep working. Voice picks up when the connection returns,
    or tries again every 20 seconds.
  - Leaving cook mode or the lesson turns the mic off.
- **New icon:** `i-mic` in `public/icons.svg`.
- The voice wording is a draft for the owner. The demo page has no mic (its
  sample family has voice off).
- Tests: 109. New ones cover the setting (off by default, per family, behind
  the PIN, kept when not sent) and how commands are read from what was heard.
  The voice flow was also run in Chromium with a stand-in recognizer: steps,
  the doneness step, read-aloud pausing, the connection dropping and coming
  back, and the mic stopping when leaving cook mode. It still needs a try on a
  real Android phone (`docs/setup.md`, section 10).

---

## 47. 2026-10-22 — "next" reads the step; Phase 2d waits

- **Owner ruling:** voice "next" moves on **and reads the new step aloud**, so
  cooking with voice is hands-free. Built in `public/player.js`; §6.12 updated.
  "back" still moves without reading, and "again" reads the step on demand.
  Listening pauses while a step is read, so a "next" said during the reading
  isn't heard; it's said again once the reading ends.
- **Owner ruling:** Phase 2d (the installable PWA and cooking offline) waits
  until pretty much everything else is built. Noted under the phase table in
  §9. The next slice of Phase 2 is 2e, fix requests and lesson patches.

---

## 48. 2026-10-22 — Timers you can hear

The owner asked how the timer-done sound works, then asked for all three
suggested changes (`public/player.js`):
- **It keeps ringing.** A ringing timer dings every 4 seconds (with a buzz where
  the device can) until someone taps Stop. Before, it dinged once.
- **With voice on, the timer says what's done:** "Time's up: Simmer sauce."
- **A "Tap here to turn on the timer sound" button** shows above the timers
  when a timer is going and the browser has sound off: no tap since the lesson
  opened, or the app came back from the background with sound suspended. Any
  tap in the player turns sound back on, and the button dings once to show it.
  Coming back from the background also redraws cook mode, so timers and the
  button are current.
- Still true, because browsers can't do otherwise: nothing sounds while the
  screen is off or the app is in the background (the timer shows "Ended 3 min
  ago" on return), and an iPhone on silent stays silent. Cook mode keeps the
  screen awake to avoid the first.
- Checked in Chromium with a fake clock and a stand-in for the audio: repeat
  dings, Stop ending them, the spoken line, and the button appearing and going.

---

## 49. 2026-10-22 — Phase 2e: fix requests and lesson patches

Built to §6.11.
- **Migration 0004** (`src/worker/migrations/0004_fixes.sql`): `fix_requests`
  and `lesson_patches` from §8.4, plus `closed_at` on a request. **The owner
  presses Apply pending on `/ops`** after this deploys. A family's requests are
  in its own export; patches belong to the whole app and are in the full
  backup.
- **Field paths** (`src/content/patch.js`, shared with the browser): a patch
  names one field by stable ids: `totalMinutes`;
  `ingredients.<id>.amount | unit | text | prep`; and
  `steps.<id>.text | tip | look | timerSeconds | timerLabel | target.temp |
  target.look`. Nothing else can be patched: no ingredient, step, title, or
  safety level.
- **Suggest a fix** on the lesson card and on every cook step, for the app
  (not the demo). A kid profile asks for the parent PIN first; an adult
  profile doesn't. The dialog is in the house style: the problem type (the
  five in §6.11), which part (the step's own fields, or the lesson's time and
  ingredient lines), what it says now, what it should say instead (timers in
  minutes; amounts at the lesson's own serving count, with the size being
  cooked shown), and what's wrong. The app adds the lesson, its live version,
  the step, and the servings. A family can have 30 open requests at once.
- **Safety and unclean-ingredient reports email the owner** right away
  through Resend. The report is saved even if the email fails.
- **What came of it** shows on the lesson card for the family that sent it:
  waiting, "Fixed: timer length in step 7 is now 9 min", left as it is, a
  duplicate, or saved for a bigger update, with the owner's reply.
- **Owner screen: Fix requests** (a new tab beside Owner). Waiting requests,
  grouped by lesson, show the part as it is now beside the suggestion (and
  what it said when sent, if it has changed since). The owner can edit the
  value, add a reply, and **Apply**, or **Decline**, mark a **Duplicate**, or
  **Needs a content change**. The owner sees no family's name. **Live fixes**
  each have **Revert**; answered requests have **Reopen**.
- **Checks before a patch goes live** (`src/worker/lessons.js`): the content
  linter itself runs on the patched lesson (blocked words, units, the
  food-safety step rules, timers, kitchen words, scaling at every size), so
  the Worker now bundles the content in `src/worker/content-data.js`, built by
  `tools/build-library.js`. On top of that, a thermometer target can be raised
  but never lowered below the one in the lesson file. A fix that fails can't
  be applied, and the screen lists why. Reverting runs the same checks.
- **Versions:** a lesson's version is its file's version plus one for every
  apply and every revert. Cooks record the live version. The player, the demo,
  and the library list all show lessons with their live fixes
  (`GET /api/patches`, public, lesson content only).
- **Revert** works on the newest live fix to a part; an older one waits until
  the later one is reverted. Its request goes back to Waiting, so Apply puts it
  live again: Apply and Revert undo each other.
- **Folding fixes into the files** (§6.11) is done in a session: Claude reads
  the live fixes from a backup, writes them into the lesson files (and
  `course.json` for a time), raises each version, runs the linter, and adds a
  migration that removes the folded fixes from the database, so the owner's
  only step is Apply pending. Nothing to do until fixes exist.
- Tests: 120. New ones cover the full loop (suggest, apply, every family sees
  it, revert puts it back), the live version on a cook, the hard block
  rejecting a fix even when the owner edits it, the thermometer floor, unit and
  empty-text checks, the fields a fix can't touch, the PIN rule, the owner
  email, decline and reopen, scoping, revert order, and a patched time in the
  library. The loop was also run in Chromium across two families.

---

## 50. 2026-10-22 — Lessons renumbered in course order

The old numbers were the order dishes were added. The owner approved a
teaching order and asked for numbers that follow it, with pick-one groups
sharing a number (1a, 1b, 1c), so a family can say what lesson they're on and
how far through the course they are.
- **The order** (plan §4, owner-approved): units in order, prerequisites
  first, easier before harder, cuisines alternated. 75 dishes, 59 numbers
  (1a Spring rolls … 8a Shakshuka … 27 Beef bulgogi … 40a Buttermilk
  biscuits … 56 Brown butter cookies … 59 Apple pie). The §4 tables are
  reordered and renumbered, with every number in their notes updated.
- **Numbers aren't stored any more** (new §4.1). `content/course.json` lists
  every dish in order with an `id`; a pick-one group is the dishes next to each
  other with the same `pickOne`. `src/content/course.js` turns that order into
  numbers, for the Worker, the app, the demo, the syllabus, and the preview.
- **Ids and file names lost their numbers:** `04-shakshuka` is `shakshuka`,
  and so on for the 4 lesson files and all 75 pictures (and their web copies,
  and `tools/dish-sheets.txt`). Lessons point at each other by id: the
  cookies' callback names `buttermilk-biscuits`, the 22 kitchen words name a
  dish, and prerequisites name a dish or `pick:<skill>` for any dish in a
  pick-one group. The course outline now carries the plan's prerequisites
  (Eggs Benedict needs cacio e pepe, and so on).
- **Linter:** drops the number checks; checks ids are unique, pictures are
  named for their dish, a pick-one group sits together and has at least two
  dishes, prerequisites exist and come first in the suggested order (and don't
  loop), each lesson's prerequisites match the outline, and a kitchen word's
  lesson is a dish in the course.
- **What people see:** "Quest 8a" on quest cards, "Lesson 8a" on recipe
  cards, "of 59" on the lesson card in the app, lesson numbers on "same move,
  other dishes" and kitchen words, and the new numbers in the demo's course
  and skills views and the syllabus.
- **Migration 0005** renames the lesson ids already saved on cooks, fix
  requests, and fixes. **The owner presses Apply pending on `/ops`** after this
  deploys. A cook in progress on a device when it ships starts over.
- **Not built yet, at the owner's word:** each family's own course plan (view,
  reorder, remove, put back), with its numbers following it (§4.1). Until
  then, every family sees the suggested order's numbers.
- The build log keeps the old numbers in earlier entries; the approved
  showcase mockups keep theirs.
- Tests: 126. New ones cover the numbering (75 dishes, 59 numbers, letters,
  a reordered plan with removed dishes, a dish added after a plan was saved,
  prerequisite notes), the new linter checks, and migration 0005.


## 51. 2026-10-22 — Steady profile tests

- Two tests (`worker-attempts`, `worker-fixes`) picked the kid and adult
  profiles by list order. Profiles made in the same millisecond come back in
  random order, so the kid/adult PIN test failed about half the time in CI.
  They now pick profiles by name. No app change.
- Tests: 126, all passing.

## 52. 2026-10-22 — Phase 3 rulings

Before Phase 3, the owner ruled:
- **Phase 3 comes next**, before Phase 1c (public launch).
- **Request a lesson (§6.1):** confirmed. A kid taps "I want to make this," and
  a parent approves or declines it.
- **Package rounding (§6.3):** built in Phase 3. Every ingredient gets its
  store package sizes, and the registry's store sections become §6.3's list.
- **Offline shopping list (§6.3):** waits with Phase 2d. Until then, check-offs
  are saved to the account.
- Phase 3 is built in two slices: 3a, the queue (requests, Cook this, the
  foundations note, safety review, mark test-cooked); 3b, shopping trips and
  the pantry.

## 53. 2026-10-22 — Plan: course plans and the weekly schedule

The owner asked that homeschool mode let a parent set the whole course up
once, with each week's lessons loaded into the queue and unfinished ones
moved to the next week. The plan had homeschool due dates as dates saved on
queued lessons, and a pacing helper that suggested dates a few lessons ahead,
which would have meant reworking the queue later. The owner ruled:
- **New §6.18, course plans and the weekly schedule.** A course is for one or
  more profiles, with its dishes in order, a start date, and lessons per week.
  Each week's lessons are worked out from the plan, not stored, and next
  week's show in the queue from the Friday before.
- **Rollover: everything shifts.** An unfinished lesson goes first the next
  week and the rest move back; the parent sees how far behind the planned
  finish it is. Skip this week, and putting a skipped week back, are included.
- **Siblings** can share a course or each have their own.
- **Casual mode** can turn it on as Plan our weeks (off by default);
  homeschool mode always has it.
- **Build order:** course plans and the schedule move into Phase 3 (slice
  3a, with the queue), which lifts the earlier wait on the family's course
  plan (§4.1). The pacing helper is gone. Phase 4b keeps course details,
  grading, and the transcript.
- The queue stays the one "up next" list in both modes, so shopping, safety
  review, and cooks are built once. Data model: `queue` gains `course_id` and
  `source`; new `courses`, `course_profiles`, `course_lessons`, and
  `course_skips` tables (§8.4).

## 54. 2026-10-22 — Skip this recipe, and cook another

- The owner asked for two one-tap controls for a parent on the weekly
  schedule (§6.18):
  - **Skip this recipe:** the lesson comes out of the course plan and the next
    unfinished lesson takes its place this week. Undo is shown, and it can be
    put back from the plan.
  - **Cook another recipe:** pulls the next unfinished lesson into this week as
    an extra, for this week only. Cooked, it moves the schedule up; not
    cooked, it goes back to its place without being overdue.
- Data model: `course_skips` (section 53) is now `course_weeks`, which holds a
  skipped week and a week's extra lessons (§8.4).

## 55. 2026-10-22 — Phase 3a: the queue, courses, and the weekly schedule

- **Migration 0006** (`src/worker/migrations/0006_queue.sql`) adds the queue
  and who each lesson is for, courses (their profiles, plan, and skipped or
  extra weeks), test-cooked marks, and the family's mode and Plan our weeks.
  Backups and family downloads include the new tables. **The owner presses
  Apply pending on `/ops`** after this deploys.
- **The weekly schedule** (`src/worker/schedule.js`) is worked out on each
  read, never stored: each week holds the next unfinished lessons at the
  course's pace. An unfinished lesson goes first the next week and everything
  shifts; a lesson cooked early counts and the rest move up; a skipped week
  pushes the plan back without counting as behind; an extra (Cook another
  recipe) is this week only. Next week shows from Friday. The parent sees the
  planned finish and how many weeks behind.
- **The queue** (`src/worker/plan.js`) is the one "up next" list. Each read
  brings a course's rows in line with its schedule: due lessons are queued
  for all the course's profiles, ones no longer due leave (unless shopped
  for), and cooked ones close. A finished cook closes the queued lesson it
  was for, whichever way it got there.
- **Kids and adults:** "I want to make this" on a kid profile sends a request
  (5 waiting at most per profile); "Cook this" on an adult profile queues it
  with no PIN. A kid's kitchen has **Up next** (or **Next quests**), with "due
  Friday" in homeschool mode and nothing about being late. Opening a queued
  lesson starts at its serving count with its other profiles picked.
- **Parents → Queue:** requests with Approve and Not now; each course's week
  with Skip this recipe, Cook another recipe, and Skip this week (each with
  Undo); next week's lessons from Friday; skipped recipes with Put back;
  lessons queued by hand with Remove (and Put back); and Add a lesson, with
  the knife-work note (§4.0). Every lesson has **Safety review** (the steps an
  adult is needed for) and **I've test-cooked this**. Foundation lessons are
  marked with a shield and the word "Foundation". Overdue shows only in
  homeschool mode, only to parents.
- **Parents → Courses:** set up a course for one or more profiles: start
  date, lessons per week, and the plan (every dish in course order, move up or
  down, untick to leave out; pick-one groups start with their first dish),
  with the prerequisite notes and the planned finish. End a course, and put
  it back. A profile is on one course at a time. A profile on a course takes
  its lesson numbers from the course plan.
- **Family settings:** Casual or Homeschool, and Plan our weeks for casual
  mode. Switching never deletes anything.
- **The test-cook notice** now says a lesson can be marked test-cooked.
- **Decisions made in building, for the owner to check** (now in §6.18): a
  lesson's due day is the Friday of its week; only lessons a family can cook
  are scheduled (today that's the 4 written ones), and the rest join as
  they're written; ending a course takes its unshopped lessons out of the
  queue. A request for a lesson the course already queued shows once to the
  kid, and the parent is told.
- Fixed in passing: the Suggest a fix flag on the lesson card was drawn huge.
- Tests: 148. New ones cover the schedule (on track, rollover, cooking ahead,
  skipped weeks, extras, before the start) and the API (requests and Cook
  this, approve, decline and put back, remove and put back, the PIN, input
  checks, family scoping, a course loading the week for two profiles, Skip
  this recipe, Skip this week, homeschool due days, one course per profile,
  ending and putting back a course, plan order, safety review, test-cooked,
  and the new tables in a family download).
- Next: 3b, shopping trips and the pantry.

## 56. 2026-10-22 — Sabbath weeks, and more than one pick-one dish

- **Owner ruling: weeks run Sunday to Friday, and Saturday is the Sabbath**,
  for every family. Nothing is scheduled, due, or shopped for on Saturday.
  Courses start on a Sunday, and the schedule names each week by its Sunday.
- **Next week's lessons show from Thursday** (was Friday), so a parent can
  shop Thursday or Friday. Kids see them as **"For next week"**, with no due
  day; only this week's lessons say "Due Friday" in homeschool mode.
- **Due day stays Friday** (owner). The parent's week reads "Sun to Fri".
- **Pick-one groups:** one dish is ticked by default, and a parent can tick
  more than one; each one ticked is scheduled and numbered (8a, 8b). The
  course editor says so, and §6.18 now does too.
- Migration 0006 (not yet applied anywhere) now says weeks start on Sunday;
  the tables are unchanged.
- Tests: 149. The schedule tests use Sunday weeks and the Thursday preview; a
  new test keeps two dishes of one group. The queue tests no longer depend on
  which weekday they run.

## 57. 2026-10-22 — The Sabbath banner, and extras aren't due

- **Owner ruling: on the Sabbath, opening the app shows a banner** on the
  lockers, a kitchen, and the parent screens: "Shabbat shalom! While you're
  welcome to follow the recipe, please note that grading and due dates are not
  available on the Sabbath. We hope your family enjoys the rest!"
- That day, kids see no "Due Friday" and parents see no due days or Overdue on
  the queue. Grading (Phase 4b) won't be offered on the Sabbath; §6.18 and §9
  say so.
- The Sabbath is Saturday by the device's calendar, midnight to midnight.
- **Extra lessons** (Cook another recipe) now say "Extra, this week only" to
  parents and carry no due day for kids, since they're never due or overdue.
- Tests: 150 (the extras' flag in the schedule, and no due day for a kid's
  extra lesson in homeschool mode).

## 58. 2026-10-22 — Phase 3b: shopping trips and the pantry

- **Reviewed against this session first.** Trips start with every queued
  lesson not yet shopped for ticked, and next week's course lessons are there
  from Thursday, so a family can shop Thursday or Friday. A course lesson's
  date for perishables is its week's Sunday. A course lesson on an open trip
  (or already shopped for) stays in the queue if the schedule moves it. The
  offline list waits with 2d (section 52); check-offs save as they're tapped.
- **Store sections and package sizes** (`content/ingredients.json`): the
  registry's sections are now §6.3's list (produce, herbs, meat and fish,
  dairy and eggs, bread and tortillas, grains and pasta, canned and jarred,
  sauces, oils and vinegars, baking, spices, specialty, frozen), and every
  ingredient has a `purchaseUnit`: a typical US package (a 28-oz can, a dozen
  eggs, a 5-lb bag), one item for things bought loose, and quarter pounds for
  meat. The linter requires one. **The sizes are estimates for the owner to
  check.**
- **The list** (`src/content/shop.js`, shared by the Worker and the demo):
  each lesson at its own serving count with the family's diet swaps, left-out
  ingredients dropped, merged by ingredient, rounded up to whole packages with
  what the recipes use beside it, grouped by section in store order. Pantry
  staples move to "You should have"; perishables for lessons further off than
  the trip's window (7 days to start) move to "Buy closer to the day";
  undated perishables show, marked "no date set"; lines with no amount show
  once with no quantity.
- **Migration 0007** adds shopping trips, the lessons on each (with the
  serving count bought for), check-offs, and the pantry. Family downloads
  include them. **The owner presses Apply pending on `/ops`** after this
  deploys.
- **Parents → Shopping:** start a trip, tick items off in the store, add or
  take off lessons, change the perishables window, End trip (the lessons are
  shopped for) or Cancel, each with Undo; recent trips can be reopened. One
  trip is open at a time. **Pantry staples** is its own screen.
- **"You shopped for N"**: a shopped lesson's card warns when its serving
  count changes after shopping, and doesn't block (§6.6).
- **The demo's shopping preview** now uses the same list, so it rounds to
  packages too.
- Tests: 163. New ones cover the list (merging, packages, pantry, section
  order, perishables, diet swaps, the linter's package rule) and trips (check-
  offs kept, End trip and Reopen, Cancel, adding and taking off lessons, the
  pantry, family scoping, input checks, a course lesson kept on a trip, and
  the new tables in a family download).

## 59. 2026-10-22 — A shopping trip is for one week

- **Owner ruling:** a shopping list only ever holds the lessons for the
  current week, or, from Thursday, the upcoming week. Section 58 offered
  every queued lesson not yet shopped for.
- A lesson is in the week by its course week or its planned date. A lesson
  queued by hand with no date is always offered, so a family that doesn't use
  dates can still shop for it.
- The Shopping screen says which week it's for. The API refuses a lesson from
  another week, when starting a trip or adding to one.
- Tests: 165 (the week a trip is for, Sunday to Saturday, and a lesson dated
  two weeks out kept off a trip).

## 60. 2026-10-22 — Shopping is optional: What you'll need, and lists by lesson count

The owner reworked shopping before any family used it (sections 58 and 59
are replaced):
- **Shopping is optional.** Nothing a learner does waits on it. The point is
  for a parent to see at a glance what the coming lessons need.
- **What you'll need** (the Shopping screen): the upcoming uncooked lessons
  week by week, undated hand-queued lessons first, with a course's weeks
  worked out ahead (the schedule now returns the weeks after next). This week
  and next are open, later weeks folded. Ingredients are merged by section, in
  the amounts the recipes use.
- **Make a shopping list:** "How many lessons are you shopping for?" counts
  from the next uncooked lesson (always, even ones on an earlier list:
  owner), shows their names, then a preview to tick what's on hand (this list
  only), then **Create shopping list**. Check-offs save as tapped; on-hand
  items can be put back; Done shopping is optional; Delete has an Undo.
- **Kitchen staples** (was pantry staples): still on every list, grouped
  under "May already have" (owner: staples get shopped for too). "You should
  have" is gone.
- **No perishable rules** (owner): nothing held back or marked. The trip's
  perishables window, the one-week trip rule, the Thursday shopping week, and
  "shopped" as a step are gone.
- **Migration 0008** replaces 0007's trip tables (no family had used them)
  with shopping lists, their lessons (as they were, with the serving count
  for "You shopped for N"), on-hand marks, and check-offs. The pantry table
  stays. **The owner presses Apply pending on `/ops`.**
- The demo's preview note now describes this.
- Tests: 163. New ones cover the weekly view's order and course weeks ahead,
  the preview and on-hand marks, counting from the next uncooked lesson, "You
  shopped for" on a course lesson queued after its list, cooking a lesson
  never shopped for, Done and Delete with their undos, family scoping, input
  checks, the PIN, and the new tables in a family download.

## 61. 2026-10-22 — Phase 4, first part: Reflect, Print our progress, and the photos switch

- **Owner rulings:** Phase 3 stays on its branch for now (no pull request
  yet). The homeschool transcript moves to Phase 4b, with grading. Print our
  progress gets a CSV download. Phase 4 starts with the parts that don't need
  photo storage.
- **Blocker for the rest of Phase 4:** the photo storage (an R2 bucket) has to
  be created by the owner in the Cloudflare dashboard. `docs/setup.md` has the
  steps. The camera, upload, gallery, and photo download wait for it.
- **Migration 0009:** `families.photos_enabled`, and `attempt_profiles.transfer`
  and `reflected_at`. **The owner presses Apply pending on `/ops`.**
- **Reflect (§3):** Plate it now finishes the cook (it counts at once) and
  opens Reflect. Each profile on the cook gets its own: a 1 to 5 rating (gold
  gems in Kitchen Quest, chef's hats in Chef's Passport, from the approved
  showcase), "What would you change next time?", and the optional "What other
  dish could use this move?". Then an optional rating from whoever ate it.
  Save, or Skip for now. Reflections wait in their own outbox on the device
  and go up after their cook, so a dropped connection doesn't lose them. The
  demo shows Reflect and saves nothing.
- **Print our progress (§6.15):** Parents → Progress. Everyone or one profile;
  a table per profile of date, dish, cuisine, skill, and that profile's
  rating, oldest first, styled for paper (Print, or save as PDF), and the same
  rows as a CSV download.
- **Photos switch (§2.6):** each family on `/ops` says photos on or off, with
  Turn photos on / Turn photos off beside it. Every family starts off; turning
  them off deletes nothing.
- Tests: 167 (reflections per profile and the eater rating, changing one
  later, input checks and family scoping, the progress rows, parents only, and
  the photos switch).

## 62. 2026-10-22 — The demo page's opening words

- Phase 4 is paused (owner).
- The demo page's opening paragraph is the owner's new wording: "A cooking
  course, but not like any you've ever tried before." (in bold), then that it
  suits kids, teens, and adults, and is built to be fun, free, and
  fundamentally rooted in the dietary laws of the Most High, and that beta
  testing by invitation begins shortly. Two small edits to the text as given:
  "fundementally" is spelled "fundamentally", and "three things--" became
  "three things:".

## 63. 2026-10-22 — The demo's Shopping tab follows the real flow

- The demo's Shopping tab was still the old "Shopping trip" checklist. It now
  walks through the real flow (§6.3) with the sample lessons, saving nothing:
  - **What you'll need:** the four sample lessons as a pretend family's
    weeks (this week: shakshuka and bulgogi; next week: biscuits; the week
    after: cookies), this week and next open, in recipe amounts.
  - **Make a shopping list:** How many lessons, with their names, then Next.
  - **Before you make the list:** tick what you have.
  - **Shopping list:** packages and aisles, check-offs (not kept), what you
    said you have with Put on the list, and Make another.
- Salt, black pepper, and olive oil play the pretend family's kitchen
  staples, so "May already have" shows. The diet switches still apply.
- §6.16's description of the preview now says this.

## 64. 2026-10-22 — Unit 1: the three julienne lessons

Content fill (Phase 7) starts with Unit 1, at the owner's request: all three
pick-one julienne lessons first. 
- **1a Fresh spring rolls** (`spring-rolls`): poached chicken (165°F), carrot
  and cucumber matchsticks, rice noodles, mint, rolled in rice paper, with a
  peanut-hoisin dip. Teaches making a flat side before cutting, cutting
  planks, then matchsticks. Swaps: sunflower seed butter (peanuts),
  gluten-free hoisin (gluten). 4 servings, 60 minutes.
- **1b Chicken fajitas** (`chicken-fajitas`): peppers cut skin side down and
  onions cut into even strips; thighs rubbed with a spice paste, seared whole
  (165°F), rested, then sliced, so no raw chicken is cut. Tortillas carry the
  "check for lard" note; sour cream carries a "check for gelatin" note. Swap:
  corn tortillas (gluten). 4 servings, 50 minutes.
- **1c Baked shoestring fries** (`shoestring-fries`): flat side, planks,
  sticks; soaked, dried, and baked at 425°F on two pans, turned and swapped
  halfway. 4 servings (up to 8), 70 minutes.
- **Registries:** 24 new ingredients (chicken breast and thighs, rice paper,
  rice noodles, produce, spices, tortillas, sour cream, toppings) and 7 tools
  (medium saucepan, colander, shallow dish, kitchen towels, peeler, paper
  towels, microwave). Every animal product is from a clean species.
- **Course outline:** the three dishes carry their real times instead of
  estimates.
- **Linter:** a dish in the same pick-one group no longer counts as an
  "earlier lesson" for the missing-callback warning, since a family cooks only
  one of them (§7.4 says so now). One new test.
- **Merged with main** (Phases 3 and 4 so far): the 24 new ingredients got
  their store sections and package sizes, which main now requires.
- **Course tests use the four samples:** the queue and shopping tests built
  courses from the suggested plan, so writing 1a–1c changed which lesson a
  course starts with. They now keep only the four sample lessons
  (`samplePlan` in `test/helpers/worker.js`), so lessons written later don't
  move them. One test still uses the suggested plan, to check that a course
  passes over dishes not written yet.
- The demo's Try it tab lists every written lesson, so 1a–1c show there too.
- Not test-cooked. No intro slides yet (warned, as for the samples).
- Tests: 168.

## 65. 2026-10-22 — The demo shows one skill's three choices

- **Owner ruling:** the demo shows the three julienne lessons, so visitors see
  what a foundation skill's choices look like, but lessons written later
  don't join it.
- **Try it** now has two groups: "Pick one: three ways to learn julienne"
  (spring rolls, fajitas, shoestring fries, with a line on how pick-one
  works), then "More sample lessons" (the four samples). The list lives in
  `DEMO_TRY` in `public/demo.js`.
- The demo loads only those seven lessons, and the Course tab marks only
  them "Try it now". §6.16 says so.

## 66. 2026-10-22 — Plan: Holy Times and sharing recipes

Plan only; nothing built. From the owner's rulings in this session.

- **New §6.19, Holy Times (Requirement):** a seasonal unit beside the
  numbered course, starting with Passover and the Feast of Unleavened Bread,
  with lessons we write and a Parent-contributed shelf.
  - **Leaven** uses the owner's definition: yeast, sourdough, baking powder,
    baking soda, self-rising flour, and ready-made foods that usually contain
    them. It's a badge and a filter, not the hard block.
  - **Badges:** Unleavened (automatic, when every ingredient is in the
    registry and none is leaven) and Good for Feast Days (when a parent shares
    a recipe as a feast-day recipe).
  - **Swap for a Holy Time meal instead:** in every queued lesson's "⋯" menu,
    all year, parents only. February through April it offers only Unleavened
    recipes (the unit's lessons, then other library lessons, then parent
    recipes); the rest of the year, every feast recipe. A swapped-out course
    lesson rolls over to next week (§6.18).
  - Placeholder art by meal type for shared recipes without a photo.
- **§6.10 rewritten:** family recipes are no longer a bonus. Sharing follows
  one routine for every recipe: recipes that pass the hard block go straight
  to the directory (typed-in ingredients included); a feast-day recipe
  flagged for leaven gets the owner's notice with Send for review and Share
  recipe; a hard-block flag gets Send for review only. Owner review clears
  false alarms and never lets unclean food through. The guided entry adds
  meal type, a "why we make this" card, and the doneness rule.
- **§6.2, §6.2a:** the swap, sharing, and Recipe reviews replace recipe
  submissions.
- **§9:** new Phase 4c, Holy Times and shared recipes, with Phase 9's family
  recipes folded in. Its place in the order is proposed, for the owner to
  confirm.
- **§10:** open questions: other appointed times; whether Holy Times is for
  every family or turned on per family; whether its cooks count toward
  progress and the transcript; who sees shared recipes and whether the family
  name shows; and Phase 4c's place.

## 67. 2026-10-22 — Plan: Phase 4c is next

- **Owner ruling:** Phase 4c (Holy Times and shared recipes, §6.19, §6.10)
  is built next, with family recipes pulled forward from Phase 9. It comes
  after Phase 4's first part and before the rest of Phase 4 and 4b. §9 says
  so, and its place is no longer an open question.

## 68. 2026-10-22 — Plan: Appointed Times, and the review of sharing

Plan only; nothing built. A review of entries 66–67 and the owner's rulings
on it.

- **Renamed:** Holy Times is now **Appointed Times** (§6.19), including the
  unit, the "Swap for an Appointed Time meal instead" menu item, Phase 4c,
  and the leaven notice ("the spring Appointed Time").
- **Typed-in ingredients are reviewed** (§6.10). Instant sharing let a
  typed-in ingredient reach every family with only the blocked-word scan on
  it, and the scan can't catch everything §2.1 blocks (pepperoni, gelatin,
  refried beans). Now a recipe with a typed-in ingredient shows only Send for
  review and can't be shared until the owner clears it, usually by adding the
  ingredient to the registry. Its family can still cook it meanwhile.
- **No photos in the directory:** shared recipes always show the meal-type
  art; a family's own photo stays with that family.
- **Report and Hide:** any parent can report a directory recipe; the owner
  can hide any directory recipe and unhide it (the restore rule). New
  "Reported recipes" on the owner screens (§6.2a).
- **Send for review and Share recipe** can both be pressed: the recipe is
  shared without the Unleavened badge and gets it if the review clears it.
  The leaven notice keeps the owner's wording.
- **Leaven:** the check reads step text too. Beer is off the list; fermented
  foods that aren't a raising agent (beer, soy sauce, vinegar, Worcestershire,
  miso) aren't leaven.
- **The spring window** runs February 1 through May 15, so the latest years'
  feast days are covered. Proposed: it goes by the week being swapped.
- **The swap picker** shows the whole community directory (plus the family's
  own recipes), with diet filters applied and hidden recipes left out.
- **Housekeeping:** §1's Users table; §6.10's entry flow (photo stays with
  the family, typed-in ingredients go to review, hazard line and an added
  wash-hands step proposed); §8.4 now has `recipe_reviews` (replacing
  `recipe_submissions`), `community_recipes` with kind, meal type, the
  Unleavened flag and `hidden_at`, `recipe_reports`, and `queue` and
  `attempts` that can point at a family recipe, with a swap as a queue row
  (proposed). §9's 4c row and test cover review, Report and Hide.
- **§10, new open questions:** in homeschool mode, whether a swapped week
  shows as behind, and whether next week can be swapped from Thursday;
  whether the unit's lessons count in the 75.

## 69. 2026-10-22 — No Thursday preview; a swap is never behind

- **Owner ruling: the Thursday preview is gone.** It was there so a parent
  could shop Thursday or Friday for next week, but section 60 made shopping
  work from What you'll need, which already shows the weeks ahead. Now each
  week's course lessons join the queue on its Sunday, and kids no longer see
  "For next week".
  - `src/worker/schedule.js`: `PREVIEW_FROM` and `shows_next` removed.
  - `src/worker/plan.js`: the queue sync loads this week only; the course
    card always returns next week (for the plan and Skip next week), and a
    profile's items are "this week" or undated.
  - `public/app.js`: the parent's course card always shows next week, without
    the "show here from Thursday" note; the kitchen's "For next week" label
    is gone.
  - Plan §6.18 and the README say so. Tests: 168, the Thursday checks removed
    and the queue tests no longer filter out next week.
- **Owner ruling: a swap is never behind** (§6.19). The parent approved it,
  so the remaining lessons move back a week and the planned finish with them;
  nobody is shown as late. Off the open questions, with the Thursday swap
  question, which no longer applies.

## 70. 2026-10-22 — Plan: syllabus hours count one student's path

- **Owner ruling:** the syllabus counts only what a learner is expected to
  cook. §6.17 now says the hours and suggested credit come from one student's
  path (59 lessons, each pick-one group once at its average time), which is
  how `public/syllabus.js` already works. The 75 is only the list of dishes.
- The Appointed Times unit is optional, so it's listed in its own section and
  left out of the hours and credit. Off the open questions (§10).

## 71. 2026-10-22 — Nothing cooked on the Sabbath counts; Appointed Times settled

- **Owner rulings on the Appointed Times questions** (§6.19, off §10):
  - Recipes can be for any of the Levitical holy days (Leviticus 23), though
    most will likely be for Unleavened Bread.
  - The unit and the swap are for every family. None of the app's religious
    elements can be turned off.
  - Appointed Times cooks count toward progress, ranks, skills, and the
    transcript like any other cook, except on the Sabbath.
  - Shared recipes carry no identifier at all: the directory and the unit's
    shelf are just "User-shared recipes" (was "Parent-contributed").
- **Owner ruling: nothing cooked or graded on the Sabbath counts** (§6.18),
  for any lesson. Built for what exists now:
  - `src/worker/schedule.js`: `isSabbath(day)`.
  - `src/worker/plan.js`: a course lesson is finished by its first cook that
    wasn't on a Saturday.
  - `src/worker/api.js`: a cook finished on a Saturday is saved but doesn't
    close its queued lesson; a profile's cooks (the kitchen's "cooked" marks)
    and Print our progress leave Saturday cooks out.
  - The day is the family's calendar day, from the device's offset: the cook
    outbox (`public/cooks.js`) and the kitchen now send `?tz=`. A cook's day
    is worked out from the offset of the device asking, not stored, so a
    clock change near midnight can move a cook by an hour.
  - Grading (Phase 4b) and stamps, pins, and ranks (Phase 5) aren't built
    yet; the plan says they follow the same rule.
- **Tests: 170.** New: a Saturday cook leaves its lesson queued and is left
  off the cooks list and Print our progress, while a Friday cook counts; and
  `isSabbath`. The test setup (`test/helpers/register.js`) runs a Saturday
  test run as the Friday before, so the suite, which cooks "now", passes on
  any day (checked with the clock set to a Saturday).
- No migration; nothing for the owner to do.

## 72. 2026-10-22 — Phase 4c, slice 1: the Appointed Times unit and the leaven check

- **Owner rulings:** Phase 4c is being built now (family recipes and the
  Appointed Times unit; the transcript waits). Cottage cheese crescent rolls
  join the unit. Its lessons are labeled **A1, A2** (was: no number).
- **Leaven** (`content/rules/leaven.json`, `src/content/leaven.js`): the
  owner's list as words (yeast, sourdough, baking powder and soda, baker's
  ammonia, self-rising flour, and ready-made breads, crackers, and mixes),
  checked in ingredient names, typed-in names, and step text, with plurals and
  a few allowed phrases ("unleavened bread", "no yeast"). Beer, soy sauce,
  vinegar, Worcestershire, and miso aren't on it.
- **Unleavened badge:** worked out at build time for every lesson (every
  ingredient from the registry, none leaven), shown on kitchen cards as an
  icon and a word. Five of the nine lessons have it.
- **The unit** is unit 8 in `content/units.json`, marked `seasonal`, with a
  prefix letter and its lessons in order. Its lessons aren't in
  `course.json`, so the course, its numbers, the demo, and the syllabus are
  unchanged. The linter checks the list matches the lessons. The kitchen
  shows "Appointed Times · Quest A1"; course plans keep A labels as they are.
- **Two lessons:** A1 unleavened flatbread (flour, water, oil, salt; rolled
  thin, pricked, cooked in a dry pan) and A2 cottage cheese crescent rolls
  (cottage cheese and butter pastry around cinnamon sugar). Their Learn cards
  say why they belong to the feast.
- **Registry:** water (store section `tap`: never on a shopping list, no
  package, which the linter allows only for tap), small-curd cottage cheese
  (with the gelatin label note), ground cinnamon, and a rolling pin.
- **Meal-type pictures** (`content/images/meals/`, copied to
  `public/img/meals/` by the build): meat, poultry, fish, bread, soup, salad,
  side, dessert, drink, drawn as SVG. Both new lessons use the bread picture
  until the owner makes their dish art.
- Tests: 176 (leaven words, plurals, allowed phrases, the fermented foods that
  aren't leaven, the badge, A labels, the linter's list check, water never on
  a list).

## 73. 2026-10-23 — Phase 4c, slice 2: family recipes

- **The owner's art** for A1 and A2 (`source/sheet-23-appointed-times.png`)
  is cropped into `dishes/unleavened-flatbread.png` and
  `dishes/cottage-cheese-crescents.png`, listed in `tools/dish-sheets.txt` and
  `LICENSES.md`; the two lessons use them instead of the bread picture.
- **Family recipes** (§6.10), for one family only:
  - `src/content/recipe.js` (shared with the browser): the stored shape,
    `normalizeRecipe` (trims, numbers the steps, puts a wash-hands step after
    each step marked as handling raw meat, poultry, fish, or eggs),
    `recipeProblems` (the hard block on every registry ingredient and every
    word, with no exception; amounts and units; safety levels and hazards;
    timers; and for raw meat, poultry, or fish a doneness check at the safe
    minimum: poultry 165°F, ground meat 160°F, other meat and fish 145°F), and
    `recipeLesson` (a recipe in lesson shape; a typed-in ingredient gets its
    own id, scales as a plain amount, and isn't merged on shopping lists).
  - `src/worker/recipes.js`: list, one recipe, check, add, edit (the version
    goes up), delete with Undo. In the queue, on cooks, and on shopping lists a
    recipe's lesson id is `recipe:<id>`, so the queue, kid requests and Cook
    this, safety review, shopping, cooks, the Sabbath rule, and Print our
    progress work for recipes unchanged. Diet filters hide a recipe the same
    way as a lesson; a typed-in ingredient has no diet tags.
  - **Migration 0010** adds `family_recipes`. **The owner presses Apply
    pending on `/ops`** after this deploys.
- **Screens:** Parents → Recipes (list, Edit, Delete with Undo) and the
  guided entry: the basics, ingredients (search our list or type one in;
  amounts like 1/2 or 1 1/2, or blank for "to taste"), tools, steps (who's
  needed, the hazard, a timer, "handles raw food", and the doneness check),
  meal type with its picture and an optional "why we make this" card, then a
  review with the server's checks before Save. The draft is kept on the device
  until it's saved. Kitchens show an "Our recipes" shelf; the player opens a
  recipe with its meal-type picture, and goes straight to Prep when there's no
  card. The queue's Add a lesson lists the family's recipes. Suggest a fix
  stays off for recipes; the family edits its own.
- **Not yet:** a recipe's own photo waits for the camera (Phase 4); sharing,
  reviews, and the directory are slice 3.
- Tests: 185 (the checks, the wash step, units, the hard block's refusals and
  allowed phrases, doneness minimums, scoping between families, diet hiding,
  and a recipe queued, on a shopping list unmerged, cooked, and on Print our
  progress). Checked in a browser: the entry flow, the kitchen shelf, and the
  player.

## 74. 2026-10-23 — The parent menu, and dish cards

- **Owner ruling: a side menu** for the parent screens, after MCCE's
  parents app (`public/app.js` in that repo). The row of tabs is gone: a
  **Menu** button in the bar opens a panel from the side with four groups,
  one open at a time, opening on the current screen's group; Escape or a tap
  outside closes it. Learning path (Queue, Shopping, Kitchen staples,
  Progress), Recipes (Our recipes), Setup (Courses, Profiles, Family settings,
  Logins & PIN), and Owner for the owner only (Families & beta word, Fix
  requests). Kitchen staples is its own entry now. Each screen's title is
  its page name, under its group's. The app's name goes back to the Queue.
- **Owner ruling: dish cards.** Many dishes are new to families, so on the
  queue (queued lessons and kids' requests) and the course plan, a dish opens
  a card: a line about it, its main ingredients (not the flour, salt, and
  oil), how it cooks, and the time.
  - `content/course.json`: `about`, `main`, and `method` (stove, oven,
    stove-oven, no-cook) for all 75 dishes, written this session; the linter
    requires them and scans them for blocked words. The two Appointed Times
    lessons carry their own (lesson schema), also required.
  - Family recipes: the entry flow asks how it cooks; the card's main
    ingredients come from the recipe (registry pantry sections left out) and
    its about line from the "why we make this" card.
- Tests: 185. Checked in a browser: the menu, its groups, and the cards on
  the queue and the course plan.

## 75. 2026-10-23 — Phase 4c, slice 3: sharing, reviews, and User-shared recipes

- **Sharing** (`src/worker/sharing.js`, §6.10): Share on a recipe asks
  General or Feast day, then runs the routine:
  - every ingredient from our list: shared at once, with the Unleavened badge
    if it earns one and Good for Feast Days if shared as a feast-day recipe;
  - a typed-in ingredient: a notice with only Send for review; a cleared
    review shares it, with the badge the owner decides;
  - a feast-day recipe flagged for leaven (ingredients or step text): the
    owner's notice word for word, with Send for review (greyed once sent,
    "Sent for review") and Share recipe, which shares it without the badge;
    both can be pressed, and clearing the review gives the badge;
  - a blocked word: the entry flow's Review shows a matching notice and Send
    for review, which saves the recipe **held** (it can't be cooked, queued,
    or shared). Clearing it frees the recipe and remembers those words as a
    false alarm in that recipe only (`cleared_words`); a new blocked word in
    an edit is refused again. Any other problem beside a blocked word can't
    be sent, and an unclean registry ingredient never can.
  - Stop sharing withdraws a recipe; deleting one withdraws it too. An edit
    after a review needs another review (reviews carry the recipe's version).
- **User-shared recipes** (Recipes → User-shared recipes): every family's
  shared recipes, with no family named, filtered by the family's diet
  settings; search, Good for Feast Days only, the dish card, Add to our
  recipes (a copy of its own, which keeps the cleared words), and Report
  (unclean, food safety, wrong, inappropriate, other; unclean and food-safety
  reports email the owner through Resend).
- **Owner** (Menu → Owner): Recipe reviews (what was flagged, the whole
  recipe, the Unleavened badge choice, a note, Clear or Decline) and Reported
  recipes (open reports with Hide or Dismiss, and every hidden recipe with
  Unhide). The owner can also Hide any recipe from the directory. Hiding is
  never undone by the family sharing again. A family's copy of a hidden
  recipe stays, with a note on Our recipes.
- Our recipes shows each recipe's badges and where it stands (held, shared,
  sent for review, a declined review's note).
- **Migration 0011** adds `recipe_reviews`, `community_recipes`, and
  `recipe_reports`, and `held` and `cleared_words` on `family_recipes`.
  **The owner presses Apply pending on `/ops`** after this deploys.
- **Not built:** a User-shared recipes shelf in the kids' kitchen under
  Appointed Times; for now a parent adds a shared recipe to Our recipes to
  cook it. The swap (slice 4) will offer the directory.
- Tests: 193 (the routine's four paths, both buttons, clearing and declining,
  held recipes and cleared words, scoping, Report with the email, Hide and
  Unhide, withdraw and delete). Checked in a browser.

## 76. 2026-10-23 — The User-shared shelf in the kitchen

- **Owner ruling:** the Appointed Times unit gets its User-shared recipes
  shelf in the kids' kitchen. Under the unit's lessons, every feast-day
  recipe other families shared (the family's diet settings applied) shows
  as a card; it opens in the player, and can be asked for, queued, shopped
  for, and cooked straight from the directory, as `shared:<id>`
  (`src/worker/recipes.js`, `lessonFor`). Once it's withdrawn or hidden it
  can't be queued or started again, but cooks of it keep its name.
- The player's kicker reads "User-shared recipe" for these.
- Tests: 194.

## 77. 2026-10-23 — Phase 4c, slice 4: Swap for an Appointed Time meal

- **The swap** (`src/worker/swap.js`, §6.19): every queued lesson on the
  parent's queue, and every course lesson in this week's plan, has a "⋯"
  menu with **Swap for an Appointed Time meal instead**. It opens a picker
  for the week being swapped (a course lesson's week, a planned date's week,
  or this week):
  - **February 1 through May 15** (any day Sunday to Friday of that week in
    the window): only Unleavened meals, in order: the Appointed Times
    lessons, other lessons that pass the leaven check, then parent recipes
    that pass it: the family's own, then User-shared recipes;
  - **the rest of the year**: the Appointed Times lessons and every Good for
    Feast Days recipe (the family's own shared as feast day, and the
    directory's), unleavened or not.
  - The family's diet settings apply. Picking a User-shared recipe adds it to
    the family's recipes first.
- **What a swap does:** the meal is queued for the same profiles and
  servings (the nearest size it makes). A course lesson stays in the plan
  and goes first next week, and the rest move back: `course_weeks.swapped`
  takes a place at the pace for that week, so the planned finish moves back
  too and the course is never "behind" for it (schedule.js). A lesson queued
  by hand comes off the queue. **Undo swap** on the swapped-in meal reverses
  either; the swapped-out lesson isn't offered under Recently taken off.
- **Migration 0012** adds `queue.swap_of` and `course_weeks.swapped`. **The
  owner presses Apply pending on `/ops`** after this deploys.
- Tests: 201 (the window's edges, both pickers' order and contents, diet
  settings, a hand-queued swap and its Undo, a course swap that moves the
  lesson to next week and the planned finish with it, picking a shared
  recipe, family scoping). Checked in a browser.
- One run of the whole suite failed the shopping-list test once and passed
  on every re-run (18 more); it looks like a timing flake already there
  (queue rows created in the same millisecond sort by a random id), not
  this change.

## 78. 2026-10-23 — The kids' kitchen in two tabs, with search

- **Owner ruling:** kids aren't shown a wall of every lesson. After MCCE
  Kids' bottom tabs, the kitchen has themed tabs pinned to the bottom:
  - **Main quest** (Kitchen Quest) / **My journey** (Chef's Passport): what's
    queued for this profile, then the next three lessons on its path (its
    course plan's order, or the suggested one), with a pick-one group's
    dishes shown together and counted once, and gone once one is cooked or
    queued.
  - **Side quests** / **More recipes**: every unit, then Appointed Times with
    its User-shared shelf, then Our recipes, each a folded shelf with its
    count. A search box filters by dish name, skill, cuisine, or any
    ingredient (every word typed must match) and opens the shelves with
    matches.
  - The tab and the search are remembered for this browser tab, so coming
    back from a lesson lands where the kid was. Progress and rewards join as
    a third tab with Phase 5.
- `/api/library`, `/api/recipes`, and `/api/shared` give each card its
  search words, and lessons their pick-one group.
- Tests: 201. Checked in a browser in both themes.

## 79. 2026-10-23 — Phase 5: progress, ranks, skills, celebrations, and sound

- **Owner rulings:**
  - Ranks by different dishes cooked: Kitchen Apprentice 0, Prep Cook 5,
    Line Cook 15, Sous Chef 30, Head Chef 50, and a new sixth rank,
    **Executive Chef at 75**, the whole course (§5.2, §5.4).
  - Family recipes (Our recipes, and User-shared recipes a family cooks) count
    toward rank only: no stamp, node, or skill.
  - Sound is synthesized in the browser, with no audio files, and on until
    muted.
- **The kitchen's third tab** (`public/rewards.js`): **Skill tree** in
  Kitchen Quest, **Passport** in Chef's Passport. Its art is ported from the
  approved showcase.
  - Kitchen Quest: the level badge and XP bar, the skill tree with a path per
    unit (Appointed Times beside the seven), a node per planned dish lit when
    cleared and the next one pulsing, and the crest collection.
  - Chef's Passport: the owner's world map, with regions colored by progress;
    a tab per region; a stamp page with every planned dish (stamped with its
    cuisine's stamp and first date, or an empty spot); the chef card with the
    six-rank ladder; and the skill pins on the apron.
  - Tapping a crest or pin shows the idea behind it and every dish that uses
    it, cooked or not (§3).
- **Executive Chef's outfit:** an even taller hat with a gold band and star,
  and a black jacket with gold buttons. Level 6 in Kitchen Quest.
- **Celebrations:** after Plate it (on the done screen) and on arriving in the
  kitchen, a profile sees what it earned since this device last showed it:
  - the dish's stamp slamming down (Passport), or Quest Cleared with its dish
    (Quest);
  - any new pins or crests;
  - then a full-screen rank up or level up with a sprinkles or pixel burst.
  - What's been shown is kept per profile on the device
    (`cpr.seen.<profile>`). The first visit records what's already earned
    without celebrating, so rewards from before this change don't all pop at
    once. A sibling on the same cook sees theirs in their own kitchen.
  - `prefers-reduced-motion` turns it all into simple fades.
- **Nothing is stored:** rewards are worked out from the profile's cooks and
  the content files (`src/content/rewards.js`, shared with the browser as
  `public/lib/rewards.js`), so no migration. `/api/profiles/<id>/cooks` now
  also gives each lesson's `first` cook date, for its stamp. Sabbath cooks
  still don't count.
- **Sound** (`public/sound.js`): a sizzle on Next in cook mode, a stamp thunk,
  a chime for new skills, and a rank-up fanfare. A mute toggle on the kitchen
  and in the player is remembered on this device. It silences the effects but
  not the timer ding, since a timer rings until it's stopped.
- The player's sound code moved into `sound.js`. The world-map layers are
  served from `public/img/map/`.
- Tests: 211 (ranks and thresholds, stamps and skills from a lesson,
  recipes counting toward rank only, repeat cooks, the skill tree and passport
  pages covering every planned dish, what's new since last shown, first-cook
  dates, and every icon, glyph, and map layer the rewards draw). Checked in a
  browser at phone width in both themes: the progress tab, tapping crests,
  pins, and passport pages, the celebration from the kitchen and from the
  player's done screen, and the rank up.

## 80. 2026-10-23 — A kid's list follows the course order; off-path cooks need a grown-up

- **Fix: course order.** Reordering a course saved and rescheduled correctly,
  but a kid's list sorted queued lessons by when they were added, and
  "Coming up on your path" used the suggested order. Both now follow the
  course plan (`/api/profiles/<id>/queue` gives `order`).
- **Owner ruling: a kid cooking off their list needs a grown-up.** On a kid
  profile, a lesson not on their list is flagged ("This one is early" or
  "isn't on your path right now"), and its start button becomes **Ask a
  grown-up to start**: the parent PIN, then **Add as an additional assigned
  meal** or **Replace an assigned meal** (pick which). Adults aren't asked.
  A request approved on the Queue screen offers the same two choices.
- **Neither pushes assigned lessons back.** A course lesson cooked through a
  lesson queued outside the course counts as done but doesn't take a week's
  place (`schedule.js`, `free`). Before this, cooking a later course lesson
  early took this week's place and moved an assigned one to next week.
  Replacing works like the Appointed Time swap (shared `replaceStatements`),
  with Undo swap.
- New `POST /api/profiles/<id>/approve`; `POST /api/queue/<id>/approve` takes
  `replace`.
- Tests: 217. The browser check got through the flag and the PIN step; the
  rest of the tap-through still needs a browser check.
- **Asked, not planned:** kid logins (username and password, no email, no
  parent screens). §8.3 says kids don't log in, and no phase has it.

## 81. 2026-10-23 — Plan: kid logins, Phase 5b

- **Owner ruling:** a kid can have a login, with a username and password set
  by a parent. A kid login has no chef's lockers and no parent screens; it goes
  straight to that kid's kitchen. Parent and adult logins work as before.
  Built next, as **Phase 5b**, after Phase 5 and before Phase 6.
- **Specced in the plan, §8.3a:** optional and per kid profile; set, changed,
  and turned off on the profile editor behind the PIN; one Log in screen taking
  an email or a username; a kid session limited on the server to its own
  profile, with every other route refused unless it's on the allowed list; a
  grown-up step on a kid's device (Ask a grown-up to start) takes the PIN for
  that one action only and opens nothing else; what ends a kid's sessions; and
  a migration with `kid_logins` and `kid_sessions` (§8.4), applied from `/ops`.
- **Changed in the plan:** §8.3 no longer says kids don't log in. The landing page and
  privacy lines (§6.13), §6.1, §6.2, §8.4, and the phase table (§9) now include kid
  logins.
- **Four questions for the owner** are listed at the end of §8.3a: usernames
  unique app-wide or per family, logins for adult learners too, logging out
  with or without the PIN, and the password minimum.
- No code changed.

## 82. 2026-10-23 — Course lessons approved early aren't queued twice; a tidier queue and course editor

- **Fix: the ⋯ menu ran off a phone screen.** On a course lesson the "⋯"
  button wrapped to the left, and its menu ("Swap for an Appointed Time meal
  instead") was pinned to the button's right edge, so it opened past the left
  side of the screen. Menus now shift to stay on screen.
- **Fix: the same dish twice.** A kid's lesson approved early (from the
  lesson or the Queue screen) that was also later in their course showed in
  the queue now and again in its course week. A course lesson queued outside
  the course for its profiles, and not cooked yet, now comes out of its later
  place (`schedule.js`, `taken`): as an extra, the lessons after it move up;
  replacing a meal, the replaced one goes first next week and the ones between
  move down. Taking it off the queue puts it back in its place. This applies to
  a course lesson a parent queues by hand too.
- **Fix: a swap bumped the wrong lesson.** With two or more a week, swapping
  out the first lesson kept it and pushed the last one to next week. A swap now
  bumps the lesson it replaced (`course_weeks` count plus the swap rows'
  `swap_of`).
- An extra meal approved on the spot is planned for today. The approve calls
  send the family's time zone.
- **Queue screen, course card:** This week and Next week are separate sections
  with dividers. Next week and Skipped recipes are folded shut. Each lesson is
  one line that opens to its tools (safety review, test-cooked, servings, Skip
  this recipe, Swap for an Appointed Time meal). Cook another recipe and Skip
  this week moved into a "⋯" menu beside This week. Lessons queued by hand open
  the same way.
- **Course editor:** the lessons fold by path ("Path 1: Knife work and
  assembly · 4 of 10 dishes ticked"), closed until opened; a path stays open
  while it's being reordered. The rows are lighter: no boxes on unticked
  dishes, and the skill line is the link to the dish card.
- Tests: 222 (an early course lesson as an extra and replacing one, its Undo,
  replacing the first of two, the bumped lesson's order). Checked in a browser at
  phone width: the menu fix in both themes, the course card, a hand-queued row,
  and the course editor opened, folded, and reordered.
- **Still to do (owner asked):** the rest of the parent side gets the same
  treatment (expanders, menus, and folded sections).

## 83. 2026-10-23 — The queue: Add a lesson in a dialog, and a Course / Additional toggle

- **Owner ruling: adding something new opens in a dialog** over the page,
  not a form at the bottom of it. A shared `modal()` in `app.js` (Cancel, a tap
  outside, or Escape closes it).
- **Queue screen:** **+ Add a lesson** sits at the right of "The queue"
  heading, above the list, and opens the add form in a dialog.
- A **Course / Additional** toggle under the heading switches between the
  course card and the lessons assigned on top of it (added by hand, approved
  requests, swaps), with a count. The choice is kept for the visit. With no
  course, only the additional list shows, without the toggle. "Recently taken
  off" is folded under the additional list.
- Tests: 222. Checked in a browser at phone width: the toggle both ways, the
  dialog, and adding a lesson from it.

## 84. 2026-10-23 — Parent screens: add buttons on top, dialogs, folded sections

- **CLAUDE.md:** added the owner's rule, under "Parent screens": adding
  something new opens in a dialog from a button; a flow too big for a dialog
  opens as its own page from a button.
- **Add buttons** sit at the top right of each list (`addHead`): + Add a
  profile, + Add a parent, + Set up a course, + Add a recipe, + Make a
  shopping list, beside + Add a lesson on the queue.
- **In dialogs now:** adding a profile (the form is shared with the edit page,
  `profileForm`; `#/parent/profiles/new` opens the list with the dialog up),
  adding a parent, and making a shopping list. Setting up a course and adding
  a recipe stay pages: the course editor is long and the recipe builder has
  several steps. A dialog closes when the page changes.
- **Course editor:** Save and the other buttons are at the top and stay in
  view while scrolling (`form(..., { top: true })`). A lesson row is tighter:
  smaller type and line spacing, a smaller number, no box around a dish, and
  34px move buttons.
- **Shopping:** every week of "What you'll need" is folded shut, with its
  lesson count. The page went from about 6,250px tall to about 1,100px at
  phone width.
- **Kitchen staples:** each store section folds shut, with "N of M on hand"
  and Save at the top. The checkboxes are a tight two-column list. About
  4,700px tall before, about 1,450px now.
- **Family settings:** Save is at the top; the diet checkboxes are a tight
  list; the voice control's where-it-works and privacy note is folded.
- Tests: 222. Checked in a browser at phone width: every parent page, and
  adding a profile, a parent, and a shopping list from their dialogs.

## 85. 2026-10-23 — Shopping: a Lists / Upcoming ingredients toggle

- **Shopping** has a **Lists / Upcoming ingredients** toggle, like the queue's.
  The choice is kept for the visit.
- **Lists:** + Make a shopping list sits above the lists. Open lists show
  newest first, then Done lists, also newest first.
- **Upcoming ingredients:** the weeks of "What you'll need", each folded, and
  the Kitchen staples link. A folded week is a single line, with no empty
  space under it.
- Tests: 222. Checked in a browser at phone width with two lists: the order and
  both views.

## 86. 2026-10-23 — Kitchen staples move into Shopping, added by search

- **Shopping** has three views: **Lists**, **Upcoming** (was "Upcoming
  ingredients", shortened so three fit on a phone), and **Staples**.
- **Owner ruling: staples are added only by searching.** The Staples view
  lists only the family's staples, A to Z, each with Remove (and Undo).
  **+ Add a staple** opens a dialog with a search box: type part of a name, tap
  Add, and keep going; Done closes it. Names starting with what's typed come
  first.
- The Kitchen staples page and its menu entry are gone. `#/parent/pantry` opens
  Shopping on the Staples view. The API is unchanged.
- Tests: 222. Checked in a browser at phone width: the old link, searching and
  adding two staples, and Remove with Undo.

## 87. 2026-10-23 — Shopping: Upcoming first, and new intro copy

- Shopping's views are now **Upcoming**, **Lists**, **Staples**, and the page
  opens on Upcoming.
- The intro line is the owner's copy: "See at a glance what ingredients are
  needed for future queued lessons. You can also generate a shopping list.
  First select everything you have on-hand already; anything checkmarked will
  be left off the list."
- Tests: 222. Checked in a browser at phone width.

## 88. 2026-10-23 — Kitchen staples come first on every list

- **Owner ruling:** kitchen staples go at the top of every list, not the
  bottom. The "May already have" group now comes before the store sections on
  a shopping list, on "Before you make the list", and in each week of
  Upcoming. Any ingredient added on Staples goes in that group, whatever store
  section it's normally in (garlic, say, leaves Produce). The server already
  grouped them that way, so only the order on screen changed.
- The plan (§6.3, item 5) now says "grouped first", and the staples notes on
  Shopping say so too.
  The demo page's shopping preview puts them first too.
- Tests: 222. Checked in a browser at phone width: a list and its preview with
  salt, olive oil, and garlic as staples.

## 89. 2026-10-23 — On the shopping list, staples are in their aisles

- **Owner ruling, correcting 88:** "May already have" is for a parent in the
  kitchen checking cupboards, so it stays first in Upcoming and on "Before
  you make the list". The finished shopping list is for the store, so each
  staple goes in its own aisle there, like everything else; the list has no
  "May already have" group. (Section 88 had put that group first on the list
  too.)
- `listOut` in `shopping.js` builds the list without staples; the demo page's
  list does the same. The notes on Upcoming and Staples say so.
- The plan (§6.3, item 5) says this now.
- Tests: 222 (the list test now finds olive oil, a staple, under Oils and
  vinegars). Checked in a browser at phone width: garlic and salt as staples,
  grouped first on the preview and in their aisles on the list.

## 90. 2026-10-23 — Plan: kid logins settled (name, picture, password)

- **Owner answers to the four questions in §8.3a:**
  - No usernames to make up. A kid logs in with their **first name and last
    initial** ("Ava C"), the way a big homeschool curriculum provider does it,
    plus **a cooking picture** picked from 30 (each with an id) and a
    password. The name and picture together are unique across the app; a
    picture another "Ava C" has shows as taken when the parent sets it up.
  - Kid profiles only; adult learners keep the lockers.
  - Logging out on a kid's device needs no PIN.
  - Passwords are at least 6 characters.
- **Changed in the plan:** §8.3a rewritten around the name and picture, with
  the 30 picture ids, a Grown-up / Kid choice on the Log in screen, the
  set-up dialog on the profile editor, and ten **build steps** for Phase 5b
  (data, pictures, kid sessions, the allowed-route list, the APIs, the
  PIN-approved start, the app's three parts, and the checks). §6.1, §6.2,
  §6.13, §8.3, §8.4 (`kid_logins` now has `login_name`, `login_key`, and
  `picture`), and the phase table follow.
- No code changed.

## 91. 2026-10-23 — Phase 5b: kid logins

Built to §8.3a as settled in 90.

- **Owner step:** after this deploys, press **Apply pending** on `/ops` for
  migration 0013 (`kid_logins`, `kid_sessions`). Nothing to set up in the
  Cloudflare dashboard. Apply it right after the deploy: until then the
  profile editor's Kid login part says to apply it, and deleting a profile or
  changing one to adult fails.
- **The 30 login pictures:** `src/content/login-pictures.js` (ids and names,
  copied to `public/lib/` for the app), drawn as `lp-<id>` symbols in
  `public/icons.svg` in the ingredient icons' style. Egg and pepper reuse those
  icons; the rest are new. In the app they sit on light tiles, so they read in
  the dark theme too.
- **Server:** kid sessions in `auth.js` (cookie `cpr_kid`, hashed in
  `kid_sessions`; logging in as one kind ends the other on that device).
  `kidlogin.js` has the kid's log in and the parent's controls: which pictures
  are taken for a name, set up, change name or picture, change password, log
  out everywhere, turn off. A route is open to a kid session only if it's
  registered with `{ kid: true }`; dispatch refuses every other route with
  "Ask a grown-up." before its handler runs, and the kid routes check the
  profile is the kid's own (`ownProfile`). `/api/profiles` gives a kid's device
  only names and avatars for the others. A cook a kid's device isn't on is
  refused (403), and the app keeps it on the device for a session that can send
  it. Changing a profile to adult or deleting it removes its login.
  `kid_sessions` is never in a family's export.
- **Grown-up step on a kid's device:** Ask a grown-up to start takes the PIN
  and sends it with that one approval; it never unlocks the PIN on the device.
- **App:** Log in has a **Grown-up / Kid** choice (remembered on the device);
  Kid is name, a picture grid, and password. A kid's device opens straight to
  that kitchen, and every other address goes back to it. No lockers link, no
  Suggest a fix, and a Log out (no PIN) beside the theme and sound buttons. A
  logged-out kid's device opens on the kid's Log in. The profile editor has a
  **Kid login** part for kid profiles: **+ Give Ava a login** opens a dialog
  (first name from the profile, last initial from the family name, the
  pictures with taken ones dimmed, the password twice with Show), then it shows
  "Ava C" and the picture, how many devices, Change name or picture, Change
  password, and a "⋯" with Log out everywhere and Turn off login.
- Plan: Phase 5b marked built.
- Tests: 232 (10 new: the pictures and name matching, set up and log in,
  uniqueness across families, adult profiles and the PIN, every allowed and
  refused route with the kid's own profile and a sibling's, cooks and
  reflections, the PIN-approved start, switching kinds on one device, each thing
  that ends a kid's sessions, and the export). Checked in a browser at phone
  width on two devices: the parent sets up a login; the kid logs in (dark
  theme), lands in the kitchen, is sent back from the parent screens, the
  lockers, and a sibling's kitchen, and starts an off-path lesson with the PIN;
  the parent changes the password and the kid's device is logged out.

## 92. 2026-10-23 — Kid logins last 14 days; "adult," not "grown-up"; ages 10 and up

- **Owner ruling: a kid login lasts 14 days and renews each time the app is
  opened.** The kid cookie's life is 14 days (was 400, like a parent's).
  Opening the app asks `/api/me`, which for a kid session starts the 14 days
  again: the session's `last_seen` and the cookie (`renewKidSession` in
  `auth.js`). A kid session unused for more than 14 days is deleted the next
  time it's read, and the device shows the kid's Log in. Parent logins are
  unchanged.
- **Owner ruling: say "adult," not "grown-up."** Every kid-facing line: Ask an
  adult to start, You asked an adult, "Ask an adult." when a kid's login is
  refused, the login's wrong-details and forgot lines, the safety notes in the
  player ("An adult stays in the kitchen for this step"), and the Log in
  screen's **Adult / Kid** choice. The plan says so in §5.1.
- **Owner ruling: the target age is 10 and up** (it was 11–12). The plan's §5.1
  and the syllabus description (§6.16 and `/syllabus`) say so.
- Tests: 233 (one new: the 14 days, a launch on day 13 renewing it, and a
  session unused for 15 days logged out). Checked in a browser at phone width:
  the Adult / Kid choice and Ask an adult to start, with the two-device run
  from 91 passing again.


## 93. 2026-10-23 — Unit 1 finished: lessons 2a through 5

Content fill (Phase 7) goes on with the rest of Unit 1, at the owner's
request: one commit per lesson, each checked in the lesson preview before
the next was started.
- **2a Fattoush** (`fattoush`): parsley and mint chopped fine by rocking the
  knife with the tip on the board; pita squares toasted at 400°F; a whisked
  lemon-sumac dressing; the pita goes in last. Swaps: lemon zest for sumac
  (availability), corn tortillas for pita (gluten). 40 minutes.
- **2b Chimichurri steak** (`chimichurri-steak`): parsley and garlic chopped
  fine; the sauce sits while a patted-dry sirloin is seared to 145°F, rested,
  and sliced across the grain. Callback to 1b's sear. 45 minutes.
- **2c Tuna salad sandwiches** (`tuna-salad-sandwiches`): celery and pickles
  cut into sticks, then across into tiny bits; tuna pressed dry. No-cook.
  Swaps: gluten-free bread (gluten), Greek yogurt for mayonnaise (egg).
  25 minutes.
- **3a Pico de gallo + Baja fish tacos** (`fish-tacos`): dicing as planks,
  sticks, cubes; tomatoes seeded so the pico isn't watery; an onion cut toward
  its root. Spiced cod broiled to 145°F without flipping. Swap: tilapia or
  another white fish. 50 minutes.
- **3b Ratatouille** (`ratatouille`): five vegetables diced, round ones halved
  flat side down first; the eggplant browned alone, then everything simmered
  lid on, then lid off to thicken. 70 minutes.
- **3c Minestrone** (`minestrone`): onion, carrots, celery, and zucchini
  diced, carrots smaller; a soffritto, then tomatoes, broth, and cannellini,
  with small pasta near the end. Swap: gluten-free pasta. 60 minutes.
- **4 Chicken Caesar** (`chicken-caesar`): bread cubed and baked into
  croutons; chicken browned, then cooked with the lid on to 165°F; the dressing
  is on a store mayonnaise base (pasteurized eggs, per §3), with the oil
  whisked in slowly. Worcestershire is optional, so a fish-free family keeps
  the lesson. Callback to 3a. Swaps: gluten-free bread, Greek yogurt for
  mayonnaise. 50 minutes.
- **5 Smash burgers + quick pickles** (`smash-burgers`): cucumbers sliced thin
  into a warm brine; onion sliced paper thin; loose balls of beef smashed
  through parchment and seared to 160°F, 3 at a time, with a wash step after
  each batch of raw beef. Cheese is optional. Callback to 1b. Swap:
  gluten-free buns. 60 minutes.
- **All eight are written for 6 servings** (§2.2). 1a–1c are written for 4
  and weren't changed.
- **Callbacks name one lesson.** When a skill comes from a pick-one group, the
  callback points at the group's first dish (1b, 3a) and is worded so it reads
  right whichever one the family cooked.
- **Registries:** 37 new ingredients (romaine, tomatoes, radishes, lemons,
  sumac, sirloin, ground beef, cod, tilapia, canned tuna, mayonnaise, Greek
  yogurt, Worcestershire, parmesan, broth, beans, pasta, breads, and more),
  each with its store section and package. Every animal product is from a
  clean species. Gluten-free bread and buns are tagged egg, since many
  contain it. 4 new tools: aluminum foil, spoon, ladle, and a large heavy pot.
- **Course outline:** the eight dishes carry their real times instead of
  estimates.
- Not test-cooked. No intro slides yet (warned, as for the others).
- Tests: 233 (no new ones; the linter checks every new lesson).
