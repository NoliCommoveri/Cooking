# Cooking

A cooking course app for kids: each lesson pairs one skill with one real dish,
then runs the cook with checklists, step-by-step cook mode, and timers.
Multi-family, on Cloudflare, at `cleanplate.immotus.app`. Working name: **Clean Plate Recipes**.

**Latest build log entry:** [42. 2026-10-22 — Plan: homeschool mode and the syllabus](docs/build-log.md#42-2026-10-22--plan-homeschool-mode-and-the-syllabus)

## Current features

The plan is in `cooking-class-app-PLAN.md`. Setup steps, all in a browser, are in `docs/setup.md`.

- **Accounts** (`src/worker/`, `public/`): open sign-up with an emailed code, an optional beta word, parent login, password reset by email, and a parent PIN for parent screens.
- **Chef's lockers and profiles**: one person or several per profile, kid or adult, each with its own theme.
- **Kitchen**: each profile sees the lesson library as Kitchen Quest quest cards or Chef's Passport recipe cards, filtered by the family's diet settings (with swaps and left-out optional ingredients shown on the card).
- **Lesson player** (`public/player.js`): each lesson in the profile's theme: the lesson card with the serving picker, Learn cards, Prep checklists, and Cook mode with safety banners, kitchen words, Why? cards, timers, and the screen kept awake.
- **Parent screens**: profiles, family name, default servings, diet filters, other parent logins, and the PIN.
- **Owner screens**: the beta word, the family list, and setting a parent's password.
- **Ops page** (`/ops`): migrations, the owner flag, backup download and restore, clear everything, and remove or restore one family.
- **Theme picker mockup** (`mockups/theme-picker.html`): four candidate themes with a sample lesson, so the kids can pick one.
- **Dish illustrations** (`content/images/dishes/`): one picture for each of the 75 lessons.
- **Theme showcase** (`mockups/quest-showcase/`): every component in both approved themes, Kitchen Quest and Chef's Passport.
- **Lesson content** (`content/`): 4 sample lessons, and the ingredient, tool, skill, and cuisine lists, as JSON.
- **Content linter** (`tools/lint-content.js`): checks every lesson against the food rules, including the unclean-food block, the food-safety steps, and scaling. Runs on every push.
- **Scaling** (`src/content/`): amounts and step counts change with the serving size, shown in measuring-cup and spoon amounts.
- **Lesson preview** (`preview/lesson-preview.html`): each sample lesson, read-only, at every serving size. Tap an underlined kitchen word to see what it means.
- **Kitchen words** (`content/terms.json`): what cooking words like dice, mince, and simmer mean, in kid terms. The linter won't let a lesson use one that isn't defined.
