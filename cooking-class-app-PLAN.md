# Kids Cooking Class App — Overview Plan

**Status:** Planning. Nothing is built yet.
**Audience for this doc:** Claude Code, building the app in phases.
**How to read this doc:** Items marked **Requirement** come from the owner (Jen) and should not change without her say-so. Items marked **Recommendation** are proposals. Each one lists alternatives and the conditions under which it should be revisited. Treat every recommendation as open to change.

---

## 1. What this is

A cooking course app for two kids, ages 11 and 12, who already have some cooking experience. The app does two jobs:

1. **Teaches.** Each lesson pairs one cooking skill with one real dish that uses that skill.
2. **Runs the actual cooking.** Kids work through checkable ingredient and equipment lists, then a step-by-step cook mode with built-in timers. At the end they photograph the result and write a short reflection.

A parent uses the app from their phone. They queue lessons, see a combined **shopping list** before shopping, review the safety requirements of each lesson, and browse their kids' photos.

**Requirement: the app is multi-family.** It was designed first for the owner's family (two kids, ages 11 and 12), but several families must be able to use it. Each family has its own kids, progress, queue, pantry, shopping list, photos, and settings. All families share the same lesson library.

**Planned: a beginner track.** A simpler track for kids with no prior cooking experience is planned after the core course (§11). It is not built in the first release, but the data model includes the fields it needs from the start, so adding it later doesn't require a migration.

### Users
| User | Device | Main jobs |
|---|---|---|
| Owner (Jen) | Any | Everything a parent can do, plus creating invite codes and managing families |
| Parent (1+ per family) | Phone | Queue lessons, shopping list, safety review, gallery, family settings |
| Kid (any number per family) | Tablet or phone in the kitchen | Learn, prep, cook, photograph, reflect, see progress |

---

## 2. Requirements

### 2.1 Food rules
- **Hard-blocked: biblically unclean foods** (Leviticus 11, Deuteronomy 14). No lesson, ingredient, substitution, or family setting may include them, for any family. This rule cannot be turned off in the app.
  - **Land animals:** allowed only if the animal both chews the cud and has a split hoof (beef, lamb, goat, venison). Blocked: pork in every form, rabbit, and any other animal that fails either test.
  - **Water animals:** allowed only if the animal has both fins and scales (e.g. salmon, cod, tilapia, tuna, anchovy, trout). Blocked: all shellfish (shrimp, crab, lobster, clams, oysters, mussels, scallops), squid, octopus, catfish, eel, shark, and any other animal without both.
  - **Birds:** chicken, turkey, duck, and goose are allowed. The birds listed in Leviticus 11:13–19 are blocked, including birds of prey and scavengers.
  - **Insects:** blocked (the only exceptions in Leviticus 11:22 are certain locusts, which won't appear in this library).
- **Hidden sources must be flagged** in the ingredient registry and checked by the content linter (§7.4). Each needs a named substitute or a "check the label" note:
  - Oyster sauce (shellfish). Substitute mushroom stir-fry sauce, or soy sauce plus sugar.
  - Shrimp paste, which hides in many Thai curry pastes and some kimchi.
  - Gelatin (usually pork). Substitute beef gelatin or agar-agar. Gelatin also hides in some yogurts, sour creams, gummies, and marshmallows.
  - Lard, found in some tortillas, refried beans, biscuits, and pie crusts.
  - Pork sausage casings, used even on many chicken and turkey sausages. Look for collagen-cased or skinless.
  - Breakfast sausage, andouille, chorizo, bacon, pancetta, guanciale, Canadian bacon (pork by default; use beef or poultry versions).
  - Imitation crab (often pollock, but may contain crab or shellfish extract).
  - Carmine or cochineal (an insect-derived red coloring) in some candies, yogurts, and drinks.
- **Per-family dietary filters** are an extra layer on top of the hard block. Each family can add its own restrictions (e.g. vegetarian, nut-free, dairy-free) using `diet` flags on the ingredient registry. A lesson that conflicts with a family's filters is hidden from that family. If the lesson lists an allowed substitution that resolves the conflict, it is shown with that substitution applied instead.
  - **Recommendation:** start with these flags: nuts, peanuts, dairy, egg, gluten, fish, meat (for vegetarian).
  - The hard block is not a family filter. A family can add restrictions but cannot remove the hard block.
- Clean fish and products made from them are allowed: fish sauce (anchovy), Worcestershire (anchovy), and dashi (bonito).
- Mixing meat and dairy in one dish is allowed.
- Ingredients should not be hard to find. Where a dish has a hard-to-find ingredient, the lesson must name a common substitute.

### 2.2 Servings
- Library recipes are written for **6 servings**. Each family sets its own default serving count, and recipes must scale to it.

### 2.3 Fun, kid-appealing UI
- The UI must be **highly appealing to kids, themed, and playful, not utilitarian.** See §5. This is a primary requirement, not polish to add at the end.
- **No pill-shaped chips, tags, or badges.** See §5.6 for the full list of banned patterns.

### 2.4 Parent shopping view
- A parent must be able to see every ingredient needed for their family's upcoming lessons **from their phone, before shopping**.

### 2.5 Security level
- **Requirement:** keep security basic. The data isn't sensitive, so don't add security features beyond §8.3.
- The one thing the basic level must still guarantee: **a family sees only its own data and photos.** Other families' kids' photos must never be visible.

### 2.6 Photos
- Kids must be able to photograph their finished dishes inside the app. Each photo is attached to that kid's attempt at that lesson.

---

## 3. Lesson structure

Each lesson has these stages:

1. **Intro.** A 30–45 second animated slideshow (§6.5): the finished dish, the skill, why it matters, an ingredient preview, time and safety level, and a "Let's cook" button.
2. **Learn.** 3–6 short concept cards with a "why it works" angle. An optional quiz of 2–3 questions follows. **The quiz never blocks cooking.**
3. **Prep (mise en place).** An ingredient checklist with amounts scaled to the chosen servings, then an equipment checklist. Cook mode unlocks once every item is checked.
4. **Cook mode.** One step per screen. Each step has a checkbox, a big Next control, inline timers where needed (several can run at once), a safety level, and an optional tip or "what it should look like" note. The screen stays awake for the whole cook.
5. **Plate and photo.** The camera opens directly, and the photo saves to this attempt.
6. **Reflect.** A 1–5 rating, a "what would I change?" note, and an optional rating from whoever ate it.

### Safety levels (per step; a lesson's level is its highest step)
| Level | Meaning |
|---|---|
| Solo | Kid works alone |
| Adult nearby | An adult must be in the kitchen |
| Adult hands-on | An adult must actively help (hot oil, deep frying, etc.) |

Safety levels must be shown as **illustrated icons or banners, not colored pills** (§5.4).

---

## 4. Curriculum (50 dishes)

Lessons are grouped into units by skill. International and American dishes are mixed within each unit, and breakfast dishes are spread across the units. The exact teaching order is still an open content task. **Recommendation:** go through the units in order and alternate cuisines within each unit. The safety levels below are suggested defaults. The parent can adjust them per step.

### Unit 1 — Knife work and assembly
| # | Dish | Cuisine | Skill | Max safety | Notes |
|---|---|---|---|---|---|
| 1 | Fresh spring rolls | Vietnamese | Julienne, rolling rice paper | Adult nearby | Chicken instead of shrimp/pork; peanut + hoisin dip |
| 2 | Fattoush | Lebanese | Fine chopping, toasting pita | Adult nearby | Sumac sub: lemon zest + salt |
| 3 | Pico de gallo + Baja fish tacos | Mexican | Dicing; simple batter or broil | Adult nearby | Cod/tilapia |
| 26 | Chicken Caesar + homemade dressing & croutons | American | Whisked dressing, cubing bread | Adult nearby | Pasteurized eggs or mayo base |
| 27 | Smash burgers + quick pickles | American | Thin slicing, quick pickle, high-heat sear | Adult nearby | |

### Unit 2 — Stovetop basics
| # | Dish | Cuisine | Skill | Max safety | Notes |
|---|---|---|---|---|---|
| 4 | Shakshuka | N. African / Middle Eastern | Building a sauce, poaching eggs in it | Adult nearby | |
| 5 | Chicken fried rice | Chinese | High-heat stir-fry, day-old rice | Adult nearby | Mushroom stir-fry sauce, not oyster sauce |
| 6 | Oyakodon | Japanese | Simmering, setting egg gently | Adult nearby | Mirin sub: rice vinegar + sugar; dashi sub: chicken broth + soy |
| 7 | Chicken adobo | Filipino | Braising, reducing | Adult nearby | |
| 8 | Cacio e pepe | Italian | Emulsion | Adult nearby | |
| 28 | French-style omelet (breakfast) | American/French | Heat control, rolling an omelet | Adult nearby | |
| 29 | Crispy hash browns (breakfast) | American | Squeezing out moisture, crisping | Adult nearby | |
| 30 | Breakfast burritos (breakfast) | American | Timing several components, rolling | Adult nearby | Beef chorizo or turkey sausage |
| 31 | Eggs Benedict (breakfast) | American | Poaching eggs, hollandaise | Adult nearby | Turkey bacon or smoked salmon. Prereq: 8 |
| 32 | Stovetop mac and cheese | American | Roux → béchamel → cheese sauce | Adult nearby | Foundation for every roux lesson |

### Unit 3 — Spices and flavor bases
| # | Dish | Cuisine | Skill | Max safety | Notes |
|---|---|---|---|---|---|
| 9 | Chana masala | Indian | Blooming spices, onion-tomato base | Adult nearby | Amchur sub: lemon |
| 10 | Misir wot | Ethiopian | Spiced lentils | Adult nearby | Berbere sub: paprika + cayenne + warm spices; serve with rice |
| 11 | Chicken tagine with olives | Moroccan | Layered spice braise | Adult nearby | Preserved lemon sub; ras el hanout sub; Dutch oven |
| 12 | Butter chicken | Indian | Marinating, finishing with cream | Adult nearby | |
| 13 | Jerk chicken | Jamaican | Wet marinade, broiling | Adult nearby | Habanero or jalapeño |
| 33 | Beef chili | American | Batch browning, toasting spices | Adult nearby | |
| 34 | Chicken & sausage jambalaya | Louisiana | Onion/celery/pepper base | Adult nearby | Chicken andouille; check casings; no shrimp |
| 35 | BBQ pulled chicken + coleslaw | American | Dry rub, reducing a sauce | Adult nearby | |

### Unit 4 — Breaking down and slicing meat, marinades
| # | Dish | Cuisine | Skill | Max safety | Notes |
|---|---|---|---|---|---|
| 14 | Beef bulgogi | Korean | Thin slicing (partly frozen), marinating | Adult nearby | Asian pear sub: Bosc pear or apple |
| 15 | Lomo saltado | Peruvian | Beef stir-fry | Adult nearby | Aji amarillo sub: yellow bell pepper + cayenne |
| 16 | Chicken tinga tacos | Mexican | Braising, shredding | Adult nearby | |
| 36 | Chicken noodle soup from a whole chicken | American | Breaking down a bird, making stock | Adult nearby | |
| 37 | Philly cheesesteak | American | Thin slicing (deliberate repeat of 14) | Adult nearby | Prereq: 14 |

### Unit 5 — Dough and batter
| # | Dish | Cuisine | Skill | Max safety | Notes |
|---|---|---|---|---|---|
| 17 | Pupusas | Salvadoran | Masa dough, griddle | Adult nearby | Lard-free beans |
| 18 | Gyoza | Japanese | Pleating, fry-then-steam | Adult nearby | Chicken or beef filling |
| 19 | Skillet naan | Indian | Yogurt dough, high-heat skillet | Adult nearby | |
| 20 | Pão de queijo | Brazilian | Scalded tapioca dough | Adult nearby | |
| 38 | Buttermilk biscuits (breakfast) | American | Cutting in cold fat, folding for layers | Adult nearby | Butter, not lard |
| 39 | Biscuits + sausage gravy (breakfast) | American | Milk gravy on a roux | Adult nearby | Turkey sausage. Prereq: 38, 32 |
| 40 | Blueberry muffins (breakfast) | American | Muffin method, avoiding overmixing | Adult nearby | |
| 41 | Skillet cornbread | American | Preheated skillet | Adult nearby | Pairs with 33 |
| 42 | Cinnamon rolls (breakfast) | American | First yeast dough: kneading, proofing, shaping | Adult nearby | |

### Unit 6 — Oven, roasting, frying
| # | Dish | Cuisine | Skill | Max safety | Notes |
|---|---|---|---|---|---|
| 21 | Spanakopita | Greek | Phyllo, layering | Adult nearby | |
| 22 | Spinach & mushroom quiche | French | Pastry, blind baking, custard | Adult nearby | No bacon |
| 23 | Chicken katsu | Japanese | Breading station, shallow frying | **Adult hands-on** | Tonkatsu sauce sub |
| 24 | Swedish meatballs | Swedish | Browning, roux gravy | Adult nearby | Beef; cranberry for lingonberry. Prereq: 32 |
| 43 | Homemade granola (breakfast) | American | Oven browning, stirring partway | Solo / Adult nearby | |
| 44 | Meatloaf with glaze | American | Binders, thermometer | Adult nearby | |
| 45 | Roast chicken + pan gravy | American | Roasting, resting, carving, gravy | Adult nearby | Prereq: 32 |
| 46 | Chicken pot pie | American | Roux filling + pie crust | Adult nearby | Prereq: 32, 22 |
| 47 | Pot roast | American | Long oven braise | Adult nearby | |
| 48 | Southern fried chicken | American | Buttermilk soak, deep-fry with thermometer | **Adult hands-on** | |

### Desserts
| # | Dish | Cuisine | Skill | Max safety | Notes |
|---|---|---|---|---|---|
| 25 | Churros with chocolate *(alt: panna cotta)* | Spanish/Mexican *(Italian)* | Choux dough, frying *(gelatin swap)* | **Adult hands-on** *(Adult nearby)* | Panna cotta: beef gelatin or agar-agar |
| 49 | Brown butter chocolate chip cookies | American | Browning butter, creaming | Adult nearby | |
| 50 | Apple pie with lattice | American | Advanced pastry | Adult nearby | Prereq: 22 |

### Capstone
- **Multi-dish meal timing.** Example: bulgogi + fried rice + spring rolls. Requires a "plan the timeline" stage that the single-dish lessons don't have. Design it after the core lesson player works.

### Equipment note
None of the 50 dishes requires a stand mixer. Lessons that use one in typical recipes (cinnamon rolls, cookies, churros, pão de queijo) must be written for hand mixing or hand kneading.

---

## 5. UI and visual design

> If a frontend-design skill is available in the Claude Code environment, load it before starting any UI work.

### 5.1 Tone and age target
- Target ages **11–12**. It should feel like a **cooking video game**, not a preschool app and not a productivity tool.
- Playful, warm, and tactile. Avoid baby-ish mascots, a sing-song tone, and anything kids this age would find embarrassing.

### 5.2 Theme
**Recommendation:** "Chef's Passport" combined with "Kitchen Ranks."
- **Passport:** each completed dish earns an inked stamp for its cuisine in a passport book. Stamp pages are grouped by region, and the passport's world map lights up as regions fill in.
- **Ranks:** kids level up through Kitchen Apprentice → Prep Cook → Line Cook → Sous Chef → Head Chef, driven by lessons completed and skills earned. Each rank changes the hat or apron on the kid's chef avatar.

**Alternatives:**
- Kitchen Quest: an RPG-style skill tree with unlockable paths.
- Food Truck: each lesson adds a menu item to the kid's own food truck.
- Recipe scrapbook: progress lives in a scrapbook.

**Revisit if:** the kids prefer a different theme. Let them choose from mockups before the theme is built out.

### 5.3 Visual language
- **Surfaces:** recipe cards with a paper texture, tape on the corners, and a slight rotation. Use a corkboard, a chalkboard menu, or a tile-backsplash texture for backgrounds.
- **Palette (recommendation):** warm kitchen colors defined as CSS tokens — tomato red, butter yellow, basil green, cream paper, cast-iron charcoal. An optional "night kitchen" dark theme.
- **Typography (recommendation):** a chunky, rounded display font for headings (e.g. **Lilita One**, **Fredoka**, or **Baloo 2**), a highly readable body font (e.g. **Nunito**), and a handwritten accent font for notes and reflections (e.g. **Caveat**). All are SIL OFL fonts on Google Fonts. Body text in cook mode must stay readable from about an arm's length away, so the body size there is large (≥ 20px).
- **Icons:** custom SVG illustrations in one consistent style. Don't rely on emoji as the main iconography.

### 5.4 Themed components
| Component | Treatment |
|---|---|
| Lesson card | A taped recipe card showing the dish illustration, title in the display font, and a skill line handwritten underneath |
| Ingredient checklist | Tapping an item makes it **hop into a mixing bowl** illustration. The bowl visibly fills as items are checked |
| Equipment checklist | Tools hang on a **pegboard**. Checked tools lift off their hook and glow |
| Cook step | A large recipe card. Next **flips** the card to the following step |
| Timers | A **kitchen dial timer** that counts down, wobbles and rings at zero. Several timers sit side by side on a "counter" strip, each labeled with what it's timing |
| Safety level | An illustrated **banner** across the top of a step (chef-hat helper icon for adult nearby, oven-mitt hands for adult hands-on) with one short line of text. **Not a pill** |
| Progress within a lesson | A **measuring cup** or pot that fills as steps are completed |
| Course progress | The **passport book** and world map (§5.2) |
| Skills earned | **Enamel-pin or embroidered-patch** shapes (circles, shields, hexagons) pinned to an apron. Not text chips |
| Rating | 1–5 **chef hats** or wooden spoons, not stars |
| Photos | Taking a photo drops a **Polaroid** onto a corkboard. The gallery is a corkboard or scrapbook |
| Rank up | A full-screen celebration where the hat upgrades, with a confetti or sprinkles burst |
| Profile picker | Each kid has a **chef's locker** with their avatar and apron |

### 5.5 Motion and sound
- **Small, frequent actions** (check an item, Next): quick and satisfying, about 150–350 ms.
- **Milestones** (lesson done, stamp earned, rank up): bigger celebrations are fine — a stamp slamming down with an ink splat, steam puffs, a sprinkles burst.
- **Nothing should animate while a kid is reading a step.** Motion must not pull attention away from the cooking instructions.
- Honor `prefers-reduced-motion` with simpler fades.
- **Optional sound effects:** timer ding, a light sizzle on Next, a stamp thunk. Include a mute toggle that is remembered per device.

### 5.6 Banned patterns
Do **not** use:
- **Pill-shaped chips, tags, badges, or status labels** (small colored rounded-rectangle labels, `border-radius: 9999px` text tags, "tag clouds"). Show status through an **icon plus shape plus position**, or through themed objects (stamps, pins, banners).
- The default look of any component library (Bootstrap, unstyled shadcn, default Tailwind UI) left un-themed.
- A generic SaaS dashboard look: gray-bordered card grids, purple-blue gradients, flat stat tiles.
- Tiny tap targets. The minimum is **56px** in cook mode, since kids will be tapping with messy hands.

### 5.7 Parent view
- Uses the same theme, but toned down and **built for scanning**. She's in a store, on a phone.
- The shopping list is styled as a **grocery notepad** with handwritten-style checkmarks, grouped by store section. Still no pills.

---

## 6. Features

### 6.1 Kid features
- Profile picker (chef lockers), showing only the kids in this family
- Lesson browser by unit, with locked lessons whose prerequisites aren't done shown as a "coming up" card (not hidden)
- Full lesson flow (§3)
- Serving scaler (default 6)
- Multiple concurrent timers; the timer keeps running if the kid navigates to another step
- Screen Wake Lock during Prep and Cook
- Passport, ranks, skill pins, gallery

### 6.2 Parent features
- **Queue:** assign or approve the next 1–3 lessons per kid, each with an optional planned date
- **Shopping list** (§6.3)
- **Safety review:** before approving a lesson, see every step marked adult-nearby or adult-hands-on
- **Edit safety levels** per step
- **Gallery:** all photos, filterable by kid and lesson, with reflections
- **Pantry staples:** a list of ingredients always on hand, which drop off the shopping list
- **Family settings:** family name, kids (add, rename, avatar), dietary filters (§2.1), default servings, other parent logins

### 6.2a Owner features
- Create and revoke invite codes
- See the list of families (name, number of kids, last active). The owner does **not** see other families' photos or progress by default.

### 6.3 Shopping list logic
1. Collect the ingredient lines from the selected queued lessons.
2. Scale each line to the lesson's serving count.
3. Convert each line to the ingredient's **base unit** using the registry's conversions (e.g. grams per cup of flour).
4. **Merge by canonical ingredient ID.** This is the main reason the ingredient registry exists.
5. Remove pantry staples (keep them viewable in a collapsed "you should have" section).
6. Round up to **purchase units** (e.g. 15 oz can, dozen eggs, bunch, head), with the exact amount used shown alongside.
7. Group by **store section** (meat & fish, produce, herbs, dairy & eggs, bread & tortillas, grains & pasta, canned & jarred, sauces, oils & vinegars, baking, specialty, frozen, spices).
8. Mark perishables. If lessons have planned dates, show perishables only for lessons within the next N days (default 7, adjustable).
9. Check-off state persists, so the list survives closing the app mid-shop.

### 6.4 Photos
- Open the camera via file input with `capture`, or an equivalent.
- **Resize on the device** before upload (long edge about 1600px, JPEG about 0.8 quality).
- Store in object storage (§8), linked to the attempt.
- Photos are only visible to the family that took them (§2.5, §8.3).

### 6.5 Lesson intro slideshows
**Recommendation:** an in-app slideshow engine driven by each lesson's data, not pre-rendered video files.
- Each lesson's `intro` field is a list of slides (image, caption, duration, transition) plus a music loop ID.
- The app plays it full screen so it looks and feels like a video.
- It can include the kid's own photo from an earlier lesson ("Last time you made…").
- Includes a mute toggle and a skip button.

**Alternative:** render an MP4 per lesson from the same slide data.

**Revisit if:** intros need to be shared or played outside the app. Because both approaches use the same slide data, MP4 export can be added later.

**Images for intros:** the parent's photos, free-license stock images, or a consistent set of illustrated ingredient icons. Once a kid has cooked a lesson, their photo can replace the stock hero image.

**Music:** a small set of royalty-free loops (upbeat, calm, baking). The license for each track must be recorded in the repo.

---

## 7. Content as data

Lessons, recipes, and ingredients are **JSON files in the repo**, separate from the app code. Adding lessons means adding files, not changing code. Recipe text must be written originally, not copied from published sources.

### 7.1 Files
```
content/
  ingredients.json        # canonical ingredient registry
  lessons/
    01-spring-rolls.json
    ...
  music/                  # loops + LICENSES.md
  images/
```

### 7.2 Ingredient registry entry (sketch)
```json
{
  "id": "flour-ap",
  "name": "All-purpose flour",
  "section": "baking",
  "baseUnit": "g",
  "conversions": { "cup": 125, "tbsp": 7.8 },
  "purchaseUnit": { "label": "5 lb bag", "amount": 2268 },
  "perishable": false,
  "unclean": false,
  "diet": { "dairy": false, "gluten": false },
  "watch": null
}
```
For ingredients on the hidden-source list (§2.1), `watch` carries a short note, e.g. `"Check casing: must be collagen or skinless"`.

### 7.3 Lesson file (sketch)
```json
{
  "id": "14-bulgogi",
  "number": 14,
  "track": "core",
  "unit": 4,
  "title": "Beef Bulgogi",
  "cuisine": "Korean",
  "skill": "Thin slicing & marinating",
  "prereqs": [],
  "servings": 6,
  "intro": { "slides": [ { "image": "...", "caption": "...", "seconds": 5 } ], "music": "upbeat-1" },
  "learn": { "cards": [ { "title": "...", "body": "..." } ], "quiz": [ { "q": "...", "choices": ["..."], "answer": 0 } ] },
  "ingredients": [ { "ingredient": "beef-sirloin", "amount": 2.5, "unit": "lb", "prep": "sliced thin" } ],
  "substitutions": [ { "for": "asian-pear", "use": "pear-bosc", "note": "or a grated apple" } ],
  "equipment": ["chef-knife", "cutting-board", "skillet"],
  "steps": [
    { "text": "...", "safety": "adult-nearby", "timerSeconds": 0, "tip": "..." }
  ]
}
```

### 7.4 Content linter (runs at build time and in CI)
The linter must reject content when:
- the JSON doesn't match the schema
- a lesson references an ingredient ID missing from the registry
- an ingredient is flagged `unclean` (§2.1). There is no override or exception mechanism for this check
- a step has no safety level
- a prerequisite points to a lesson that doesn't exist, or prerequisites form a loop
- a unit has no conversion to its ingredient's base unit

The linter must **warn** (without failing the build) when:
- a lesson uses an ingredient with a `watch` note
- a lesson has no intro slides yet

---

## 8. Architecture

### 8.1 Hosting — Recommendation
- Use the owner's existing **git → Cloudflare** deploy stack: a **Worker** serving the app and API, **D1** for structured data, and **R2** for photos.
- Own subdomain, e.g. `cook.immotus.app`. This app is not a game, so it stays separate from the `games.immotus.app` hub.

A backend is needed because the app is multi-family: each family's progress, queue, and photos must be stored per family and reachable from any of that family's devices.

### 8.2 Front end — Recommendation
- Build it as an installable **PWA**, and cache the active lesson so a Wi-Fi drop mid-recipe doesn't break cook mode.
- The framework choice is open: Vite with a lightweight component framework, or plain web components. Use CSS custom properties for theme tokens. CSS animations are fine for most motion; use an animation library only for complex sequences (stamp slam, rank up).

### 8.3 Accounts and access (basic, per §2.5) — Recommendation
- **Sign-up by invite code.** The owner creates a code and a new family uses it to create its account. This keeps the app to families the owner knows without building moderation tools.
  - **Alternative:** open sign-up. **Revisit if** the owner wants anyone to be able to join.
- **Parent login:** email and password. Store passwords hashed with a standard algorithm (PBKDF2 via Web Crypto is available in Workers). Sessions use a long-lived, httpOnly cookie, so kitchen devices stay logged in.
  - **Not included, on purpose:** email verification, password-reset email flows, two-factor login, rate limiting beyond the platform defaults. A forgotten password is reset by the owner.
  - **Revisit if:** the app opens to families the owner doesn't know.
- **Kids don't log in.** A device logged in as a family shows the profile picker (chef lockers).
- **Parent PIN:** optional, per family. If set, parent-only screens on a shared device ask for it. Stored as a hash, but it's a convenience lock, not a security boundary.
- **Family scoping:** every API query filters by the logged-in session's `family_id`. No endpoint accepts a family ID from the client.
- **Photos:** stored in R2 under `families/{family_id}/…`, served only through the Worker after checking the session's family. R2 is not exposed publicly.

### 8.4 Data model (D1)
Every table except `families` carries `family_id`.
- `families` (id, name, default_servings, diet_filters, parent_pin_hash, created_at)
- `parents` (id, family_id, email, password_hash, is_owner)
- `invites` (code, created_by, used_by_family_id, created_at, revoked)
- `sessions` (id, parent_id, family_id, created_at, last_seen)
- `kids` (id, family_id, name, avatar, rank, track: core | beginner)
- `queue` (family_id, kid_id, lesson_id, planned_date, status: assigned → shopped → cooked, approved_by_parent)
- `attempts` (id, family_id, kid_id, lesson_id, servings, started_at, finished_at, checklist_state, rating, notes, eater_rating)
- `photos` (id, family_id, attempt_id, r2_key, created_at)
- `pantry` (family_id, ingredient_id)
- `shopping_checks` (family_id, ingredient_id, list_key, checked)
- `safety_overrides` (family_id, lesson_id, step_index, level)
- Stamps, pins, and rank are computed from `attempts` and the content files, not stored separately (**recommendation**; cache them if it gets slow).
- The lesson library and ingredient registry are content files shared by all families (§7). They are not stored per family.

---

## 9. Build phases

Each phase should be deployed and usable before the next begins.

| Phase | Scope | Done when |
|---|---|---|
| **0. Look & feel** | Theme tokens, fonts, SVG icon set, and a **component showcase page** with every themed component from §5.4 in a demo state | The owner approves the look. **No features are built before this.** |
| **1. Content core** | JSON schema, ingredient registry (including diet flags), linter, and 4 sample lessons covering different units (suggested: 4 Shakshuka, 14 Bulgogi, 38 Biscuits, 49 Cookies) | The linter passes and the lessons render read-only |
| **1b. Families & accounts** | D1 schema with `family_id` on every table, invite codes, parent login, sessions, kid profiles, family settings, diet filtering of the library | Two test families sign up with codes, and neither can see the other's kids, data, or photos |
| **2. Lesson player** | Learn, Prep, Cook mode, timers, wake lock, offline cache | A kid can cook a sample lesson start to finish on a tablet |
| **3. Parent shopping** | Queue, shopping list with merging, pantry, check-off persistence | A parent shops for 3 queued lessons from their phone |
| **4. Photos & reflect** | Camera, resize, R2 upload, Reflect stage, gallery | A photo taken on the tablet shows in the gallery on the parent's phone |
| **5. Progress & delight** | Profiles, passport, ranks, skill pins, celebrations, sound | Completing a lesson earns its stamp and pin with full animation |
| **6. Intros** | Slideshow engine, music loops, skip/mute | Every sample lesson has a working intro |
| **7. Content fill** | The remaining 46 lessons, written in separate content sessions | All 50 lessons pass the linter |
| **Later** | Beginner track (§11), capstone meal-timing lessons, cook-together mode, voice "next step," CSV export to the homeschool management system | — |

---

## 10. Open questions

1. **Cooking together or separately?** If kids often cook as a pair, attempts need to support two kids and maybe split roles (one preps while the other cooks).
2. **Allergies:** does the owner's family need any diet flags beyond the hard block on biblically unclean foods?
3. **Adult hands-on steps:** do these need a parent tap-to-unlock in the app, or is the illustrated banner enough?
4. **Theme:** do the kids choose between theme mockups (§5.2)? With several families, is there one theme for everyone, or can each family pick?
5. **Invite-only or open sign-up** (§8.3)?
6. **Family-authored lessons:** should families be able to add their own recipes, or is the shared library the only content? Not planned for now. Adding it would move lessons from content files into the database.

---

## 11. Planned: beginner track

**Status:** Planned for after the core course. Not part of the first release.

A separate set of simpler lessons for **kids with no prior cooking experience**, inside the same app, using the same families, profiles, shopping list, and photo gallery. The track is defined by experience, not age. As a rough guide for writing the content, it's pitched at about **ages 7–10**. **The app must not show ages anywhere**: no age labels on the track, lessons, or profiles. An older kid who has never cooked belongs here too, so the track's name and art must not feel babyish.

### What changes for beginner lessons (recommendations)
- **Light reading.** Short sentences, one action per step, and a large illustration or photo per step. Every step has a "hear it" button that reads it aloud with the device's text-to-speech.
- **Starting skills.** Kitchen safety and cleanliness, reading a recipe, measuring dry vs. liquid, pouring, stirring, whisking, cracking eggs, spreading, peeling, grating, cutting soft foods with a kid-safe knife, using the microwave and toaster oven, then first stovetop and oven steps with an adult.
- **Safety:** any stove, oven, or sharp-knife step is "Adult hands-on." Everything else is at least "Adult nearby."
- **Shorter lessons:** fewer steps, a short Learn stage, and a quick intro.
- **Graduation:** the last beginner lessons lead into Unit 1 of the core course. A parent can move a kid from beginner to core at any time.
- **Same food rules:** the hard block in §2.1 applies to beginner lessons with no exceptions.

### Theme
- Same theme as the core app (§5), with bigger art, fewer words, and more animation feedback on every tap.
- Progress uses the same passport or stamp idea, so siblings on different tracks collect the same kind of reward.
- **Revisit if:** kids on either track find the shared theme a poor fit. The beginner track could get its own skin.

### Data hooks to include now
- Lesson files have `track: "core" | "beginner"` (§7.3).
- Kids have `track` (§8.4). A kid's profile shows lessons from their track. A parent can open individual lessons from the other track to a kid.
- Steps can carry an `image` and an `audioText` field. These are optional for core lessons and required for beginner lessons, which the linter enforces once the beginner track starts.
- The shopping list already combines lessons across kids, so beginner and core lessons queued the same week merge into one list automatically.
