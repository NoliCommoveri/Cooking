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
