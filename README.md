# Cooking

A cooking course app for kids: each lesson pairs one skill with one real dish,
then runs the cook with checklists, step-by-step cook mode, and timers.
Multi-family, on Cloudflare. Working name: **Clean Plate Recipes**.

**Latest build log entry:** [23. 2026-10-22 — Wording a kid can follow](docs/build-log.md#23-2026-10-22--wording-a-kid-can-follow)

## Current features

No app yet. The plan is in `cooking-class-app-PLAN.md`.

- **Theme picker mockup** (`mockups/theme-picker.html`): four candidate themes with a sample lesson, so the kids can pick one.
- **Dish illustrations** (`content/images/dishes/`): one picture for each of the 50 lessons.
- **Theme showcase** (`mockups/quest-showcase/`): every component in both approved themes, Kitchen Quest and Chef's Passport.
- **Lesson content** (`content/`): 4 sample lessons, and the ingredient, tool, skill, and cuisine lists, as JSON.
- **Content linter** (`tools/lint-content.js`): checks every lesson against the food rules, including the unclean-food block, the food-safety steps, and scaling. Runs on every push.
- **Scaling** (`src/content/`): amounts and step counts change with the serving size, shown in measuring-cup and spoon amounts.
- **Lesson preview** (`preview/lesson-preview.html`): each sample lesson, read-only, at every serving size.
