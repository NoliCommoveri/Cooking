# Cooking

A cooking course app for kids: each lesson pairs one skill with one real dish,
then runs the cook with checklists, step-by-step cook mode, and timers.
Multi-family, on Cloudflare, at `cleanplate.immotus.app`. Working name: **Clean Plate Recipes**.

**Latest build log entry:** [70. 2026-10-22 — Plan: syllabus hours count one student's path](docs/build-log.md#70-2026-10-22--plan-syllabus-hours-count-one-students-path)

## Current features

The plan is in `cooking-class-app-PLAN.md`. Setup steps, all in a browser, are in `docs/setup.md`.

- **Accounts** (`src/worker/`, `public/`): open sign-up with an emailed code, an optional beta word, parent login, password reset by email, and a parent PIN for parent screens.
- **Chef's lockers and profiles**: one person or several per profile, kid or adult, each with its own theme.
- **Kitchen**: each profile sees the lesson library as Kitchen Quest quest cards or Chef's Passport recipe cards, filtered by the family's diet settings (with swaps and left-out optional ingredients shown on the card).
- **Lesson player** (`public/player.js`): each lesson in the profile's theme: the lesson card with the serving picker, Learn cards, Prep checklists, and Cook mode with safety banners, kitchen words, Why? cards, timers that ring until stopped, and the screen kept awake.
- **Suggest a fix** (`src/content/patch.js`, `src/worker/lessons.js`): parents and adult learners report a problem on a lesson or step with what it should say instead; the family sees what came of it on the lesson.
- **Fix requests** (owner screens): apply a suggestion as a lesson patch for every family, after the linter's checks; decline, reopen, or revert any of them.
- **Voice step control** (`public/voice.js`): in cook mode, "next" (moves on and reads the step aloud), "back," and "again" (reads it again). Off until a parent turns it on in family settings; shown only where the browser can recognize speech.
- **Saved cooks** (`public/cooks.js`): each cook is saved to the family's account for every profile on it, with "Cooking with someone?" on the lesson card. A cook finished offline is sent when the connection returns. Lessons a profile has cooked say so in its kitchen.
- **Queue** (`src/worker/plan.js`): the one "up next" list. Parents add lessons for one or more profiles, approve kids' requests, check each lesson's safety review, and mark lessons test-cooked. Kids ask with "I want to make this"; adults tap "Cook this".
- **Courses and the weekly schedule** (`src/worker/schedule.js`): set a course up once for one or more profiles, and each week's lessons load into the queue. Weeks run Sunday to Friday (Saturday is the Sabbath); each week's lessons join the queue on its Sunday. On the Sabbath a "Shabbat shalom" banner shows and due dates are hidden. Unfinished lessons roll to next week; Skip this recipe, Cook another recipe, and Skip this week, each with Undo.
- **Shopping** (`src/content/shop.js`, `src/worker/shopping.js`), optional: **What you'll need** shows the ingredients for the coming lessons week by week. A parent can make a shopping list for the next few uncooked lessons, tick what's on hand, and check the rest off in the store; it's merged, rounded to store packages, and grouped by aisle.
- **Kitchen staples**: grouped on lists as "May already have", still on the list.
- **Casual and homeschool modes**: homeschool adds due days for kids and overdue for parents; casual can turn on Plan our weeks.
- **Reflect** (`public/player.js`): after Plate it, each profile on the cook rates it (gems or chef's hats), says what they'd change, and can name another dish that uses the move; plus an optional rating from the eaters. Saved even if the connection drops.
- **Print our progress** (Parents → Progress): what each profile has cooked, with date, dish, cuisine, skill, and rating, printable or as a CSV.
- **Photos switch** (`/ops`): photos are off for every family until the owner turns them on for one.
- **Test-cook notice**: each parent sees a one-time note, above the lockers, to read a lesson through before their kids cook it.
- **Demo page** (`/demo`): no account needed. Try the sample lessons in either theme, including the three choices for julienne, preview diet settings and a real shopping list, and browse the whole course by dish or by skill.
- **Syllabus** (`/syllabus`): the course as a homeschool course, with objectives, units, hours, pacing, a suggested credit, and the rubric. Printable.
- **Course outline** (`content/course.json`): all 75 planned dishes in teaching order, with their skills and prerequisites, checked by the linter.
- **Lesson numbers** (`src/content/course.js`): come from the course order; pick-one choices share a number (1a, 1b, 1c), 59 in all.
- **Parent screens**: profiles, family name, default servings, diet filters, voice step control, other parent logins, and the PIN.
- **Owner screens**: the beta word, the family list, setting a parent's password, and fix requests.
- **Ops page** (`/ops`): migrations, the owner flag, backup download and restore, clear everything, and remove or restore one family.
- **Theme picker mockup** (`mockups/theme-picker.html`): four candidate themes with a sample lesson, so the kids can pick one.
- **Dish illustrations** (`content/images/dishes/`): one picture for each of the 75 lessons.
- **Theme showcase** (`mockups/quest-showcase/`): every component in both approved themes, Kitchen Quest and Chef's Passport.
- **Lesson content** (`content/`): 7 lessons (the 4 samples, and 1a–1c: spring rolls, chicken fajitas, shoestring fries), and the ingredient, tool, skill (52), and cuisine lists, as JSON.
- **Content linter** (`tools/lint-content.js`): checks every lesson against the food rules, including the unclean-food block, the food-safety steps, and scaling. Runs on every push.
- **Scaling** (`src/content/`): amounts and step counts change with the serving size, shown in measuring-cup and spoon amounts.
- **Lesson preview** (`preview/lesson-preview.html`): each written lesson, read-only, at every serving size. Tap an underlined kitchen word to see what it means.
- **Kitchen words** (`content/terms.json`): what cooking words like dice, mince, and simmer mean, in kid terms. The linter won't let a lesson use one that isn't defined.
