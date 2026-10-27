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

## 94. 2026-10-23 — The lesson preview doesn't say a thermometer step locks

- **Owner ruling, restated:** a thermometer check never locks a step. The
  lesson preview said "Must reach 145°F on the thermometer before Next
  unlocks" under every doneness step, which wasn't true: §3 says the app
  doesn't require a reading, and the player shows only the target. The
  preview now says "Thermometer: at least 145°F", the same as the player.
  The lesson files were already right; only `tools/preview-template.html`
  and the rebuilt preview changed.
- Tests: 233.

## 95. 2026-10-23 — Plan: Chef Ruth, the helper, and the first run as her task

- **Owner rulings:**
  - The helper is **Chef Ruth**, with the owner's picture
    (`content/images/brand/chef-ruth.png`; a 256 px web copy at
    `public/img/chef-ruth.webp`, the white around the badge made clear).
  - **Her most useful job is collecting information** the app keeps on
    several pages, in one chat.
  - **The first-run wizard is one of her tasks** (Getting started), not its
    own flow.
  - **Parent screens first;** Chef Ruth in the kitchen can wait.
- **§6.8 rewritten** from KennelOS's Kels (End-State guide §33, the Kels
  roadmap). Recommendations, to confirm before building: scripted, not AI;
  saves through the pages' own API calls and shared rules; a floating **Ask
  Chef Ruth** button on every parent screen; Doing something first, then
  Finding and Understanding something; one thing at a time, saved as
  answered, with a draft and a review for tasks that make something new; her
  voice and opening lines. Her first tasks: Getting started, Add people to our
  family, Set up our learning path, Plan this week, and Our diet and kitchen,
  each listed with the pages it saves to.
- **§6.9 is now Getting started.** Recommendation: the family name and PIN
  screen stays first and required, then a one-time Meet Chef Ruth card; the
  parent tour can become her Understanding something. The profile intro stays
  with the kitchen, for later.
- **§9 Phase 8** is Chef Ruth on the parent screens. §5.4's helper rows and
  §6.10 name her.
- Nothing built yet. Tests: 233.

## 96. 2026-10-23 — Plan: Chef Ruth's first lines

- **Owner's wording** for Chef Ruth's first message ("Hi, I'm Ruth, your Clean
  Plate guru! …") and for Getting started's opening to a new family ("Since
  you're a new user, I'm going to get you all set up! …"), in §6.8 and §6.9.
- A new family's first visit to her goes straight from her first message into
  Getting started, which ends with the first recipes in each kid's queue.

## 97. 2026-10-23 — Plan: Getting started opens on its own and can't be skipped

- **Owner rulings** (§6.8, §6.9):
  - A new family goes **straight into Chef Ruth's chat** after sign-up. She
    floats on the empty locker screen, and **the family name and parent PIN
    are her first questions**, replacing the "Your family" screen.
  - **Getting started can't be skipped:** no Never mind, no Maybe later card.
    Answers are kept if the app closes, and she picks up where she stopped.
    The lockers and parent screens open once it's done.
  - Her button says **Chef Ruth**.
- Still to confirm: optional settings answered with **None for now**; her
  other first tasks and their order; the parent tour as her Understanding
  something.

## 98. 2026-10-23 — Plan: what Getting started asks

- **Owner rulings** (§6.9): Getting started asks only what's required, in
  this order: family name and PIN, default servings, allergies and diet, the
  profiles (kid or adult, one person or shared), a login for each kid if the
  parent wants one (set up right there), casual or homeschool, then an offer
  to set up a course: who it's for, an optional name, the start date, and
  lessons per week, with a line that the course can be edited to reorder or
  drop lessons. Kitchen staples, another parent's login, and other optional
  settings are left out.
- **Owner ruling, for all her tasks** (§6.8): before each question, Chef Ruth
  says in one short line what it's for (a profile can be shared by several
  kids; each kid can have their own even if they cook together); after the
  answer, she says where to change it later.
- Recommendations added, to confirm: in casual mode a yes to the course turns
  on Plan our weeks; the test-cook warning becomes one of her lines.

## 99. 2026-10-23 — Plan: a first lesson when there's no course

- **Owner ruling** (§6.9, step 8): a family that doesn't set up a course is
  offered a first lesson by hand. Chef Ruth asks Chicken, Beef, Fish, or
  Vegetarian, then offers the first matching lesson in course order with its
  number, name, and description. A no gets the next match; a second no gets
  "no problem" and where to add lessons themselves.
- Recommendations, to confirm: only written lessons the diet filters allow;
  "matching" is by the main protein in the required ingredients (vegetarian:
  no meat or fish); the lesson goes to every learner.

## 100. 2026-10-23 — Chef Ruth's Getting started

- **Owner rulings:** a yes to a course in casual mode turns on Plan our weeks;
  the vegetarian first lesson is fattoush, not shoestring fries (sides aren't
  offered); her last lines are "Great, you're ready to get cooking!" and the
  beta reminder, in the owner's words, in place of the test-cook notice.
- **Built** (`public/ruth.js`, `src/worker/setup.js`,
  `src/content/getting-started.js`): a new family lands on the empty lockers
  with Chef Ruth's chat open over them. It has no close button. She asks, each
  with a line on what it's for and, after, where to change it: family name and
  PIN, default servings, allergies and diet, learners (a roster, shared or
  not, kid or adult), a login for each kid if wanted, casual or homeschool,
  then a course (who, an optional name, the start date, lessons per week) or,
  without one, a first lesson by chicken, beef, fish, or vegetarian (two
  offers, then where to add one). Every answer saves through the pages' own
  routes. If the app closes, she picks up at the next part; a PIN that ran out
  is asked for in the chat, with Forgot PIN.
- **Her button** ("Chef Ruth", her picture) floats on the setup screen and on
  every parent screen. From a parent screen it opens her chat with **Getting
  started (change your setup)**, which walks through it again with the
  current answers filled in (the PIN stays on Logins & PIN).
- **Migration 0014** (`families.setup_step`, `families.setup_done_at`). A
  family that set its PIN before it is marked set up. Until the owner applies
  it on `/ops`, sign-up keeps the old family-name-and-PIN screen.
- **First lessons:** each lesson's main protein is worked out at build time
  (`mainProtein`), and `content/course.json` marks the 16 sides, breads, and
  desserts `"meal": false` (the linter checks the flag). `GET
  /api/setup/starters?kind=` lists the matches the family's diet filters allow.
- A kid's last initial is guessed from the family name without a leading
  "The" ("The Carsons" is C), on the login dialog too.
- Tests: 241 (8 new: the parts' order, the protein rule, today's first offers,
  the routes and their PIN check, the diet filters, and a family from before
  0014). Checked in a browser at phone and desktop width: a casual family with
  a shared profile, a kid login, and fattoush declined for ratatouille; and a
  homeschool family with a course, closed partway with the PIN locked.

## 101. 2026-10-23 — Chef Ruth's Show me around

- **Owner ruling:** a second flow, apart from Getting started, that shows
  every parent screen and explains how to use it, starting with the Queue.
  She steps aside for 4 seconds on each screen, then pops back.
- **Built** (`public/ruth.js`): **Show me around** in her menu. For each
  screen, in the Menu's order (Queue, Shopping, Progress, Our recipes,
  User-shared recipes, Courses, Profiles, Family settings, Logins & PIN, then
  the owner's four for the owner): a line on what it's for, the screen with
  her chat tucked away (her button brings her back early), then how to use
  it, with Next, Show me again, and Stop the tour. Her explanations use the
  screens' real button names.
- It's the parent tour §6.9 asked for; §6.8 and §6.9 say so.
- Tests: 242 (one new: the tour covers every parent screen in `PARENT_PAGES`,
  starts with the Queue, and keeps the owner's screens for the owner).
  Checked in a browser at phone width: the Queue stop, Shopping with her
  button tapped early, and Stop the tour.

## 102. 2026-10-23 — Didn't make it

- **Owner ruling:** a way to remove a dish a kid marked done but didn't make.
  Most kids will do a test run on the couch.
- **Built:** **Didn't make it** on each row of **Parents → Progress**
  (parents only, behind the PIN), with a confirm naming everyone on that cook,
  then a done-message with **Undo**. The button is left off the printout.
- **How it works:** removing is a soft delete. `POST
  /api/attempts/:id/remove` sets `attempts.removed_at`, and the queued lesson
  the cook closed goes back to assigned. Every read that counts cooks skips
  removed ones: a profile's cooks (kitchen, stamps, ranks, skills), Print our
  progress, a course's finished lessons, and the knife-lesson note. `POST
  /api/attempts/:id/restore` clears it and closes the queued lesson again,
  the way finishing it did (not on the Sabbath). A retry of the cook from the
  kid's device doesn't bring it back, since a finished cook isn't changed.
- The whole cook comes off, for everyone on it, since a shared cook is one
  cook. Its reflections are kept, so Undo loses nothing.
- **Migration 0015** (`attempts.removed_at`). Until the owner applies it on
  `/ops`, Progress and the kitchen fail to load, so apply it right after the
  deploy.
- Chef Ruth's Show me around mentions it on the Progress stop. Plan §6.15 and
  §8.4 say so; setup check-it 15.
- Tests: 243 (one new: remove and Undo, across profiles, the queue, Progress,
  a resent cook, another family, and the PIN). The migration-count tests now
  expect 15.

## 103. 2026-10-23 — Chef Ruth talks one line at a time

- **Owner ruling:** she's a person in a chat. Typing dots for a second or so
  before each message, never more than one message at once, and the chat
  scrolls with each new one. Worst before this in Show me around: coming back
  from the Queue, five messages landed at once and the parent was left at
  the bottom.
- **Built** (`public/ruth.js`, `public/app.css`): `say()` now queues her line
  instead of showing it. Each line waits a half beat (0.5s), shows three
  bouncing dots in her bubble (0.7 to 1.6s, longer for longer lines), then
  the message, and the chat scrolls smoothly to it. Her buttons (`choose`),
  forms (`ask`), and stepping aside for a tour stop (`peek`) wait until she's
  finished talking. No script changed: every task still calls `say()` the
  same way. The dots are labeled "Chef Ruth is typing" for screen readers
  and hold still with reduced motion.
- Plan §6.8 says so.
- Tests: 243, unchanged. Checked in a browser at phone width: her menu, then
  Show me around through the Queue stop, counting messages every half second
  (one at a time, dots between, buttons only after the last, scrolled to the
  bottom).

## 104. 2026-10-23 — Chef Ruth's tour: another look, and one flow at a time

- **Owner question:** why Chef Ruth showed owner screens. Answer: by design.
  Show me around adds the four owner screens only for the owner's login, and
  the owner was signed in as the owner. Nothing changed for that.
- **Owner ruling: one flow at a time.** While she's in one flow, she doesn't
  show the button to start the other. Before, finishing or stopping Show me
  around put her menu back up, with Getting started on it. Now the tour ends
  with **Thanks, Chef Ruth!**, which closes her chat; her button opens the
  menu again. Getting started run from her menu already ended this way.
  **Never mind** at the start of the tour still goes back to her menu, since
  no flow has started.
- **Owner ruling: Let me see it again.** It replaces **Show me again** on
  each tour stop. Before, Show me again stepped aside for 4 seconds and then
  repeated every how-to line. Now she steps aside for 10 seconds so the
  parent can click around (her button still brings her back sooner), then
  comes back and asks "Ready to see the next screen?" ("Ready to finish the
  tour?" on the last stop), with Next, Let me see it again, and Stop the tour.
  The how-to lines aren't repeated.
- **Built** in `public/ruth.js` (`showMeAround` and her menu in `openRuth`).
  Plan §6.8 says so.
- Tests: 243, unchanged. Checked in a browser at phone width, with her
  script on a stubbed app: the menu, the tour through two stops, Let me see
  it again (back after 10.0s, then "Ready to see the next screen?"), her
  button bringing her back early, then Stop the tour (only Thanks, Chef Ruth!
  shown, and it closes her chat).

## 105. 2026-10-23 — Chef Ruth's buttons in the chat, and a one-time Getting started

- **Owner ruling: her buttons are part of the chat.** Before, her answer
  buttons and forms sat in a bar pinned to the bottom of her panel. Now they
  sit right under her last message, on the parent's side like a reply,
  outlined in the accent color with a chat-bubble corner, and scroll with
  the chat. A form (a PIN, a kid login) is a card across the chat. Built in
  `public/ruth.js` (`chatPanel`: the panel is the last thing in the chat log,
  and each line lands above it) and `public/app.css`.
- **Owner ruling: Getting started is one-time.** Run again from her menu, it
  was always offered. Now **Getting started (change your setup)** leaves her
  menu once the family has a lesson in the queue (assigned or shopped, or
  cooked from the queue) or a finished cook that wasn't taken back with
  Didn't make it. `/api/me` reports it as `family.cooking` (parents only),
  and her menu asks for `/api/me` again when it opens, so it's current. A
  removed or declined lesson doesn't count. Until migration 0015 is applied
  on `/ops` it reads as not cooking, so the button stays. A new family's
  required Getting started isn't affected.
- Plan §6.8 and §6.9 say so; README updated.
- Tests: 244 (one new: the flag across queuing, removing, an unfinished and
  a finished cook, Didn't make it, and another family). Checked in a browser
  at phone width on a stubbed app: the buttons are inside the chat log,
  under her line, and her menu shows Getting started only when not cooking.

## 106. 2026-10-23 — Longer looks on the Show me around tour

- **Owner ruling: Chef Ruth steps aside longer.** On each tour stop she now
  steps aside for 8 seconds (was 4), and **Let me see it again** steps aside
  for 15 seconds (was 10). Her button still brings her back sooner. Built in
  `public/ruth.js` (`chat.peek` default and `showMeAround`). Plan §6.8 says
  so.
- Tests: 244, unchanged.

## 107. 2026-10-23 — Main quest shows the whole path, and the kitchen intro's first copy

- **Owner ruling: Main quest / My journey shows the whole path, by week.**
  Before, it showed what was queued, then only the next three lessons on the
  path, so kids never saw the whole course. Now this week and next show
  open: what's queued (a lesson with no date counts as current; one a parent
  dated, by its date's week), then the course's lessons scheduled for next
  week. Everything later, including lessons a parent dated further out, is
  under a **See more** expander, in path order, remembered open or shut for
  this tab. A profile without a course schedule has no weeks, so its whole
  path is under See more.
- `GET /api/profiles/:id/queue` now returns `week` (this week's Sunday) and
  `weeks` (the week each course lesson still to cook falls in; null without a
  schedule). Built in `src/worker/plan.js` and `pathView` in `public/app.js`.
- **The kitchen intro (plan §6.9, the profile intro) is being planned.** The
  owner's copy so far (the three tabs, and asking to cook) is in §6.9. Not
  built yet.
- Plan §6.1 and §6.9 say so; README updated.
- Tests: 244, two checks added to existing tests (the weeks for a course
  profile, and none without a schedule). Checked in a browser at phone width
  on a test family: a course profile showed this week's lesson and a
  parent-dated one next week open, next week's course lesson under Coming up
  on your path, and a lesson dated three weeks out plus later course lessons
  under See more (3); a profile with no course showed its 15 path lessons
  under See more.

## 108. 2026-10-23 — The kitchen intro, and the Passport rank ladder on phones

- **Owner ruling: the kitchen intro is cards, with Chef Ruth's picture.**
  Twelve cards over the kitchen, drawn in the profile's theme: a welcome,
  the three tabs, asking to cook (Cook this on an adult profile), one card
  per cook stage (the lesson card, Learn, Prep, cook mode, Plate it),
  something looks wrong (kids tell an adult; adults get Suggest a fix), and
  "You're ready!". Back, Next, and Skip on each, with dots for where you are.
  The tab and asking-to-cook copy is the owner's; the rest is a draft.
  Kitchen Quest's Skill tree card says "crests", the word on that screen.
- **Screenshots with boxes.** Each card but the first and last shows the
  real screen at phone width in the profile's theme, with boxes drawn by the
  app around the parts it's about (numbered on cook mode, to match its
  lines). `tools/intro-shots.js` takes them in a session: it makes a test
  family on the in-memory database, opens each screen, measures the parts,
  and writes `public/img/intro/*.webp` (22 images, about 740 KB, loaded only
  when the intro opens) and `public/intro-shots.js`.
- **When it opens (owner ruling).** Once, on its own, for a profile with no
  cooks that hasn't finished or skipped it. **How it works** at the top of
  the kitchen replays it. No "try it" taps for now.
- **Migration 0016** adds `profiles.intro_seen_at`; apply it on `/ops`.
  Until then the intro doesn't open on its own (How it works still works).
  `/api/profiles` reports `intro` ('new' or 'seen'), and
  `POST /api/profiles/:id/intro` marks it seen (a kid's own login too).
  Nothing destructive was added, so there's nothing new to restore.
- **Fix: the Passport rank ladder on phones.** With large text, "Kitchen
  Apprentice" ran into "Prep Cook". On screens up to 560px wide the six
  ranks are now two rows of three, and a long word wraps instead of
  overlapping. Built in `public/themes.css`.
- Built in `public/intro.js`, `public/app.js` (`kitchen`),
  `public/themes.css`, `src/worker/api.js`. Plan §6.9 says so; README
  updated.
- Tests: 247 (three new: every card's screenshot in both themes, kid and
  adult, with a numbered box per line; the buttons the cards name are still
  in the app; the intro flag, and another family can't set it). Checked in a
  browser at phone width: all twelve cards in both themes, the intro gone
  and marked seen after the last card, How it works replaying it, and the
  ladder in two rows with large text.

## 109. 2026-10-23 — The intro's progress card says badges

- **Owner ruling: badges, in both themes.** The kitchen intro's Skill tree /
  Passport card now reads, for every theme, "This is where you track your
  progress. As you cook, you'll earn badges and rank up." Before, Kitchen
  Quest's said "crests" and Chef's Passport's said "stamps and skill pins".
  Badges is a word kids know; the screens keep their own names (crests,
  skill pins, stamps). Built in `public/intro.js`. Plan §6.9 says so.
- Tests: 247, unchanged.

## 110. 2026-10-23 — The PIN locks on its own; Lockers and Sign out in the Menu

- **Owner ruling: no Lock button.** The parent screens' top bar had
  **Lockers**, **Lock**, and **Log out**. Lock is gone: leaving the parent
  screens (to the lockers, a kitchen, anywhere else) locks the PIN on its
  own. The app opening anywhere but a parent screen while still unlocked (a
  tab closed on a parent screen) locks it too. Not during Getting started,
  which needs the PIN. Built in `route` in `public/app.js`.
- **Owner ruling: Go to Lockers and Sign out are in the Menu,** as
  top-level commands below the screen groups. The top bar now has only the
  Menu button and the app's name. Built in `parentMenu` in `public/app.js`
  and `public/app.css`.
- Plan §5.7 and §8.3 say so; README updated.
- Tests: 247, unchanged. Checked in a browser at phone width: the Menu with
  the two commands under the groups; Go to Lockers locked the PIN, and
  opening a parent screen asked for it again; Sign out signed out.

## 111. 2026-10-23 — Plan: the content editor

- **Owner ruling: the owner keeps the content up to date from the browser,
  with no session.** Plan §7.5 is new: units, lessons (add, edit every part,
  add, remove, and reorder steps, move to another unit or position, hide),
  the registries, the food rules, and pictures, all edited on the owner
  screens and saved into the `content/` files themselves. A save is checked
  by the linter's rules in the Worker, committed to a `content-edits` branch
  through the GitHub API, then built, linted, tested, and moved to `main` by
  a workflow, and deployed. Every save has History and Revert.
- **Owner ruling: the owner's call on an ingredient is the final word.** She
  marks ingredients clean or unclean and edits the clean-species list,
  blocked words, and allowed phrases; the scan flags things for her. The
  §2.1 checks themselves can't be turned off.
- Why: lesson patches (§6.11) covered only small fields on top of the files,
  and everything bigger waited on a session. §6.11's "bigger changes" and
  §6.10's "made in a session" lines now point at the editor; §6.2a lists it;
  §9 adds Phase 10. Replacing patches with the editor in fix requests is
  marked a Recommendation until the owner confirms.
- Owner setup before it can save: a fine-grained GitHub token, set as the
  `GITHUB_TOKEN` Worker secret on the Cloudflare dashboard.
- Nothing built yet. Tests: 247, unchanged.

## 112. 2026-10-23 — Plan: the content editor moves to its own manager section

- **Owner ruling: the content editor is a manager section at `/manage`**, its
  own app at its own address, not on the owner screens. It has its own
  sign-in screen, and only the owner's login opens it. Nothing in the family
  app or the owner screens links to it. Plan §7.5 and §9 (Phase 10) say so;
  the §6.2a line entry 111 added is removed.
- A subdomain was offered and not chosen: `/manage` needs no setup on the
  Cloudflare dashboard.
- Nothing built yet. Tests: 247, unchanged.

## 113. 2026-10-23 — Plan: course plans and fix requests under the content editor

- **Owner rulings.** A new lesson joins every family's existing course plans,
  included, at its place in the order. A hidden lesson comes out of every
  course plan as well as the library. A fix request's **Apply** opens the
  editor with the suggestion filled in, replacing lesson patches. Plan §7.5
  and §6.11 say so; §6.11's line is no longer a Recommendation.
- Nothing built yet. Tests: 247, unchanged.

## 114. 2026-10-23 — The manager section: the owner edits the content from the browser

Phase 10 (plan §7.5), built.

- **The manager section at `/manage`** (`src/worker/manage.js`,
  `public/manage/`): its own sign-in and cookie (`cpr_manage`, path
  `/manage`), opened only by the owner's login; table `manage_sessions`
  (migration 0017).
  - **The course:** units (add, rename, reorder, remove when empty, with
    every unit number rewritten across units.json, course.json, and the lesson
    files), lessons (add blank or as a copy, write a planned dish, move to
    another unit or place, nudge up and down, hide and unhide, edit a planned
    dish's card).
  - **The lesson editor:** a form built from `content/schema/lesson.schema.json`
    by `public/manage/form.js`, so every field gets a control, folded to one
    line per step, ingredient, or card; the dish card; the picture (made a
    PNG in the browser); History with Load this version. Ids for new steps
    and why cards are made from their words.
  - **Lists and rules:** ingredients, tools, skills, kitchen words,
    cuisines and regions, from the registries schema; the food rules (clean
    animals, fat-blocked animals, allowed products, blocked words, allowed
    phrases, leaven, the kitchen-word watch list).
  - Changes are staged in the browser until **Review and save**, and the
    content linter runs in the browser as the owner edits
    (`lint.js`, `validate.js`, `load.js`, `format.js` added to `public/lib/`).
- **Saving** (`src/worker/github.js`): the Worker checks the content with
  the save on it, refuses only problems the save brings, and commits the
  changed files to the `content-edits` branch through the GitHub API
  (`GITHUB_TOKEN` secret, `GITHUB_REPO` variable). A file changed on GitHub
  since the editor opened it is refused, never overwritten. A lesson's
  version goes up when its steps or ingredients change. Each save is a row in
  `content_saves`, with **Undo** (a new save putting the files back) and a
  status: Checking, Publishing, Live, Failed with GitHub's reason, or
  Replaced.
- **Publishing** (`.github/workflows/content-publish.yml`): on a push to
  `content-edits`, merges `main`, rebuilds the generated files and any new
  picture's web copy, lints, tests, and pushes to `main`; on a failure it
  comments the reason on the save's commit and leaves `main` alone.
  `content.yml` no longer runs on `content-edits`.
- **Hidden lessons** (`content/hidden.json`): `tools/build-library.js`
  leaves them out of the library, the course, its numbers, and the seasonal
  units, so they leave every family's course plan; their lesson files are
  still built. The linter checks the list names real lessons.
- **One content layout** (`src/content/format.js`, `tools/format-content.js`):
  every content file except the schemas was rewritten into it once, so a save
  from the browser changes only the lines it changes; a test keeps them in it.
- **One content loader** (`src/content/load.js`): the command-line tools,
  the Worker, and the browser read the content files the same way.
  `src/worker/content-data.js` now carries every content file, its git id,
  and the picture list.
- **Faster unclean-word scan** (`src/content/rules.js`): its patterns are
  built once per list. The linter takes `renderOnly`, so a save renders only
  the lessons it changed; a save's check takes about 40 ms.
- **Fix requests** (owner ruling): **Apply in the manager** on the owner
  screens opens the lesson with the suggestion filled in; saving marks the
  request fixed with the owner's note. A lesson patched before this opens
  with its patches on, and saving writes them into the file; the patches
  stop applying once that file is live. Older patches keep Revert.
- `/ops` shows whether GitHub is connected. The demo and syllabus pages find
  Desserts by its name, not by unit 7.
- **Owner steps** (`docs/setup.md`, *The manager section*): make a
  fine-grained GitHub token (Contents read and write, Actions read, this
  repository), set it as the `GITHUB_TOKEN` secret on the Cloudflare
  dashboard, and press **Apply pending** on `/ops` (migration 0017).
- Tests: 261 (14 new in `test/manage.test.js`, against a stand-in GitHub in
  `test/helpers/github.js`). Checked in a browser at phone width against the
  stand-in GitHub (`DEV_GITHUB=1` on `tools/dev-server.js`): sign-in, the
  course, editing a step and saving, adding a unit and a copied lesson with a
  picture, moving and hiding lessons, the checks catching a missing picture
  and a split pick-one group, History, and Undo. The publish workflow itself
  runs only on GitHub, so it is first exercised by the owner's first save.

## 115. 2026-10-23 — One schema file, and a fresh database

The owner is clearing the database and signing up again, so the seventeen
migrations were squashed into one.
- **`src/worker/migrations/0001_schema.sql`** builds every table the app keeps:
  families and sign-in, profiles and kid logins, cooks, fix requests and
  patches, the queue and courses, shopping, family recipes and sharing, and
  the manager section. Columns that later migrations added are in their
  tables now, with their notes beside them. 0001_families.sql through
  0017_manage.sql are gone. A check against a database built from the old
  files found the same 53 tables and indexes, with the same columns.
- **Content stays in files.** The owner asked about one table per list
  (lessons, with recipes split by unit, and ingredients). That was talked
  through and dropped: lessons and ingredients are repo files the manager
  section edits (plan §7, §7.5), so a new recipe already needs no migration,
  and a table per unit would have needed one for each new unit.
- The two tests that checked old data fixes (0005 renaming lesson ids, 0014
  marking families set up) went with their migrations; the /ops tests expect
  one pending migration. Tests: 259, all passing. `docs/setup.md` no longer
  names migration numbers, and has *Starting over with an empty database*.
- **Owner steps:** once this deploys, on `/ops`: **Clear everything**, then
  **Apply pending**, then sign up again and make yourself the owner. A
  download made before this reset is at schema version 0017 and can't be
  restored into the new schema.

## 116. 2026-10-23 — Fix: /manage stuck in a redirect loop

- **Fix: `/manage` didn't open.** For any page under `/manage/` the Worker
  asked Cloudflare's assets for `/manage/index.html`, and Cloudflare answers
  that with a redirect back to `/manage/`, which reached the Worker again, so
  the browser gave up after too many redirects. It now asks for the folder,
  `/manage/`, which Cloudflare serves. Built in `handleManage` in
  `src/worker/manage.js`.
- `tools/dev-server.js` now redirects a `…/index.html` request to its folder
  the way Cloudflare does, so a loop like this shows up when the app is
  checked in a session. Checked there: the old code redirected without end,
  and the fixed code opens the manager's sign-in after the one redirect from
  `/manage` to `/manage/`.
- Tests: 259, unchanged in number (the test that pages are served at
  `/manage/` now expects the folder).

## 117. 2026-10-23 — Unit 2 begins: lessons 6a through 8b

Content fill (Phase 7) moves to Unit 2, at the owner's request: the first
five lessons in course order that weren't written yet (8a Shakshuka was
already a sample).
- **6a French-style omelet** (`french-omelet`): eggs whisked smooth, then one
  omelet per person in an 8-inch nonstick pan over medium-low: butter foams,
  stir to soft curds, stop, let it set, roll it out seam side down. Lifting
  the pan off the burner is taught as the fast way to turn the heat down.
  Checked at 160°F (§3), so it's soft but set, not runny. 35 minutes.
- **6b Grilled cheese + tomato soup** (`grilled-cheese-tomato-soup`): the
  soup simmers 20 minutes, then cools 5 and is blended with a stick blender;
  meanwhile sandwiches are cooked 2 at a time over medium-low, lid on for the
  first side. Callback to 3b's simmer. Milk is optional. Swap: gluten-free
  bread. 55 minutes.
- **6c Challah French toast** (`challah-french-toast`): day-old challah,
  1 inch thick, soaked 20 seconds a side (turned with a fork, so hands stay
  off raw egg) and cooked on medium-low; checked at 160°F in the middle, with
  a wash step after the custard is made and again at cleanup. Swaps:
  gluten-free bread, oat milk, and oil for butter. 40 minutes.
- **7 Crispy hash browns** (`hash-browns`): grated into cold water, rinsed
  clear, squeezed dry in a towel, then cooked in two batches without
  stirring and flipped in wedges. Callback to 6a's heat control. Swap: oil
  for butter. 45 minutes.
- **8b Spaghetti marinara** (`spaghetti-marinara`): onion, then garlic, then
  crushed tomatoes simmered 20 minutes; salted pasta water (not scaled down,
  so the pot is always full enough), a cup of it saved, and the spaghetti
  tossed in the sauce. Callback to 3b's simmer. Parmesan is optional. Swap:
  gluten-free spaghetti. 50 minutes.
- **All five are written for 6 servings** (§2.2). Crushed tomatoes scale by
  the half can, so a small batch doesn't call for a whole 28-oz can.
- **Registries:** 7 new ingredients (chives, whole milk, oat milk, challah,
  maple syrup, spaghetti, gluten-free spaghetti); challah is tagged gluten and
  egg. 3 new tools: an 8-inch nonstick skillet, a stick blender, and a butter
  knife.
- **Course outline:** the five dishes carry their real times instead of
  estimates. Skills are as the outline had them; 6a is still tagged
  `poaching-eggs`, which now gives 8a a "no callback" warning.
- Not test-cooked. No intro slides yet (warned, as for the others).
- Tests: 261 (no new ones; the linter checks every new lesson).

## 118. 2026-10-23 — Unit 2 goes on: lessons 8c through 12

- **Owner ruling:** the French-style omelet (6a) doesn't teach poaching eggs.
  `poaching-eggs` is off it in `course.json` and the lesson file, so
  shakshuka (8a) is again the first lesson with that skill and needs no
  callback.
- Five more Unit 2 lessons, in course order:
  - **8c Honey-garlic chicken** (`honey-garlic-chicken`): thighs cut and
    tossed in cornstarch, browned in two batches, then glazed in honey, soy,
    rice vinegar, garlic, and ginger bubbled down until sticky; 165°F. Rice
    cooked on the stove alongside. Swap: tamari. 45 minutes.
  - **9 Chicken fried rice** (`chicken-fried-rice`): rice cooked the day
    before; everything cut before the stove goes on; egg scrambled and set
    aside (a look check: no wet egg), diced chicken to 165°F, then the rice
    spread, left, and tossed. Soy sauce poured around the pan's edge. No
    oyster sauce. Callback to 3a's dicing. Serves up to 8. Swap: tamari.
    35 minutes.
  - **10 Oyakodon** (`oyakodon`): onion and chicken simmered in chicken
    broth, soy, mirin, and sugar (chicken broth in place of dashi, §4);
    lightly beaten eggs poured over and set under a lid to 160°F, over rice.
    Callback to 3b's simmer. Swaps: rice vinegar and sugar for mirin
    (availability), tamari. 45 minutes.
  - **11 Chicken adobo** (`chicken-adobo`): thighs patted dry and browned in
    two batches, braised in vinegar, soy, garlic, bay leaves, and
    peppercorns (no stirring until the vinegar boils), then reduced lid off
    to a glaze; 165°F; bay leaves fished out. Callback to 8a's thickened
    sauce. Swap: tamari. 75 minutes.
  - **12 Breakfast burritos** (`breakfast-burritos`): potatoes steamed then
    crisped, bulk turkey sausage to 165°F, scrambled eggs to 160°F, all in
    one pan, slowest first, with the finished parts kept under foil;
    tortillas warmed in a damp towel and rolled. Callback to 1a's rolling.
    Swaps: gluten-free tortillas, oil for butter. 50 minutes.
- **Callbacks name one lesson**, as in Unit 1, worded so they read right
  whichever dish of a pick-one group the family cooked.
- **Step amounts that scale:** steps in 8c, 9, 11, 12, and 7 now say "half
  the oil" or "the salt for the eggs" instead of a fixed spoonful, so they
  match the ingredient list at every serving size.
- **Registries:** 11 new ingredients (cornstarch, rice vinegar, mirin,
  chicken broth, frozen peas and carrots, bay leaves, whole peppercorns, bulk
  turkey sausage, shredded cheddar, burrito-size and gluten-free tortillas).
  The turkey sausage carries a casing note, and the tortillas the lard note.
- **Course outline:** the five dishes carry their real times.
- Not test-cooked. No intro slides yet.
- Tests: 261.

## 119. 2026-10-23 — Unit 2 finished: lessons 13 through 15c

- **Owner ruling:** the new tortilla and pepper entries from 118 stay as
  they are (burrito-size and gluten-free tortillas, whole peppercorns).
- The last five Unit 2 lessons:
  - **13 Cacio e pepe** (`cacio-e-pepe`): less pasta water than usual, so it's
    starchier; pepper toasted in butter; finely grated pecorino mashed into a
    paste with warm pasta water and tossed in with the heat off. Serves up to
    8. Swaps: parmesan for pecorino (availability), gluten-free spaghetti.
    30 minutes.
  - **14 Eggs Benedict** (`eggs-benedict`): hollandaise from pasteurized
    yolks (§3), whisked over simmering water to 160°F, then hot butter
    whisked in slowly and kept warm off the heat; turkey bacon; eggs poached
    4 at a time in barely bubbling water with vinegar, whites to 160°F.
    Prereq 13; callback to 13's emulsion. Swaps: smoked salmon for turkey
    bacon (meat), gluten-free bread. 60 minutes.
  - **15a Stovetop mac and cheese** (`mac-and-cheese`): a roux, milk
    whisked in a little at a time into béchamel, cheese stirred in off the
    heat. Swap: gluten-free small pasta. 40 minutes.
  - **15b Chicken and spinach crêpes** (`chicken-spinach-crepes`): crêpe
    batter rested 15 minutes (with the raw-batter tip), chicken to 165°F with
    wilted spinach, béchamel with parmesan; crêpes cooked in the 8-inch
    nonstick pan, filled, rolled, sauced, and baked at 400°F. Callback to
    6a's heat control. 80 minutes.
  - **15c Japanese chicken curry** (`japanese-chicken-curry`): the roux
    made from scratch (§4: store blocks can hold fats we don't use), cooked
    to light brown; curry powder bloomed in it off the heat, loosened with
    broth, and stirred into a pot of chicken, carrots, and potatoes; 165°F.
    Swap: tamari. 65 minutes.
- **Raw chicken cut, then cooked later** (15b, 15c): the chicken stays on
  the board, hands are washed, and the board and knife are washed after the
  chicken goes into the pan, so every raw step is followed by a wash step.
- **Kitchen word:** `roux` is now defined in `terms.json`, taught in 15a, so
  steps can use it.
- **Registries:** 8 new ingredients (pecorino, pasteurized eggs, turkey
  bacon, smoked salmon, English muffins, elbow macaroni, baby spinach,
  curry powder) and 4 tools (a heatproof bowl, a slotted spoon, a toaster,
  and a 9-by-13 baking dish). Turkey bacon's id is `turkey-strips`: the
  unclean-word check reads ids as well as names, and "turkey bacon" is
  allowed only as a phrase. Its name stays "Turkey bacon", with a note to
  pick a fully cooked package.
- **Course outline:** the five dishes carry their real times. Every Unit 2
  dish is now written.
- Not test-cooked. No intro slides yet.
- Tests: 261.

## 120. 2026-10-23 — The manager's Preview as a learner

The owner asked for a way to go through a lesson the way a learner does,
without ticking off every ingredient and without it counting.
- **Preview as a learner** (`public/manage/lesson.js`, route `#/try/<id>`):
  a button on each lesson's page in the manager, and in its ⋯ menu on the
  course. It opens the real lesson player on the lesson as it stands in the
  editor, unsaved changes included, with the editor's ingredients, tools,
  skills, kitchen words, and cuisines. Kitchen Quest or Chef's Passport, a
  kid or an adult, remembered on the device.
- **The player's preview mode** (`public/player.js`, `preview`): Enter the
  kitchen / Start cooking shows whether or not Prep is checked off; a
  "Preview · nothing is saved" strip jumps to the lesson card, Learn, Prep,
  Cook, or Reflect; the end says nothing was saved; Back goes to the lesson.
  The manager hands it no `onCook` or `onReflect`, so nothing reaches the
  server, as with the demo. Where it's up to is kept on the device under its
  own preview profile, apart from any real cook. In the manager, each new
  stage scrolls to the top of the lesson, not the top of the page.
  A new `registry` option lets the manager use its own lists.
- **The player stops on its own** when its screen is replaced without Back
  (another page, or switching the preview's theme): its ticking and voice
  stop, so a running timer can't ring from a screen that's gone. This holds
  in the family app too.
- The manager's page now loads `themes.css` and the theme fonts.
- Plan §7.5 has the feature.
- Tests: 260 (1 new: the manager's preview loads the themes and passes no
  save callbacks). Checked in a browser at phone width against the dev
  server: the omelet in both themes, Prep with nothing checked, Cook,
  Reflect, the end, and Back; the only request sent was the manager
  sign-in.

## 121. 2026-10-23 — Preview as a learner for parents

At the owner's request, parents get the manager's preview too.
- **Where:** "Preview as a learner" in the tools of each lesson on the
  Queue (a kid's request, this week's course lessons, and lessons added by
  hand), and "Preview" beside each written lesson in the course editor.
- **How it looks** (`previewLesson` in `public/app.js`): it opens over the
  page, not as a new page, so closing it (Close, Close preview, Escape, or
  going to another page) leaves the queue or a course being edited exactly
  as it was. "See it as" picks one of the family's profiles, and the lesson
  shows in that profile's theme, as a kid or an adult, with the family's
  diet swaps; the choice is kept for the visit. A family recipe on the
  queue previews too.
- **Nothing is saved or counted:** the player runs in preview mode (§7.5)
  with no `onCook`, `onReflect`, `onDone`, or `ask`, and keeps where it's up
  to under its own preview id, apart from the profile's real cooks. Checked:
  a whole preview sends no request that writes anything.
- **Player:** `exitLabel` sets what Back says in a preview ("Close
  preview" for parents, "Back to the lesson" in the manager). A preview no
  longer scrolls past its own header when it first opens.
- Plan §6.2 has the feature.
- Tests: 261 (1 new: the parents' preview passes no save callbacks).
  Checked in a browser at phone width on the dev server with a family of a
  kid (Kitchen Quest) and an adult (Chef's Passport): the queue's links,
  the course editor's, switching between the two, Cook mode as each, and
  closing back to the page.

## 122. 2026-10-23 — Preview from Add a lesson and Our recipes; stacked arrows

- **Owner request:** Preview as a learner reaches lessons added by hand.
  Besides the Additional lessons on the Queue (which had it from 121), it's
  now in the **Add a lesson** dialog, for the lesson picked, and on each of
  the family's own recipes in **Our recipes** (not one waiting on a review).
  Escape over the Add a lesson dialog closes the preview only.
- **Course editor:** each row's ↑ and ↓ are stacked, one above the other,
  instead of side by side.
- Tests: 261. Checked in a browser at phone width on the dev server: the
  Additional tab, Add a lesson, a family recipe in Cook mode, and the
  course editor; nothing was written.

## 123. 2026-10-23 — Delete our family and Download our data

The beta word is out, so the owner asked for parents to be able to delete
their own family, and for a way to delete families from `/ops`.
- **`/ops` already had one:** Remove… on each family, with Download beside
  it and Restore a family. It stays as it was.
- **Family settings → Leave Clean Plate** (`public/app.js`): **Download our
  data** saves the family's own export, the same file `/ops` downloads for
  it, so Restore a family can put it back. **Delete our family…** opens a
  dialog that says what happens, offers the download again, and asks for the
  parent's password (the page is already behind the PIN).
- **What deleting does** (`deleteFamily` in `src/worker/backup.js`,
  `POST /api/family/delete`): the family gets `deleted_at`, and every parent
  and kid session, manager session, and reset link of the family is removed.
  Login, kid login, and Forgot password refuse it; sign-up with one of its
  emails says it was deleted and when it's erased. Its shared recipes leave
  the directory, and it leaves the owner's family list.
- **The owner's family can't delete itself from the app**, because it holds
  the owner screens; Remove on `/ops` still works for it.
- **Grace period (§6.14):** on `/ops`, deleted families are listed under
  "Deleted by the family" with Download, **Bring back** (everything as it
  was; everyone logs in again), and Erase now… (the Remove page).
- **Daily erase job** (`scheduled` in `src/worker/index.js`, the cron in
  `wrangler.toml`, 09:17 UTC): erases families deleted more than 30 days ago
  the same way as Remove. Cloudflare sets up the cron on deploy.
- **Fixed in Remove:** a family whose shared recipe another family had
  reported couldn't be removed (the report pointed at the recipe). Reports
  on its recipes now go with it.
- A download taken while a family was deleted restores as a live family.
- **Migration `0002_family_delete.sql`** adds `families.deleted_at`. After
  the deploy, the owner presses **Apply pending** on `/ops`; until then,
  logging in fails.
- Not built yet: the inactive purge and its warning emails, and photos (so
  nothing to download or erase there).
- Plan §6.14 notes what's built.
- Tests: 266 (5 new; two `/ops` tests now count the migrations instead of
  assuming one). Checked in a browser at phone width on the dev server: the
  new section, the dialog, a wrong password, and the delete, which logged
  the device out.

## 124. 2026-10-23 — Grades and the homeschool transcript

Phase 4b, homeschool mode, built before deploying 123 (the owner is holding
the deploy until this is done, so its tables go in the same migration).
- **Owner rulings (2026-10-23):** a single grade is whatever the parent
  types; the transcript has everything cooked except on the Sabbath; parents
  grade from a To grade list and from Progress; the app shows the rubric
  average and the hours, and the parent decides the final grade and credit.
  Plan §6.15 has the spec; §10's open question is closed.
- **Migration:** `0002_family_delete.sql` from 123 is renamed
  `0002_delete_and_grades.sql` and also adds `families.school_name`, a
  `grades` table (one row per profile per cook: the five rubric scores,
  `grade_text`, or both), and `transcripts` (one per profile). It was never
  applied, so editing it is safe.
- **Rubric** (`src/content/grades.js`, copied to `public/lib/`): the five
  rows and their descriptions from the syllabus, the rubric average, and the
  one-line grade ("A- · 3.6 / 4").
- **API** (`src/worker/grades.js`), homeschool mode and the parent PIN only:
  `GET /api/grades` (counted cooks with no grade), `PUT
  /api/attempts/<id>/grade` (the rubric, words, or both; neither takes it
  off), `GET` and `PUT /api/transcript/<profile>`. Refused on the Sabbath, and
  for a cook on the Sabbath or one taken back. In casual mode they're refused
  and grades are kept. `/api/progress` adds each row's grade in homeschool
  mode. Deleting a profile takes its grades and transcript.
- **Parent screens** (`public/app.js`), in the Learning path menu in
  homeschool mode only:
  - **Grades:** cooks waiting for a grade, newest first, each with Grade.
  - **Grade dialog:** the profile's reflection, the five rubric rows as 1–4
    buttons, and a grade in your own words; Remove grade when there's one.
  - **Progress:** a Grade column (not printed) showing the grade or Grade.
  - **Transcript:** a student picker, Print, and Edit details (a dialog);
    on screen only, the cooks, hours, and rubric average for the parent to
    decide from; printed, the homeschool name, details, the table with hours
    and grades, skills, totals, the final grade, and the credit.
- Chef Ruth's button no longer prints on Print our progress or the
  transcript.
- Not done: Chef Ruth's tour doesn't show the two new pages yet.
- Tests: 271 (5 new). Checked in a browser at phone width on the dev server:
  the Grades page, grading with the rubric and words, Progress's Grade
  column, Edit details, and the transcript on screen and in print.

## 125. 2026-10-23 — Feast-day badges everywhere, and feast-day course lessons

The owner asked where the Unleavened and Good for Feast Days badges show,
since the dish card had neither.
- **Owner rulings (2026-10-23):** both badges go on the dish card and the
  kitchen cards; the owner will mark some course lessons Good for Feast Days
  (before this, only shared feast-day recipes and the Appointed Times
  lessons had it). Plan §6.19 updated.
- **Lesson field:** `feast: true` on a lesson file (`lesson.schema.json`).
  In the content editor it's a **Good for Feast Days** checkbox on the
  lesson's dish card section, not on Appointed Times lessons, which always
  have it. `tools/build-library.js` gives every lesson `feast` (marked, or in
  a seasonal unit) in `registry.json` and `library-data.js`.
- **Swap:** outside February 1 to May 15, the picker now also offers the
  marked course lessons under "Other lessons", after the Appointed Times
  lessons. In spring they show only if they're unleavened, as before.
- **Dish card** (`showDish`): both badges, for lessons, family recipes, and
  shared recipes, in the swap picker's icon-and-word style.
- **Kitchen cards:** lesson cards and recipe cards (Our recipes and the
  User-shared shelf) show Good for Feast Days beside Unleavened.
  `/api/library` lessons and `/api/recipes` summaries carry `feast`; a
  family recipe has it when it's shared as a feast-day recipe, or was added
  from one that's still in the directory.
- Tests: 272 (1 new). Checked in a browser at phone width on the dev server:
  the dish card and the kitchen's Appointed Times shelf with both badges. The
  editor checkbox wasn't opened in a browser.

## 126. 2026-10-23 — Plan: the Levels, Unleavened Bread dates, and family tastes

Design only; no code changed. Owner decisions from this session, written
into the plan:
- **Heritage and the Levels (§1, §4, §12):** the 75-lesson course is now
  the Heritage course, still open to every family. Four Levels (Helper,
  Apprentice, Cook, Chef) are a companion program in this app, not a
  separate app, because it shares families, food rules, shopping, the
  schedule, and the transcript. Level 3 is built first. The Level outlines
  are the owner's suggestions. The beginner track (§11) is replaced by
  Levels 1 and 2.
- **Level 3 unit order:** yeast dough moves from Unit 8 to Unit 2. Taught
  late, it fell on Unleavened Bread in most years. It needs only food safety,
  measuring, and the oven; UK schools teach yeast rolls in the first year of
  secondary school; practice spread over weeks is kept better (weekly
  challah); and an early success builds confidence. Stock and soup now lands
  in April. Week 18's beef sausage gets the §2.1 casing note.
- **Unleavened Bread dates (§6.20):** the fixed February 1 to May 15 window
  is replaced by each family's dates: one or two standard calendars
  (`content/calendars.json`, owner to name them), with the family's own first
  day allowed. Every family keeps the feast; there's no opt-out. Families
  also say when their house goes unleavened (on the first day, or a date
  before). Asked in Getting started, Family settings, and every year. §6.19's
  swap rule now points here.
- **Family tastes and the recipe pool (§6.21):** proteins, cuisines to skip,
  spice, time, a $ to $$$ budget band, and how adventurous. Tastes leave
  dishes out, never skip a skill (closest fit instead), and never touch the
  hard rule. New recipes are written only as swap-ins for a named skill. A
  Recipe gaps page counts, with no family named, where tastes leave families
  short, to drive what gets written next.
- Data model, phases 11 to 13, and open questions (which calendars;
  mini-courses set aside) updated.
- Research behind these: teen cooking standards (FCS, ProStart, UK
  competences), personalization at meal-kit and planning services, Passover
  dates for 2027 to 2029, and studies on spaced practice and cooking
  confidence.

## 127. 2026-10-23 — Plan: Cook Around the World

Design only. The owner renamed the 75-lesson course: it's **Cook Around the
World**, offered and marketed to casual families and adults, and the Levels
are the homeschool curriculum. "Heritage" (126) didn't fit a course built
this month. Plan §1, §4, §6.21, §8.4 (`program` is `world` or `level-3`),
§9, and §12 updated. New open question (§10): whether homeschool mode stays
on Cook Around the World or moves to the Levels only; the syllabus and
landing pages need wording for the two programs either way.

## 128. 2026-10-23 — Plan: building the next release beside the live app

Design only. Owner decisions:
- **The next release is built switched off** (plan §8.6). Everything planned
  today (Unleavened Bread dates, tastes and recipe gaps, the Levels, the
  Cook Around the World name) goes into the live app behind a Next release
  switch on `/ops`: preview for chosen families, Launch for everyone, and
  Turn off for everyone as its restore. New content lives in
  `content/levels/` and `content/calendars.json`. Chosen over a long-lived
  branch, which would drift from `main`, couldn't be tried on the live app
  without a second Worker, and couldn't be edited in the content editor.
- **One migration for the whole build** ("I don't want 40 migrations"):
  `0003_next_release.sql` is a draft, edited in place. It may only create new
  tables; Re-apply draft rebuilds them (preview data only, with the backup
  beside it); Finalize freezes it at launch. So tastes and course programs
  move to new tables (`family_tastes`, `course_programs`) instead of new
  columns. The runner pattern in `CLAUDE.md` is unchanged.
- **Homeschool mode stays on both programs:** homeschool families can take
  Cook Around the World as an elective. The open question is closed.
- Phase 10b (the switch and the draft migration) comes before phases 11–13.

## 129. 2026-10-23 — The Next release switch and the draft migration

Phase 10b (plan §8.6): the way the next release is built inside the live app,
switched off, with one migration.
- **Phases reordered (owner, 2026-10-23):** tastes and the recipe pool is
  now phase 11, built right after the switch; Unleavened Bread dates moves to
  13. Level 3's calendar check comes with 13.
- **Next release switch** (`src/worker/release.js`, `/ops`): a "Next release"
  section with Launch for everyone and Undo launch (back to preview only;
  nothing is lost), and a preview on/off button on each family. Kept in
  `settings` under `next_release`, so the switch needs no migration.
  `/api/me` adds `next_release` and `next_release_preview`; a preview
  family's parent screens show a Preview note. Nothing else uses it yet.
- **Draft migrations** (`src/worker/migrate.js`): a migration marked
  `draft: true` is edited in place. It may only create new tables and
  indexes on them; anything else is refused before it runs. `_drafts` (made
  by the runner, like `_migrations`) records the tables each draft made.
  States: pending, draft, draft-edited (instead of drifted), and applied once
  finalized. `/ops/draft/<id>`: Re-apply draft (type REBUILD) drops the
  draft's tables and makes them again in one batch; Restore draft tables
  (`importDraftTables` in `backup.js`) is its restore, filling the draft's
  empty tables from an earlier export.json; Finalize (type FINALIZE) freezes
  an unedited draft. An applied draft counts as ready on `/ops`.
- **`0003_next_release.sql`** is the draft, with no tables yet. After this
  deploy the owner presses **Apply pending** on `/ops` (with 0002, if that's
  still pending).
- **`content/levels/`** holds the next release's content (a README for now).
- Tests: 276 (4 new: draft checks; re-apply, restore, and finalize; the
  switch per family and for everyone; the draft page's phrase). Checked in a
  browser at phone width on the dev server: the Next release section, a
  family's preview button, the draft page, and the Preview note on Family
  settings.

## 130. 2026-10-24 — Plan: ratings, variations, and the phase 11 slices

Design only. Plan §6.21 rewritten from the owner's decisions:
- **Ratings, not yes or no:** 4 stars (love) to 1 (hate), or Haven't tried,
  **per profile**. No country list, since many people haven't tried a
  cuisine: profiles rate 11 **flavors, each shown with example dishes**
  (common dishes, recipe or not, all normally made clean), plus 10 proteins
  and about 35 key ingredients. Cuisines are learned from Reflect ratings.
  Time, budget, tools, and how adventurous stay per-family limits. Claude
  drafted the lists; they'll live in `content/tastes.json` for the owner to
  edit.
- **Variations instead of "use this instead":** a full version of a lesson
  with the preference built in (protein, amounts, doneness target, steps,
  shopping list), counted as the same lesson, tagged and scored on its own,
  and linted as a whole lesson.
- **Scoring:** anyone's 1 star on the main protein or a required ingredient
  rules a version out; the rest are scored from everyone's stars. The gaps
  page suggests a variation first when one ingredient is the problem.
- Data model: `profile_ratings`, `family_limits`, `taste_learned` replace
  `family_tastes`. Phase 11 is split into 11a tags, 11b ratings,
  11c variations, 11d scoring and picks, 11e Recipe gaps.

## 131. 2026-10-24 — Plan: five stars and one absolute favorite

Design only. The owner found a 4-star scale confusing: ratings are now
5 stars (absolute favorite) to 1 (hate), or Haven't tried, and a profile has
at most one 5-star item in each list (proteins, flavors, ingredients); a new
5-star asks to move the old one to 4. Plan §6.21 and §8.4 updated.

## 132. 2026-10-24 — Tags and tastes (slice 11a)

Phase 11, slice 11a (plan §6.21): the shared words ratings, picks, and gaps
will use. Nothing here is shown to families.
- **`content/tastes.json`**, a new registry file: 10 proteins, 11 flavors
  (each with a hint and example dishes, all normally made clean), and 38 key
  ingredients. A protein or key ingredient lists the registry ingredients it
  covers. Validated by `registries.schema.json` (`tasteProteins`,
  `tasteFlavors`, `tasteIngredients`).
- **Tags** (`tags` with `protein`, `flavors`, `heat`, `budget`,
  `familiar`) on every `course.json` dish and on the two Appointed Times
  lessons (`lesson.schema.json`). Claude drafted all 77 for the owner to
  review. Breads and desserts use "Mild and buttery" for now.
- **`src/content/tastes.js`** (also in `public/lib/`): the fixed levels,
  tag checks, the key ingredients a lesson uses, and a written lesson's first
  meat or fish.
- **Linter:** refuses unknown tags, more than 3 flavors, a taste item naming
  an ingredient not in the registry, and blocked words in taste names and
  example dishes; warns when a dish is missing tags, or when a written
  lesson's protein tag differs from its first meat or fish (eggs Benedict:
  eggs, with turkey on top).
- **Build:** `library-data.js` lessons carry `tags` and `tasteItems`; its
  course list carries each dish's skills and tags; `tastes` lists the ids and
  names.
- **Content editor:** a **Tastes** tab (the three lists, with ingredient
  pickers), a **Tags** tab (every dish as a card: protein, heat, budget, how
  familiar, and up to 3 flavors; a filter for dishes still to tag), and the
  same fields on the lesson editor's dish card and the planned-dish dialog.
- `course.json` now uses the layout `tools/format-content.js` writes for long
  entries (one field per line), since tagged dishes no longer fit one line.
- Tests: 281 (5 new). Checked in a browser at phone width on the dev server:
  the Tags page and a change staging a save, the Tastes list, and the tags on
  Shakshuka's dish card.

## 133. 2026-10-24 — A Sweet treats flavor

The owner added a 12th flavor, **Sweet treats** (cookies, cakes, pastries,
sweet breads), so desserts no longer borrow "Mild and buttery". Re-tagged:
blueberry muffins, rugelach, cinnamon rolls, granola, brown butter cookies,
malva pudding, churros, apple pie, challah French toast, and cottage cheese
crescents. Plan §6.21 updated.

## 134. 2026-10-24 — A vegetables tag

Nothing told the app which dishes are mostly vegetables, so a fattoush and a
mac and cheese looked alike. The owner chose a separate tag over a 13th
flavor:
- **`veggies`** (light, some, lots) on every dish's tags, checked by the
  linter and set on the Tags page and dish cards. Drafted for all 77: lots
  for 7 (spring rolls, fattoush, ratatouille, minestrone, chicken Caesar,
  ugali and sukuma wiki, spanakopita), some for 27, light for 43.
- **Meals heavy on vegetables** (`VEGGIE_RATING` in `src/content/tastes.js`)
  is the item profiles will rate for it in slice 11b, matched against this
  tag. Plan §6.21 updated.
- Tests: 281. Not checked in a browser this time: the new field uses the
  same select as the others on the Tags page.

## 135. 2026-10-24 — Star ratings and Our tastes (slice 11b)

Phase 11, slice 11b (plan §6.21), all behind the Next release switch (§8.6):
- **Draft migration `0003_next_release.sql`:** `profile_ratings` (one row per
  profile per item: 1 to 5 stars, or NULL for Haven't tried) and
  `family_limits` (time, budget, missing tools, how adventurous). After the
  deploy the owner presses **Re-apply draft** on `/ops/draft/0003` (it has no
  rows to lose yet).
- **API** (`src/worker/tastes.js`), parents only, and 404 for a family
  without the next release: `GET /api/tastes` (the lists with example
  dishes, every profile's ratings, the limits, the tool choices),
  `PUT /api/profiles/<id>/ratings` (one rating; a second absolute favorite
  in a list is refused with 409 unless `replace`, which moves the old one to
  4), `PUT /api/tastes/limits`. A deleted profile's ratings go with it; a
  family's ratings are in Download our data and go with the family.
- **`src/content/tastes.js`:** the star words, the limits' choices, the tool
  choices (from the equipment registry), and `ratingItems` (the flavors list
  ends with Meals heavy on vegetables).
- **Our tastes** (Menu → Setup, next-release families only): limits, a
  profile picker, and Proteins, Flavors (each with its examples), and Key
  ingredients as star rows (`public/tastes.js`). Every tap saves; tapping a
  rating again clears it.
- **Getting started:** a new `tastes` part after Logins for kids (skipped
  for families without the next release): the limits, then each profile's
  proteins. **Chef Ruth:** "Ask what we like to eat", five unrated items at a
  time for one profile.
- Not built: the kid's taste quiz in the kitchen, moved to slice 11d.
- Tests: 287 (6 new in `test/worker-tastes.test.js`; the Getting started
  order test updated). Checked in a browser at phone width on the dev
  server: Our tastes with the limits, rating, the favorite question and
  moving it, Haven't tried, the Flavors list, and Chef Ruth rating five
  proteins. Getting started's tastes part wasn't run in a browser.

## 136. 2026-10-24 — Variations (slice 11c)

Phase 11, slice 11c (plan §6.21): a variation is a complete version of a
lesson with a preference built in, and counts as that lesson.
- **Stored on the lesson** (`variations` in the lesson file,
  `src/content/variations.js`): title, tags, whole values (time, scaling,
  servings, intro, substitutions, Learn cards) and list changes (`change`,
  `drop`, `add`, `order`) for ingredients, tools, steps, and why cards, keyed
  by stable ids. What a variation doesn't change stays the lesson's, so a fix
  to a shared step reaches it, and a step added to the lesson later lands in
  it after the step before. `diffVariation` turns an edited copy back into
  changes; a test checks the round trip.
- **First variation: Chimichurri chicken** (thighs, 165°F, longer sear,
  strips instead of across-the-grain, its own why card, wrong signs, and quiz
  question).
- **Linter:** each variation is put together and checked as a whole lesson
  (schema, unclean block, raw handling and wash steps, doneness, rendering at
  every size), plus its tags and the protein warning. Refused: duplicate ids,
  the lesson's own title. Warned: a variation that changes nothing, or names a
  step the lesson no longer has. **New for every lesson:** the thermometer
  target must reach the safe minimum for the raw meat, poultry, or fish in it
  (165°F poultry, 160°F ground meat, 145°F whole cuts and fish). Every
  current lesson already passes it.
- **Build:** `library-data.js` carries each variation as a lesson summary
  (ingredients, time, badges, tags, key ingredients) for picks and shopping;
  `registry.json` lists each lesson's variations by id and title.
- **Content editor:** a **Variations** section on each lesson.
  **+ Add a variation** asks for its name in a dialog, then opens
  `#/lesson/<id>/v/<variation>`: the whole lesson, with skill, cuisine,
  prerequisites, and picture locked to the lesson's, its tags, and
  **Take this version out**. Edits are stored as what differs.
  **Preview as a learner** works for each variation. A stray "null" under
  the editor's sections is gone.
- **Families with the next release** (`src/worker/variations.js`):
  `PUT /api/variations/<lesson>` saves the family's pick ('' is the lesson
  itself), and `/api/me` returns them. A **Version: …** button on queue and
  course rows opens a dialog to pick. The player plays the picked version
  ("A version of Chimichurri steak" under its title); a cook already under
  way keeps the version it started in. A cook sends its version and the
  Worker records it once; an unknown version saves as the lesson itself, so a
  retry always lands. Shopping buys for the picked version, and a list keeps
  the version it was made for. Fix-request checks (`patchProblems`) now
  include the lesson's variations.
- **Draft migration `0003_next_release.sql`:** `variation_choices`,
  `attempt_variations`, `list_variations`. After the deploy the owner presses
  **Re-apply draft** on `/ops/draft/0003` (download export.json first; Restore
  draft tables puts the ratings back).
- Not built: the default pick by score (11d); "(a version of …)" in progress,
  grades, and the transcript; Suggest a fix on a step only a variation has
  (it would target the lesson's step); a variation's own picture.
- Tests: 298 (11 new in `test/variations.test.js` and
  `test/worker-variations.test.js`). Checked in a browser at phone width on
  the dev server: the Version dialog on the queue, the player showing
  Chimichurri chicken, the Variations section, Add a variation, the variation
  editor (a time change stored as a change, checks passing), and its preview.

## 137. 2026-10-24 — Plan: proposed variations

Design only. A coverage check of the drafted tags (75 planned dishes, 32
written) found skills taught with one protein only (thin slicing and
binders: beef; reducing and julienne meals: chicken), no salmon, lamb, or
tofu dish, and no spicy written meal. Plan §6.21 now lists nine proposed
variations (chicken bulgogi, chicken cheesesteak, turkey meatloaf, chicken or
bean empanadas, beef or bean fajitas, turkey smash burgers, honey-garlic
salmon or tofu, spicy shakshuka, spicy chicken fajitas) with the skill and
gap each fills and draft tags, as a recommendation waiting on the owner.

## 138. 2026-10-24 — Plan: proposed pick-one dishes

Design only. Fifteen new dishes found on the web, recorded in plan §6.21 as
a recommendation. The owner's direction: each goes in as a pick-one choice
beside a dish that teaches the same skills, not as an extra lesson, so the
course keeps its numbering and length. They add the first salmon, lamb, and
coconut dishes, more smoky and BBQ, and quick meals (eight of 30 minutes or
less): chicken piccata, beef and broccoli, turkey lettuce wraps, coconut
chickpea curry, blackened fish, BBQ salmon, broiled honey-soy salmon, jerk
salmon, pineapple teriyaki salmon, huevos rancheros, chicken souvlaki pitas,
moqueca, coconut-crusted fish, lamb kofta, and Caribbean coconut curry lamb
chops. Two groups exist today (building-a-sauce, dicing); the rest would make
new groups named for their skill. Each lists draft tags and what to watch
(no shrimp or oyster sauce; doneness at the safe minimums).

## 139. 2026-10-24 — Pick-one groups of three at most; jerk salmon as a variation

The owner's rulings on the proposed dishes (plan §4.0, §6.21):
- **A pick-one group has at most 3 dishes.** The linter now refuses a fourth
  (`course.json pick-one "<group>": has 4 dishes`); every group today has 2
  or 3. Plan §7.4 lists the check.
- **Jerk salmon becomes a proposed variation of jerk chicken**, since it
  teaches the same skills (marinating, broiling); it left the dicing group,
  which is back to 3. It waits on jerk chicken being written.
- **Chicken piccata moves** from building-a-sauce (already 3) to the new
  reducing group, beside chicken adobo and pineapple teriyaki salmon: its pan
  sauce is reduced after searing.
- Tests: 298 (one more assertion in `test/lint.test.js`).

## 140. 2026-10-24 — Eight more variations

The owner asked for the proposed variations (plan §6.21) whose lesson is
already written. Each was written as an edited copy of its lesson and stored
as what differs; times, temperatures, and methods were checked against
recipes found on the web (sources in the session). All are drafts for the
owner to review on each lesson's Variations section.
- **Beef bulgogi → Chicken bulgogi:** thighs, frozen 30 minutes and sliced
  into thin strips (a "thin and even" card replaces "across the grain"),
  3 + 2 to 3 minutes a batch, 165°F, a tip and a wrong sign for the sugary
  marinade burning. $.
- **Chicken fajitas → Steak fajitas:** flank steak seared whole 4 minutes a
  side, 145°F, rested, sliced thin across the grain (new card and quiz
  question). $$.
- **Chicken fajitas → Black bean fajitas:** no meat steps; two cans of black
  beans, rinsed (new card on why), warmed with the spice paste after the
  vegetables. 35 minutes, no thermometer. $.
- **Chicken fajitas → Spicy chicken fajitas:** jalapeños julienned with the
  peppers, cayenne in the paste, a card on where a chili's heat is and
  washing hands after cutting it, and a "too spicy" fix.
- **Smash burgers → Turkey smash burgers:** 93% lean ground turkey, balls
  chilled before smashing, more oil, medium-high heat, 3 minutes then 2,
  165°F; a "turkey is lean" card and a "crumbles" fix.
- **Honey-garlic chicken → Honey-garlic salmon:** skinless salmon in 1-inch
  pieces, browned 2 minutes a side and set aside; the sauce reduces alone,
  then the salmon is turned in it; 145°F; a "gentle with fish" card. $$$.
- **Honey-garlic chicken → Honey-garlic tofu:** two 14-oz blocks of
  extra-firm tofu, pressed 15 minutes (new first step and card), no wash or
  doneness steps since nothing is raw. $.
- **Shakshuka → Spicy shakshuka:** diced jalapeños, chili flakes no longer
  optional, cayenne, the heat card, and a "too spicy" fix.
- **Registry:** salmon fillets, flank steak, ground turkey, extra-firm tofu
  (14-oz block), black beans (15-oz can), and cayenne; the tastes lists link
  them to salmon, beef, turkey, tofu, beans, and hot peppers.
- **Linter:** a variation no longer repeats its lesson's label notes (flour
  tortillas, sour cream); it warns only for an ingredient it adds.
- Tests: 299 (a new check that the written variations pass with no warnings
  of their own). Checked in the manager's learner preview at phone width:
  Honey-garlic tofu and Spicy shakshuka.

## 141. 2026-10-24 — Five new pick-one lessons

The owner asked for the four proposed pick-one groups whose existing dish is
already written (plan §6.21). Five new lessons, each beside that dish with
the same skills, so the course keeps 59 numbers (now 80 dishes):
- **4b Chicken souvlaki pitas** (dressings, with 4a Chicken Caesar):
  tzatziki with squeezed cucumber and finely chopped dill, a 20-minute
  lemon-oregano marinade, chicken seared to 165°F.
- **9b Turkey lettuce wraps** (stir-frying, with 9a Chicken fried rice):
  pea-size carrot and water chestnut, ground turkey to 165°F, a hoisin sauce.
- **11b Chicken piccata** (reducing, with 11a Chicken adobo): chicken pounded
  even between parchment, floured, seared to 165°F, a broth-lemon pan sauce
  bubbled down by half, capers and butter. No wine.
- **11c Pineapple teriyaki salmon** (reducing): pineapple juice, soy, and
  brown sugar reduced to a glaze in its own pan, salmon seared to 145°F, the
  pineapple browned in the skillet.
- **14b Huevos rancheros** (poaching eggs, with 14a Eggs Benedict): eggs
  cooked covered in simmering salsa to 160°F, crisp corn tortillas, warm
  refried beans. It calls back to shakshuka.
- Each earlier dish now has `pickOne`, and the new one sits right after it,
  so a saved course plan keeps the earlier dish and starts with the new one
  removed. Tags are set on each new dish.
- **Registry:** capers, pineapple chunks, water chestnuts, vegetarian refried
  beans (a label note: many are made with lard), hoisin (a label note for
  oyster or shrimp extract), butter lettuce, red onion, fresh dill, and queso
  fresco; a Hawaiian cuisine. Tastes link capers and refried beans.
- **Pictures:** placeholders made from the meal-type drawings, listed in
  `content/images/LICENSES.md`, until the owner's ChatGPT sheet arrives. Claude
  gave the owner the prompt for it.
- Tests: 299 (the course test counts 80 dishes; Chicken Caesar is now 4a).
  Checked in the manager's learner preview at phone width: Chicken piccata
  and Huevos rancheros, Learn and Cook.

## 142. 2026-10-24 — Pictures for the five new lessons

The owner supplied sheet 24 (ChatGPT, from Claude's prompt; the first of two
versions, which had the most space between dishes). Cropped with
`tools/crop-dish-sheet.py` into the pictures for pineapple teriyaki salmon,
chicken piccata, turkey lettuce wraps, huevos rancheros, and chicken souvlaki
pitas, replacing the placeholders; web copies rebuilt.
`tools/dish-sheets.txt` and `content/images/LICENSES.md` list the sheet.

## 143. 2026-10-24 — Nine planned pick-one dishes

The owner supplied sheets 25 and 26 (ChatGPT, from Claude's prompts),
cropped into pictures for the other nine proposed pick-one dishes. They're
now in Cook Around the World's outline (`content/course.json`) as planned
dishes, each the second or third choice beside a dish with the same skills,
with estimated times and tags: 16b coconut chickpea curry, 21b blackened
cod, 21c BBQ-rubbed salmon, 22b Caribbean coconut curry lamb chops, 23b
moqueca, 26b broiled honey-soy salmon, 29b beef and broccoli, 45b lamb kofta,
and 53b coconut-crusted fish. None is written yet. The course still has 59
numbers (89 dishes).
- **Not behind the next release** (owner, 2026-10-24): new dishes are part of
  the live course for every family. A new test checks a family without the
  next release gets the five new lessons in its library and the planned
  ones in its default course plan, as second choices.
- The linter caught "no shrimp" and "no oyster sauce" in two dish cards'
  descriptions; the blocked-word check doesn't read "no", so those notes stay
  in the plan only.
- Plan §4's unit tables and §6.21 updated; `tools/dish-sheets.txt` and
  `content/images/LICENSES.md` list the sheets.
- Tests: 300.

## 144. 2026-10-24 — Plan: slice 11d in four parts

Design only. Slice 11d (scoring and picks, plan §6.21) is split into four
parts, as a recommendation waiting on the owner:
- **11d1 Scoring and default picks:** `src/content/score.js` with draft
  weights; limits rule a version out (lesson summaries gain their tools);
  the best version plays by default when the family hasn't picked one; a new
  course keeps the best dish in each pick-one group; the plan editor shows
  each dish's fit and has a Suggest picks button. Saved plans don't change.
- **11d2:** Best for them at the top of Add a lesson; best fit first inside
  Swap's existing order; Chef Ruth's "What should we cook?"; a hated
  optional ingredient left out of the player and shopping list.
- **11d3:** `taste_learned`, rebuilt from a profile's reflections each time
  one is saved, so an edited reflection isn't counted twice.
- **11d4:** the kid's taste quiz in the kitchen; the ratings API takes a
  kid's own session for its own ratings.
- No written lesson uses mushrooms, so the phase's done-when is tested with
  a made-up lesson until a mushroom dish is written.

## 145. 2026-10-24 — Plan: the main track ranks, it doesn't rule out

Design only. The owner's ruling: on Cook Around the World, scoring picks the
best option where there are options, and never keeps a skill's only dish
off. Plan §6.21 changed:
- A 1 star on a version's protein or a required ingredient makes it
  **Doesn't fit**: ranked below every version that fits, but kept.
- **Family limits never rule a dish out.** Over the time or budget, or a
  missing tool, takes points off (draft: −1 a 15 minutes over, −1 a $ over,
  −2 a tool) with a note, so it loses to an option within the limits and is
  kept when it's the only one.
- §10 notes the owner's idea of a **custom course from a family's tastes**,
  which could rule dishes and skills out. Not planned.

## 146. 2026-10-24 — Scoring and default picks (slice 11d1)

Phase 11, slice 11d1 (plan §6.21), all behind the Next release switch
(§8.6). On the main track nothing is ruled out; dishes are only ranked.
- **`src/content/score.js`:** scores a dish or version for the profiles on
  a cook with the draft weights (one `WEIGHTS` object). A 1 star on its
  protein or a required key ingredient makes it Doesn't fit, ranked last but
  kept. Time, budget, and missing tools take points off with a note. Fit
  words: Great fit (2 points or more), Good fit (0.5), Not a great fit; none
  when nothing it uses has been rated.
- **Build:** library lesson summaries and variations carry their `tools`;
  the course outline carries each dish's `minutes`, so planned dishes can be
  scored.
- **`src/worker/picks.js`:** reads a family's ratings, limits, and diet
  settings once a request. A lesson with no saved pick plays its best version
  for the profiles on the row: the parent's queue and course rows
  (`version`, with every option's fit and why), the kitchen
  (`versions` on `/api/profiles/<id>/queue`), and shopping. A version the
  diet settings hide is never picked. `PUT /api/variations/<lesson>` with
  `variation: null` takes the family's pick off.
- **Courses:** `GET /api/picks/course?profiles=…` gives each dish's fit and
  each pick-one group's best written dish. A new course posted with no plan
  (Chef Ruth's) keeps those picks; without the next release, the first dish
  as before. A group where nothing fits keeps its closest, with "Nothing for
  … fits everyone yet; this one is closest."
- **Parent screens:** **Version: …** says "(best for Ava)", and its dialog
  lists the versions best first with their fit, why, and notes, after
  **The best fit for whoever is cooking**. The course editor shows a fit line
  under each dish and a **Suggest picks** button; a new course follows the
  people ticked until a dish in a group is ticked by hand. Chef Ruth says she
  picked the best dish in each group. The queue no longer loads the content
  registry, which only the old Version button used.
- **Plan:** slice **11f, the taste tester** (owner, 2026-10-24): a manager
  tool for trying sets of preferences and seeing what they pick, built at the
  end of phase 11.
- Tests: 309 (5 in `test/score.test.js`, including the mushroom check with
  a made-up lesson; 4 in `test/worker-picks.test.js`). Checked in a browser
  at phone width on the dev server: the Version button and dialog on a
  queued Chimichurri steak (beef 1 star, chicken 4, a 45-minute limit), and
  a new course's fit lines and picks.

## 147. 2026-10-24 — Add a lesson, Swap, Chef Ruth, and hated extras (slice 11d2)

Phase 11, slice 11d2 (plan §6.21), all behind the Next release switch.
- **`GET /api/picks/lessons?profiles=…`** (`src/worker/picks.js`): every
  library lesson the diet settings allow, outside the Appointed Times, best
  first for the profiles on a cook, each with its fit, why, notes, best
  version, and whether any of them has cooked it or has it queued.
- **Add a lesson:** with the next release, Who's cooking comes first. Once
  it's ticked, the menu starts with **Best for them** (up to 5 Great or Good
  fits not cooked or queued for them), then every lesson; one that doesn't
  fit says so, and the picked lesson's fit shows under the menu.
- **Swap** (`src/worker/swap.js`): inside each part, best fit first for the
  profiles on the swapped lesson, with each lesson's fit and why. The parts
  keep §6.19's order; parent recipes keep theirs.
- **Chef Ruth: "What should we cook?"** on her menu: who's cooking (one
  profile or everyone), then the 3 best lessons that fit and aren't cooked or
  queued for them, each added to the queue with one tap.
- **Hated extras:** an optional ingredient on a protein or key ingredient
  someone on the cook rated 1 star is left out, like a diet's (§2.1). The
  kitchen gets `leave_out` per lesson and the player says "Leave out the
  fresh cilantro (Ava doesn't like it)". What you'll need, the list preview,
  and saved lists drop it and say what was left out (`shoppingList` takes
  `leaveOut`); a saved list works it out from the people on each lesson now.
- **Fixed:** a lesson whose version is the lesson itself (`''`) showed an
  empty title in What you'll need and on lists (`versionTitle`). It showed
  for a family that picked the lesson itself in 11c, and for every lesson
  that 11d1 picked as written.
- Tests: 314 (5 new in `test/worker-picks.test.js`; its setup now finds
  profiles by name, since two made in the same millisecond can list either
  way). Checked in a browser at phone width on the dev server: Add a lesson
  with Best for them, the Swap picker's fit lines, the player's leave-out
  note, What you'll need, and Chef Ruth's three suggestions.

## 148. 2026-10-24 — Learning from Reflect (slice 11d3)

Phase 11, slice 11d3 (plan §6.21), behind the Next release switch. The
owner put 11d4, the kid's taste quiz, on hold.
- **Draft migration `0003_next_release.sql`:** `taste_learned` (one row per
  profile per protein, flavor, or cuisine: `adjust` and `cooks`). After the
  deploy the owner downloads export.json on `/ops`, presses **Re-apply
  draft** on `/ops/draft/0003`, then **Restore draft tables** to put the
  ratings and version picks back.
- **`learnedFrom`** (`src/content/score.js`): each cook counts its own
  Reflect rating (1 to 5 as −2 to +2) plus half the eaters', capped at ±2;
  an item adds half of each cook's value, capped at ±2 (`WEIGHTS`). The score
  adds a profile's learned protein, flavors on average, and cuisine; a
  cuisine at +1 or more gives "Ava enjoyed cooking Tex-Mex". Cuisines are
  only learned, never asked. Planned dishes carry their cuisine from the
  course outline now.
- **`relearn`** (`src/worker/picks.js`): rebuilds the rows for everyone on a
  cook from all their finished cooks, using the version each was
  (`attempt_variations`), whenever a reflection is saved, a cook is taken
  back or put back, or a profile is deleted. Rebuilt, so a changed
  reflection never counts twice. Family recipes teach nothing (no tags).
  Nothing happens before the table exists.
- Rows go with the profile (`forgetProfile`) and the family, and are in
  Download our data.
- Tests: 319 (2 in `test/score.test.js`, 3 in `test/worker-picks.test.js`).
  Not checked in a browser: nothing new is drawn; what's learned shows in
  the fit lines and reasons built in 11d1 and 11d2.

## 149. 2026-10-24 — Recipe gaps (slice 11e)

Phase 11, slice 11e (plan §6.21): a page in the owner screens (Menu → Owner
→ Recipe gaps), counts only, with no family, profile, or name in it.
- **`src/worker/gaps.js`, `GET /api/owner/gaps`** (owner only). Families with
  the next release that have rated something or set a limit are counted.
  Each is checked group by group for the people it cooks for together (each
  active course, and everyone on no course) and counts once a group:
  nothing that fits, or only a poor fit. Reasons are counted per family from
  name-free codes the scorer now returns (`hated`, `over` in
  `src/content/score.js`).
- **Write next:** a protein 1 star → a variation in the protein the
  affected people rate highest; an ingredient → a version without it; a
  limit in a full group → a quicker, cheaper, or tool-free version of the
  closest dish; otherwise a new dish for the group with their best-rated
  protein and flavors, mild, their usual time and budget (in a full group, a
  version of its first dish). Bread and dessert groups keep no protein.
- **Open in the manager** (`/manage/#/gap/variation/<lesson>?…` and
  `#/gap/dish/<group>?…`): Add a variation opens on the lesson with the gap's
  tags and note; a new dish opens a dialog that places it after the group's
  last dish with the group's skills, its pick-one group, the target time, and
  the tags, then opens it in the editor.
- **Coverage:** each group against the 10 proteins (written versions, and
  +planned dishes), heat, and how many flavors, in a table that scrolls
  sideways on a phone. **What people cook** (every family): swapped out
  most, skipped most, rated low, and average stars by flavor.
- Chef Ruth's tour has a Recipe gaps stop.
- Tests: 323 (4 in `test/worker-gaps.test.js`, including a check that no
  name or email is in the report). Checked in a browser at phone width on
  the dev server: the page with three gaps and the coverage table, Open in
  the manager on a variation, and the new-dish dialog placing a dish in the
  dressings group with its tags. That check also caught Write next suggesting
  a salmon version of a dish whose only problem was time, now a quicker
  version.

## 150. 2026-10-24 — Plan: phase 12, Level 3 Cook

Design only. Plan §12.4 (new), §9, and §8.4 changed.
- **Owner rulings:** slice 11f, the taste tester, is on hold, and phase 12
  goes first. A Level week is done when its recipe is cooked. Each week's
  recipe is the best fit for the family, picked when the course is set up.
  Phase 12 writes Unit 1's new recipes and all 108 part pages; the other new
  recipes come in content sessions.
- **Slices:** 12a Level content (`content/levels/level-3.json`, new recipes
  in `content/levels/recipes/`) and its linter checks; 12b a Level course
  (`course_programs`, Which program?, one Level week per calendar week on
  today's schedule); 12c the kitchen's four parts (`level_tasks`), mastery
  weeks, and Why did it work?; 12d best-fit recipes at setup and Swap recipe;
  12e Progress and the transcript; 12f the content.
- **`mastery_notes`** is planned as its own table: the draft can't add a
  column to `attempt_profiles`, where §12.2 had put "why it worked".
- Open for the owner: stamps and pins for Level weeks, and whether Level
  recipes join Side quests at launch.

## 151. 2026-10-24 — Plan: the Level view

Design only. Plan §12.4 (slice 12e) and §9 changed. The owner's ruling: a
learner on a Level isn't working through 75 dishes, so their progress tab
shows how far they are in the course.
- **The Level view:** week and hours at the top, a bar of the 36 weeks by
  unit, the 9 units as a path with each week's recipe and part ticks, what's
  left this week, and a certificate at the capstone. Each theme draws it.
- **Units are the ranks:** a Level learner isn't shown the dish-count ranks;
  a mastered unit is the step up.
- **My cooking collection:** a toggle to the usual stamps or skill tree and
  pins, which every cook keeps earning. This answers the open question on
  stamps and pins for Level weeks.

## 152. 2026-10-24 — Plan: Level 3 recipes checked against the main course

Design only. Plan §12.4 changed. The owner's ruling: every new Level recipe
is checked for a pick-one group with room, or as a variation of a planned
dish, before it's written. A table of the 36 weeks proposes where each one
goes, waiting on the owner: 13 are written or planned in Cook Around the
World already; 3 are variations (beef kofta, chicken noodle soup, perhaps
thick burgers); 5 fill groups with room (vegetable stir-fry, a dressed
salad, beef stew, shish taouk, beef ragù); 3 could start new pairs (pita
with naan, mujaddara with koshari, red lentil soup with misir wot); the rest
are Level only.

## 153. 2026-10-24 — Level 3 content and its checks (slice 12a)

Phase 12, slice 12a (plan §12.4). The owner's rulings on the recipe table:
all five group fills, the three new pairs, Beef stew over Poached cod, thick
burgers Level only, and the Level-only recipes as their own unit in Side
quests.
- **Eight new planned pick-one dishes** in `content/course.json`, live for
  every family like the other planned dishes: 4c Chickpea chopped salad +
  vinaigrette, 9c Vegetable stir-fry with tofu, 18b Red lentil soup, 22c
  Beef ragù, 23c Beef stew, 24b Mujaddara, 26c Shish taouk, 37b Pita bread.
  Misir wot, Koshari, and Skillet naan now start pick-one groups. The course
  still has 59 numbers (97 dishes). A new skill, cooking dried beans and
  lentils, is on the five lentil and bean dishes; a Turkish cuisine.
- **Pictures:** the owner's sheets 27 and 28 (ChatGPT, from Claude's
  prompts), cropped with `tools/crop-dish-sheet.py`; checked for unclean
  foods. The meal-type placeholders made earlier in the session are gone.
- **`content/levels/level-3.json`** and **`content/schema/level.schema.json`**:
  the units and goals, the 36 weeks (skill, default recipe, note, swap-ins,
  mastery, and each part's title and planned minutes), weeks 35 and 36 as a
  practice week and the capstone, and 17 Level-only recipe cards with their
  tags and meal-type drawings. The Level's unit is number 100, so a unit
  added in the manager can't take its number (a manager test caught 9).
- **Registries:** six skills for Level weeks (checking meat with a
  thermometer, sautéing, cooking grains, handling raw poultry, cooking fish,
  building a soup); Israeli and Cuban cuisines.
- **Linter** (`src/content/lint.js`, `src/content/load.js`): units of four
  weeks with the mastery week last, the capstone last, each recipe and
  swap-in known and used once, skills in the registry, the planned hours
  within 10% of 125 (126.6 now), the hard rule on every Level page and recipe
  card, and lesson files in `content/levels/recipes/` checked as lessons and
  against their cards. It warns that 108 part pages aren't written yet.
- **Manager:** a Level 3 page (`public/manage/level.js`): each unit folded,
  its weeks with their recipe, skill, swap-ins, and three parts, the hours
  and pages written at the top, and the Level's recipes with their tags and
  an Add dialog that reminds the owner to check the main course first.
- **Fixed:** a gaps test relied on stir-frying being a two-dish group; it
  now uses poaching eggs.
- Tests: 327 (4 new in `test/lint.test.js`; a Level save with a blocked word is refused in `test/manage.test.js`). Checked in a browser at phone width on the dev server: the
  Level 3 page, a week opened, and a drill's minutes changed (the hours and
  the save bar update; no sideways scroll).

## 154. 2026-10-24 — A Level course (slice 12b)

Phase 12, slice 12b (plan §12.4): a course can be Level 3 Cook. Behind the
Next release switch.
- **Which program?** opens the course editor for a family with the next
  release: Cook Around the World or Level 3 Cook. A Level course hides
  Lessons per week (one Level week a week, Sunday to Friday) and shows the
  Level's weeks folded by unit, each with its recipe, Preview, mastery
  check, and "Being written" where it isn't. Editing shows the program; it
  can't change. Chef Ruth's Getting started asks the same question and skips
  "How many lessons a week?" for a Level.
- **`course_programs`** in the draft migration (`0003_next_release.sql`):
  one row per Level course; no row is Cook Around the World. Press **Re-apply
  draft** on `/ops` after this deploys.
- **The plan** (`src/worker/plan.js`): a Level course's `course_lessons` rows
  are its weeks' recipes, with the week as the position. The schedule, Skip
  this recipe, Skip this week, rollover, weeks behind, and the planned finish
  work unchanged. Unwritten recipes and weeks 35 and 36 (no recipe yet) wait
  like planned dishes.
- **The course card** says "Level 3 Cook · Week 1 of 36" and names each
  recipe by its week ("Week 3 · Chicken fried rice"), skipped ones too.
- **Next release off:** a Level course is left out of the courses, the queue,
  and the one-course-at-a-time check, and comes back when it's on again.
- **Library build:** `LIBRARY.levels` has each Level's units, weeks, and
  recipe titles for the Worker.
- Tests: 333 (6 new in `test/worker-levels.test.js`). Checked in a browser at
  phone width on the dev server: Which program?, the Level's weeks, a Level
  course started, its card on the queue, the course list, and the edit page
  (no sideways scroll, no errors).


## 155. 2026-10-24 — Plan: Levels 2 and 4, and the week options

The owner's Level 2 Apprentice and Level 4 Chef plans and the week-options
workbook (`clean-plate-week-options.xlsx`) go into the plan. No app changes.
- **§12.1:** Level 2 and Level 4 now point to their own sections. The
  owner's plans moved quick breads up to Level 2's Unit 4 and pastry and
  enriched breads up to Level 4's Unit 3, both to keep leavened units away
  from spring.
- **§12.5 Level 2 Apprentice** and **§12.6 Level 4 Chef:** how a week is
  timed, supervision, unit goals, the 36 weeks with their four parts, the
  unleavened backups, and the media each plan asks for.
- **§12.7 Week options:** what the workbook holds (270 options, 58 new
  dishes), the gaps it shows, Claude's check of every dish against the hard
  rule (none unclean; five hidden sources to write around), the four weeks
  where the workbook and the plans name different defaults, and seven
  questions waiting on the owner: what the options are in the app, a
  leavened week's backup vs. passing it over, the four defaults, teaching
  pages that name unclean foods, Level 4's independence, live-action clips,
  and checking the 58 new dishes against the main course first.

## 156. 2026-10-24 — Plan: Level 4 learners get adult-style safety notes

Owner ruling on §12.7's question 5. No app changes.
- **§12.6:** a Level 4 learner sees each step's safety banner the way an
  adult profile does: the hazard, without "an adult stays in the kitchen"
  or "an adult helps", kid profile or not. The lessons' safety levels don't
  change.
- Picking Level 4 under Which program?, and its syllabus wording, tell
  parents not to assign it unless the learner can work independently. The
  owner writes that text.
- **§12.7:** question 5 marked ruled.

## 157. 2026-10-24 — Plan: week-option rulings and the new dishes checked

The owner took the recommendations on §12.7's other questions ("go with
your recommendations on the rest"). No app changes.
- **§12.2:** a week's choices are its options (best fit picks among them;
  Swap recipe lists them first, then other recipes with the skill), and a
  leavened week cooks its unleavened backup on the family's unleavened days
  instead of being passed over; a week with no backup is still passed over.
- **§12.7 rulings:** the four defaults (L4 wk 3 Chicken fajitas as Steak
  fajitas, wk 15 hollandaise over asparagus, wk 22 chicken tikka masala; L2
  wk 33 Chicken fried rice); a reviewed "watch for" list for teaching pages
  that name unclean foods; live-action clips as a later phase.
- **New dishes checked against Cook Around the World** (the §12.4
  Requirement): 59 dishes. Proposed: 2 fill pick-one groups (poaching eggs,
  breading and frying), 2 go to Appointed Times (matzah brei, roast leg of
  lamb), 21 are variations, Lasagna for 12 is the lasagna lesson at 12, and
  33 are Level only, in each Level's own Side quests unit. Waiting on the
  owner.

## 158. 2026-10-24 — Plan: the new Level dishes' table approved

The owner approved §12.7's table ("go with the table"). No app changes.
- Hollandaise over asparagus and Chicken schnitzel fill the poaching-eggs
  and breading-and-frying groups; matzah brei and roast leg of lamb join
  Appointed Times; 21 dishes are written as variations; Lasagna for 12 is
  the lasagna lesson at 12; 33 are Level only.
- Group fills, Appointed Times lessons, and variations of course dishes are
  live for every family once written; Level-only recipes wait for the next
  release.

## 159. 2026-10-24 — The kitchen's Level week (slice 12c)

Phase 12, slice 12c (plan §12.4). Behind the Next release switch.
- **Kitchen** (`public/app.js`): a profile on a Level course gets a Level
  card at the top of its main tab: the week, the unit, a mastery-week note,
  the recipe, and the drill, knowledge, and Sabbath task with their minutes
  or "Done". Parts not checked off from weeks whose recipe is cooked show
  under "Still to check off"; they never hold the schedule.
- **Part pages** (`#/kitchen/<profile>/~<week>-<part>`): in the profile's
  theme, with the page's body, steps, and quiz when written (none are yet,
  so each says to do what the title says), and **Done**. On the Sabbath,
  Done isn't offered, and the API refuses it by the family's calendar day.
- **Parent** (the course card on the Queue): this week's three parts, who
  checked each off, and **Take back** with Undo.
- **Mastery** (`public/player.js`): on a mastery week's recipe, the lesson
  card says "Mastery: cook it on your own", and Reflect asks each profile
  "Why did it work?", saved with the reflection.
- **Draft migration:** `level_tasks` (with `removed_at` for Take back) and
  `mastery_notes`. Press **Re-apply draft** on `/ops` after this deploys.
- **Library build:** each Level week carries its three part pages.
- Hours from the parts and the parts on Progress come with 12e.
- Tests: 338 (5 new in `test/worker-levels.test.js`; one 12b test now checks
  the course card's new fields). Run on a Saturday, so also run with the
  clock set to a Monday to cover Done. Checked in a browser at phone width
  on the dev server, clock set to a Monday: the Level card in both themes, a
  drill page and Done, a mastery lesson card, and the parent's Take back and
  Undo (no sideways scroll, no errors).

## 160. 2026-10-24 — Japchae in the thin-slicing group

Owner, 2026-10-24: add japchae to the thin-slicing group.
- **`content/course.json`:** Japchae (29c), a planned pick-one dish after
  Lomo saltado and Beef and broccoli: thin-sliced beef and julienned
  vegetables with sweet potato glass noodles in soy and sesame. No oyster
  sauce and no leaven. Tagged beef, ginger-soy and sweet-savory, mild, $$.
  The course has 98 dishes, still 59 numbers.
- **Picture:** a stand-in from the meat drawing, noted in
  `content/images/LICENSES.md`, until the owner's next sheet.
- **Plan §4:** the dish's row. Tests: 338 (the course test counts 98 dishes
  and checks japchae is 29c); the lesson preview rebuilt.

## 161. 2026-10-24 — Plan: japchae in Level 3 week 13

Owner, 2026-10-24. No app changes.
- **§12.7:** Level 3 week 13 ("Hot oil; a quick sauté") offers Japchae
  (29c) in place of Beef and broccoli: Garlic green beans, Sautéed zucchini,
  and Japchae. The workbook's other options are unchanged.

## 162. 2026-10-24 — Blanching in Level 3 week 13

Owner, 2026-10-24: teach blanching in week 13, for japchae and the green
beans.
- **`content/skills.json`:** a Blanching skill (60 skills; the README's
  count of 52 was out of date).
- **`content/terms.json`:** the kitchen word "blanch" (cook a minute or two
  in boiling water, then into ice water), taught in Japchae. Steps may use
  the word now.
- **Dish tags:** Japchae (29c) teaches thin slicing, stir-frying, and
  blanching (julienne taken off); Garlic green beans teaches sautéing and
  blanching.
- **`content/levels/level-3.json` week 13:** the drill is "Blanch and shock
  green beans and spinach; shimmer test for hot oil"; the knowledge page is
  "Blanching: why vegetables stay green and crisp; oils and smoke points".
  Minutes unchanged.
- **Plan §12.3 and §12.7** match. Tests: 338; lint clean.

## 163. 2026-10-24 — Best-fit recipes and Swap recipe (slice 12d)

Phase 12, slice 12d (plan §12.4). The owner confirmed the four picking
rules. Behind the Next release switch.
- **Options** (`content/levels/level-3.json`): each week's `swapIns` now
  start with the workbook's options (§12.7), week 13 with Japchae in place
  of Beef and broccoli; the swap-ins already there follow. The six options
  that are approved variations wait for their dish.
- **Library build:** each Level week carries its skill and options, and the
  Level's recipe cards carry their tags, so a recipe not written yet is
  scored by its tags.
- **Picking** (`src/worker/picks.js`, `levelPlan`): in week order, each week
  keeps its best option not already in an earlier week; one a profile on the
  course has cooked comes last; within a fit, a written recipe comes first;
  a week where nothing fits keeps its own recipe, with a note.
  `GET /api/picks/level` gives every week's options and other recipes with
  the skill, with their fit.
- **Courses** (`src/worker/plan.js`): a new Level course takes the parent's
  weeks or each week's best fit; editing takes changed weeks; a recipe can't
  be in two weeks, and a week's Skip stays with the week.
  `GET/POST /api/courses/<id>/level-week` list a week's recipes and swap one.
- **Screens:** the course editor shows each week's recipe and fit, with
  **Change** (the week's options, then "Also teaches the skill"); the
  course card's Level weeks have **Swap recipe** with Undo. Each week's
  links sit under its name so long names keep the row's width.
- Tests: 341 (3 new in `test/worker-levels.test.js`; the earlier Level
  tests ask for every week's own recipe). Checked in a browser at phone
  width: a new course's picks, Change, Swap recipe, and the edit page.

## 164. 2026-10-24 — A flaky shopping test fixed

The PR's GitHub check failed once and passed on its re-run of the same
commit: `test/worker-shopping.test.js` queued two lessons back to back, and
when both got the same millisecond their order came down to their random ids.
The test now waits a few milliseconds between them. No app changes.

## 165. 2026-10-24 — Level 3 recipe progression review (Units 1–6)

A unit-by-unit review of Level 3's weeks: whether each week's recipe and
options practise the week's skill, whether the year builds in general, and
which weeks rely on a skill from a later unit or from Level 2. Units 1–6 are
done. It lives in `docs/level-recipe-review.md`, a copy of the working doc
on claude.ai.

- **Owner rulings (2026-10-24):** nobody taking a Level has taken an
  earlier one, so reusing skills and recipes from Level 2 or earlier units is
  good review. Bread units are exempt from the difficulty climb. Side dishes
  and small dips are fine. The same dish can be in two weeks. Level 2 skills
  get quick reviews, written once Level 2 is. Wholly new recipes are allowed.
  A Level version of a dish (a variation with easier steps, like jarred
  garlic) shows for every family. Level 2 gets basic knife safety for
  chopping. A parent cuts the raw chicken in Unit 1.
- **Approved changes, Units 1–5:** Unit 1's weeks move to the thermometer
  skill, with a new cooling-and-reheating skill; Chicken adobo replaces Jollof
  rice (week 3); Turkey meatloaf replaces Swedish meatballs (week 4);
  Cinnamon rolls replaces pizza as the week 8 option; Beef tacos with pico
  becomes week 9's default; Kuku sabzi replaces Chimichurri steak (week 10);
  Ratatouille replaces the chopped salad (week 12); Chicken jambalaya
  replaces Lomo saltado (week 15); Ragù bolognese replaces the beef chuck
  ragù (week 16); Cuban black beans replaces Chana masala (week 18); Bulgur
  pilaf joins week 19. The full list is in the review.
- **Open:** Unit 6's three decisions (a pan-juice Level version of Roast
  chicken, oven-roasted BBQ pulled chicken, a glove step for Jerk chicken),
  and Units 7–9.
- Nothing in the app or content changes yet; the approved changes are built
  after the review.

## 166. 2026-10-24 — Butter chicken and Chicken jambalaya written

The owner's kids wanted to cook a chicken dish for fun, outside the course
order, so these two recipes were written.

- **Butter chicken** (`content/lessons/butter-chicken.json`): Cook Around the
  World #25 (Unit 3, "Marinating, finishing with cream"), until now a planned
  dish. Chicken thighs marinated in yogurt, lemon, and spices, browned in two
  batches, then simmered in a buttery tomato sauce and finished with cream,
  over rice. Checked at 165°F. 80 minutes (30 of them marinating), so the
  dish card's estimate of 60 is replaced. Its callback is Shakshuka's sauce. It
  is also Level 4 week 22's option 2 (plan §12.7), with chicken tikka masala
  planned as its variation.
- **Chicken jambalaya** (`content/levels/recipes/chicken-jambalaya.json`): the
  new Level 3 week 15 recipe the review approved in place of Lomo saltado
  (`docs/level-recipe-review.md`, Unit 4). Sausage and chicken browned, the
  trinity sweated, the pot deglazed with broth, and the rice cooked in it.
  Checked at 165°F. 75 minutes. Its callback is Chicken adobo's brown bits.
  It's a Level-only recipe card in `level-3.json` and week 15's option, so it
  shows only with the next release.
- **Hard rule:** the sausage is a new registry item, smoked chicken andouille
  (`chicken-sausage-smoked`), with a "check the label" note for pork casings
  and pork in the mix. Its id avoids the blocked word; its name uses the
  allowed phrase "chicken andouille".
- **New registry items:** garam masala, ground turmeric, sweet paprika,
  tomato paste, heavy cream, and the sausage. The kitchen word **deglaze**
  is now defined in `terms.json`, since the jambalaya teaches it.
- **Picture:** the retired jambalaya picture (chicken, sausage, tomato, and
  pepper; no shellfish) is back as `dishes/chicken-jambalaya.png`, with
  `tools/dish-sheets.txt` and the licenses updated.
- The Level 3 test now counts 18 Level-only recipes. The generated library and
  preview files were rebuilt.

## 167. 2026-10-24 — Beef kielbasa for the jambalaya's sausage

- Owner, 2026-10-24: beef kielbasa is a swap for the smoked chicken andouille
  in Chicken jambalaya. It's a new registry item (`beef-kielbasa`), with a
  "check the label" note: it must be all beef, collagen-cased or skinless,
  since most kielbasa is pork and many beef ones use pork casings. The
  jambalaya lists it as a substitution, and the andouille's note names it.

## 168. 2026-10-24 — Add a lesson fixed, jambalaya and butter chicken placed, Unit 7 reviewed

- **Add a lesson showed no lessons with the next release on.** Its menu was
  filled with `replaceChildren`, which takes nodes, not arrays: when there was
  no "Best for them" list (before anyone was ticked, or when nothing ranked),
  the plain list of lessons went in as one array and showed as nothing, and a
  missing group went in as the text "null". The list is now spread, empty
  parts are dropped, and a ranked lesson the family's library doesn't have is
  skipped. Checked in a browser: 38 lessons before ticking anyone, then "Best
  for them" (5) and "Every lesson" (38) after.
- **Chicken jambalaya joins Cook Around the World** (owner, 2026-10-24): a
  pick-one pair with Jollof rice, 20a and 20b, grouped by their shared skill
  (`flavor-base`). Its lesson moved from `content/levels/recipes/` to
  `content/lessons/`, its card from `level-3.json` to `course.json`, and
  Level 3 week 15 still offers it. Level 3 is back to 17 Level-only recipes.
  Its web picture was made.
- **Butter chicken is a Level 3 week 22 option** (owner, 2026-10-24), beside
  Shish taouk's other options: raw thighs cut and marinated, then cooked in
  a sauce.
- **Unit 7 (Fish) reviewed** in `docs/level-recipe-review.md`: the four
  defaults stay; each week's options are trimmed to dishes that use its
  method; week 25's baked fish gets a side from an earlier unit; Steamed fish
  is written with a foil-ball steamer and the adult pouring the hot oil; a
  new Fish in parchment packets variation for week 26; week 28's drill
  becomes searing a fillet; Coconut-crusted fish leaves the fish weeks
  (Level 4 frying, leavened panko). Six decisions are open for the owner.
  The claude.ai working copy couldn't be opened from this session, so the
  repo copy carries Unit 7.

## 169. 2026-10-24 — Unit 7 review decisions approved

- Owner, 2026-10-24: all six Unit 7 (Fish) proposals are approved and ticked
  in `docs/level-recipe-review.md`. Nothing is built yet; they go in with the
  rest of the review.

## 170. 2026-10-24 — Unit 6 decisions approved; Unit 8 reviewed

- Owner, 2026-10-24: Unit 6's three decisions are approved (a pan-juice
  Level version of Roast chicken and Roast turkey breast, BBQ pulled chicken
  roasted in the oven, a glove step for Jerk chicken).
- **Unit 8 (Stock and soup) reviewed** in `docs/level-recipe-review.md`. The
  written soups use boxed broth, so Level versions use the student's own
  stock (Matzo ball soup, Chicken noodle soup, Grilled cheese + tomato soup,
  Red lentil soup, Minestrone). Matzo ball soup's Level version starts from
  week 30's stock, not a whole raw bird. Beef and barley soup's Level version
  uses ground beef instead of chuck. Chicken stock can start from wings or
  backs. Beef bone broth's fat step is required (§2.1). Matzo ball soup
  leaves week 32's options. Seven decisions are open.

## 171. 2026-10-24 — Unit 8 decisions approved; Unit 9 reviewed

- Owner, 2026-10-24: Unit 8's seven decisions are approved.
- **Unit 9 (Balancing flavor and Sabbath capstone) reviewed** in
  `docs/level-recipe-review.md`, the last unit. Week 33's salads stay. Beef
  stew gets a chicken-thigh Level version for week 34 (chuck stays for Level
  4). Week 35's Sabbath task becomes serving the practice dish; "Shop and do
  Thursday prep" moves to week 36's drill. The capstone is main, side, bread,
  and salad, with soup as a choice. Weeks 35 and 36 can't finish in the app
  today (no recipe), so the review proposes picking their dishes from the
  Level's recipes, as a later build. Four decisions are open.

## 172. 2026-10-24 — Unit 9 decisions approved; the review is done

- Owner, 2026-10-24: Unit 9's four decisions are approved. Every unit of the
  Level 3 recipe progression review is reviewed and approved. None of it is
  built yet beyond Chicken jambalaya and Butter chicken; the changes go into
  `content/levels/level-3.json`, the lessons, and plan §12.3 and §12.4 next.


## 173. 2026-10-24 — Level 3 review applied; Fish before poultry

- **Fish before poultry** (owner, 2026-10-24): Fish is now Unit 6 (weeks
  21–24) and Poultry and roasting Unit 7 (weeks 25–28). With poultry first,
  the year dropped from the whole roast chicken to a 30-minute baked fillet.
  Fish is the gentler first raw protein, the whole bird is now the hardest
  dish right before the stock unit, and its carcass waits two weeks for week
  30 instead of six. Plan §12.3 records it; `docs/level-recipe-review.md` is
  renumbered, with a Fish before poultry section.
- **The review's week decisions are in `content/levels/level-3.json`:**
  - Weeks 1, 3, and 4 carry the thermometer skill (`temping-meat`), and
    Meatloaf (`course.json`) has it too. A new skill, **Cooling and
    reheating**, is on Chicken fried rice (lesson and card); week 3's note
    and drill say the drill's cooled rice goes into it.
  - Options trimmed to the ones that practise each week's skill, with the
    approved replacements: Chicken adobo (week 3), Cinnamon rolls (week 8),
    Kuku sabzi (week 10), Ratatouille (week 12), Cuban black beans and rice
    (week 18), Bulgur pilaf with chickpeas (week 19). Jollof rice, Swedish
    meatballs, Homemade pizza (week 8), Chimichurri steak, Chickpea chopped
    salad (week 12), Chana masala (week 18), Matzo ball soup (week 32), and
    the off-method fish dishes are gone from those weeks.
  - Week 9's default is Beef tacos with pico de gallo; Fish tacos is an
    option.
  - Notes name each Level version (ragù bolognese, pan-juice roast chicken,
    soups from the student's own stock, ground-beef barley soup, chicken-thigh
    stew), week 7's braided rolls, week 21's any-fillet baked fish with a
    side, week 22's foil-ball steamer, and week 30's wings-or-backs stock.
  - Part titles: week 24's drill is searing a fillet; week 35's Sabbath task
    is serving the practice dish; week 36's drill is Shop and do Thursday
    prep, its meal adds soup as a choice, and its reflection is the Sunday
    after.
  - Four new Level-only cards (21 in all): Beef tacos with pico de gallo,
    Kuku sabzi (the Persian cuisine is added), Cuban black beans and rice,
    and Bulgur pilaf with chickpeas. Baked salmon's card is now Baked fish
    with lemon and herbs (any clean fillet), and Steamed fish and Chicken
    stock describe the approved methods.
- Plan §12.4's recipe table follows the new week numbers, with a note on what
  the review changed. Cuban black beans and rice could be the third dish in
  Cook Around the World's dried beans and lentils group (recommendation,
  waiting on the owner).
- Tests: Level 3 has 21 Level-only recipes, and a new Level course schedules
  3 written recipes (Fish tacos left week 9's default), with 33 waiting.
- **Not built yet:** the Level-version variations, Turkey meatloaf, Fish in
  parchment packets, the new recipes' lessons, the fixes inside planned
  lessons, and weeks 35 and 36 picking their dishes. The review's Next
  session lists them.

## 174. 2026-10-24 — Level 3 Unit 1 content (slice 12f)

- Owner, 2026-10-24: 12f for Unit 1 only, for now.
- **Meatloaf with glaze** (`content/lessons/meatloaf.json`), week 4's mastery
  recipe and a Cook Around the World lesson: rolled oats soaked in milk and
  egg bind the loaf, glazed twice, checked at 160°F in the center, rested.
  Oats keep it unleavened, with gluten-free oats as the swap. Its card's
  minutes are no longer an estimate, and its main ingredients say rolled oats.
  **Turkey meatloaf with glaze** is its variation, to 165°F.
- **Thick beef burgers** (`content/levels/recipes/thick-burgers.json`), week
  2's recipe, Level only: thick patties with a dimple, seared on medium-high,
  flipped once, each checked from the side at 160°F. Its card's minutes are
  the lesson's.
- **Easy-prep Level versions** (variations, shown to every family): Shakshuka
  and Chicken fried rice use jarred minced garlic; in Chicken fried rice and
  Oyakodon a grown-up cuts the raw chicken (adult hands-on), and Oyakodon's
  onion is chopped; Smash burgers' pickles and onion are optional.
- New ingredients: rolled oats, gluten-free rolled oats, jarred minced garlic.
- **Weeks 1–4's twelve part pages** in `level-3.json`, each with a body, steps,
  and a quiz, for the owner to review: calibrating a thermometer (with the
  knife-safety quick review), the danger zone, labeling, thick vs. thin
  patties, the safe temperatures chart, an ice bath, cooling rice for the
  fried rice, cross-contamination, storing for the Sabbath, a clean station,
  the unit quiz, and reheating to 165°F.
- **Cuban black beans and rice** (owner, 2026-10-24) joins Cook Around the
  World's dried beans and lentils group. Not moved yet: a course dish needs
  its picture, `content/images/dishes/cuban-black-beans.png`, which isn't
  made. Its card stays in `level-3.json` until then.
- **Not served yet:** lessons in `content/levels/recipes/` are linted but not
  built into the app's library, so Thick beef burgers isn't cookable and week
  2 still waits as being written. That needs a build: Level-only lessons in
  the library for families with the next release.
- Tests: a new Level course schedules 4 written recipes (Meatloaf is
  written), with 32 waiting; the Level-lesson lint test sets its own minutes.

## 175. 2026-10-24 — No "holy trinity" in the recipes

- Owner, 2026-10-24: the recipes don't use the term "holy trinity" (or "the
  trinity"). Chicken jambalaya now says onion, celery, and green pepper: its
  skill line, Learn card, Why? card ("Sweat the vegetables, don't brown
  them"), quiz question, ingredient group (Vegetables), and step and timer.
  The step and Why? card ids changed with them. The same wording is in its
  `course.json` card, Level 3 week 15's note and the Cajun rice dressing card,
  plan §4 and §12.3, and the review doc. Earlier build log entries keep the
  words they had.
- Week 3's knowledge quiz asks about cooked chicken, not grilled.
- The Unit 1 part pages are in a review doc for the owner, "Level 3 Unit 1
  part pages" (claude.ai), copied from `level-3.json`; changes from the review
  go back into `level-3.json`.

## 176. 2026-10-24 — Level 3 Unit 1 pages rewritten for older learners

- Owner, 2026-10-24: the Unit 1 pages read too young for Level 3's
  learners. Plan §12.3 now has a Level 3 voice rule: "adult", never
  "grown-up"; the real terms (microorganisms, pathogens, toxins) without
  explaining them as to a young child; food-safety pages give the USDA
  guideline and its reason, and say where common practice differs.
- All 12 part pages for weeks 1–4 are rewritten in that voice. Week 1's
  knowledge page is now "Danger zone and how microorganisms grow" and names
  Salmonella, E. coli, and Listeria. Week 3 names Bacillus cereus.
- **Steak:** week 2's temperatures page gives the USDA's 145°F for whole cuts
  (medium), then explains why a well-seared intact steak eaten rare or
  medium-rare is a much smaller risk than undercooked ground meat, and where
  that doesn't hold (ground, poultry, needle-tenderized or injected meat, and
  people at higher risk). Two quiz questions test it.
- **Leftovers:** the pages give the USDA's 3 to 4 days as the guideline, say
  many families keep some foods closer to a week, explain why risk rises
  (Listeria grows in the fridge, and smell doesn't reveal pathogens), and
  leave the limit to the family. Meatloaf's tip says the same.
- The Easy-prep Chicken fried rice and Oyakodon say "An adult" cuts the raw
  chicken.
- The review doc, "Level 3 Unit 1 part pages", has the new text.
- Tests: the kitchen test expects week 1's new knowledge title. (The first
  push of this entry missed it and failed that one test; the follow-up commit
  fixed it.)

## 177. 2026-10-24 — Leftover times by kind of food

- Owner, 2026-10-24: many leftovers keep a week. Week 1's labeling page and
  the two leftover quiz questions (weeks 1 and 4) now give the USDA's 3 to 4
  days for cooked meat, poultry, soups, and stews, say many other leftovers
  keep longer and hard-cooked eggs keep a week, and leave the limits to the
  family. The review doc has the same text.
- Open for the owner: what the Sabbath task part becomes (it teaches
  Sabbath practice, which families keep differently).

## 178. 2026-10-24 — Beyond the Recipe replaces the Sabbath task

- Owner, 2026-10-24: whether one cooks on the Sabbath is debated among the
  families the app serves, so Level pages don't teach Sabbath practice. A
  page may say, as a fact, that many families cook or prep ahead so they can
  focus on resting. (The rule that nothing done on the Sabbath counts as
  schoolwork, §6.18, is about school, not cooking, and stays.)
- A Level week's fourth part is now **Beyond the Recipe**: the kitchen's part
  page, the Level 3 picker in the course editor and Chef Ruth's Getting
  started, and the manager's Level 3 page and field label say so. It's still
  stored as `sabbath` in `level-3.json` and `level_tasks`, so nothing
  already checked off is lost.
- Unit 1's four Beyond the Recipe pages are make-ahead storage: labeling
  (with the note on families prepping ahead to rest), cooling, making a dish
  ahead and storing it (week 3's new title), and reheating. The Sabbath
  claims are gone. The review doc has the new text.
- Plan §12.2 and §12.3 describe the part and the rule, with a proposed split
  for weeks 5–36, waiting on the owner: 24 make-ahead weeks and 12 weeks of
  What the Bible says about food. Weeks 5–36 keep their old titles until it's
  approved. Levels 2 and 4 still say Sabbath task in their outlines.

## 179. 2026-10-24 — Clean land animals in the Beyond the Recipe draft

- Owner, 2026-10-24: a Bible and food page on surprising clean land animals,
  like week 26's clean birds. The plan §12.3 draft puts it in week 14 (Beef
  picadillo) in place of freezing a sofrito, since freezing in portions
  comes up in weeks 5, 17, and 29. The draft is now 23 make-ahead weeks and
  13 Bible and food weeks, still waiting on the owner.

## 180. 2026-10-24 — More clean animals on the allowlist

- Owner, 2026-10-24: add the clean animals the list was missing.
  `content/rules/clean-species.json` goes from 20 to 56 species:
  - Land animals: elk, moose, caribou, reindeer, pronghorn, antelope,
    gazelle, ibex, bighorn sheep, mountain goat, water buffalo, yak, musk ox,
    and giraffe.
  - Birds: quail, pigeon, dove, pheasant, partridge, grouse, and guinea fowl.
  - Fish: carp, herring, mackerel, smelt, whitefish, perch, walleye, pike,
    bass, barramundi, mahi-mahi, snapper, grouper, sole, and flounder.
- Left off as debated: swordfish and sturgeon (their scales), and insects
  (§2.1 keeps them blocked). Ostrich and emu stay off.
- Plan §2.1 names the additions. The fat rule still covers only cattle,
  sheep, and goats; whether it reaches water buffalo and yak is open for the
  owner. No ingredient uses any of the new species yet.

## 181. 2026-10-24 — Week 2's drill uses a potato

- Owner, 2026-10-24: no extra ground beef just for a drill. Level 3 week 2's
  drill is now "Thick vs. thin: how size changes cooking time": a ¼-inch
  slice and a 1-inch chunk of potato roasted at 400°F, each checked every 5
  minutes until about 205°F. Two of the week's burger patties, one thin and
  one thick, are the option. Plan §12.3 and the review doc follow.

## 182. 2026-10-24 — Level 3 recipes are served

Phase 12, the step before 12e (plan §12.4). Behind the Next release switch.

- **The Level's own recipes are in the app's library.** `tools/build-library.js`
  builds each written lesson in `content/levels/recipes/` into the library
  with its Level (`level`), labels them L1, L2… in the order of the Level's
  recipe cards, and serves their lesson files. Thick beef burgers is L1.
- **Next release only.** `/api/library`, the parent's lesson picker, the
  queue, and Swap leave them out for a family without the next release; with
  it, Side quests has a "Level 3 recipes" shelf, named like Appointed Times
  rather than "Path 100". They're on a profile's path only through a Level
  course's plan.
- **Week 2 is cookable.** A Level 3 course's week 2 is Thick beef burgers now,
  not "being written": 5 recipes are scheduled and 31 weeks wait.
- The owner's lesson fixes (§6.11) work on a Level recipe too; their checks
  read it from `levels/recipes/`.
- Tests: 342. One new test (the shelf and the queue, with and without the next
  release); the Level course tests expect week 2's burgers.

## 183. 2026-10-24 — The Level view, Progress, and the transcript (slice 12e)

Phase 12, slice 12e (plan §12.4). Behind the Next release switch. No new
tables.

- **A Level learner's progress tab** (`public/rewards.js`): "Quest map" in
  Kitchen Quest, "My Level" in Chef's Passport. It shows "Level 3 Cook · Week 2
  of 36", a bar of the 36 weeks in their 9 units, and the hours so far of about
  125. Then what's left this week, and the units: chapters with a crest
  (Kitchen Quest) or passport pages with a visa stamp (Chef's Passport). The
  current unit is open. Each week has its recipe and four ticks (recipe,
  drill, knowledge, Beyond the Recipe). A finished Level shows its
  certificate at the top.
- **My cooking collection** opens the usual skill tree or passport and pins,
  without the dish-count ranks; Back returns to the Level.
- **Units are the ranks.** A Level learner gets no rank-up. A unit mastered
  (its mastery recipe cooked with a "why it worked") pops "Chapter cleared"
  or "Unit mastered", and finishing the capstone pops the certificate. Each
  shows once per device, after a cook or when the kitchen opens; the first
  visit on a device shows nothing, since it's all on the tab.
- **The server** (`levelProgress` in `src/worker/plan.js`) works it out from
  the profile's own work: a week's recipe ticks when the profile cooked it on
  the course (finished, not taken back, not on the Sabbath), and a part when
  it checked it off. Hours are the planned minutes of what's done. The
  kitchen's queue response carries it as `level.progress`.
- **Practice run and capstone:** once every recipe week is cooked or skipped,
  the kitchen's Level card shows week 35, then week 36, with its note, until
  the profile checks its parts off.
- **Proposed, waiting on the owner:** the capstone has no recipe yet, so it's
  finished when its three parts are checked off, which also masters Unit 9. A
  practice or capstone week's own cooking time (150 and 300 minutes) counts
  once its last part, serving the meal, is checked off.
- **The parent's Progress** shows each Level profile's hours, units mastered,
  and a table of every week with its recipe and parts ticked. Its rows (and
  the CSV) add each part checked off ("Level 3 Cook · Week 1 Drill"), with no
  grade or "Didn't make it".
- **The transcript** lists the part rows with their planned hours, counts
  "Level parts done" apart from lessons cooked, and adds the Level's hours
  toward its ~125 and the units mastered. Parts aren't graded.
- Tests: 345 (3 new in `test/worker-levels.test.js`: ticks, hours, and a
  unit mastered; the capstone and the practice week; Progress and the
  transcript, and that they're gone without the next release).

## 184. 2026-10-24 — Level parts are optional

- Owner, 2026-10-24: the drill, knowledge, and Beyond the Recipe parts are
  optional. Parents can turn them off when setting up a course, any part can
  be skipped even when on, and setup shows the hours the course will add up to.
- **Each week's parts** in the course editor for a Level: three ticks, all on
  to start, saved on the course (`course_programs.parts`, in the draft
  migration) and editable later. A part turned off is out of every week: the
  kitchen card, the progress ticks, the hours, and the transcript. The practice
  run and capstone keep all three.
- **Planned hours:** `src/content/levels.js` adds up a course's recipes
  (estimates for unwritten ones) and the parts it keeps on. The editor shows it
  live ("About 106 hours with these parts and recipes. With every part, it's
  about 126."). The learner's progress counts toward the same number.
- **Skip:** Skip this on a part page (the learner), and Skip on the course
  card (the parent, for everyone who hasn't done it). It's allowed any day,
  the Sabbath included, since it counts for nothing. A skipped part isn't left
  open, shows as skipped (a dash on the ticks), and Take back undoes it.
  Stored as `level_tasks.skipped` (in the draft).
- The capstone is finished when each part is done or skipped, with at least
  one done.
- Tests: 347 (2 new: parts off at setup and on again later, with their hours;
  a skipped part and its take back). Expected Level hours are 126 now, the
  course's own planned total, not the Level's round 125.

## 185. 2026-10-24 — Migrations squashed into one schema

- Owner, 2026-10-24: no beta testers besides the owner are in yet, so the
  schema changes are squashed. `0001_schema.sql` now holds everything:
  - the first schema
  - `0002`'s `deleted_at` and `school_name` columns on `families`, and the
    `grades` and `transcripts` tables
  - every table from the next release's draft `0003`: tastes, variations,
    learning, and the Levels, with this session's `course_programs.parts` and
    `level_tasks.skipped`
- `0002` and `0003` are deleted. There's no draft migration now; a later
  next-release table starts a new one. The draft runner, Re-apply, and
  Finalize stay for that.
- **Restore across the squash:** an export taken at `0002` or `0003` restores
  into the squashed `0001` (`SQUASHED` in `src/worker/migrations/index.js`).
  An older one is still refused. The column checks still guard every row.
- **Owner, one time, all on `/ops`** (`docs/setup.md` §8b): Download
  export.json, Clear everything, Apply pending, then Restore from
  export.json. Until then `/ops` shows `0001` as drifted and `0002` and `0003`
  as orphaned.
- Checked end to end: a database built from the old three migrations, with a
  next-release family, a Level course, and a checked-off drill, was exported,
  cleared, migrated, and restored. The course and the drill came back, and
  `/ops` reads applied.
- Tests: 348 (one new: an export at 0003 restores and one at 0017 is refused;
  the /ops draft page test runs only while a draft exists).

## 186. 2026-10-24 — Knowledge, Drill, Recipe, Beyond the Recipe

- Owner, 2026-10-24: a Level week is presented in the order Knowledge, Drill,
  Recipe, Beyond the Recipe. The order before (Recipe first, then Drill,
  Knowledge, Beyond) made no sense to the owner.
- The new order is used everywhere a week shows:
  - the kitchen's week card
  - the progress view's ticks, their key, and "Left this week"
  - the parent's course card and the Level table on Progress
  - the setup section
  - Chef Ruth's and the program picker's one-line descriptions
  - the manager's Level 3 page
- `PARTS` in `src/content/levels.js` is in this order now.
- **Setup copy** is the owner's own: the section is "Each week's components".
  It reads: "Our Level course lessons consist of four components: Knowledge,
  Drill, Recipe, Beyond the Recipe. If you'd like to skip assigning any of the
  components, uncheck them below." Under that: "Note: accumulated hours
  displayed will be adjusted based off selected components." ("unchecked"
  became "uncheck".)
- Recipe is listed in its place, ticked and greyed out ("Always included: a
  week is done when it's cooked"). The hours line says "components".
- Tests: 348; the Level tests expect the new order.

## 187. 2026-10-24 — `unleavened_dates` in the schema ahead of phase 13

- So no more schema changes are needed after the squash, Phase 13's table is
  in `0001_schema.sql` now, as plan §8.4 lists it: family, year, calendar,
  first day, unleavened from, and confirmed (plus updated_at). Nothing uses it
  yet. It's in the backup and Download our data automatically, and goes with
  the family.

## 188. 2026-10-24 — Numbered releases

- Owner, 2026-10-24: everything built for the Levels goes live for everyone,
  and the next release stays for new work. It must allow many next release
  events, one after another. Asked what's in it, the owner chose everything
  behind the switch, not only the Levels. That's Our tastes, variations,
  best-fit picks, Chef Ruth's taste features, and the recipe gaps page too.
- **Before:** one switch, launched or not. Once launched, anything new built
  behind it would have been live at once.
- **Now:** releases are numbered (`RELEASES` in `src/worker/release.js`).
  Each gated feature calls `releaseOn(db, family, n)` with its release's
  number. The stored switch keeps `live` (how many releases are launched)
  and the preview families. A preview family sees every release built.
  - Everything built so far is release 1.
  - An old stored `launched: true` reads as release 1 live.
- **`/ops` → Releases:** a table of releases and whether each is live, then
  **Launch release N for everyone** (the next in order), and **Undo launch of
  release N** (the latest launched) as its restore. A resent form does
  nothing twice. The per-family preview buttons are unchanged.
- `/api/me` gives `family.release` (the newest release the family sees) in
  place of the `next_release` true/false. The parent screens check
  `release >= 1`; a parent page names its release (`release: 1`).
- **Owner, on `/ops`:** press **Launch release 1 for everyone**. Nothing is
  live for other families until then.
- Tests: 349 (the switch test reworked for numbers; one new: the old switch
  reads as release 1, and a later release previews while an earlier one is
  live).

## 189. 2026-10-24 — The demo page's two tracks

- Owner, 2026-10-24: with the Level courses merged, the demo should present
  the two main tracks. **Cook Around the World** is for older teens and
  adults who want to practise technique and try a wide range of dishes, and
  is recipe only. **Structured Progression** is for families teaching
  cooking from the fundamentals onward, even for young cooks: complete,
  credit-able courses with Knowledge, Drill, and Beyond the Recipe beside
  each recipe.
- Owner rulings: Structured Progression is the public name for the Levels;
  Cook Around the World can still be graded; Levels 1, 2, and 4 show as
  being written; release 1 is already launched for everyone, so the demo
  can show Level content.
- **Before:** the demo was Cook Around the World only (Try it, Shopping,
  Course, Skills), with the syllabus link under the header.
- **Now** (`public/demo.js`, `public/demo.css`):
  - Under the header, a card for each track, with an Explore button; the
    syllabus link moved onto Cook Around the World's card.
  - A track switch above the tabs. Cook Around the World's four tabs are
    unchanged.
  - Structured Progression: **Try a week** (Level 3, weeks 1–4, as the
    kitchen's week card in either theme; each part opens its page with its
    steps and quiz and Done, kept for the tab only; the recipe opens the
    real player, with "cook it on your own" on the mastery week; with a diet
    that rules out the default, the first option that fits, or a note that a
    parent would swap). **The Levels** (all four, Level 3 with its units,
    goals, and weeks). **Progress** (the real Level progress view,
    `levelProgressView`, for a pretend learner in week 6 with Unit 1
    mastered, and sample transcript rows).
  - Theme, Cooking as, and Leave out show only on the tabs they change.
- `tools/build-library.js` writes `public/content/levels.json`: each
  Level's units, and its weeks with recipe titles and part pages.
- **For the owner to approve:** the two track blurbs are Claude's draft from
  the owner's words. The header copy above them is unchanged.
- Not done: the syllabus page still covers Cook Around the World only;
  Structured Progression has no syllabus link yet.
- Tests: 349, all passing; screenshots of every view sent in the session.
- `CLAUDE.md` gains a Screenshots rule (owner, 2026-10-24): every screen
  built or changed is sent to the owner as a screenshot in the session, at
  phone width and in both themes where it matters, and not committed.

## 190. 2026-10-24 — The Structured Progression syllabus

- Owner, 2026-10-24: build the Structured Progression syllabus next.
- **Before:** one syllabus, `/syllabus`, for Cook Around the World only. It
  still said a beginner track was planned.
- **Now:** `/syllabus/structured-progression/` (`public/syllabus-sp.js`):
  - The program and who it's for, by what a student can do.
  - The four Levels at a glance: where each starts, time, credit, status.
  - How a week works: Knowledge, Drill, Recipe, Beyond the Recipe with
    Level 3's average minutes; mastery weeks; the capstone; best-fit
    recipes; optional parts.
  - Level 3 in full: objectives (its unit goals), hours by part with
    `plannedMinutes` as setup counts them (about 126 with every part), the
    suggested credit, and each unit's weeks with the recipe and the three
    part titles.
  - Levels 1, 2, and 4 as outlines, being written.
  - Pacing, materials, safety and supervision, and assessment (mastery
    checks, the rubric, parts checked off, the transcript).
- `public/content/levels.json` gains each week's `recipeMinutes`, counted
  the way the Worker counts it (lesson time, else the planned dish's, else
  the Level card's).
- The Level outlines moved from `public/demo.js` to `public/level-outlines.js`,
  shared by the demo and the syllabus.
- The syllabus pages' styles moved into `public/syllabus.css`. Wide tables
  stack into labelled rows on a phone; print keeps the table.
- Links: the demo's Structured Progression card and The Levels tab; Cook
  Around the World's syllabus now points to Structured Progression in place
  of the planned beginner track, and the two syllabi link to each other.
- **For the owner to approve:** all the syllabus wording, including where
  each Level starts. Level 4's assignment note is still the owner's to write
  (§12.6); the syllabus says only that Level 4 students work on their own.
- Tests: 351 (the two new scripts parse; the new page loads its script).

## 191. 2026-10-24 — Amounts for the pita and rice served on the side

- Owner, 2026-10-24 (screenshot of the demo's shopping list): the bread
  items showed a note ("warm, for scooping", "steamed, for serving") where
  the amount should be.
- **Cause:** both lines had no amount, only a note, and the shopping list
  shows a line's note when it has nothing to measure.
- **Fix (content):** Shakshuka's pita is 6 pitas (warm, for scooping), and
  Beef bulgogi's rice is 2 cups uncooked (steamed, for serving), each still
  optional. The list now reads "1 × 6-pack of pitas" and "1 × 2-lb bag", for
  the demo and for every family. They were the only lines in the library
  with something to buy and no amount, apart from ketchup for dipping (Hash
  browns, Shoestring fries), which is left as is.
- The shopping test now checks the pita's amount and uses the ketchup line
  for a line without one. `preview/lesson-preview.html` rebuilt.
- Tests: 351, all passing.

## 192. 2026-10-24 — Ketchup for dipping is a bottle

- Owner, 2026-10-24: give the ketchup for dipping an amount, one bottle.
- **Fix (content):** Hash browns (serves 6) and Shoestring fries (serves 4)
  each list ½ cup ketchup, for dipping, still optional. It scales with the
  servings like any line, and the shopping list rounds it to **1 × 20-oz
  bottle** (a bottle is about 2⅓ cups).
- The shopping test checks the bottle, and now uses French omelet's black
  pepper ("a few grinds") for a line with no amount. Lines like that, and
  flour for dusting and flaky salt, still have no amount; each is a pinch or
  a few grinds of something the lesson buys anyway, or a kitchen staple.
- Tests: 351, all passing.

## 193. 2026-10-24 — Track buttons on the demo, and cook steps stay put

- Owner, 2026-10-24: make "Two ways to learn" two buttons side by side on a
  phone that expand when tapped; and Next step on a recipe jumped back to
  the top of the page, so anchor it.
- **Track buttons (`public/demo.js`, `public/demo.css`):**
  - **Before:** two full cards, stacked on a phone.
  - **Now:** two buttons side by side at every width, each with the track's
    name and a short line. Tapping one picks that track (the tabs below
    switch to it) and opens its details under the buttons: who it's for,
    what's in it, Explore, and its syllabus. Tapping it again closes them.
    Both start closed.
- **Cook steps (`public/player.js`, `public/themes.css`):**
  - **Before:** every redraw that moved on scrolled to the page's top. In
    the app that's the lesson's top; on the demo it's the demo's header.
  - **Now:** Next step and Back (and "next" and "back" by voice) keep the
    step where it is: the safety banner at the top of the screen, the step
    and Next step under it. A new stage starts at the lesson's top, which is
    the page's top in the app and the lesson's top on the demo.
- Tests: 351, all passing.

## 194. 2026-10-24 — Try a week: a tab for each part

- Owner, 2026-10-24: Try it should have little tabs to show all four
  components, not just the recipe. Taken as Structured Progression's Try a
  week (Cook Around the World is recipe only).
- **Before:** the week card listed the four parts as rows. A part's row
  opened its page in place of the tab, with a back link; the recipe's row
  opened the player.
- **Now (`public/demo.js`, `public/demo.css`):** under the week's heading,
  four small tabs in the owner's order, Knowledge, Drill, Recipe, Beyond the
  Recipe, each with its minutes or "Done ✓". The open tab's page shows right
  under them in the card: a part's reading, steps, and quiz with Done; the
  recipe's picture, skill, time, servings, the week's note, and **Cook it**,
  which opens the real player. Knowledge is open first; the open tab is kept
  for the visit, like the week. The separate part page is gone.
- Tests: 351, all passing.

## 195. 2026-10-24 — Demo header: beta testing is live

- Owner, 2026-10-24: "Beta testing will begin shortly" is out of date.
- **Before:** "Beta testing via invitation will begin shortly."
- **Now** (`public/demo.js`), in the owner's words: "Beta testing is now
  live. To participate, search Clean Plate Recipe App on Facebook."
- Tests: 351, all passing.

## 196. 2026-10-25 — Level 3 Unit 2: yeast dough

Phase 12, slice 12f, Unit 2 (plan §12.4).

- Owner, 2026-10-25: one unit at a time. All new copy goes to a review doc,
  "Level 3 Unit 2: Yeast dough", so corrections land before merge and no
  lesson's version goes up. Level 3 is release 1, so this is live for every
  family on merge, not behind a new release.
- Owner, 2026-10-25: the Beyond the Recipe plan is confirmed: a make-ahead
  task where the dish suits one, What the Bible says about food in the other
  weeks. All 32 titles for weeks 5–36 are set in `level-3.json` (most old
  titles said "for the Sabbath"). Week 36's is now Giving thanks for food, in
  place of serving the meal; the review doc asks the owner to confirm that.
- **Pita bread** (`content/lessons/`, lesson 37b in the flatbreads pair): 8
  pitas baked on a sheet pan heated at 475°F. A flat pita is still good
  bread, and the lesson says so.
- **Challah** (`content/lessons/`, the yeast dough group): 3-strand braid,
  egg wash twice, checked at 190°F. Made with oil, so it's dairy-free.
- **Sandwich loaf** and **Dinner rolls** (`content/levels/recipes/`, Level
  only): a loaf kneaded to a windowpane and checked at 190°F; 12 rolls
  weighed on a scale, 2 or 3 shaped as knots or small braids. The rolls are
  made the same day; the overnight cold proof is week 7's Beyond the Recipe.
  Their cards' minutes are the lessons'.
- Every Unit 2 bread blooms active dry yeast in liquid checked at 105 to
  110°F, the week 5 drill.
- **Weeks 5–8's twelve part pages**, in the Level 3 voice: how yeast works,
  gluten, proofing, doneness, and the unit quiz; a three-temperature yeast
  test, kneading to a windowpane, dividing by weight, and braiding (drills
  use a flour-and-water dough with no yeast); freezing pita, a cold proof,
  and two Bible pages: Bread in the Bible (Exodus 16, Matthew 6, John 6) and
  Leaven and unleavened bread (Exodus 12, 1 Corinthians 5, Leviticus 23,
  Matthew 13).
- New registry entries: active dry yeast, a kitchen scale, a 9-by-5-inch
  loaf pan, and the kitchen word "proof" (taught in Challah).
- Level 3's hours with every part are now about 128 (126 before); the
  written recipes' minutes replace the estimates.
- Screenshots were sent in the session, taken from the demo's Try a week
  pointed at Unit 2 for that only. The demo still shows Unit 1.
- Tests: 351. The Level course test now schedules 9 written recipes, with
  27 waiting; the hours tests expect 128.

## 197. 2026-10-25 — How much? in Cook mode, and kitchen words on part pages

- Owner, 2026-10-25: add the kitchen words for Unit 2 and link them; and in
  a cook, a way to see how much of an ingredient a step uses, either by
  tapping the ingredient or with one How much? button. Claude built the
  button: kitchen words are already tappable in step text, and two kinds of
  tappable word in one sentence would be hard to tell apart.
- **How much?** (`public/player.js`, `src/content/amounts.js`): a Cook mode
  step that names ingredients has a How much? button beside Why?. It opens
  "How much, for 8" with each named ingredient's lines at the cook's size,
  any swap, and the group where one ingredient is in two (challah's eggs:
  Dough and Egg wash). A step names an ingredient by its name or a run of
  its words ("flour", "chicken"); describing words alone ("brown", "fresh")
  and general ones ("sauce", "powder") don't count; a longer name claims its
  words, so "vegetable oil" isn't olive oil and "garlic powder" isn't
  garlic; any fish is "the fish"; a {qty:} placeholder names its ingredient.
  Wash steps and left-out ingredients show nothing. It closes when the step
  changes.
- **Kitchen words** (`content/terms.json`): bloom, shaggy dough, tacky,
  windowpane test, egg wash, poke test, crumb, and enriched dough, beside
  proof (build log 196). Knead is now practiced in Pita bread, the first
  written lesson that kneads.
- **Kitchen words on part pages:** a Level's knowledge, drill, and Beyond
  the Recipe pages (the kitchen's and the demo's) underline kitchen words,
  and a tap opens the word's card under its paragraph (`markTerms` and
  `toggleTermCard` in `src/content/terms.js`).
- The review doc has the new words and the button's copy. Screenshots were
  sent in the session.
- Tests: 355 (four new: which ingredients a step names).

## 198. 2026-10-25 — Level 3 Unit 3: knife cuts

Phase 12, slice 12f, Unit 3 (plan §12.4). Owner, 2026-10-25: Unit 3 the
same way as Unit 2: the copy in a review doc, "Level 3 Unit 3: Classic knife
cuts and honing", the kitchen words added and linked, live on merge.

- **Beef tacos with pico de gallo** (week 9, Level only): pico diced to
  ¼ inch with the pinch grip and the claw; ground beef browned to 160°F, its
  fat spooned off and thrown away cooled.
- **Tabbouleh** (week 10, Level only): two bunches of parsley minced by
  rock-chopping; fine bulgur soaked, not cooked. Bulgur is wheat; no
  gluten-free swap.
- **Vegetable stir-fry with tofu** (week 11; lesson 9c, the stir-frying
  group, for every family): carrots and pepper julienned ⅛ inch, tofu pressed
  and crisped in batches, hard vegetables first, garlic and ginger last.
  Tamari is the gluten-free swap. Its card's minutes are now the lesson's 60.
- **Israeli salad** (week 12, mastery, Level only): every cut unaided, a
  ¼-inch dice, dressed right before serving.
- **Weeks 9–12's twelve part pages:** parts of a knife and knife safety,
  honing vs. sharpening (with how to hone), why even cuts cook evenly, and
  the classic cuts by size with the unit quiz; drills dicing three onions,
  mincing parsley and garlic (garlic in oil is kept cold: botulism), a
  measured julienne, and a timed dice; Beyond the Recipe: chopping ahead,
  storing herbs, prepping salad vegetables, and gleaning (Leviticus 19:9–10,
  Deuteronomy 24:19–22, Ruth 2).
- **Kitchen words:** pinch grip, claw, hone, plank, brunoise, batonnet,
  chiffonade.
- New ingredients: fine bulgur (#1), snow peas.
- **How much?** reads names more carefully: a word before the last stands
  alone only if it isn't another ingredient's name ("rice" isn't rice
  vinegar, "chicken" isn't chicken broth); "the pepper" next to a bell pepper
  isn't black pepper, but "salt and pepper" is. When a step says which group
  it means ("the beef's salt", "the eggs for the dough"), only that group's
  line shows.
- Screenshots were sent in the session, taken from the demo's Try a week
  pointed at Unit 3 for that only.
- Tests: 356. A Level course now schedules 13 written recipes, with 23
  waiting; best fit's "written option first" check moved to week 15, since
  week 9's own recipe is written now.
## 199. 2026-10-25 — Level 3 Unit 4: sautéing and aromatic bases

Phase 12, slice 12f, Unit 4 (plan §12.4). Owner, 2026-10-25: more units,
starting with 4, from the Unit 3 review template. The copy is in a review
doc, "Level 3 Unit 4: Sautéing and aromatic bases", and goes live for every
family on merge.

- **Garlic green beans** (week 13, Level only): beans blanched 3 minutes in
  salted water, shocked in ice water, patted dry, then sautéed in oil
  checked by the shimmer test, garlic last. **Sautéed zucchini**, an approved
  week 13 option, is its variation: no blanching, three batches, salted at
  the end.
- **Beef picadillo** (week 14, Level only): the sofrito sweated on
  medium-low and moved to a bowl, so the beef browns in a hot, dry pan;
  160°F, fat spooned off, then a simmer with tomato sauce, raisins, and
  olives, over rice.
- **Cajun rice dressing with beef** (week 15, Level only): beef browned for
  fond, onion, celery, and green pepper sweated in the same pan, deglazed
  with beef broth
  and cooked down, cooled rice folded in. Rice cooked the day before works,
  reheated to 165°F (Unit 1).
- **Beef ragù** (week 16; lesson 22c, the braising group, for every family):
  chuck seared in batches, a soffritto, tomato paste cooked, deglazed, and
  braised 2½ hours until it reads 195°F and shreds. **Ragù bolognese** is
  its Level version and week 16's mastery recipe: ground beef browned in two
  batches to 160°F and a 1½-hour simmer, no whole-cut searing (Level 4). The
  pasta water boils in a new stockpot.
- **Weeks 13–16's twelve part pages:** blanching and smoke points, browning
  (the Maillard reaction and caramelization), aromatic bases across
  cuisines, and sweat vs. sauté with the unit quiz; drills blanching beans
  and spinach with a shimmer test, sweating vs. browning onions, deglazing,
  and an unaided vegetable sauté; Beyond the Recipe: blanching for the
  fridge and freezer, clean land animals (Leviticus 11:1–8, Deuteronomy
  14:3–8), salt (Leviticus 2:13, Matthew 5:13, Colossians 4:6), and a sauce
  made a day ahead.
- **Kitchen words:** sweat, fond, shock, smoke point, aromatics, mirepoix,
  soffritto, sofrito. Deglaze now points to Chicken
  jambalaya, and shimmer to Vegetable stir-fry with tofu.
- No "holy trinity" anywhere (owner's ruling, build log 175, repeated
  2026-10-25): the rice dressing, week 15's knowledge page, the unit quiz,
  and the kitchen words say onion, celery, and green pepper instead.
- Owner's edits in the review doc, 2026-10-25: week 14's drill dices one
  onion and splits it into two piles, and its Beyond the Recipe asks the
  learner to research the giraffe (split hooves? chews the cud? clean?) in
  place of picking an animal from the page's list.
- New ingredients: fresh green beans, beef chuck roast, beef broth, canned
  tomato sauce, raisins, pimento-stuffed green olives. New tool: a stockpot.
- Level 3's hours with every part are now about 130 (128 before); the
  written recipes' minutes replace the estimates, and Beef ragù's card is
  230 minutes.
- Screenshots were sent in the session, taken from the demo's Try a week
  pointed at Unit 4 for that only. The demo still shows Unit 1.
- Tests: 356. A Level course now schedules 17 written recipes, with 19
  waiting; best fit's "written option first" check moved to week 24, since
  week 15's own recipe is written now.

## 200. 2026-10-25 — Level 3 Unit 5: legumes and grains

Phase 12, slice 12f, Unit 5 (plan §12.4). Owner, 2026-10-25: Unit 5, the
same way as Unit 4. The copy is in a review doc, "Level 3 Unit 5: Legumes
and grains", and goes live for every family on merge.

- **Red lentil soup (mercimek)** (week 17; lesson 18b, the cooking dried
  beans and lentils group, for every family): lentils picked over and
  rinsed, simmered over a sweated onion and carrot until they melt, cooled
  5 minutes and blended with the stick blender kept under the surface (the
  hot-blending step the recipe review asked for), finished with lemon and
  paprika butter.
- **Red beans and rice** (week 18, for every family): kidney beans picked
  over and soaked overnight (quick-soak as the fallback), a 10-minute hard
  boil (the review's ask), a gentle 1½-hour simmer, and a cup mashed for
  creaminess. The sausage is optional beef kielbasa, with chicken andouille
  as the swap, to match week 18's note; its course card says so now.
- **Rice pilaf** (week 19, Level only): orzo and rinsed rice toasted in
  butter, hot broth, 15 minutes covered and a 10-minute rest. The orzo is
  optional, so the pilaf can be gluten-free.
- **Mujaddara** (week 20, mastery; the crisping group, for every family):
  brown lentils simmered 12 minutes for a head start, onions fried slowly
  in olive oil until crisp and salted after, the rice toasted in that oil,
  then lentils and rice cooked together.
- **Weeks 17–20's twelve part pages:** legume types and cook times, why
  beans are soaked (and the kidney-bean hard boil), absorption vs. pasta
  method with ratios, and a grains-of-the-world worksheet with the unit
  quiz; drills picking over and cooking red and brown lentils, quick-soak
  vs. overnight soak, toasted vs. plain rice, and a grain cooked without a
  recipe card; Beyond the Recipe: freezing soup in portions, soaking and
  freezing beans ahead, Daniel 1, and cooking grains ahead and reheating
  them with steam.
- **Kitchen words:** legume, pick over, quick-soak, hard boil, absorption
  method, pilaf.
- New ingredients: red lentils, brown lentils, dried red kidney beans, orzo.
- Level 3's hours with every part are now about 131 (130 before).
- Screenshots were sent in the session, taken from the demo's Try a week
  pointed at Unit 5 for that only. The demo still shows Unit 1.
- Tests: 356. A Level course now schedules 21 written recipes, with 15
  waiting.

## 201. 2026-10-25 — Level 3 Unit 6: fish

Phase 12, slice 12f, Unit 6 (plan §12.4). Owner, 2026-10-25: Unit 6, the
same way as Units 4 and 5. The copy is in a review doc, "Level 3 Unit 6:
Fish", and goes live for every family on merge.

- **Baked fish with lemon and herbs** (week 21, Level only): salmon, with
  cod or tilapia as the cheaper swaps; pin bones felt for and pulled with
  tweezers; baked at 400°F to 145°F. Unit 5's rice pilaf cooks alongside,
  and the fish goes in when the rice timer shows 15 minutes left, so both
  finish together (the review's "side from an earlier week").
- **Steamed fish with ginger and scallion** (week 22, Level only): a
  heatproof plate on three foil balls in the large pot; cod steamed to
  145°F; ginger and green onion julienned; the adult lifts the hot plate and
  pours oil heated only until it shimmers. **Fish in parchment packets** is
  its variation and week 22's option: no boiling water and no hot oil.
- **Cod poached in tomato sauce** (week 23, Level only): a sweated onion,
  tomatoes with olives and capers simmered thick, cod poached under the lid
  on low to 145°F.
- **Pan-seared trout** (week 24, mastery, Level only): fan on and a window
  open first (the review's ventilation step), skin dried, pressed flat, and
  left until it releases; finished with butter and lemon. Tilapia is the
  swap, with a note that it has no skin.
- **Weeks 21–24's twelve part pages:** fins and scales, reading fish labels
  and names, why fish cooks faster than meat, and a species ID unit quiz;
  drills on pin bones, freshness, doneness by flaking, and searing one
  fillet skin side down; Beyond the Recipe: dishes that serve well cold,
  loaves and fishes and breakfast on the shore (Matthew 14, John 21), a
  sauce made ahead with the fish cooked fresh, and firstfruits and tithing
  (Deuteronomy 14:22–29, Proverbs 3:9). The blocked-word check covers every
  page, so unclean water animals are described by what they lack.
- Owner, 2026-10-25: week 24's tithing page names all three tithes. The
  first went to the Levites (Numbers 18:21, 24); the second the family ate
  at the place God chose (Deuteronomy 14:22–27); and every third year a
  third tithe for the poor was given in addition, while families still
  traveled and ate the second (Deuteronomy 14:28–29). The first draft had
  the third-year tithe replacing the second.
- Owner, 2026-10-25: "We still keep the tithe laws." The page is in the
  present tense: the three tithes are kept today, the first is the LORD's
  (Leviticus 27:30), the second keeps the feasts, and the third is set aside
  every third year as well. Its family step plans a dish for the feast
  with the second tithe.
- **Kitchen words:** fillet (steps can't use it until it has a card), pin
  bones, steam (underlined as "steamed" and "steaming" only), flake, in
  parchment.
- New: skin-on trout fillets, and tweezers for pin bones.
- Level 3's hours with every part are now about 132 (131 before).
- Screenshots were sent in the session, taken from the demo's Try a week
  pointed at Unit 6 for that only. The demo still shows Unit 1.
- Tests: 356. A Level course now schedules 25 written recipes, with 11
  waiting; best fit's "written option first" check moved to week 25.

## 202. 2026-10-25 — Level 4 planned

Planning only; nothing in the app changed. Owner, 2026-10-25: plan Level 4
now, ahead of Level 2.

- **Recipe review** (`docs/level-recipe-review.md`, Level 4 Chef): every
  week of the owner's outline (plan §12.6) read against its skill, the climb
  across the year, and what Level 3 teaches first. The main finding: Chicken
  pot pie (week 9) needs a velouté that Unit 4 teaches in week 14, so the
  review proposes swapping Units 3 and 4 (sauces in weeks 9–12, pastry in
  13–16, still clear of spring). Smaller fixes: week 2's scaling done by
  hand and checked against the app's amounts; chiffonade moved to week 1;
  the chuck-cubing drill moved from week 7 to week 5; week 6's knowledge on
  fat and trimming, sourcing left to week 31; a grill-pan and oven backup
  for grilling; a USDA note on hollandaise; four added options. Its
  decisions are a checklist for the owner.
- **Build plan** (plan §12.8, phase 14 in the phase table): Level 4's
  content file and checks, Which program? with the owner's warning,
  adult-style banners for a cook where every profile is an adult or on
  Level 4, **Write my recipe** for the weeks the student plans (24, 28,
  32–36) through the family recipe editor, the capstone portfolio, the
  syllabus and demo, and the content written a unit at a time.
- Questions for the owner: an "adult at home" line for weeks 18–20 (the
  owner's plan asks for it, the adult-style banners don't say it); whether
  week 31's sourcing page mentions the sciatic nerve (Genesis 32:32);
  typed or uploaded portfolio work; and the warning's wording, which is the
  owner's to write.

## 203. 2026-10-25 — The Levels re-plan: shared units by cooking method

Planning only; nothing in the app changed.

- Owner, 2026-10-25, after reviewing all four Level outlines: each Level
  must stand alone with a real skill set across most types of cooking, and
  the Levels must still look like a progression. The outlines didn't do
  both: each Level owned its own kinds of cooking (fish, poultry, and soup
  only in Level 3; pastry, frying, and grilling only in Level 4; no poultry,
  fish, or soup in Level 2), so one Level alone left big gaps.
- Decided: a spiral. The same units in every Level, organized by cooking
  method, with one early unit on choosing and handling meat, poultry, and
  fish; unit lengths can differ; recipes picked by each Level's difficulty
  scale, not by cuisine; the presentation by Level approved; and Level 3
  re-planned rather than patched.
- New plan §12.0 records it. §12.1, §12.3, §12.5, §12.6, §12.7's week
  options, and §12.8's week-by-week parts are marked replaced until each
  Level's new weeks go in. The Level 4 review (entry 202) is marked
  replaced.
- The working doc, [The Levels re-plan](https://claude.ai/artifact/344145zznjKnNzLjXMTZgJ),
  holds the draft nine units, the difficulty scale for each Level, the skill
  ladder, what happens to Level 3's written work, and the open decisions.
- Owner, 2026-10-25: picking by difficulty must not mean picking
  American. Other cultures' quick, everyday home dishes are researched from
  home-cooking sources inside each cuisine (plan §12.0), with examples in
  the re-plan doc's new Cuisines section. Proposed: every week has a
  non-US option, and each unit's defaults span at least three cuisines.
- Owner, 2026-10-25: two main dishes every recipe week at every Level,
  one Familiar (dishes US families know, not only American) and one
  Explore, with the family picking the default and a one-tap swap on the
  kitchen's week card (plan §12.0; the re-plan doc's new Two dishes a week
  section, with the proposed setup default, who can swap, the shopping
  check, and best fit's smaller role).
- Owner, 2026-10-25: the learner can swap the week's dish from the
  kitchen, and the parent sees it and can Undo.

## 204. 2026-10-25 — Release 2: the Levels re-plan, gated

- Owner, 2026-10-25: "Gate our redesign behind a release switch." The
  whole re-plan (plan §12.0) is **release 2**.
- Correction: entries 202 and 203 and the first draft of the re-plan doc
  said today's Level 3 was behind the switch and seen only by preview
  families. It isn't: it's release 1, launched for everyone (entries 186,
  196). It stays live and unchanged until release 2 launches; courses
  already on it keep it to the end, and the new Levels get their own ids
  (`sp-1` to `sp-4`).
- **Before:** `/ops` offered Launch for the next release as soon as it was
  listed in `RELEASES`.
- **Now:** a release can be marked `building` (`src/worker/release.js`).
  It previews for preview families like any release, but `/ops` shows it
  as "Being built: preview only", offers no Launch button, and refuses a
  launch sent anyway ("still being built … Nothing was changed"). Release
  2 is listed and marked building. Nothing is gated on it yet, so no family
  sees any change.
- Owner, 2026-10-25: "take all your suggestions for the rest." Every open
  item in the re-plan doc is confirmed: the nine units, their order and
  lengths, the same at every Level; frying in Stovetop and grilling in Oven
  and grill; Level 4's cuisines named per week; the difficulty scales and
  the linter warning; the skill ladder as drafted; Level 4's "Have an adult
  at home" for deep frying and grilling; all Level writing held until the
  new weeks are approved; a non-US option every week and three cuisines per
  unit; the setup default preset from "how adventurous"; best fit only
  filling in for diet or tools. Level 4's portfolio is typed in the app.
  Plan §12.0 and §8.6 are updated.
- Screenshots of the Releases section and the refusal were sent in the
  session.
- Tests: 357 (a release still being built previews but can't be launched).

## 205. 2026-10-25 — Level 3's new weeks proposed

Planning only; nothing in the app changed.

- Owner, 2026-10-25: plan Level 3's weeks on the shared units. The
  proposal is in the doc [Level 3 Cook: the new 36 weeks](https://claude.ai/artifact/HAXqrVAgaEh6BGphYoq8uc),
  waiting on the owner unit by unit (plan §12.0).
- Each week takes a Level 3 row of the skill ladder, with a Familiar and an
  Explore dish at Level 3's difficulty, and its drill, knowledge, and
  Beyond the Recipe (23 make-ahead, 13 Bible and food: 8 written, 5 to
  write). No raw meat before Unit 3; each unit's Familiar and Explore
  dishes each span at least three cuisines.
- The `familiar` tag decided each dish's slot, so ratatouille, red beans
  and rice, red lentil soup, and chicken piccata (tagged new-ish) aren't
  Familiar picks; they and the other unpicked Level 3 recipes stay live in
  today's Level 3 and as fallbacks.
- 68 dishes: 14 written, 2 variations of written lessons, 16 planned in
  Cook Around the World, 1 Level card, 35 new. About 45 of today's 72 part
  pages carry over.
- The Explore dishes were checked against home-cooking search results
  (sources in the doc) for being home dishes and for their usual hidden
  sources, each written around (lard in tortillas, shells, conchas, and
  empanada dough; pork in hambagu, sausage, and some noodle and omelet
  versions; shrimp in jollof bouillon and moqueca; oyster sauce; bouillon in
  suya and yassa). Weeks 29–33, which usually fall on Unleavened Bread, are
  unleavened as planned.
- Owner, 2026-10-25, on the proposal: "very little fish, no lamb", and a
  note on week 21. Changes in the doc: the soup make-ahead page and the
  Hospitality page swapped weeks (now 19 and 20); lamb kofta (week 7) and
  a lamb and apricot tagine (week 33); fish added in weeks 26 (rava fish
  fry), 29 (sheet-pan salmon, psari plaki), and 30 (Baja fish tacos), with
  canned tuna as a week 6 choice; hambagu, milanesa, kuku sabzi, chicken
  yassa, and meatloaf moved to fallbacks.
- Owner, 2026-10-25: No-cook drops to two weeks so salads don't run three
  weeks in a row, and Stovetop gains a fish week: week 24 is pan-seared
  trout or salmon skin-side down (Familiar) and steamed fish with ginger
  and scallion (Explore), both already written. The shared units move to
  No-cook 5–6, Meat 7–10, Baking 11–15, Boiling 16–20, Stovetop 21–26, for
  every Level (plan §12.0). The doc also has a count of main proteins by
  unit, Familiar and Explore.
- Owner, 2026-10-25: steaming is Unit 5's ("it's unit 5 we reference
  steaming"). Week 18 is now a steaming week (salmon and vegetables steamed
  in a basket; Cantonese steamed fish, written), and week 17 takes beans and
  lentils together (pinto bean burritos; mujaddara), so red-red and the
  lentil soup move to fallbacks. Week 24 is both dishes seared skin-side
  down (pan-seared trout or salmon, written; Korean pan-fried mackerel,
  godeungeo-gui). Unit lengths are unchanged.
- Owner, 2026-10-25: lamb stays Explore-only at Level 3 ("familiar may not
  like lamb, it's kind of an acquired taste"). Level 4 is to bring in new
  proteins such as quail and duck, noted in plan §12.0 for when its weeks
  are planned.
- Complexity review (owner, 2026-10-25), in the Level 3 doc's new
  Complexity across the year section: each dish rated 1–5 for parts to
  time, decisions, and cook time, bread exempt. The year climbs (units
  2.6, 1.75, 2.75, bread, about 3.1–3.2 for Units 5–7, 3.7, capstone),
  with four dips inside units, each fixed by reordering weeks (proposed:
  fish before poultry in Unit 3, steaming first in Unit 5, the skin-side
  sear before the stir-fry in Unit 6, the whole roast chicken as Unit 7's
  mastery) and a timed side for week 26's rava fish fry.
- Owner, 2026-10-25: "apply all five." In the Level 3 doc: fish (week 8)
  before poultry (week 9); steaming first in Unit 5 (16), then grains
  (17), beans and lentils (18); the skin-side sear (23) before the
  stir-fry (24); Unit 7 runs sheet-pan (27), fish timed with a side (28),
  the broiler (29), and whole roast chicken or piri-piri as the mastery
  (30); week 26's rava fish fry comes with lemon rice and a cucumber salad.
  Bible and make-ahead pages moved with their dishes; weeks 29–33 stay
  unleavened.

## 206. 2026-10-25 — Level 2's new weeks proposed

Planning only; nothing in the app changed.

- Owner, 2026-10-25: plan Level 2 with the same rules as Level 3, using
  rotisserie chicken and more canned and frozen ingredients where they make
  a dish enjoyable without being overwhelming. The proposal is in the doc
  [Level 2 Apprentice: the new 36 weeks](https://claude.ai/artifact/7b8KuJsihfkFkFZ1ZQKD9y),
  waiting on the owner unit by unit (plan §12.0).
- Same nine units and weeks as Level 3, at Level 2's limits (10
  ingredients, 12 steps, under 45 minutes hands-on, a paring knife on soft
  foods). A Familiar and an Explore dish each recipe week; mastery weeks
  4, 6, 10, 15, 20, 26, 30, 33; the capstone is one Sabbath dish from a
  prep list. 13 kid-level Bible and food pages, 23 make-ahead.
- 68 dishes: 11 written Cook Around the World lessons (each needs a
  Level 2 version), 2 variations, 8 planned, 47 new. All 108 part pages are
  new.
- Unit 7 starts with the broiler; Unit 8 simmers rather than braises
  (braising is Level 3's). Week 4's Explore mastery (ful medames) gains
  baked pita chips and a salad to match the Familiar dish.
- Hidden sources written around: lard in refried beans, taco shells, flour
  tortillas, and Welsh cakes; pork in "chicken" potstickers, sausage,
  giniling, and the hot dogs in Filipino baked macaroni; salted shrimp in
  gyeran-jjim; seafood in pajeon; oyster sauce; bouillon cubes; shrimp
  paste in tom kha pastes. Weeks 29–33 are unleavened as planned.
- Flagged for the owner: fish is thin (4 dishes, Units 1–3), with two
  suggested swaps.
- Owner, 2026-10-25: week 27's Explore is broiled miso-glazed salmon, in
  place of halloumi skewers, for 5 fish dishes in Level 2.
- Owner, 2026-10-25: week 19's Familiar is black bean tortilla soup, with
  rotisserie chicken as a choice, so a family on Familiar defaults cooks a
  bean dish too.

## 207. 2026-10-25 — Level 4's new weeks proposed

Planning only; nothing in the app changed.

- Owner, 2026-10-25: plan Level 4. The proposal is in the doc
  [Level 4 Chef: the new 36 weeks](https://claude.ai/artifact/JMPw926naDNJf7d2oQPq6X),
  waiting on the owner unit by unit (plan §12.0).
- Same nine units and weeks, at Level 4's difficulty (no ingredient or
  step limit, three or more parts timed together, up to two days, precise
  cuts, breaking down birds, deep frying and grilling). Each week names a
  cuisine, taught on its Knowledge page.
- New proteins: duck (weeks 8 and 32), quail (10), and goat (31); lamb in
  29 and 30; all Explore. Adult at home in weeks 26 and 28. Mastery weeks
  offer the student's own dish through Write my recipe; weeks 34–36 are the
  student's menu, budget, and meal for household and guests.
- 66 dishes in weeks 1–33: 6 written, 2 approved variations, 10 planned,
  5 carried from §12.7, 43 new. All 108 part pages are new. The old Level 4
  outline's other dishes are replaced.
- Hidden sources written around: pork cured meats on the antipasto, lard in
  store pastry and crusts, suet in patties and dafina's casing, pork in
  sausage gravy, Canadian bacon, feijoada, mapo tofu, Swedish meatballs,
  and the cassoulet-style duck; shrimp paste in curry paste; beef, goat,
  and lamb fat skimmed and thrown out (birria recipes often fry tortillas
  in it). No wine, following the library's broth rule. Weeks 29–33 are
  unleavened as planned.
- Owner, 2026-10-25: "I miss the yeast rolls and sandwich bread." Level 3
  week 12's Familiar is the written Sandwich loaf and week 13's the written
  Dinner rolls (with their written cold-proof page), in place of homemade
  pizza and cinnamon rolls. A separate breads course is noted in plan §12.0
  as an idea to decide.

## 208. 2026-10-25 — Re-plan build, 14a: the data model

Phase 14 (plan §12.9), behind release 2. Owner, 2026-10-25: "start
building what we have and do level 1 later." The Level 2, 3, and 4 docs are
taken as approved.

- **Before:** every Level unit had exactly 4 weeks; a week held one recipe;
  a week could cook only its own Level's cards; every Level, its recipes,
  and its courses were gated on release 1.
- **Now:**
  - `content/level-units.json`: the nine shared units and their lengths
    (4, 2, 4, 5, 5, 6, 4, 3, 3).
  - A Level file can set `release`. A release 2 Level must use the shared
    units (names and lengths) and give each recipe week a `familiar` and an
    `explore` dish; any week can name its `cuisine`
    (`content/schema/level.schema.json`).
  - The linter checks the pair (both known, different, each in one week
    only), warns when a dish's `familiar` tag doesn't match its slot, and
    lets a week cook another Level's card or recipe; a card lives in one
    Level only (`src/content/lint.js`).
  - The library carries each Level's release, its weeks' pairs and
    cuisines, and the other Levels' cards its weeks use
    (`tools/build-library.js`). The public `levels.json` (demo and
    syllabus) leaves out release 2 Levels until launch.
  - The Worker shows a Level in Which program?, its own recipes and Side
    quests unit, its best-fit page, and any course on it only to a family
    whose release has reached the Level's (`levelsOn`, `levelLessonOn` in
    `src/worker/plan.js`; `api.js`, `picks.js`, `swap.js`).
- No family sees a change: no release 2 Level exists yet (14b adds them).
- Phase 14 in the phase table replaces the old Level 4 row; §12.8's
  features are slice 14f.
- Tests: 360 (the shared units and the pair, a card in one Level and cooked
  by another, and a release 2 Level hidden until the family has release 2).

## 209. 2026-10-25 — Review of the 14b weeks; owner's calls

Planning only; nothing in the app changed. Claude reviewed the Level 2, 3,
and 4 week docs that 14b turns into the Level files, for progression and
range. The owner's calls on the findings:

- **Level 4 week 33:** the Familiar dish is cholent (beef, beans, barley,
  potatoes, held overnight; no kishke) in place of brisket, so both dishes
  teach the week's overnight hold. Explore running harder than Familiar at
  Level 4 is fine.
- **The same dish at more than one Level** (fajitas, teriyaki, chicken
  Caesar, spaghetti and meatballs, chili, chicken noodle soup) stays, as
  long as its steps differ by Level: shortcuts vs. scratch, or the cook
  seasoning the meat and sauce themselves. Each is one lesson with Level
  versions.
- **Level 2 rice and knives:** rice from a rice cooker or heat-and-serve
  rice, so dishes served with rice keep to one heat source; a chef's knife
  for big chop work where a dish needs it, with a parent assisting.
- Recorded in plan §12.0, the Level 2 and Level 4 docs, and the re-plan
  doc's difficulty scale and Familiar and Explore section.

## 210. 2026-10-25 — The 14b review's smaller fixes

Planning only; nothing in the app changed. Owner, 2026-10-25: Level 4's
Unit 2 may cook some parts ("ok"); "the rest you can fix."

- **Level 2:** weeks 7 and 8 swapped, so the thermometer week (burgers)
  comes before the first other ground-beef dish (tacos, now with the label
  week). Week 2's molletes are baked, not broiled, until the broiler week
  (27). Weeks 2, 4, and 16 cook one part first and hold it, so one heat
  source is on at a time. Unit 8 offers a slow cooker for the simmer.
- **Level 3:** week 26's cucumber salad is made ahead (two parts finish
  together, Level 3's limit); week 24's lomo saltado uses oven fries
  before frying is taught; week 28's Familiar is sheet-pan cod, so salmon
  isn't four of the five Familiar fish.
- **Shared lessons:** Level 2's chicken Caesar wraps, sheet-pan fajitas,
  and meatballs in marinara are variations of written lessons (the
  meatballs the same variation as Level 3's); Level 2's and Level 3's
  chicken noodle soup are one new lesson with two Level versions; Level 4's
  teriyaki salmon side is a variation of Pineapple teriyaki salmon. Counts
  in plan §12.0 updated.
- **The re-plan's ladder** now matches the weeks: no frittata or quiche in
  Unit 7 (quiche is Level 4's Unit 4), Level 3's oven bake is psari plaki,
  Level 4's is lasagna and moussaka, Level 2's broiling is nachos, and hot
  holding is 140°F, the USDA figure.

## 211. 2026-10-25 — Re-plan build, 14b: the Level 2, 3, and 4 files

Phase 14 (plan §12.9), behind release 2. Owner, 2026-10-25: start 14b,
in sections; ChatGPT prompts first, four dishes a sheet; a doc of every
part page to review; and fix the recurring resting line.

- **Pictures:** 136 dish prompts, 34 sheets of four (sheets 29–62), in
  [Level dish pictures: ChatGPT prompts](https://claude.ai/artifact/PbGHZTt9e78S2SbwtyYVMB),
  in week order. Sloppy joes and chicken noodle soup get fresh pictures
  rather than their retired ones, so every sheet has four. The cards keep
  their meal-type drawings until the sheets arrive.
- **Registries:** seven skills for Level weeks (knife grip and safety,
  setting out first, measuring and scaling, reading labels, steaming,
  seasoning by taste, grilling over two zones); twelve cuisines (Spanish,
  Welsh, Irish, Finnish, Hungarian, Georgian, Mozambican, Singaporean,
  Thai, Indonesian, Venezuelan, Trinidadian); goat and "duck and quail"
  as taste proteins; a card's `variationOf` names the written or planned
  dish it varies, and the linter checks it.
- **Level files** (`content/levels/sp-2.json`, `sp-3.json`, `sp-4.json`,
  release 2): units with their goals, 36 weeks each with a skill, a
  Familiar and an Explore dish, notes (shortcuts, Level versions, an
  adult at home), mastery weeks, and part titles at each Level's minutes;
  Level 4 names a cuisine every recipe week, and weeks 34–36 are the
  student's own menu. Side quests units 102 (A), 103 (K), and 104 (C).
  - 136 recipe cards with tags and estimated times: 47 in Level 2, 38 in
    Level 3, 51 in Level 4. Level 2 cooks Level 3's spaghetti and
    meatballs and chicken noodle soup cards with its own steps.
  - Level 3 carries 45 written pages from today's Level 3, edited to
    their new weeks and dishes (old week and unit numbers, old dishes,
    week 16's make-ahead sauce, week 7's knife review).
  - Level 2's recipe estimates add up to about 67 hours (set as its
    hours), under the planned 72, until they're written and timed.
- **Resting line:** 12 of today's Level 3 make-ahead pages ended "…or so
  they can focus on resting". Each now closes on its own payoff; the
  resting fact stays on two pages (a cold meal, a pot made ahead). Plan
  §12.2 records the rule for new pages.
- **Review doc:** [Level part pages](https://claude.ai/artifact/PYqCyTko7F9fK4NWbZciNc)
  lists all 324 pages with a one-line summary, marking the carried pages
  and the seven that join two of today's pages.
- **A course on a new Level** (preview families only): the three Levels
  show in Which program?. Until 14c adds each course's Familiar or Explore
  pick, a week's recipe in the library is its Familiar dish
  (`tools/build-library.js`), so a course runs on Familiar dishes in week
  order instead of coming out empty. While today's Level 3 and the new one
  both show, the new one reads "Level 3 Cook (new plan)", and the Levels
  are listed in order (`public/app.js`). A course still skips weeks whose
  dish isn't written, so a new Level 3 course opens on week 4 (minestrone)
  until 14g writes the recipes.
- Owner, 2026-10-25: pan-seared trout (Level 3 week 23's Familiar) and
  eggs Benedict (Level 4 week 17's) are retagged everyday, so they fit
  their Familiar slots. Eggs Benedict's tag also counts in Cook Around
  the World's best fit.
- Tests: 362 (a course on Level 3 plans its Familiar dishes; the three Levels in the library, release 2, a pair each
  recipe week, the mastery weeks, and Level 4's cuisines; the Level
  tests now expect the re-planned Levels beside today's Level 3 for a
  preview family).

## 212. 2026-10-25 — Re-plan build, 14c planned: a course on a new Level

Planning only; nothing in the app changed. Owner, 2026-10-25: "Plan phase
14c." The plan is in plan §12.9 under 14c, as recommendations until the
owner confirms them:

- Which program? offers a release 2 family the new Levels only, as after
  launch; courses on today's Level 3 run to the end.
- Setup and Chef Ruth ask **Each week starts with: Familiar or Explore**,
  preset to Explore only for "Bring it on".
- Draft migration `0002` with one table, `course_starts`, applied from
  `/ops`.
- Each week's dish is worked out from the course's start slot, falling back
  to the other dish when the diet or tools rule one out or it isn't written
  yet; best fit only when both are ruled out. Weeks the parent changed keep
  their pick.

## 213. 2026-10-25 — 14c: "A bit adventurous" starts with Explore

Planning only; nothing in the app changed. Owner, 2026-10-25: "A bit
adventurous should be explore." Plan §12.9's 14c preset is now Explore for
"Bring it on" or "A bit adventurous", and Familiar for "Stick to what we
know" or not set.

## 214. 2026-10-25 — 14c: two more of the owner's calls

Planning only; nothing in the app changed. Owner, 2026-10-25, "yes" to
both:

- Preview families are offered the new Levels only at Which program?, as
  after launch; today's Level 3 isn't offered to them for a new course.
- A week whose chosen dish isn't written yet cooks its other dish when that
  one is written, instead of being skipped.

Recorded in plan §12.9 under 14c.

## 215. 2026-10-25 — Reset: the first Level 3 retired, the schema squashed, release 1 is the Levels

Owner, 2026-10-25: "We don't have any real families yet. So if we can, lets
reset and squash the schema file. Get rid of the old level 3 stuff from the
ui and the plans around it, maintaining only the recipes or pages we are
salvaging, but under the new level 3. The cook around the world and all its
functionality stay in prod, the new courses behind the release button, which
is reset to release 1." On the public pages: "Follow the switch."

- **Before:** release 1 (live for everyone) was the first Level 3, Our
  tastes, variations, best-fit picks, and the recipe gaps page; release 2
  (being built) was the re-planned Levels 2, 3, and 4. Preview families saw
  both Level 3s in Which program?, the second as "(new plan)". The public
  demo and syllabus were built on the first Level 3.
- **Now:**
  - **Releases** (`src/worker/release.js`): one release, **release 1, the
    Levels**, being built (`LEVELS_RELEASE`). Our tastes, variations, picks,
    learning from Reflect, Chef Ruth's taste questions, and the recipe gaps
    page are ungated: every family has them, as part of Cook Around the
    World. The switch is kept under a new settings key, `releases`, so the
    live database's old launch of release 1 doesn't turn the Levels on for
    everyone before the reset.
  - **The first Level 3 is gone:** `content/levels/level-3.json` and six
    Level-only recipes no new Level uses (beef tacos with pico, Cajun rice
    dressing, garlic green beans, Israeli salad, poached cod, rice pilaf).
    The eight it salvages (thick burgers, sandwich loaf, dinner rolls,
    tabbouleh, beef picadillo, baked fish, steamed fish, pan-seared trout)
    are the new Level 3's own cards and its Side quests unit (103, K
    labels); its 45 carried part pages were already there (entry 211).
  - **A Level has no `release` of its own:** every Level runs on the shared
    units with a Familiar and an Explore dish each recipe week; the linter
    and schema lost the old single-recipe week.
  - **Schema** (`0001_schema.sql`): rewritten as one clean file, phase and
    "next release" notes taken out, with 14c's `course_starts` table in it,
    so 14c needs no migration. The squash map for old exports is gone.
  - **Public pages follow the switch:** the Worker serves
    `/content/levels.json` empty until release 1 is launched. Until then the
    demo is Cook Around the World only and the Structured Progression
    syllabus says it's coming; Cook Around the World's syllabus stops
    linking to it. After launch, both are built on Levels 2, 3, and 4: the
    demo's Try a week uses the first four fully written Level 3 weeks, with
    Cook this instead for the other dish; The Levels and the syllabus show
    each week's two dishes. `public/level-outlines.js` keeps only what the
    content doesn't (time, credit, who it's for).
  - **Manager:** Level 2, Level 3, and Level 4 tabs; a week edits its
    Familiar and Explore dishes and can pick any Level's card.
  - **Chef Ruth's tour** has a stop for Our tastes, now an ordinary parent
    screen.
  - `tools/dev-server.js`: `/__live?n=1&preview=<email>` sets the release
    and a preview, for session screenshots.
- **Plan:** §12.3 and §12.5 to §12.7 removed (the first Level 3's weeks and
  build history, the old Level 2 and 4 outlines, the week options
  workbook); §12.1, §12.2, §12.4, and §12.8 rewritten as the rules still in
  force; §8.4, §8.6, §6.16, §6.17, §6.21, the phase table, and 14c updated.
  `docs/level-recipe-review.md` (the first Level 3's review) is deleted.
- **Owner, one time, all on `/ops`** (`docs/setup.md` §8b): Clear
  everything, Apply pending, sign up again, make yourself the owner, and
  turn your family's preview on to see the Levels. Until then `/ops` shows
  `0001` as drifted.
- Screenshots (phone width, light and dark) of the demo and syllabus before
  and after launch, Which program?, Our tastes for a family without the
  preview, and the manager's Level pages were sent in the session.
- Tests: 361. The Level course tests run on the new Level 3 (its first
  written week is 4, Minestrone); the "without the next release" tests now
  check that every family has tastes, variations, and picks; new: the
  Levels show to a preview family before launch and to everyone after, and
  `/content/levels.json` is empty until launch.

## 216. 2026-10-25 — Re-plan build, 14c: a course on a new Level

Phase 14 (plan §12.9), behind release 1. Owner, 2026-10-25: "Build 14c."
During the build the owner made three calls, now Requirements in §12.0 and
§12.9:

- "I do not think preferences should alter the recipes for a level course
  outside the two tracks."
- "If both dishes would be ruled out, we need to tell them, not just hide
  it… they need a 'request a replacement' button to funnel it up so we can
  write an alternative or a variant. Then they can proceed to the next week
  if they want."
- The learner's kitchen links to it, since parents will know something
  needs doing "when their kid brings them a screen with an issue"; and a
  missing tool can move a week to its other dish.

- **Before:** a new Level course kept each week's best fit from Our tastes,
  among its Familiar dish and swap-ins (the Explore dish wasn't a choice),
  saved as a row for every week. A week whose dish was hidden by the diet
  settings was passed over without a word.
- **Now:**
  - **Each week starts with: Familiar or Explore** on setup and in Chef
    Ruth's Getting started, preset from "how adventurous" (Bring it on or A
    bit adventurous → Explore), changeable in Edit course; kept in
    `course_starts`. The course card says "Starts with Familiar" or
    "Starts with Explore".
  - **Each week's dish is worked out when the plan is read**
    (`levelWeekDishes` in `src/worker/plan.js`): a week the parent changed
    or skipped keeps its row; a dish on the queue, a shopping list, or
    cooked stays; otherwise the start slot's dish, or the other when the
    diet settings hide it, it needs a tool the family doesn't have, or only
    the other is written. Rows are saved only for weeks the parent changed,
    so changing the start re-points the rest. Put back on a week that cooks
    its own Familiar or Explore dish drops its row.
  - **Best fit no longer picks Level weeks.** `/api/picks/level` returns
    each recipe's fit for Change and Swap recipe only; the week's own dishes
    list first, in order. The setup's per-week best-fit notes are gone.
  - **A week whose two dishes are written and both ruled out waits, and
    says why.** It isn't queued and holds the course. The parent's course
    card names each dish, what it uses that the diet settings leave out,
    and the tools it needs that the family marked they don't have, asks
    whether those are still the right settings, and offers Check diet
    settings, Check our tools, Request a replacement (with Undo), Go on to
    the next week (Skip this recipe, with Put back), and Change. Setup's
    week list shows the same notice. The learner's kitchen shows "Needs a
    parent" on the recipe and a **Show a parent** button to the course
    card.
  - **Request a replacement** saves to `level_requests` in the release's
    draft migration, `0002_levels.sql`. Recipe gaps lists **Level weeks
    requested** with the reasons counted, no family named, and Open in the
    manager.
  - Setup's week list shows each week's Familiar and Explore dish, the one
    it cooks ticked.
- **Owner, on `/ops` after it deploys:** press **Apply pending** for
  `0002` (draft). Request a replacement says requests open after that.
- Screenshots (phone width; light and dark for parent screens, Kitchen
  Quest and Chef's Passport for the kitchen) of setup's start question and
  week list, the course card's notice before and after a request, the
  kitchen's week card, and Recipe gaps were sent in the session.
- Tests: 367. Level course tests now start with Familiar, and week 5 cooks
  its written Explore dish (tabbouleh). New: the preset from each "how
  adventurous" answer; Familiar and Explore courses; diet and tool
  fallbacks; a changed week survives a change of start while a queued dish
  stays; a blocked week waits unqueued, says why, takes a request counted
  on Recipe gaps, goes on with Put back, and cooks again once the settings
  change; backup export and import carry `course_starts`.

## 217. 2026-10-25 — 14d: the owner's calls

Planning only; nothing in the app changed. Owner, 2026-10-25, answering the
open questions on the kitchen's week card:

- A learner's swap changes the week for everyone on the course.
- The dish being cooked is highlighted; the default isn't marked.
- Put back wipes a swap.
- No swapping on the Sabbath.
- The shopping check opens the list preview for the new dish, with what the
  old list had preselected as already have, each one untickable: "just
  cause they made a list doesn't mean they already bought it."

Recorded in plan §12.0 and §12.9 under 14d. Before, §12.0 said a swap after
the shopping list was made only said what was missing.

## 218. 2026-10-25 — Re-plan build, 14d: Cook this instead

Phase 14 (plan §12.9), behind release 1. Owner, 2026-10-25: "Build 14d",
and for a learner's swap after the shopping list was made: "Yes show
parent."

- **Before:** the kitchen's Level week showed one recipe. Only the parent
  could change a week (the course editor or Swap recipe), and a change after
  the shopping list was made said nothing about the list.
- **Now:**
  - **The kitchen's week card** shows the dish being cooked as the Recipe,
    labelled Familiar or Explore, and the other dish under it with **Cook
    this instead**. A dish the diet settings or a missing tool rule out says
    so; one still being written, or in another week, isn't shown. No
    swapping on the Sabbath.
  - **A swap is for the whole course:** the week's row and its queued lesson
    move to the new dish for every profile on it. The swapping learner's
    card says "You picked … instead of …" with **Undo**; a sibling's says
    who picked it.
  - **The parent's course card** lists the week's two dishes, the one
    cooking highlighted, with **Cook this instead** and Undo, and a
    learner's swap with the parent's **Undo**. Swap recipe (12d) runs
    through the same swap.
  - **Put back wipes a swap**, and its dish comes off the queue, so the
    week follows its start again.
  - **The shopping check:** when the old dish is on a shopping list and the
    new one isn't, the parent's swap opens **What it needs**, the list
    preview for the new dish, with what the old list had ticked as already
    have, each untickable. A learner's swap shows **Show a parent** in the
    kitchen; the course card's notice has See what to buy and **We have
    what it needs** (with Undo). A list made for the new dish clears it.
  - New in the draft migration `0002_levels.sql`: `level_swaps`.
- **Owner, on `/ops` after it deploys:** if `0002` is already applied, press
  **Re-apply draft** for it; otherwise **Apply pending**. Until then a swap
  still works, but who made it and the shopping notice don't show.
- Screenshots skipped this session, at the owner's word.
- Tests: 370. New: the kitchen's two dishes; a learner's swap for the whole
  course with Undo, a sibling's view, and the parent's Cook this instead
  and Undo; only this week, only its dishes; a swap survives a change of
  start, Put back wipes it, and a ruled-out dish is no choice; the shopping
  preview after a swap with the old list preselected, We have what it
  needs with Undo, and a new list clearing the notice. Every swap test
  expects a refusal when run on the Sabbath.

## 219. 2026-10-26 — Plan 14e: Level versions and step pictures

Plan only; no code. The owner's calls on presentation by Level (§12.0, 14e).

- **Before:** §12.0 and 14e called for "a coaching setting per Level in the
  player."
- **Now:**
  - **Presentation comes from each Level's written version** of a recipe,
    not from the player adapting one recipe (owner: "the original idea was
    writing level appropriate variations of the recipes"). The coaching
    setting is gone. Level 3 and Level 4 use the same player.
  - **Step pictures at every Level** (owner: "since video is too expensive
    I definitely think we should do pictures"): shown under the step on
    Level 2 versions, behind **Show me** on Level 3 and 4. Made like the
    dish pictures, from ChatGPT sheets the owner uploads.
  - 14e also has a Level week play its own Level's version of a shared
    lesson, never one picked by best fit.
  - **Claude's proposals, confirmed by the owner ("Yes to all"):** pictures on 3–4 key
    steps a recipe, one sheet per recipe; the Levels before Cook Around the
    World; a writing standard per Level that the linter warns on.

## 220. 2026-10-26 — Level week numbers on recipe cards; more 14e calls

Owner, 2026-10-26: Cook Around the World recipes on a Level course "show
numbers that are all out of order for how they present in a level course"
("Or hide the numbers"). Also the owner's yes to Claude's 14e proposals.

- **Before:** a Level learner's recipe card showed Cook Around the World's
  numbers: "Path 1 · Quest 27 of 59" in Kitchen Quest, "Lesson 27 of 59" in
  Chef's Passport, and "Path 1:" on More recipes' shelves.
- **Now:**
  - **In the player,** a Level learner's card says "Level 3 Cook · Week 4"
    for a recipe on their course, and just the Level's name for one that
    isn't. Lesson numbers in the Learn cards and fix notes are hidden.
  - **On More recipes (Side quests),** a card says "Week 9" for a recipe on
    the course; others show no number ("Side quest" in Kitchen Quest).
    Shelves show the unit's name without "Path 1:".
  - The kitchen's Level data has `week_of`: each recipe's week on the
    course.
- **Plan, 14e:** Level 2 is written for a beginner of any age; a parent
  setting per learner for step pictures (shown, or behind Show me); no
  switching to another Level's version inside a course; Cook Around the
  World recipes on a Level week get Level versions in 14g.
- Screenshots (phone width, Kitchen Quest and Chef's Passport) of the
  player's card and More recipes were sent in the session.
- Tests: 370. The kitchen test checks `week_of`.

## 221. 2026-10-26 — Re-plan build, 14e: step pictures and Show me

Owner, 2026-10-26: "Go" (build 14e's player work: step pictures, Show me,
and the parent's setting).

- **Before:** a lesson step had words only (with its tip, look note, Why?,
  and How much?).
- **Now:**
  - **Step pictures in lesson files:** `"picture":
    "steps/<lesson>/<name>.png"` on a step, from
    `content/images/steps/<lesson>/`. The schema, the content editor (a
    Step picture field), and the linter (the file must exist) know it.
    `tools/build-dish-images.py` makes its web copy in
    `public/img/steps/`, and the content-publish workflow passes new ones to
    it. A test checks every step picture has a web copy.
  - **In the player:** the picture shows under the step's words, or a
    **Show me** button (an eye icon) opens it, with **Hide the picture** to
    close it. It closes on the next step. Kitchen Quest frames it in gold;
    Chef's Passport as a snapshot.
  - **Step pictures setting:** Set up a course and Edit course have **Step
    pictures** for each learner on a Level course: Under each step, or
    Behind Show me, with "the Level's way" marked (Level 2 under each step,
    Level 3 and 4 behind Show me). Only a change from the Level's way is
    kept. The kitchen's Level data says how this learner's pictures show.
    Outside a Level course, pictures are behind Show me.
  - New in the draft migration `0002_levels.sql`: `course_pictures`.
  - `tools/split-step-sheet.py`: cuts a 2×2 ChatGPT sheet of step
    pictures into four square PNGs named for their steps.
- **Owner, on `/ops` after it deploys:** press **Re-apply draft** for
  `0002` (or **Apply pending** if it isn't applied). Until then a course
  still saves, and step pictures follow the Level, with a note saying so.
- No lesson has a step picture yet: the first prompt sheets come next.
- Screenshots (phone width) of a cook step with Show me, opened, and shown
  under the step, in Kitchen Quest and Chef's Passport, and Edit course's
  Step pictures in light and dark, were sent in the session. They used a
  stand-in picture that isn't in the repo.
- Tests: 375. New: step pictures follow the Level and each learner's pick
  (Level 3 and Level 2, a bad value, someone not on the course, saving
  without the setting, back to the Level's way); a course saves before the
  draft and its pictures follow the Level; the linter refuses a missing or
  misnamed step picture.

## 222. 2026-10-26 — Re-plan build, 14e: Level versions and the writing standard

Owner, 2026-10-26: "skip picture prompts for now, do the rest" of 14e.

- **Before:** a Level week cooking a Cook Around the World lesson played the
  family's taste pick or the best fit, like any other cook, and nothing
  checked a Level recipe against its Level's writing.
- **Now:**
  - **A Level's version** is a variation with `"level"` (sp-2, sp-3, or
    sp-4), one per Level, which may keep the lesson's name. On that Level's
    course the kitchen, the course card, and shopping use it, with no
    Version button; until it's written, the lesson itself. It's never a
    taste pick (the Version dialog refuses it), never the best fit, and not
    counted in Recipe gaps. The player doesn't call it "a version of".
  - **The content editor:** Add a variation asks what it's for, a
    preference or a Level's version; a Level's version says so on its page
    and in the lesson's list, and keeps its Level when edited.
  - **The writing standard, as linter warnings** (Claude's numbers):
    Level 2, a step over 25 words, a "!", or fewer than half the steps with
    a tip or "should look like"; Level 4, more than a third of the steps
    with a tip. Each Level file lists the written lessons its weeks cook
    with no version for it yet.
- Tests: 380. New: a Level course plays the lesson itself over the
  family's taste pick, and buys for it; it plays the Level's version, with
  no Version button, which isn't offered off the course or pickable; the
  linter's Level version rules and writing warnings.

## 223. 2026-10-26 — Level dish pictures: sheets 29–33 and 40–44

Owner, 2026-10-26: ten ChatGPT sheets from [Level dish pictures: ChatGPT
prompts](https://claude.ai/artifact/PbGHZTt9e78S2SbwtyYVMB), five for
Level 2 and five for Level 3 (sheet 40 is Levels 2 and 3).

- **Before:** Level recipe cards had only a meal-type drawing (`art`).
- **Now:**
  - 40 dish pictures, matched to the prompt doc's sheets 29–33 and 40–44,
    saved to `content/images/source/` under the doc's names, cropped into
    `content/images/dishes/<card id>.png`, and built to
    `public/img/dishes/`. Each was checked by eye for unclean foods: none
    (the potatoes have no bacon, the kimbap has egg and vegetables, no ham
    or crab stick).
  - Hand cuts, written down in `tools/dish-sheets.txt`: ajapsandali and
    solterito touched on sheet 42; onigiri's and kimbap's plates had gaps in
    their rims, so they were cut with a filled mask to keep the plate.
  - **A recipe card's picture:** `"image": "dishes/<id>.png"` on a Level
    card (the level schema), on all 40. The linter checks the name and the
    file, and that a written lesson for the card uses the same picture. A
    test checks every card picture has a web copy.
- The app shows a Level card's picture once its lesson is written; none of
  these 40 is written yet.
- Tests: 381.

## 224. 2026-10-26 — Level dish pictures: sheets 45–54

Owner, 2026-10-26: ten more ChatGPT sheets from [Level dish pictures:
ChatGPT prompts](https://claude.ai/artifact/PbGHZTt9e78S2SbwtyYVMB), "the
rest of missing L3 art and some L4", matched to the prompt doc's sheets.

- **Before:** Level 3's sheets 45–50 and Level 4's sheets 51–54 hadn't
  arrived, so those cards had only a meal-type drawing.
- **Now:**
  - 40 dish pictures, matched by eye to sheets 45–50 (Level 3, with sheet 50
    shared with Level 4) and 51–54 (Level 4), saved to
    `content/images/source/` under the doc's names, cropped into
    `content/images/dishes/<card id>.png`, built to `public/img/dishes/`,
    and listed in `tools/dish-sheets.txt`. Every sheet cropped cleanly with
    the tool; no hand cuts.
  - `"image"` added to the 40 cards in `sp-3.json` and `sp-4.json`.
  - Checked by eye for unclean foods: none. The sausages and the antipasto
    meats look like pork in the pictures, but their cards say beef or chicken
    sausage, and beef bresaola and beef salami; godeungeo-gui is mackerel,
    which has fins and scales.
- Level 3 now has a picture on every recipe card from the prompt doc. Still
  to come: Level 2's sheets 34–39 and Level 4's sheets 55–62.
- Tests: 381.

## 225. 2026-10-26 — Re-plan build, 14f: Level 4's own features

Owner, 2026-10-26: wrote the note parents see before assigning Level 4, and
asked for 14f (plan §12.8).

- **Before:** Level 4 looked like any Level. Its learners got kid safety
  banners, "Have an adult at home" was only in two weeks' notes, nothing let
  a learner write its own recipe, and the capstone's written parts had
  nowhere to go.
- **Now:**
  - **The owner's note** (`ASSIGN_NOTES`, `src/content/levels.js`, word for
    word) shows under Which program? when Level 4 is picked, in Chef Ruth's
    setup (with Keep Level 4 Chef or Cook Around the World instead), and in
    the syllabus's Level 4 section.
  - **Adult-style banners:** `/api/profiles` gives each profile its active
    Level (and a kid's device now sees each sibling's audience and Level).
    The player shows only the hazard when everyone on the cook is an adult
    or on Level 4; one kid not on Level 4 brings the kid banners back.
  - **Have an adult at home:** `adultAtHome` on Level 4's weeks 26 and 28
    (the linter allows it on Level 4 only). The week card and the recipe's
    first step say it.
  - **Write my recipe:** `ownRecipe` on Level 4's mastery weeks and weeks
    34–36. The week card has Write my recipe, which opens the family recipe
    entry flow for the learner (the parent's flow, now shared as
    `recipeFlow`), with every hard-rule check. It's saved to Our recipes and
    kept for the week in `level_recipes`. On a mastery week it becomes the
    week's recipe for everyone on the course, as a swap with Undo, and
    counts like any recipe (Progress, hours, mastery); one sent for review
    waits, then Cook this instead picks it. On weeks 34–36 it's a recipe for
    the capstone menu, cooked from the card; the plan doesn't change. The
    learner can edit its own. Edit course keeps it as the week's recipe.
  - **The portfolio:** a part page's `write` boxes (week 34's menu, budget,
    and guest list; week 35's prep timeline; week 36's reflection essay) save
    per profile in `level_writing`, not on the Sabbath, and print after the
    transcript as "Level 4 Chef portfolio", on its own pages. A deleted
    profile takes its writing with it.
  - Both tables are new in the draft migration `0002_levels.sql`.
  - The box labels and hints, and the Write my recipe and portfolio wording,
    are Claude's draft for the owner to change.
- **Owner, on `/ops` after it deploys:** press **Re-apply draft** for `0002`.
  Until then, Write my recipe and the writing boxes say they're waiting for
  it, and nothing else changes.
- Screenshots (phone width), sent in the session: setup's note (light and
  dark), Chef Ruth's note, the syllabus's note (light and dark), the week
  card before and after Write my recipe, a first step with Have an adult at
  home, and a page with writing boxes (Kitchen Quest and Chef's Passport),
  Write my recipe (light and dark), and the transcript's portfolio (light
  and dark). Week 26's dish isn't written yet, so the kitchen screenshots
  used a stand-in Level 4 week 1 (adult at home, a mastery week, and writing
  boxes) that isn't in the repo.
- Tests: 392. New: the owner's note; each profile's Level; Level 4's adult
  weeks; writing saved, replaced, cleared, refused (wrong box, too long, no
  Level 4, another family, before the draft), printed as the portfolio, and
  deleted with its profile; Write my recipe on a mastery week (checks, a
  kid's login, the whole course, the queue, edit by its writer only, Undo
  and back, cooked into Progress), only on its week, kept through Edit
  course, capstone menu recipes, and before the draft; the linter's
  `adultAtHome`, `ownRecipe`, and writing box rules.

## 226. 2026-10-26 — 14g content: Level 3 Unit 1

Owner, 2026-10-26: "Start with Level 3 Unit 1", the first unit of 14g
(plan §12.9). Reviewed in [14g review: Level 3 Cook, Unit
1](https://claude.ai/artifact/87vWCFZFenAy9FDYHVbdXt); not merged until the
owner approves it there.

- **Before:** Unit 1 had one written recipe (Minestrone, Cook Around the
  World's lesson), so a Level 3 course waited until week 4 to cook, and
  week 3's Knowledge page was blank.
- **Now:**
  - **Seven Level-only recipes** in `content/levels/recipes/`, unit 103:
    Black bean and vegetable quesadillas and Rajma (week 1, dicing),
    Spaghetti aglio e olio and Scallion oil noodles (week 2, fine chopping),
    Vegetable lo mein and Kimbap (week 3, julienne), and Ajapsandali (week 4,
    the timed mastery dice). Checked against Cook Around the World first
    (§12.4): the dicing, fine-chopping, and julienne pick-one groups are full,
    and none is a variation of a planned dish. Their cards' minutes are now
    the recipes' own (370 in all, against 350 estimated).
  - **Minestrone's Level 3 version** (`"level": "sp-3"`): sized cuts (½-inch
    onion, celery, and zucchini; ¼-inch carrot), a timed knife check, and no
    beginner tips. Level 3 has no lessons left without a version in Unit 1.
  - **Week 1 uses jarred minced garlic** (owner, 2026-10-26: "Youre asking
    for a mince not taught yet"): mincing is week 2's skill, so the
    quesadillas and rajma measure jarred garlic instead of mincing cloves.
  - **Week 3's Knowledge page:** reading a recipe for timing, a prep list,
    mise en place, and why a scale beats cups, with a 7-question quiz.
  - **New ingredients:** canned red kidney beans, lo mein egg noodles, thin
    wheat noodles (watch: some have egg), nori (watch: plain sheets, not
    seasoned snacks), short-grain rice, green cabbage.
  - **Clean foods:** no oyster sauce in the lo mein, no ham, imitation crab,
    or fish cake in the kimbap, and vegetable oil, not lard, for the scallion
    oil. Kimbap's egg has a wash step and a doneness check.
- A Level 3 course now starts cooking in week 1. The Level course tests
  (`test/worker-levels.test.js`) start there, or skip weeks 1–3 where they
  need week 4; the Level version test uses the real minestrone version.
- No screens changed, so no screenshots.
- Tests: 392.

## 227. 2026-10-26 — 14g content: Level 2 Unit 1

Owner, 2026-10-26: "begin unit 1 of level 2 while I review" (Level 3 Unit
1). Reviewed in [14g review: Level 2 Apprentice, Unit
1](https://claude.ai/artifact/5ChtD3ZAUh9VAnHy3cnv21); not merged until the
owner approves it there.

- **Before:** none of Level 2 Unit 1's dishes was written except Cook Around
  the World's grilled cheese and tomato soup, which chops with a chef's
  knife and uses a stick blender. Its 12 part pages were blank.
- **Now:**
  - **Seven Level-only recipes** in `content/levels/recipes/`, unit 102:
    Caprese sandwiches and Onigiri with tuna (week 1, knife safety),
    Molletes (week 2, the oven with mitts), Loaded baked potatoes and Bún
    bowl with chicken (week 3, mise en place), and Mini pita pizzas and Ful
    medames with pita chips (week 4, measuring, the mastery week). None fits
    a pick-one group with room or is a variation of a planned dish (§12.4).
    Their cards' minutes are now the recipes' own.
  - **Grilled cheese + tomato soup's Level 2 version:** no onion, chef's
    knife, or blender; jarred garlic; the soup made first and held off the
    heat; every step rewritten to Level 2's standard. 45 minutes.
  - **Nothing before it's taught** (the owner's note on Level 3's garlic):
    week 1 cuts only soft foods with a paring knife; the stove and oven
    start in week 2; nothing is diced, minced, or a hard vegetable. Jarred
    garlic, shredded carrots, and jarred salsa stand in.
  - **All 12 part pages:** knife rules, the bridge and claw, cutting ahead;
    burns and pan fires, mitts and handles, soup made ahead; parts of a
    recipe, mise en place, gleaning (Ruth 2); halving and doubling, dry and
    wet measuring, a yogurt dip made ahead.
  - **New tools:** paring knife, serrated bread knife.
  - **New ingredients:** fresh and shredded mozzarella, Monterey Jack,
    ciabatta and bolillo rolls (watch: lard), cooked short-grain rice
    pouches, rotisserie chicken (watch: no bacon or ham in the seasoning),
    shredded carrots, fish sauce (anchovy; watch: no shrimp or squid),
    roasted peanuts, mushrooms, canned fava beans, pizza sauce.
- The content check finds no Level 2 writing warnings.
- No screens changed, so no screenshots.
- Tests: 392.

## 228. 2026-10-26 — 14g content: Level 4 Unit 1

Owner, 2026-10-26: "Start Level 4 Unit 1 while I review." Reviewed in [14g
review: Level 4 Chef, Unit 1](https://claude.ai/artifact/6jLt9HvV7Ng1QSzg8zKVNY);
not merged until the owner approves it there.

- **Before:** Unit 1's Familiar dishes in week 1 were Cook Around the World
  lessons with no Level 4 version; chana masala (week 3) was a Cook Around
  the World card with no lesson; the other five dishes and all 12 part pages
  were unwritten.
- **Now:**
  - **Five Level-only recipes** in `content/levels/recipes/`, unit 104:
    Steak fajitas and Bò lúc lắc (week 2, weighing and yield), Chicken
    enchiladas (week 3, scaling 4 to 12 by hand), Salade niçoise with seared
    tuna and Bibimbap (week 4, the timed mastery week). All "solo", with
    weights in grams where the unit weighs. Their cards' minutes are now the
    recipes' own.
  - **Level 4 versions** of Chicken fried rice (every vegetable in brunoise)
    and Ratatouille (exact ½-inch dice).
  - **Chana masala**, a new Cook Around the World lesson (lesson 3, the
    blooming-spices group), and its Level 4 version, scaled 6 to 12 by hand.
    Its card's minutes are now the lesson's 55.
  - **All 12 part pages** at Level 4's lengths: cuts by size and the French
    aromatic base, a timed brunoise, cutting ahead; weight over volume and
    yield, weighing and portioning ahead; scaling factors and what doesn't
    scale, scaling a Sabbath recipe; planning backward from serving, a run
    prep timeline, a Sabbath prep timeline.
  - **New ingredients:** tuna steaks, baby potatoes, Kalamata or Niçoise
    olives, watercress, gochujang (watch: no shrimp or squid), dried guajillo
    chiles, canned chickpeas.
  - Tuna is cooked to 145°F and eggs to 160°F, the app's standards; the
    review doc asks the owner about both.
- No screens changed, so no screenshots.
- Tests: 392.

## 229. 2026-10-26 — Demo page copy: the owner's first corrections

Owner, 2026-10-26, in [Release 1 copy
review](https://claude.ai/artifact/1wxbCfTZ2XeGSSVJ9sQkrn) (rows D10 to D41).

- **Before:** the demo's track buttons, Shopping, Course, Skills, and Try a
  week intros were Claude's draft.
- **Now** (`public/demo.js`), in the owner's words:
  - Track buttons: "Enhance your technique as you explore dishes from all
    over" and "Fundamental cooking skills taught through reading, writing,
    and doing".
  - Shopping: "We help make sure everything you need is on hand." The two
    preview notes under What you'll need and under the list are gone.
  - Course and Skills intros, and Try a week's intro ("A sample of Unit 1
    for {Level}…", with Unit capitalized as elsewhere in the app).
- Screenshots (phone width, light and dark) sent in the session.
- Tests: 392.

## 230. 2026-10-26 — Release 1 can be launched

Owner, 2026-10-26: "Where's my ops release button to make it live for
everyone".

- **Before:** release 1 (the Levels) was marked as being built in
  `src/worker/release.js`, so `/ops` offered its preview but no launch button.
- **Now:** release 1 is no longer marked as being built. `/ops` → Releases
  shows **Launch release 1 for everyone**, with **Undo launch** beside it once
  it's pressed.
- Tests: 392.

## 231. 2026-10-26 — 14g content: Level 3 Unit 2

Owner, 2026-10-26: "We're gonna do unit 2, ordered levels 3, 2, 4. Put
each level unit in a review doc for me before starting the next one."
Reviewed in [14g review: Level 3 Cook, Unit
2](https://claude.ai/artifact/M8cfT5VgozuCAZ2Jirj1tQ); not merged until the owner
approves it there.

- **Before:** Unit 2, No-cook (weeks 5 and 6), had one written recipe,
  tabbouleh. Week 5 cooked it for both starts, week 6 waited, and five of
  its six part pages were blank.
- **Now:**
  - **Two Level-only recipes** in `content/levels/recipes/`, unit 103: Bean
    tostadas with pico de gallo (week 5, fine chopping; tomatoes salted and
    drained) and Solterito (week 6, the mastery week: a timed dice to the size
    of the beans and a lime-forward dressing balanced by taste). The
    fine-chopping and dressings pick-one groups are full, and neither is a
    variation of a planned dish (§12.4). Their cards' minutes are now the
    recipes' own (40 and 45).
  - **Chickpea chopped salad + vinaigrette**, a new Cook Around the World
    lesson (the dressings group's third dish), and its Level 3 version:
    sized cuts, the timed knife check, and no beginner tips. Its card's
    minutes are now the lesson's 40.
  - **Five part pages:** week 5's drill (mince parsley and onion; salted
    against unsalted tomatoes), Knowledge (osmosis, and salting early or
    late), and Beyond the Recipe (dips and salsas made ahead); week 6's
    drill (the timed salad set and a dressing changed one thing at a time)
    and Knowledge (emulsions, the 3-to-1 rule, and soggy salads).
  - **New ingredients:** canned pinto beans, tostada shells (watch: lard),
    frozen corn, frozen shelled edamame or baby lima beans.
  - Frozen corn and edamame are heated until steaming before the salad, as
    their bags say; they're not ready to eat from frozen.
- Recipe gaps and best fit: the dressings group now has a chickpea dish, so
  two tests that needed every dressings dish ruled out also rate beans low.
  The Level course tests skip weeks 5 and 6 where they need week 9.
- No screens changed, so no screenshots.
- Tests: 392.

## 232. 2026-10-26 — 14g content: Level 2 Unit 2

Owner, 2026-10-26: Level 2 is the second of Unit 2's three Levels (231).
Reviewed in [14g review: Level 2 Apprentice, Unit
2](https://claude.ai/artifact/QZkxD9oWoNK5Cw4MmGApZC); not merged until the
owner approves it there.

- **Before:** none of Level 2 Unit 2's dishes was written except Cook Around
  the World's tuna salad sandwiches, which chop with a chef's knife and the
  rocking cut. Its 6 part pages were blank.
- **Now:**
  - **Three Level-only recipes** in `content/levels/recipes/`, unit 102:
    Hummus plate (week 5: peel, core, and seed, and a blended dip), and
    Chicken Caesar wraps and Chana chaat (week 6, the mastery week: a
    dressing whisked, tasted, and fixed). The fine-chopping and dressings
    pick-one groups are full (§12.4). The wraps' card is marked as a
    variation of Chicken Caesar; like Level 4's steak fajitas, they're a
    Level recipe of their own. Their cards' minutes are now the recipes' own
    (30 each).
  - **Tuna salad sandwiches' Level 2 version:** the paring knife, not a
    chef's knife; parsley torn by hand; a bread knife for the sandwiches;
    every step rewritten to Level 2's standard.
  - **Nothing before it's taught:** the paring knife cuts only soft foods,
    herbs and lettuce are torn, and there's no stove. Chana chaat uses green
    onion in place of the card's red onion, which would need a dice.
  - **All 6 part pages:** peel, core, and seed; washing produce; daily bread
    (Matthew 6:11); a vinaigrette tasted and fixed; why a dressing separates;
    a lunch salad packed with the dressing apart.
  - **New tool:** a blender or food processor.
  - **New ingredients:** tahini, chaat masala (with ground cumin and lime as
    its stand-in).
- No screens changed, so no screenshots.
- Tests: 392.

## 233. 2026-10-26 — 14g content: Level 4 Unit 2

Owner, 2026-10-26: Level 4 is the last of Unit 2's three Levels (231).
Reviewed in [14g review: Level 4 Chef, Unit
2](https://claude.ai/artifact/KYrWbzYA96NVAc7DkRg9Kx); not merged until the
owner approves it there.

- **Before:** week 5 cooked Cook Around the World's Chicken Caesar, which
  had no Level 4 version; the other three dishes and all 6 part pages were
  unwritten.
- **Now:**
  - **Three Level-only recipes** in `content/levels/recipes/`, unit 104:
    Ensaladilla rusa (week 5, emulsions: a hand-whisked mayonnaise), and
    Antipasto platter and Mezze spread (week 6, the mastery week: cold
    holding at 41°F, logged, and two-stage cooling for the mezze's cooked
    chickpeas and eggplant). No pick-one group covers either skill (§12.4).
    Their cards' minutes are now the recipes' own (75, 60, 180).
  - **Chicken Caesar's Level 4 version:** the dressing from scratch, with
    pasteurized yolks, optional anchovy, and oil whisked to an emulsion;
    metric cuts and a tight method. 60 minutes.
  - **Eggs to 160°F:** both mayonnaises cook the pasteurized yolks with the
    lemon juice to 160°F before the oil, so the content check's doneness rule
    holds; the review doc asks the owner whether to allow raw pasteurized
    yolks instead.
  - **All 6 part pages:** a mayonnaise made, broken, and rescued; emulsions
    and the USDA's raw-egg guidance; dressings made ahead; an iced and an
    un-iced plate logged for 2 hours; food safety for a cold buffet;
    hospitality (Genesis 18:1–8; Hebrews 13:2).
  - **New ingredients:** anchovy fillets, frozen peas, roasted red peppers,
    beef salami (`beef-dry-sausage`; watch: pork casings), bresaola (watch:
    beef only, sealed), provolone, marinated artichoke hearts, dried
    chickpeas, labneh (watch: gelatin).
- No screens changed, so no screenshots.
- Tests: 392.

## 234. 2026-10-26 — Level dish pictures: sheets 63–64

Owner, 2026-10-26: "find me recipes with placeholder images like this", then
the two sheets made from Claude's prompts.

- **Before:** eight written Level 3 recipes, all from phase 12, showed the
  meal-type drawings (`meals/*.svg`) on their cards and in the player:
  tabbouleh, thick beef burgers, baked fish with lemon and herbs, sandwich
  loaf, dinner rolls, steamed fish with ginger and scallion, beef picadillo,
  and pan-seared trout. None had been on a picture sheet.
- **Now:** sheets 63 and 64 (`content/images/source/`) are cut into those
  eight dish pictures, with web copies, and the lessons and their Level 3
  cards point at them. The steamed fish's rice bowl stands apart from its
  plate, so it was cut by hand; `tools/dish-sheets.txt` records how.
- Screenshots (More recipes, phone width, both themes) sent in the session.
- Tests: 392.

## 235. 2026-10-26 — A letter for each program's labels

Owner, 2026-10-26, from a phone screenshot of Add a lesson: "Cook around the
world is one course of many now. So i think we need to prefix them S for
standard. We initially gave feast meals a, but lets give them U for
unleavened. 1-4 can be A-D. … I should not see a cooking around the world
recipe number in my course list for level 3. And levels familiar/explore need
an a/b after the number. A level number should correspond with its week."
Then: keep "Quest 27 of 59" as a count, keep "Week 4" on a Level learner's
cards, group Add a lesson by program, and keep A for Level 1.

- **Before:** Appointed Times and Level 2's own recipes both used A, so Add a
  lesson showed two A1s and two runs of A's, sorted by name. Level 3 was K
  and Level 4 was C, numbered in the order of each Level's recipe cards, not
  by week. A Cook Around the World lesson a Level cooks (about 25 in each)
  showed its course number in that Level's queue rows and kitchen cards.
- **Now:**
  - **Cook Around the World is S:** S1, S8a. Learners' cards, the player,
    Chef Ruth, and the demo still count the place without the S ("Quest 27",
    "Lesson 8a"); `courseNo` in `src/content/course.js`.
  - **Appointed Times is U:** U1, U2 (`content/units.json`).
  - **Levels are B, C, D by week:** the letter, the week, and a (Familiar) or
    b (Explore): B1a, C4b, D5a (`weekLabels` in `src/content/levels.js`). A
    is kept for Level 1. A lesson shared with Cook Around the World takes the
    Level's label on that Level's course card and queue rows, and when queued
    by hand for learners all on that Level. A week changed to a recipe from
    elsewhere is just C4.
  - **Add a lesson by program:** Best for them, each Level (the family's own
    first) in week order with its own labels, Cook Around the World, then
    Appointed Times, then Our recipes.
  - **Kitchen cards on a Level course** say the week ("Week 4") on queued
    lessons too; they showed Cook Around the World's number.
  - **Lint:** each program's letter is its own; S and A are taken.
  - Plan §4.1, §6.19, §12.4 updated.
- Screenshots (the queue, Add a lesson, and both kitchen themes, phone width,
  light and dark) sent in the session.
- Tests: 395.

## 236. 2026-10-26 — Add a lesson: its own page, with filters

Owner, 2026-10-26: "For add a lesson, I'd really like it if we had filters,
like ingredients where they could input their ingredients to find lessons
that matched, or skill tags, instead of just every lesson. Once we write
everything its gonna be like 250 recipes." Then: its own page; ingredients
and skills "should not be a wall, it should look more like a search bar that
filters the Ingredients down in real time as they type, and then +another to
add more"; "searches should be wide on anything except proteins"; program,
protein and cuisine, time and method, and not cooked yet as more filters; and
"since we are on a page we can show more about the recipe than just its
name". Also: record that Chef Ruth's button gets in the way of screenshot
scripts.

- **Before:** + Add a lesson opened a dialog with one long menu of every
  lesson, grouped by program (235). A lesson's line about the dish showed
  only after it was added.
- **Now:**
  - **Its own page,** `#/parent/queue/add`: who's cooking, a dish-name
    search, Ingredients you have and Skills as type-to-narrow searches with
    chips and + Another, and More filters (program, protein, cuisine, time,
    how it cooks, not cooked yet by who's cooking).
  - **Matching** (`src/content/find.js`): a lesson needs one of the
    proteins added, searched by taste group (Chicken, not chicken breast and
    chicken thigh), and at least one of the other ingredients; the most of
    them first, with "Uses yours: …".
  - **Lesson cards:** picture, labels, time, cuisine, method, the line about
    the dish, and its skill, with Add (a dialog: who, serves, planned date),
    Main ingredients, and Preview as a learner. 30 at a time, Show more.
  - **The library** carries each lesson's skills, method, line about the
    dish, and main ingredients; the queue sends the filters' options.
  - **CLAUDE.md:** screenshot scripts hide Chef Ruth's floating button and
    enter the parent PIN after opening a kitchen (owner's request).
- Screenshots (the page, typing, results, and the Add dialog, phone width,
  light and dark) sent in the session.
- Tests: 400.

## 237. 2026-10-26 — 14g content: Level 3 Unit 3

Owner, 2026-10-26: "We're gonna do unit 3, ordered levels 3, 2, 4. Put each
level unit in a review doc for me before starting the next one." Reviewed in
[14g review: Level 3 Cook, Unit 3](https://claude.ai/artifact/DQPqdYECracPFipDVSgm1C);
not merged until the owner approves it there.

- **Before:** Unit 3, Clean meat, poultry, and fish (weeks 7–10), had thick
  beef burgers and baked fish from phase 12. Week 7's lamb kofta and week 10's
  shish taouk were planned Cook Around the World cards with no lesson; week
  8's chermoula fish and week 10's chicken tenders were unwritten Level cards;
  week 9 cooked Cook Around the World's fajitas and oyakodon, which had no
  Level 3 versions. Four of its 12 part pages were blank.
- **Now:**
  - **Two Level-only recipes** in `content/levels/recipes/`, unit 103:
    Chermoula baked fish (week 8: pin bones by feel, the thin end tucked under,
    145°F) and Oven-baked chicken tenders (week 10, the mastery week: the
    raw-meat station set up alone, breast trimmed into even strips, one dry
    hand and one wet, 165°F). Their cards' minutes are now the recipes' own
    (45 and 50).
  - **Two new Cook Around the World lessons,** each already planned (§12.4):
    Lamb kofta with yogurt sauce (Unit 6, the binders group; 45 minutes) and
    Shish taouk (Unit 3, the broiling group, with a callback to butter
    chicken's marinade; 75 minutes, 30 of them marinating).
  - **Level 3 versions** of all four of week 7, 9, and 10's lessons: kofta
    with a test patty and the three thickest checked; fajitas with the thighs
    sliced raw on the raw-meat board after the vegetables and seared in two
    checked batches; oyakodon with trimmed 1-inch cubes; shish taouk as the
    mastery cook, with fresh garlic and three skewers checked.
  - **Four part pages:** week 9's drill (trim and cube thighs, clean down) and
    Beyond the Recipe (the birds of Leviticus 11:13–19, and "be holy, for I
    am holy"); week 10's Knowledge (dark and white, tender and tough, fillet
    types, carryover, and a 12-question unit quiz) and Beyond the Recipe (blood
    and fat, Leviticus 3:17; 7:23–27; 17:10–14).
  - **New ingredients:** ground lamb, panko breadcrumbs. **New tool:** skewers.
- A meat-free family's week 7 now has both dishes written and both ruled out,
  so the Level course test skips it with week 9's, and uses week 21 for a week
  that waits quietly.
- No screens changed, so no screenshots.
- Tests: 392.

## 238. 2026-10-26 — 14g content: Level 2 Unit 3

Owner, 2026-10-26: Level 2 is the second of Unit 3's three Levels (237).
Reviewed in [14g review: Level 2 Apprentice, Unit
3](https://claude.ai/artifact/HHaY6sUdVwUTu1GtCDThNJ); not merged until the
owner approves it there.

- **Before:** none of Level 2 Unit 3's dishes was written except Cook Around
  the World's smash burgers (quick pickles and onion sliced paper-thin with a
  chef's knife) and chicken souvlaki pitas (raw breast cut with a chef's
  knife, cucumber grated). All 12 part pages were blank.
- **Now:**
  - **Six Level-only recipes** in `content/levels/recipes/`, unit 102: Köfte
    with tomato-cucumber salad (week 7, the thermometer), Beef tacos with
    homemade seasoning and Keema with peas (week 8, reading labels), Oven-baked
    fish sticks and Shioyaki salted salmon (week 9, thawing fish and 145°F),
    and Baked teriyaki chicken bites (week 10, the mastery week: raw ready-cut
    chicken handled alone). None fits a pick-one group with room or is a
    variation of a planned dish (§12.4). Their cards' minutes are now the
    recipes' own; shioyaki's card no longer says the skin crisps.
  - **Level 2 versions** of smash burgers (jarred pickles, no onion, a check
    on each batch; 35 minutes) and chicken souvlaki pitas (ready-cut chicken,
    jarred garlic, a peeled and seeded cucumber, torn dill, no onion).
  - **All 12 part pages:** reading a thermometer, why ground meat needs
    160°F, freezing patties ahead; reading 10 labels, where hidden ingredients
    hide, land animals (Leviticus 11:1–8); thawing fish, fins and scales and
    fish labels, Leviticus 11:9–12; a raw-chicken spot and hand-washing, the
    bottom shelf and 165°F, birds (Leviticus 11:13–19).
  - **New ingredients:** ready-cut chicken breast (plain), frozen diced onion,
    jarred minced ginger, hard taco shells (watch: the frying fat).
- The content check finds no Level 2 writing warnings.
- No screens changed, so no screenshots.
- Tests: 392.

## 239. 2026-10-26 — 14g content: Level 4 Unit 3

Owner, 2026-10-26: Level 4 is the last of Unit 3's three Levels (237).
Reviewed in [14g review: Level 4 Chef, Unit
3](https://claude.ai/artifact/87ZoVDP7Kn4ugsVeX8CiDf); not merged until the
owner approves it there.

- **Before:** none of Level 4 Unit 3's eight dishes was written; chicken
  tagine (week 7's Explore) was a planned Cook Around the World card. All 12
  part pages were blank.
- **Now:**
  - **Seven Level-only recipes** in `content/levels/recipes/`, unit 104:
    Chicken cacciatore (week 7, a whole chicken broken into 8 and the yield
    weighed), Sliced flank steak and Seared duck breast with cherry sauce
    (week 8: silverskin, scoring, rendering, slicing across the grain),
    Teriyaki salmon side and Pescado a la veracruzana (week 9: a side skinned
    and portioned by weight, a whole snapper baked on the bone), and Chicken
    two ways and Spatchcocked quail with pomegranate (week 10, the mastery
    week: one bird used whole with its cost per serving, and eight quail
    spatchcocked). Their cards' minutes are now the recipes' own.
  - **Chicken tagine with olives,** a new Cook Around the World lesson (Unit
    3, the braising group's first dish, with a callback to chana masala;
    80 minutes), and its Level 4 version from a whole bird, the breasts out
    at 165°F and the dark meat braised on.
  - **All 12 part pages:** yield and cost, breaking down a chicken, freezing
    backs for stock; primal cuts, silverskin and scoring, clean birds
    (Leviticus 11:13–19); buying fish and labels, skinning a side of salmon,
    Luke 5:1–11; cost per serving, spatchcocking, manna and quail (Exodus 16;
    Numbers 11).
  - **New ingredients:** whole chicken, duck breasts, whole quail (watch:
    thaw in the fridge), side of salmon, whole red snapper (watch: scaled and
    gutted, check the name), frozen dark cherries, balsamic vinegar, pickled
    jalapeños, pomegranate molasses. **New tool:** kitchen shears. **New
    kitchen words:** score, render.
  - Duck and quail are cooked to 165°F and flank steak to 145°F, the app's
    standards; the review doc asks the owner about both.
- The content check finds no Level 4 writing warnings.
- No screens changed, so no screenshots.
- Tests: 392.

## 240. 2026-10-26 — Watch-for lists on part pages; the chicken oyster

Owner, 2026-10-26, on how hidden ingredients were worded in Unit 3: "I thought
label warnings were excluded", then "Do all three" (Claude's three
proposals).

- **Before:** the content check blocks unclean foods' names everywhere a
  learner reads, part pages included, so Level 2's week 8 pages said "a fat
  from an unclean animal" and "a red coloring made from crushed bugs", and
  Level 4's week 7 drill called the chicken's oyster "the round pocket of meat
  on the back". The plan's reviewed "watch for" list (§12.2) wasn't built.
- **Now:**
  - **Watch for** (§12.2): a part page can carry `watch`, a list of
    `{ name, hides }`, shown as a box after its steps in the kitchen and the
    demo. Only an item's name may name a blocked food; the rest of the page
    is checked as before. The manager's Level pages edit it, with a hint.
  - **Level 2:** week 8's Knowledge page names six (lard, gelatin, pork
    casings, oyster sauce, shrimp paste, carmine), week 8's Drill three, and
    week 9's Knowledge the unclean water animals by name.
  - **"chicken oyster"** is an allowed phrase, and Level 4's week 7 drill
    uses it.
- **Not done:** cutting the beef tacos back to rely on the taco shells' label
  note. Ingredient label notes (`watch` in `ingredients.json`) are read only
  by the content check; no screen shows them to a family, so the recipe keeps
  its own label step until the owner decides.
- Screenshots (a part page's Watch for box, phone width, both themes) sent in
  the session.
- Tests: 393.

## 241. 2026-10-26 — US units in Level recipes; label notes shown; capitalized pronouns for God

Owner, 2026-10-26: "Sure you can show the warnings." "Go through the parts
pages and make sure everywhere you use 'He' to refer to God, it is
capitalized." "Dude you can't show ingredients in grams these are all us
users."

- **Before:** an ingredient's label note (`watch` in `ingredients.json`, e.g.
  "Check the label for lard") was read only by the content check; no screen
  showed it. Level 4's recipes (Units 1 to 3) gave meat and fish in grams and
  cuts in centimeters and millimeters, and Level 3 and 4 pages priced and
  weighed in grams and kilograms. Some part pages used "he", "his", and "him"
  for God and Jesus.
- **Now:**
  - **Label notes** show under the ingredient in the player's prep list (both
    themes) and on the shopping list in the store. The beef tacos (Level 2,
    week 8) now point to them instead of naming the fat themselves.
  - **US units everywhere a family reads:** 29 ingredient lines from grams to
    pounds and ounces; every metric cut, depth, and volume in steps, tips, Why
    cards, quizzes, and part pages to inches, quarts, pounds, and ounces, with
    the yield and cost math redone in pounds (sample prices per pound). The
    kitchen scale is "Kitchen scale", not "(grams)". Level 4's week 2 skill is
    "Weighing and finding the yield".
  - **Pronouns for God and Jesus** are capitalized on the part pages (He,
    His, Him, Himself), outside quoted Scripture, which keeps the ESV's
    wording. Pronouns for people (Boaz, Daniel, Abraham, Paul, Peter) stay
    lowercase.
- Screenshots (the prep list in both themes, the shopping list light and
  dark, phone width) sent in the session.
- Tests: 401.

## 242. 2026-10-26 — Drills use what the week already buys

Owner, 2026-10-26: "Some of your drills are extremely expensive to do. If
something may not be achievable to a family (like buying a whole side of
flounder) direct them to find a YouTube video instead, or come up with an
alternative."

- **Before:** some drills asked for food the week's chosen dish doesn't
  buy: Level 4's week 8 drill needed both a flank steak and duck breasts,
  week 9 a whole side of salmon even for families cooking the veracruzana,
  and week 10 an extra whole chicken to spatchcock. Level 3's week 8 drill
  wanted two kinds of fillet and week 23 an extra skin-on fillet; Level 2's
  week 9 wanted two extra frozen fillets.
- **Now:** each of those drills uses the week's own ingredients, and where
  that can't cover it, sends the learner to a short video (with what to
  search for) and a cheap stand-in:
  - Level 2 week 9: thaw this week's frozen fish in two halves, one each way.
  - Level 3 week 8: pin-bone this week's fillets; a video shows the other
    kind of fish. Week 23: practice the skin-side sear on the first fillet of
    the week's recipe.
  - Level 4 week 8: the trim for the dish being cooked, then a video and the
    same knife motion on an eggplant, zucchini, or cucumber for the other.
    Week 9: a family cooking the veracruzana watches a side being portioned
    and practices on one skin-on fillet. Week 10: spatchcock the quail, or
    the chicken for chicken two ways before breaking it down.
- No screens changed, so no screenshots.
- Tests: 401.

## 243. 2026-10-27 — Help me choose a program

Owner, 2026-10-26 and 2026-10-27: "When chef Ruth asks about adding courses,
she needs a button to say 'help me choose'." "Add a fourth question: 'Do you
want reading pages and drills for supplemental learning, or are you only
here for the actual recipe?'" "Your other questions need to be framed as
'what are they ready for', not 'what have they done'." "Yes lowest. And yes,
course editor should also ask help me choose questions optionally."

- **Before:** Which program? listed Cook Around the World and the Levels,
  with no help picking one.
- **Now:**
  - **Chef Ruth** has **Help me choose** under Which program?. She says what
    each program expects a cook to be ready for (Cook Around the World in
    the owner's words), then offers four questions: knife work, the stove
    and oven, and the kind of recipe they're ready for, then reading pages
    and drills or just the recipes. The Level is the lowest of the three
    readiness answers; Level 2 stands in for Level 1 until it's built.
    Reading pages and drills offers that Level only. Just the recipes offers
    Level 3 or 4 beside Cook Around the World (Level 2 alone), saying its
    parts can be turned off, and picking the Level makes the course with
    Knowledge, Drill, and Beyond the Recipe off. **Start over** goes back.
  - **Set up a course** has the same **Help me choose** as a dialog under
    Which program?. It's optional: **Use …** ticks the program (and, for
    just the recipes, unticks the components), and the parent can still
    change anything.
  - The words and the placement live in `src/content/levels.js`
    (`READY_FOR`, `PLACE_QUIZ`, `PLACE_PARTS`, `suggestProgram`). The Level
    descriptions and the quiz answers are Claude's draft for the owner.
- Screenshots (Chef Ruth's buttons, descriptions, quiz, result, and finish;
  the editor's button, dialog, result, and unticked components; phone
  width, both themes) sent in the session.
- Tests: 402.

## 244. 2026-10-27 — Help me choose: the owner's two program lines

Owner, 2026-10-27: "I dont like it." with the new wording for both programs.

- **Before:** Help me choose opened with a line for Cook Around the World and
  one for each Level, on what a cook should be ready for.
- **Now:** two lines, in the owner's words: one for Cook Around the World and
  one for Structured Progression Level Courses. The quiz is unchanged and
  still picks the Level. Same in Chef Ruth and in Set up a course.
- Screenshots (Ruth's lines and the editor's dialog, phone width, both
  themes) sent in the session.
- Tests: 402.

## 245. 2026-10-27 — 14g content: Level 3 Unit 4

Owner, 2026-10-27: "We're gonna do unit 4, ordered levels 3, 2, 4. Put each
level unit in a review doc for me before starting the next one. Notify me of
any missing artwork for new recipes." Reviewed in [14g review: Level 3 Cook,
Unit 4](https://claude.ai/artifact/3mWfgmLMojBjNvXQtVREiR); not merged until
the owner approves it there.

- **Before:** Unit 4, Baking (weeks 11–15), had Sandwich loaf, Dinner rolls,
  and weeks 12, 13, and 15's pages. Week 11's skillet cornbread and week 14's
  beef empanadas were planned Cook Around the World cards with no lesson;
  soda bread, man'oushe, conchas, the apple galette, and pulla were unwritten
  Level cards; week 15 cooked Cook Around the World's challah, which had no
  Level 3 version. Weeks 11 and 14's six pages were blank.
- **Now:**
  - **Two new Cook Around the World lessons,** each already planned (§12.4):
    Skillet cornbread (Unit 5; 40 minutes) and Baked beef empanadas (Unit 5,
    the cutting-in-fat group, with a callback to buttermilk biscuits; 90
    minutes).
  - **Level 3 versions** of both and of challah: cornbread with the flour
    weighed, folded while streaky, and checked at 200°F; empanadas with butter
    cut in to pea size, rolled to ⅛ inch, sealed with the repulgue, chilled,
    and two checked at 165°F; challah as the mastery bake, its ropes weighed to
    a tenth of an ounce and a hollow-sound check beside 190°F.
  - **Five Level-only recipes** in `content/levels/recipes/`, unit 103: Irish
    brown soda bread (200°F), Man'oushe and Rustic apple galette (marked as
    variations of Pita bread and Apple pie, written as Level recipes of their
    own), Conchas (weighed into 10), and Pulla (the mastery week's Explore).
    Their cards' minutes are now the recipes' own.
  - **Six part pages:** week 11's leaveners and doneness, flour weighed three
    ways and two pancakes mixed two ways, and freezing quick breads; week 14's
    pastry vs. bread with a Watch for box (lard, suet and beef tallow), a
    cut-in, roll, and crimp drill, and freezing unbaked pastry.
  - **New ingredients:** cornmeal, whole-wheat flour, za'atar, powdered
    sugar, cocoa powder, tart baking apples, ground cardamom, pearl sugar.
    **New tool:** a 10-inch cast-iron skillet.
- The lint test that used challah as a lesson with no Level 3 version uses
  mujaddara now.
- No screens changed, so no screenshots.
- Tests: 402.

## 246. 2026-10-27 — 14g content: Level 2 Unit 4

Owner, 2026-10-27: Level 2 is the second of Unit 4's three Levels (245).
Reviewed in [14g review: Level 2 Apprentice, Unit
4](https://claude.ai/artifact/SXA8VrkW4ict39UrkwsxGV); not merged until the
owner approves it there.

- **Before:** none of Level 2 Unit 4's ten dishes was written for Level 2.
  Blueberry muffins, pão de queijo, homemade pizza, and skillet naan were
  planned Cook Around the World cards with no lesson; buttermilk biscuits had
  no Level 2 version; the other five were unwritten Level cards. All 15 part
  pages were blank.
- **Now:**
  - **Four new Cook Around the World lessons,** each already planned (§12.4),
    all in Unit 5: Blueberry muffins (45 minutes), Pão de queijo (scalded on
    the stove; 50), Homemade pizza (the yeast-dough group; 120), and Skillet
    naan (the flatbreads group; 105).
  - **Level 2 versions** of those four and of buttermilk biscuits, every step
    rewritten short: muffins with flour spooned and leveled; pão de queijo
    blended and baked in a muffin tin, with no stove; biscuits with cubed
    butter cut in to pea size instead of grated; pizza with an adult at the
    oven and knife; naan with jarred garlic and the dough divided by hand.
  - **Five Level-only recipes** in `content/levels/recipes/`, unit 102: Welsh
    cakes, Chocolate chip cookies (marked as a variation of Brown butter
    cookies, written as a Level recipe of its own), Alfajores, and week 15's
    mastery pair, Banana bread and Pan de elote. Their cards' minutes are now
    the recipes' own.
  - **All 15 part pages:** leaveners, spooning flour and two pancakes, freezing
    muffins; cold fat and flaky layers, cutting butter in, manna (Exodus 16);
    what yeast does, blooming and kneading 5 minutes, chilling dough ahead;
    why cookies spread, even scoops, freezing dough balls; quick breads around
    the world, the toothpick test, Elijah and the widow (1 Kings 17:8–16).
  - **New ingredients:** frozen blueberries, tapioca flour, currants, dulce de
    leche, shredded coconut, bananas, sweetened condensed milk. **New tool:** a
    12-cup muffin tin. **New kitchen word:** fold in.
- **Missing picture:** pan de elote's card never had one. Its recipe shows the
  dessert drawing (`meals/dessert.svg`) until a dish picture is made; the
  review doc has a prompt for it.
- The content check finds no Level 2 writing warnings.
- No screens changed, so no screenshots.
- Tests: 402.

## 247. 2026-10-27 — 14g content: Level 4 Unit 4

Owner, 2026-10-27: Level 4 is the last of Unit 4's three Levels (245).
Reviewed in [14g review: Level 4 Chef, Unit
4](https://claude.ai/artifact/KqcKeNDNyyW3Dkut9yEvHc); not merged until the
owner approves it there.

- **Before:** none of Level 4 Unit 4's ten dishes was written. Chicken pot
  pie, spinach & mushroom quiche, biscuits and sausage gravy, apple pie with
  lattice, and malva pudding were planned Cook Around the World cards with no
  lesson; the other five were unwritten Level cards. All 15 part pages were
  blank.
- **Now:**
  - **Five new Cook Around the World lessons,** each already planned (§12.4):
    Spinach & mushroom quiche (Unit 6, blind-baked; 135 minutes), Chicken pot
    pie (Unit 6, in the cast-iron skillet; 120), Biscuits + sausage gravy
    (Unit 5, bulk turkey sausage; 60, in two sizes, 6 or 12), Apple pie with
    lattice (Unit 7; 240), and Malva pudding (Unit 7; 75).
  - **Level 4 versions** of all five: the quiche with a weighed, egg-sealed
    crust and the custard to 170°F; the pot pie under a four-fold rough puff;
    biscuits and gravy weighed at the parent's size, with ground beef
    seasoned into sausage and a timeline; the apple pie as the mastery bake,
    the apples weighed and their juice boiled down; malva with a stirred
    custard to 175°F and the sponge to 200°F.
  - **Five Level-only recipes** in `content/levels/recipes/`, unit 104:
    Chocolate babka (two days, cold-retarded), Japanese milk bread
    (tangzhong), Spinach and feta borekas (rough puff), Jamaican beef patties
    (butter pastry), and Arepas with black beans and cheese. Their cards'
    minutes are now the recipes' own.
  - **All 15 part pages:** enriched doughs, cold fermentation, and baker's
    percentages, a tangzhong and an overnight retard, the bread of the
    Presence (Leviticus 24:5–9); fats and pastry labels with a Watch for box,
    lamination folds, freezing unbaked pastry; blind baking and soggy
    bottoms, a side-by-side blind bake, freezing pastry ahead; leaveners at a
    larger batch, scaling and timing to the main, freezing unbaked biscuits;
    fruit-pie thickeners and doneness by the bubbling, weaving a lattice, and
    leaven and unleavened bread with an essay. Each Knowledge page closes
    with the week's cuisine.
  - **New ingredients:** bread flour, shredded Swiss, masarepa, ground
    allspice, Scotch bonnet or habanero, apricot jam. **New tools:** a 9-inch
    pie plate, pie weights.
- **Missing picture:** the arepas' card never had one. Its recipe shows the
  side-dish drawing (`meals/side.svg`) until a dish picture is made; the
  review doc has a prompt for it.
- The lint test that used apple pie as an unwritten lesson uses beef chili
  now.
- The content check finds no Level 4 writing warnings.
- No screens changed, so no screenshots.
- Tests: 402.

## 248. 2026-10-27 — Level dish pictures: sheets 34–39

Owner, 2026-10-27: "Rest of level two dishes", six ChatGPT sheets from
[Level dish pictures: ChatGPT
prompts](https://claude.ai/artifact/PbGHZTt9e78S2SbwtyYVMB), matched to the
prompt doc's sheets 34–39.

- **Before:** 24 Level 2 recipe cards had only a meal-type drawing, and the
  written pan de elote recipe showed the dessert drawing (247's missing
  picture).
- **Now:**
  - 24 dish pictures, saved to `content/images/source/` under the doc's
    names (`sheet-34-levels-6.png` to `sheet-39-levels-11.png`), cropped into
    `content/images/dishes/<card id>.png`, built to `public/img/dishes/`, and
    listed in `tools/dish-sheets.txt`. Every sheet cropped cleanly with the
    tool; no hand cuts.
  - `"image"` added to the 24 cards in `sp-2.json`; pan de elote's recipe
    points at its picture.
  - Checked by eye for unclean foods: none. The potstickers, nachos, and
    fajitas are chicken; the sloppy joes, giniling, and Filipino baked
    macaroni are ground beef; the salmon has fins and scales.
- Every Level 2 recipe card now has a dish picture. Still to come: Level 4's
  sheets 55–62.
- Tests: 402.

## 249. 2026-10-27 — Level dish pictures: sheets 55–62, and white bowls recut

Owner, 2026-10-27: eight more ChatGPT sheets, "make sure these are the rest";
then, from a phone screenshot of the crops, "you've got a couple more that
are just floating bowl tops"; then "check unit 4 for any dishes that used
placeholder photos for recipes and make sure they're swapped".

- **Before:** 32 Level 4 recipe cards had only a meal-type drawing, and the
  written arepas recipe showed the side-dish drawing (247's missing
  picture). The crop tool takes white near the edge of a dish for
  background, so a white bowl or baking dish lost its sides and kept only
  its rim. That happened on eight of 248's Level 2 pictures.
- **Now:**
  - The eight sheets are the prompt doc's sheets 55–62, the last ones in it.
    They're saved to `content/images/source/` under the doc's names, cut into
    32 dish pictures with web copies, and listed in `tools/dish-sheets.txt`.
    `"image"` is added to the 32 cards in `sp-4.json`, and arepas' recipe
    points at its picture. Every Level 2, 3, and 4 recipe card now has a
    dish picture.
  - **`tools/hand-cut-dish.py`:** cuts one dish by hand from boxes around its
    pieces (plate, side bowls), keeping each piece's whole outline so white
    sides stay. Pieces whose outlines don't meet are kept as separate
    pieces. Recut with it: Level 2's pan de elote, gyeran-jjim, anda curry,
    Hainanese chicken rice, egg drop soup, tikil gomen, baked ziti, and
    Filipino baked macaroni; Level 4's Goan fish curry, çılbır, black bean
    soup, French onion soup, phở bò, kung pao chicken, mapo tofu, chicken
    tikka masala, Thai green curry, and birria de chivo. Every hand cut's
    command is written in `tools/dish-sheets.txt`.
  - Checked by eye for unclean foods: none. Feijoada and the braised duck
    legs show beef sausage, as their prompts asked; the mapo tofu is ground
    beef; the fish (salmon, white fish, the whole samke harra fish) have fins
    and scales; birria de chivo is goat.
- **Unit 4:** all 30 Unit 4 dishes across Levels 2, 3, and 4 now show their
  own dish picture. Pan de elote and arepas were the only ones on a
  placeholder.
- Tests: 402.
