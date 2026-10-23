# Cooking

A cooking course app for kids: each lesson pairs one skill with one real dish,
then runs the cook with checklists, step-by-step cook mode, and timers.
Multi-family, on Cloudflare, at `cleanplate.immotus.app`. Working name: **Clean Plate Recipes**.

**Latest build log entry:** [100. 2026-10-23 — Chef Ruth's Getting started](docs/build-log.md#100-2026-10-23--chef-ruths-getting-started)

## Current features

The plan is in `cooking-class-app-PLAN.md`. Setup steps, all in a browser, are in `docs/setup.md`.

- **Accounts** (`src/worker/`, `public/`): open sign-up with an emailed code, an optional beta word, parent login, password reset by email, and a parent PIN for parent screens.
- **Chef's lockers and profiles**: one person or several per profile, kid or adult, each with its own theme.
- **Kitchen**: each profile's own space, in Kitchen Quest or Chef's Passport, with three tabs pinned to the bottom: **Main quest / My journey** (what's queued, then the next few lessons on its path), **Side quests / More recipes** (every unit and recipe shelf, folded shut, with a search by dish or ingredient), and **Skill tree / Passport** (progress and rewards). Cards follow the family's diet settings, with swaps and left-out optional ingredients shown.
- **Progress and rewards** (`public/rewards.js`, `src/content/rewards.js`): each dish lights its node on the skill tree or stamps the passport and its world map, and each skill earns a crest or pin. Six ranks, from Kitchen Apprentice to Executive Chef at 75 dishes; family recipes count toward rank only. Worked out from the cooks, never stored.
- **Celebrations**: after a cook, and on coming back to the kitchen, the new stamp or cleared quest, new skills, and a full-screen rank up, once per device.
- **Sound** (`public/sound.js`): made in the browser. A sizzle on Next, a stamp thunk, a skill chime, and a rank-up fanfare, with a mute toggle remembered on the device (timers always ring).
- **Lesson player** (`public/player.js`): each lesson in the profile's theme: the lesson card with the serving picker, Learn cards, Prep checklists, and Cook mode with safety banners, kitchen words, Why? cards, timers that ring until stopped, and the screen kept awake.
- **Suggest a fix** (`src/content/patch.js`, `src/worker/lessons.js`): parents and adult learners report a problem on a lesson or step with what it should say instead; the family sees what came of it on the lesson.
- **Fix requests** (owner screens): apply a suggestion as a lesson patch for every family, after the linter's checks; decline, reopen, or revert any of them.
- **Voice step control** (`public/voice.js`): in cook mode, "next" (moves on and reads the step aloud), "back," and "again" (reads it again). Off until a parent turns it on in family settings; shown only where the browser can recognize speech.
- **Saved cooks** (`public/cooks.js`): each cook is saved to the family's account for every profile on it, with "Cooking with someone?" on the lesson card. A cook finished offline is sent when the connection returns. Lessons a profile has cooked say so in its kitchen. Nothing cooked on the Sabbath counts: it's saved, but the lesson stays up next and it isn't on Print our progress.
- **Queue** (`src/worker/plan.js`): the one "up next" list. Parents add lessons for one or more profiles, approve kids' requests, check each lesson's safety review, and mark lessons test-cooked. Kids ask with "I want to make this"; adults tap "Cook this". A kid starting a lesson that isn't on their list needs the parent PIN, approved as an extra meal or in place of an assigned one, so assigned lessons never get pushed back. A course lesson approved early leaves its later place, so it never shows twice. Each queued lesson is one line that opens to its tools. A Course / Additional toggle switches between the course and lessons assigned on top of it; + Add a lesson opens a dialog.
- **Courses and the weekly schedule** (`src/worker/schedule.js`): set a course up once for one or more profiles, and each week's lessons load into the queue. Weeks run Sunday to Friday (Saturday is the Sabbath); each week's lessons join the queue on its Sunday. On the Sabbath a "Shabbat shalom" banner shows and due dates are hidden. Unfinished lessons roll to next week; Skip this recipe, Cook another recipe, and Skip this week, each with Undo. The course card shows This week open and Next week folded, with the week's changes in a "⋯" menu. The course editor folds its lessons by path.
- **Shopping** (`src/content/shop.js`, `src/worker/shopping.js`), optional: **What you'll need** shows the ingredients for the coming lessons week by week. A parent can make a shopping list for the next few uncooked lessons, tick what's on hand, and check the rest off in the store; it's merged, rounded to store packages, and grouped by aisle. Three views: Upcoming (the default), Lists (newest first), and Staples.
- **Kitchen staples** (Shopping → Staples): added by searching for an ingredient; grouped first as "May already have" in Upcoming and before making a list; on the list itself, in their aisles.
- **Casual and homeschool modes**: homeschool adds due days for kids and overdue for parents; casual can turn on Plan our weeks.
- **Reflect** (`public/player.js`): after Plate it, each profile on the cook rates it (gems or chef's hats), says what they'd change, and can name another dish that uses the move; plus an optional rating from the eaters. Saved even if the connection drops.
- **Print our progress** (Parents → Progress): what each profile has cooked, with date, dish, cuisine, skill, and rating, printable or as a CSV.
- **Photos switch** (`/ops`): photos are off for every family until the owner turns them on for one.
- **Chef Ruth** (`public/ruth.js`, `src/worker/setup.js`): the helper, a scripted chat with a floating button on the parent screens. Her **Getting started** runs on its own for a new family and can't be skipped: family name and PIN, servings, diet, learners, kid logins, casual or homeschool, then a course or a first lesson. It can be run again from her button to change answers.
- **Test-cook notice**: parents from before Getting started see a one-time note, above the lockers, to read a lesson through before their kids cook it; Getting started ends with the same reminder.
- **Demo page** (`/demo`): no account needed. Try the sample lessons in either theme, including the three choices for julienne, preview diet settings and a real shopping list, and browse the whole course by dish or by skill.
- **Syllabus** (`/syllabus`): the course as a homeschool course, with objectives, units, hours, pacing, a suggested credit, and the rubric. Printable.
- **Course outline** (`content/course.json`): all 75 planned dishes in teaching order, with their skills and prerequisites, checked by the linter.
- **Lesson numbers** (`src/content/course.js`): come from the course order; pick-one choices share a number (1a, 1b, 1c), 59 in all.
- **Appointed Times unit** (unit 8 in `content/units.json`): lessons beside the numbered course, labeled A1, A2: unleavened flatbread and cottage cheese crescent rolls so far.
- **Family recipes** (Parents → Recipes, `src/content/recipe.js`, `src/worker/recipes.js`): a parent adds the family's own recipes one thing at a time (basics, ingredients from the list or typed in, tools, steps with safety levels and timers, meal type, a "why we make this" card, then review). The same unclean-food and food-safety checks as lessons; a wash-hands step is added after raw food. They show on an "Our recipes" shelf in every kitchen and can be queued, shopped for, and cooked like lessons. Only that family sees them.
- **Sharing recipes** (`src/worker/sharing.js`): a parent shares a recipe as General or Feast day. One from our ingredient list goes straight into **User-shared recipes**, with no family named; a typed-in ingredient waits for the owner's review; a feast-day recipe flagged for leaven gets the owner's notice with Send for review and Share recipe. Any family can search the directory, add a recipe to its own, and report one.
- **Owner: Recipe reviews and Reported recipes**: clear or decline a review (deciding the Unleavened badge), and hide or unhide any shared recipe.
- **Swap for an Appointed Time meal instead** (`src/worker/swap.js`): under a queued lesson's tools, parents only. February 1 to May 15 it offers only unleavened meals (the unit's lessons, other lessons, then recipes); the rest of the year, the unit and every feast-day recipe. The course lesson it replaces goes first next week and never counts as behind; a hand-queued one comes off. Undo swap puts it back.
- **Unleavened badge** (`src/content/leaven.js`, `content/rules/leaven.json`): on every lesson whose ingredients and steps have no leaven.
- **Parent menu**: every parent screen behind one Menu button, in groups: Learning path, Recipes, Setup, and Owner (the owner only).
- **Dish cards**: on the queue and course screens, a dish's name opens a card with a line about it, its main ingredients, how it cooks, and the time.
- **Kid logins** (`src/worker/kidlogin.js`): a parent gives a kid profile a login (first name and last initial, one of 30 cooking pictures, a password). That kid's device opens only their kitchen; the server refuses everything else. A kid login lasts 14 days, renewed each time the app is opened.
- **Parent screens**: profiles, family name, default servings, diet filters, voice step control, other parent logins, and the PIN. Each list's add button is at its top right, and adding opens a dialog (a course or recipe opens its own page); long sections fold shut.
- **Owner screens**: the beta word, the family list, setting a parent's password, fix requests, recipe reviews, and reported recipes.
- **Ops page** (`/ops`): migrations, the owner flag, backup download and restore, clear everything, and remove or restore one family.
- **Theme picker mockup** (`mockups/theme-picker.html`): four candidate themes with a sample lesson, so the kids can pick one.
- **Dish illustrations** (`content/images/dishes/`): one picture for each of the 75 lessons.
- **Theme showcase** (`mockups/quest-showcase/`): every component in both approved themes, Kitchen Quest and Chef's Passport.
- **Lesson content** (`content/`): 17 lessons (the 4 samples, all 11 of Unit 1, and the 2 Appointed Times lessons), and the ingredient, tool, skill (52), and cuisine lists, as JSON.
- **Content linter** (`tools/lint-content.js`): checks every lesson against the food rules, including the unclean-food block, the food-safety steps, and scaling. Runs on every push.
- **Scaling** (`src/content/`): amounts and step counts change with the serving size, shown in measuring-cup and spoon amounts.
- **Lesson preview** (`preview/lesson-preview.html`): each written lesson, read-only, at every serving size. Tap an underlined kitchen word to see what it means.
- **Kitchen words** (`content/terms.json`): what cooking words like dice, mince, and simmer mean, in kid terms. The linter won't let a lesson use one that isn't defined.
