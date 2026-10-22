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

## 14. 2026-10-22 — Dish art from the owner

- The owner will make the dish illustrations with an AI image tool, several
  dishes per sheet, and Claude will crop them into one image per dish.
- §5.3a updated: source sheets go in `content/images/source/`. Claude still
  draws the rest of the art as SVG. AI-made images get a line in
  `content/images/LICENSES.md` like any art Claude didn't draw.

---

## 15. 2026-10-22 — First dish art sheet

- Added the owner's first dish sheet (Unit 1, 5 dishes) as
  `content/images/source/sheet-01-unit1.png`.
- Cropped it into transparent square PNGs in `content/images/dishes/`: 01
  spring rolls, 02 fattoush, 03 fish tacos, 26 chicken Caesar, 27 smash
  burgers. Each is about 500–600 px.
- Added `tools/crop-dish-sheet.py`, which Claude runs to cut a sheet into
  dishes. It removes the white background and drops stray edges of
  neighbouring dishes.
- Started `content/images/LICENSES.md` with the sheet and its dishes.
- Checked for unclean foods: none seen. The Caesar image has no chicken, and
  the burger is a thick patty with fries, not a smash burger. Raised both with
  the owner.

---

## 16. 2026-10-22 — Dish art sheets 2 and 3

- Added sheets 2 and 3 from the owner and cropped 10 more dishes into
  `content/images/dishes/`: 04 shakshuka, 05 chicken fried rice, 06 oyakodon,
  07 chicken adobo, 08 cacio e pepe, 09 chana masala, 10 misir wot, 11 chicken
  tagine, 12 butter chicken, 13 jerk chicken. Each is about 500–630 px.
- Checked for unclean foods: none seen. All 10 match their lessons.
- Small notes passed to the owner: the tagine's lid is cut off at the sheet's
  edge, and the adobo's peppercorns look a little like eyes.
- 15 of 50 dishes now have art.

---

## 17. 2026-10-22 — Dish art sheet 4

- Added sheet 4 from the owner and cropped 4 dishes: 14 beef bulgogi, 15 lomo
  saltado, 16 chicken tinga tacos, 17 pupusas. Each is about 520–610 px.
- Checked for unclean foods: none seen.
- Note passed to the owner: the bulgogi beef looks like ground-beef crumbles,
  not thin slices, and thin slicing is that lesson's skill.
- 19 of 50 dishes now have art.

---

## 18. 2026-10-22 — Dish art sheets 5 and 6

- Added sheets 5 and 6 from the owner and cropped 8 dishes: 18 gyoza, 19
  skillet naan, 20 pão de queijo, 21 spanakopita, 22 spinach and mushroom
  quiche, 23 chicken katsu, 24 Swedish meatballs, 25 churros. Each is about
  550–670 px.
- Checked for unclean foods: none seen. The quiche has no bacon, the katsu is
  visibly chicken, and the gyoza filling isn't shown.
- Fixed `tools/crop-dish-sheet.py`: it put a bottom-row dish ahead of
  another when one sat a little higher, which swapped 20 and 21. Rows are now
  grouped by where each dish starts. Re-ran it on sheets 1–4; their crops
  didn't change.
- 27 of 50 dishes now have art.

---

## 19. 2026-10-22 — Dish art sheet 7

- Added sheet 7 from the owner and cropped 4 dishes: 32 mac and cheese, 33 beef
  chili, 34 jambalaya, 35 BBQ pulled chicken. Each is about 560–660 px.
- Checked for unclean foods: nothing that is clearly unclean, but two look like
  pork and were raised with the owner. The jambalaya's sausage is pink inside
  like pork kielbasa, and the pulled chicken is dark red-brown like pulled
  pork. The mac and cheese looks baked with a crumb top rather than stovetop
  creamy, which is minor.
- 31 of 50 dishes now have art.

---

## 20. 2026-10-22 — Dish art sheet 8

- Added sheet 8 from the owner and cropped 4 breakfast dishes: 28 French
  omelet, 29 hash browns, 30 breakfast burritos, 31 eggs Benedict. Each is
  about 670–710 px.
- Checked for unclean foods: none seen. The Benedict uses smoked salmon, not
  ham. The burrito filling is crumbled meat with no pork cues.
- Minor note to the owner: the omelet is an American-style folded half-moon,
  while the lesson teaches the pale, rolled French style.
- 35 of 50 dishes now have art.

---

## 21. 2026-10-22 — Dish art sheets 9 and 10

- Added sheets 9 and 10 from the owner and cropped 8 dishes: 36 chicken noodle
  soup, 37 Philly cheesesteak, 38 buttermilk biscuits, 39 biscuits and sausage
  gravy, 40 blueberry muffins, 41 skillet cornbread, 42 cinnamon rolls, 43
  granola. Each is about 620–740 px.
- Checked for unclean foods: none seen. The gravy's sausage is pale crumbles
  with no pork cues.
- Note to the owner: the cheesesteak beef looks ground, not thin-sliced, and
  lesson 37 repeats the thin-slicing skill.
- Fixed `tools/crop-dish-sheet.py`: the muffin crop picked up a sliver of the
  cinnamon-roll plate below it. Each dish's mask now grows back only as far as
  the erosion shrank it. Re-cropped every sheet; all 43 crops were checked
  side by side on the Kitchen Quest background.
- 43 of 50 dishes now have art.

---

## 22. 2026-10-22 — Dish art sheet 11

- Added sheet 11 from the owner and cropped 4 dishes: 44 meatloaf, 45 roast
  chicken, 46 chicken pot pie, 47 pot roast. Each is about 620–690 px.
- Checked for unclean foods: none seen.
- Fixed `tools/crop-dish-sheet.py`: the pot pie and pot roast kept a pale grey
  drop shadow. Pale grey now counts as background too; the flood fill still
  stops at each dish's dark outline. Re-cropped every sheet and checked all 47
  side by side.
- Gave the owner the redo list: 14, 26, 27, 34, 35, 37, with 28 and 32
  optional.
- 47 of 50 dishes now have art. Still to make: 48, 49, 50.

---

## 23. 2026-10-22 — Dish art complete: all 50

- Added sheet 12 from the owner: 48 Southern fried chicken, 49 brown butter
  cookies, 50 apple pie, and a redo of 26 chicken Caesar with sliced chicken on
  top. The new Caesar replaces the one from sheet 1.
- Checked for unclean foods: none seen.
- Every lesson now has dish art in `content/images/dishes/`.
- Added `tools/dish-sheets.txt`, which lists every sheet and which dish each
  position is, with '-' for a dish a later sheet replaced. Re-cropping all the
  sheets from it can no longer overwrite a redo with an old picture.
  `tools/crop-dish-sheet.py` skips '-'.
- Redos still open with the owner: 14, 27, 34, 35, 37 (28 and 32 optional).
