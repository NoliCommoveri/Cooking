# Kids Cooking Class App — Overview Plan

**Status:** Planning. Nothing is built yet.
**Audience for this doc:** Claude Code, building the app in phases.
**How to read this doc:** Items marked **Requirement** come from the owner (Jen) and should not change without her say-so. Items marked **Recommendation** are proposals. Each one lists alternatives and the conditions under which it should be revisited. Treat every recommendation as open to change.

---

## 1. What this is

**Working name: Clean Plate Recipes.** The owner's working name, not final. Its logo is in `content/images/brand/`.

A cooking course app for two kids, ages 11 and 12, who already have some cooking experience. The app does two jobs:

1. **Teaches.** Each lesson pairs one cooking skill with one real dish that uses that skill.
2. **Runs the actual cooking.** Kids work through checkable ingredient and equipment lists, then a step-by-step cook mode with built-in timers. At the end they photograph the result and write a short reflection.

A parent uses the app from their phone. They queue lessons, see a combined **shopping list** before shopping, review the safety requirements of each lesson, and browse their kids' photos.

**Requirement: the app is multi-family.** It was designed first for the owner's family (two kids, ages 11 and 12), but several families must be able to use it. Each family has its own profiles, progress, queue, pantry, shopping list, photos, and settings. All families share the same lesson library. Each family can also add its own recipes (§6.10).

**Planned: a beginner track.** A simpler track for kids with no prior cooking experience is planned after the core course (§11). It is not built in the first release, but the data model includes the fields it needs from the start, so adding it later doesn't require a migration.

### Users
| User | Device | Main jobs |
|---|---|---|
| Owner (Jen) | Any | Everything a parent can do, plus approving sign-up requests, reviewing submitted recipes, and managing families |
| Parent (1+ per family) | Phone | Queue lessons, shopping list, safety review, gallery, family settings |
| Kid (any number per family) | Tablet or phone in the kitchen | Learn, prep, cook, photograph, reflect, see progress |
| Adult learner (any number per family) | Any | The same as a kid: adults can take the class too, through their own profile |

### Profiles
Kids, and adults taking the class, use the app through **profiles** (chef lockers). A profile can be **one person or several sharing it**. The family decides: one profile per person, one shared profile, or a mix. Progress (stamps, pins, rank) belongs to the profile.

**Each profile is marked kid or adult** when it's made (§6.9). A shared profile with any kid on it is a kid profile. The difference is how safety levels read (§3); everything else is the same.

**A lesson can be for one or more profiles.** When a parent queues a lesson, they pick which profiles it's for. All of those profiles cook it together as one cook: one shopping-list entry, one photo, and every profile on it gets the stamp and pin. Each profile writes its own reflection.

---

## 2. Requirements

### 2.1 Food rules
- **Hard-blocked: biblically unclean foods** (Leviticus 11, Deuteronomy 14). No lesson, ingredient, substitution, or family setting may include them, for any family. This rule cannot be turned off in the app.
  - **Land animals:** allowed only if the animal both chews the cud and has a split hoof (beef, lamb, goat, venison). Blocked: pork in every form, rabbit, and any other animal that fails either test.
  - **Water animals:** allowed only if the animal has both fins and scales (e.g. salmon, cod, tilapia, tuna, anchovy, trout). Blocked: all shellfish (shrimp, crab, lobster, clams, oysters, mussels, scallops), squid, octopus, catfish, eel, shark, and any other animal without both.
  - **Birds:** chicken, turkey, duck, and goose are allowed. The birds listed in Leviticus 11:13–19 are blocked, including birds of prey and scavengers.
  - **Insects:** blocked (the only exceptions in Leviticus 11:22 are certain locusts, which won't appear in this library).
  - **Blood** (Leviticus 3:17, 7:26–27, 17:10–14): blocked as a food or ingredient in any form, e.g. blood sausage, black pudding, morcilla, boudin noir, blood tofu.
  - **Fat** (Leviticus 3:17, 7:23): the fat of cattle, sheep, and goats is blocked, i.e. suet and tallow (including "beef dripping" sold as a fat). Fat within the meat (marbling) and the juices and drippings from cooking it are allowed.
- **Hidden sources must be flagged** in the ingredient registry and checked by the content linter (§7.4). Each needs a named substitute or a "check the label" note:
  - Oyster sauce (shellfish). Substitute mushroom stir-fry sauce, or soy sauce plus sugar.
  - Shrimp paste, which hides in many Thai curry pastes and some kimchi.
  - Gelatin (usually pork). Substitute beef gelatin or agar-agar. Gelatin also hides in some yogurts, sour creams, gummies, and marshmallows.
  - Lard, found in some tortillas, refried beans, biscuits, pie crusts, store-bought masa, and some shortening blends.
  - Pork sausage casings, used even on many chicken and turkey sausages. Look for collagen-cased or skinless.
  - Breakfast sausage, andouille, chorizo, bacon, pancetta, guanciale, Canadian bacon (pork by default; use beef or poultry versions).
  - Imitation crab (often pollock, but may contain crab or shellfish extract).
  - Carmine or cochineal (an insect-derived red coloring) in some candies, yogurts, and drinks.
  - Suet, in mincemeat, Christmas pudding, some dumplings, and some pastry.
  - Beef tallow, used for frying by some restaurants and in some store-bought fries, pastry, and shortening blends.
- **Per-family dietary filters** are an extra layer on top of the hard block. Filters are per family, not per kid. Each family can add its own restrictions (e.g. vegetarian, nut-free, dairy-free) using the `contains` tags on the ingredient registry (§7.2). A lesson that conflicts with a family's filters is hidden from that family. If the lesson lists an allowed substitution that resolves the conflict, it is shown with that substitution applied instead.
  - **Recommendation:** start with these tags: nuts, peanuts, dairy, egg, gluten, fish, meat (for vegetarian). Derived products carry their source's tag: gelatin, chicken broth, and beef broth are `meat`; fish sauce, Worcestershire, and dashi are `fish`.
  - **Recommendation:** if a lesson is hidden by a family's filters, it no longer counts as a prerequisite for that family. Lessons that list it unlock as if it were done. Without this, a dairy-free family could never unlock the lessons that require 32.
  - The hard block is not a family filter. A family can add restrictions but cannot remove the hard block.
- Clean fish and products made from them are allowed: fish sauce (anchovy), Worcestershire (anchovy), and dashi (bonito).
- Mixing meat and dairy in one dish is allowed.
- Ingredients should not be hard to find. Where a dish has a hard-to-find ingredient, the lesson must name a common substitute.

### 2.2 Servings
- Library recipes are written for **6 servings**. Each family sets its own default serving count, and recipes must scale to it. How scaling works is in §6.6.

### 2.3 Fun, kid-appealing UI
- The UI must be **highly appealing to kids, themed, and playful, not utilitarian.** See §5. This is a primary requirement, not polish to add at the end.
- **No pill-shaped chips, tags, or badges.** See §5.6 for the full list of banned patterns.

### 2.4 Parent shopping view
- A parent must be able to see every ingredient needed for their family's upcoming lessons **from their phone, before shopping**.

### 2.5 Security level
- **Requirement:** keep security basic. The data isn't sensitive, so don't add security features beyond §8.3.
- The one thing the basic level must still guarantee: **a family sees only its own data and photos.** Other families' kids' photos must never be visible.

### 2.6 Photos
- Kids must be able to photograph their finished dishes inside the app. Each photo is attached to the attempt (one cook of one lesson, by one or more profiles, §1).

---

## 3. Lesson structure

Each lesson has these stages:

1. **Intro.** A 30–45 second animated slideshow (§6.5): the finished dish, the skill, why it matters, an ingredient preview, time and safety level, and a "Let's cook" button.
2. **Learn.** 3–6 short concept cards with a "why it works" angle. An optional quiz of 2–3 questions follows. **The quiz never blocks cooking.** The cards follow a set shape (below) so every lesson teaches how its skill carries over to other dishes.
3. **Prep (mise en place).** An ingredient checklist with amounts scaled to the chosen servings, then an equipment checklist. Cook mode unlocks once every item is checked.
4. **Cook mode.** One step per screen. Each step has a checkbox, a big Next control (with hands-free options, §6.12), inline timers where needed (several can run at once), a safety level, and an optional tip or "what it should look like" note. The screen stays awake for the whole cook. Some steps are food-safety checks (below).
5. **Plate and photo.** The camera opens directly, and the photo saves to this attempt.
6. **Reflect.** A 1–5 rating, a "what would I change?" note, and an optional rating from whoever ate it.

### Learn stage: teaching the why (recommendation)
The goal is cooking skill, not 50 memorised recipes, so every Learn stage teaches the same four things:
- **The move:** what the skill is, in one line.
- **Why it works:** the food science, kid-sized (e.g. spice flavour dissolves in fat, so spices bloom in oil).
- **Same move, other dishes:** every other lesson that uses this skill, with cooked ones marked. The app builds this card from each lesson's `skills` tags (§7.3), so it stays current as lessons are added.
- **When it goes wrong:** how to tell, and how to rescue it.

Around that:
- **Callbacks.** A lesson that reuses a skill from an earlier lesson opens with a short "You did this in …" card before anything new.
- **"Why?" in cook mode.** A step can link to one of its Learn cards (`why` on the step). Cook mode shows a **Why?** button that opens that card over the step. It never blocks Next.
- **Reflect asks one transfer question,** optional: "What other dish could use this move?"
- **Skills explain themselves.** Tapping a skill (crest, pin, or sticker, per theme) shows the idea behind it and every dish that uses it, cooked or not.
- **The beginner track** (§11) uses the same shape with fewer, shorter cards.

### Safety levels (per step; a lesson's level is its highest step)
| Level | Meaning |
|---|---|
| Solo | Kid works alone |
| Adult nearby | An adult must be in the kitchen |
| Adult hands-on | An adult must actively help (hot oil, deep frying, etc.) |

Safety levels must be shown as **illustrated icons or banners, not colored pills** (§5.4).

A safety level is information only. The banner tells the kid who must be in the kitchen; nothing in the app locks a step or waits for an adult.

On an **adult profile**, the banner shows only the hazard (hot oil, sharp knife, hot oven), without "an adult must…" wording.

### Food-safety checks (recommendation)
Separate from safety levels, which are about who must be in the kitchen. These are about the food.
- **Doneness check.** Any lesson that cooks raw poultry, ground meat, whole cuts, fish, or eggs to a safe point has a check step with a thermometer target (e.g. poultry 165°F, ground beef 160°F, fish 145°F). The kid can't check the step off without entering or confirming the reading. Every such lesson lists a thermometer in its equipment.
- **Raw-handling steps.** After a step that handles raw meat, poultry, fish, or eggs, the next step is a wash-hands-and-board step.
- **Raw and lightly cooked eggs** (Caesar dressing, hollandaise) use pasteurized eggs, or the lesson says why not.
- **Raw dough.** Lessons with raw flour or raw egg in a dough or batter include a "don't taste the raw dough" tip.
- The linter enforces the first two (§7.4).

---

## 4. Curriculum (50 dishes)

Lessons are grouped into units by skill. International and American dishes are mixed within each unit, and breakfast dishes are spread across the units. The exact teaching order is still an open content task. **Recommendation:** go through the units in order and alternate cuisines within each unit. The safety levels below are set in the content. Parents can't change them.

### Unit 1 — Knife work and assembly
| # | Dish | Cuisine | Skill | Max safety | Notes |
|---|---|---|---|---|---|
| 1 | Fresh spring rolls | Vietnamese | Julienne, rolling rice paper | Adult nearby | Chicken instead of shrimp/pork; peanut + hoisin dip |
| 2 | Fattoush | Lebanese | Fine chopping, toasting pita | Adult nearby | Sumac sub: lemon zest + salt |
| 3 | Pico de gallo + Baja fish tacos | Mexican | Dicing; broiling fish | Adult nearby | Cod/tilapia. Broiled, not battered and fried: frying is first taught in 23 |
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
| 30 | Breakfast burritos (breakfast) | American | Timing several components, rolling | Adult nearby | Beef chorizo or turkey sausage; check casings, or use bulk |
| 31 | Eggs Benedict (breakfast) | American | Poaching eggs, hollandaise | Adult nearby | Turkey bacon or smoked salmon. Pasteurized eggs for the hollandaise. Prereq: 8 |
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
| 39 | Biscuits + sausage gravy (breakfast) | American | Milk gravy on a roux | Adult nearby | Bulk turkey sausage (no casing). Prereq: 38, 32 |
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
| 43 | Homemade granola (breakfast) | American | Oven browning, stirring partway | Adult nearby | Mixing steps are Solo; oven steps make the lesson Adult nearby |
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

### 5.2 Themes
**Requirement: each profile picks its own theme.** Kids choose; there is no single app-wide theme.

- **Same rewards, different look.** Every theme shows the same progress underneath: a reward per completed dish, a pin per skill, and a rank. Each theme draws them its own way.
- **Every theme supplies its own treatment for every component in §5.4.** §5.4 gives the Chef's Passport treatment and §5.4a the Kitchen Quest one. The banned patterns in §5.6 apply to all of them.
- **The look follows the profile.** On a shared device, the theme switches when a profile is picked from the chef lockers. The profile picker and parent screens use a neutral house style.
- **Theme tokens are CSS custom properties,** one set per theme, applied at the root when a profile is active.
- **Requirement: Kitchen Quest is built first, then Chef's Passport as soon as possible.** The kids chose from the Phase 0 mockups (`mockups/theme-picker.html`). Food Truck and Recipe Scrapbook come later (§9). A profile can switch to any built theme at any time.

**Themes:**
- **Chef's Passport + Kitchen Ranks.** Each dish earns an inked stamp for its cuisine in a passport book. Stamp pages are grouped by region, and the world map lights up as regions fill in. Ranks go Kitchen Apprentice → Prep Cook → Line Cook → Sous Chef → Head Chef, and each changes the hat or apron on the chef avatar. §5.4 describes this one. Built second.
- **Kitchen Quest** (built first): an RPG-style skill tree. Each unit is a path, and each dish is a node on it. Clearing a quest lights its node. Ranks show as a level and title (Level 1 Kitchen Apprentice … Level 5 Head Chef). §5.4a describes this one.
- **Food Truck** (later): each lesson adds a menu item to the kid's own food truck.
- **Recipe Scrapbook** (later): progress lives in a scrapbook.

### 5.3 Visual language
- **Surfaces:** recipe cards with a paper texture, tape on the corners, and a slight rotation. Use a corkboard, a chalkboard menu, or a tile-backsplash texture for backgrounds.
- **Palette (recommendation):** warm kitchen colors defined as CSS tokens — tomato red, butter yellow, basil green, cream paper, cast-iron charcoal. An optional "night kitchen" dark theme.
- **Typography (recommendation):** a chunky, rounded display font for headings (e.g. **Lilita One**, **Fredoka**, or **Baloo 2**), a highly readable body font (e.g. **Nunito**), and a handwritten accent font for notes and reflections (e.g. **Caveat**). All are SIL OFL fonts on Google Fonts. Body text in cook mode must stay readable from about an arm's length away, so the body size there is large (≥ 20px).
- **Icons:** custom SVG illustrations in one consistent style. Don't rely on emoji as the main iconography.

### 5.3a Art production (recommendation)
The themed components need a lot of art, and every theme added later (§5.2) needs its own set: a dish illustration for every lesson, an icon for every ingredient (they hop into the bowl) and every tool (pegboard), a stamp per region, a pin per skill, and avatar outfits per rank.
- Phase 0 sets the style and draws the core set: the components in §5.4, one generic icon per store section, and one per tool category.
- An ingredient or tool without its own icon falls back to its category's generic icon. The linter warns about fallbacks; it doesn't fail on them.
- **Dish illustrations come from the owner,** made with an AI image tool as sheets of several dishes per image. Claude crops each sheet into one image per dish. Source sheets live in `content/images/source/`.
- Each new lesson brings its own dish illustration. Stamps, pins, and outfits come with Phase 5.
- Every image that isn't original carries its license in `content/images/LICENSES.md`, the same as music.
- **Claude draws the rest of the art** as SVG (components, icons, stamps, pins). The Phase 0 showcase is the test: if the owner isn't happy with it there, the other options are a commissioned illustrator or a licensed icon set restyled to match.

### 5.4 Themed components (Chef's Passport) — Requirement (look approved in Phase 0b)
Palette: cork, cream paper, ink, tomato red, butter, basil, and passport navy. **Lilita One** for titles; **Caveat** (handwriting) for notes and labels only, never under 20px; body text in **Nunito**, ≥ 20px in cook mode.

- **Stamp pages by region:** East & Southeast Asia, Middle East & North Africa, South Asia, Sub-Saharan Africa, Europe, Latin America & Caribbean, and the United States. Half the course is American, so the US page is the biggest. Churros (25, Spanish/Mexican) go on the Latin America page with the Mexican stamp. Each cuisine has one stamp design, so every Japanese dish gets the same stamp with its own date.
- **World map:** the owner's illustrated map, split into one layer per region by `tools/split-world-map.py`, so the app can color each region. A region turns butter when it has its first stamp and basil when every stamp is in.
- **Rank outfits:** Kitchen Apprentice wears a paper cap and plain apron; Prep Cook a short chef's hat and butter apron; Line Cook a taller hat, red neckerchief, and striped apron; Sous Chef a pleated hat, buttoned jacket, and navy apron; Head Chef the tallest hat with a gold band.

| Component | Treatment |
|---|---|
| Lesson card | A taped recipe card showing the dish illustration, title in the display font, and a skill line handwritten underneath |
| Ingredient checklist | Tapping an item makes it **hop into a mixing bowl** illustration. The bowl visibly fills as items are checked |
| Equipment checklist | Tools hang on a **pegboard**. Checked tools lift off their hook and glow |
| Cook step | A large recipe card. Next **flips** the card to the following step |
| Timers | A **kitchen dial timer** that counts down, wobbles and rings at zero. Several timers sit side by side on a "counter" strip, each labeled with what it's timing |
| Safety level | An illustrated **banner** across the top of a step (chef-hat helper icon for adult nearby, oven-mitt hands for adult hands-on) with one short line of text. **Not a pill** |
| Progress within a lesson | A **measuring cup** or pot that fills as steps are completed |
| Course progress | The **passport book**, one page per region with a tab for each, and the world map (§5.2) |
| Skills earned | **Enamel-pin or embroidered-patch** shapes (circles, shields, hexagons) pinned to an apron. Not text chips |
| Rating | 1–5 **chef hats** or wooden spoons, not stars |
| Serving picker | A "Serves" line on the recipe card with big − and + buttons and a row of little plates, one per serving (§6.6) |
| Test-cooked | An inked **test-kitchen stamp** on the lesson card, for a lesson a parent in this family marked test-cooked. Not a pill |
| Helper | The helper's (§6.8) chef avatar on a floating **Ask** button, and a chat on recipe cards (the helper) and sticky notes (the kid) |
| Photos | Taking a photo pins a **Polaroid** to a corkboard. The gallery is the corkboard |
| Rank up | A full-screen celebration where the hat upgrades, with a confetti or sprinkles burst |
| Profile picker | Each profile has a **chef's locker** with its avatar and apron. A shared profile's locker shows everyone on it |

### 5.4a Themed components (Kitchen Quest) — Requirement (look approved in Phase 0)
Drawn from the Phase 0 mockup. Palette: night navy, gold, mana teal, and ember red. Pixel-style display font (e.g. **Pixelify Sans**) for headings and labels only; body text stays in **Nunito**, ≥ 20px in cook mode. Panels have cut (octagonal) corners, not rounded ones.

| Component | Treatment |
|---|---|
| Lesson card | A **quest card**: the dish in a gold-framed window, the path and quest number, the title in the pixel font, and a small stats grid (time, servings, safety, heat) |
| Ingredient checklist | An **inventory grid**. Each slot shows the item dimmed; tapping it gathers the item, which lights up and glows. A segmented supply meter fills above the grid |
| Equipment checklist | A **gear loadout**: the same slot grid for tools |
| Cook step | A **quest log** panel. Next slides the following stage in |
| Timers | A **cooldown ring** that drains as time runs down, then shakes and rings at zero. Several sit side by side in a timer tray, each labeled with what it's timing |
| Safety level | A **banner** across the top with a gold edge (chef-hat icon for adult nearby, oven-mitt hands for adult hands-on) and one short line of text. **Not a pill** |
| Progress within a lesson | A **segmented stage bar**: done stages gold, the current one teal |
| Course progress | The **skill tree** (§5.2) |
| Skills earned | **Skill crests**: hexagon, shield, and circle badges in a crest collection. Not text chips |
| Rating | 1–5 **gold hex gems**, not stars |
| Serving picker | A **party-size** panel on the quest card: big − and + buttons, the count in the pixel font, and a chef's hat per serving. Fixed-size lessons show their allowed sizes as buttons (§6.6) |
| Test-cooked | A **gold shield seal** on the quest card. Not a pill |
| Helper | The helper's (§6.8) avatar as a guide character on a floating **Ask** button, and a chat styled as a dialogue box |
| Photos | Taking a photo hangs a framed snapshot in a **trophy hall**. The gallery is the trophy hall |
| Rank up | A full-screen **level-up**: the new title and crest, with a pixel burst |
| Profile picker | The house-style chef's lockers (§5.2), same as every theme |

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
- Profile picker (chef lockers), showing only this family's profiles. For a lesson queued for several profiles, any of them can start it, and the cook is shared
- Lesson browser by unit, with locked lessons whose prerequisites this profile hasn't done shown as a "coming up" card (not hidden)
- Full lesson flow (§3)
- Serving scaler (defaults to the family's serving count; limits in §6.6)
- Multiple concurrent timers; a timer keeps running if the kid moves to another step or closes and reopens the app (see §8.2 for iOS limits)
- **Request a lesson** (recommendation): a kid can tap "I want to make this," which adds a request to the parent's queue to approve or decline
- **Adult profiles don't ask.** On an adult profile the button is **Cook this**: it queues the lesson for that profile straight away, with no approval and no parent PIN, and it goes on the shopping list like any queued lesson. A shared profile with a kid on it is a kid profile, so it still asks
- Screen Wake Lock during Prep and Cook
- Progress, ranks, skills earned, and gallery, drawn by the profile's theme (§5.4, §5.4a)

### 6.2 Parent features
- **Queue:** assign the next 1–3 lessons per profile, or approve a profile's request (§6.1). Each queued lesson is for one or more profiles (§1), with a serving count (defaults to the family's) and an optional planned date
- **Shopping list** (§6.3)
- **Safety review:** before approving a lesson, see every step marked adult-nearby or adult-hands-on
- **Gallery:** all photos, filterable by profile and lesson, with reflections
- **Download all photos:** the family's photos as a download, so they don't live only in the app
- **Family recipes** (bonus, §6.10): add the family's own recipes, submit them for the shared library, and add recipes from the community directory
- **Mark test-cooked:** after cooking a lesson themselves, a parent can mark it test-cooked for their family (§7). Optional; lessons don't need it to be shown to kids
- **Pantry staples:** a list of ingredients always on hand, which drop off the shopping list
- **Family settings:** family name, profiles (add, rename, avatar, theme, who's on each), dietary filters (§2.1), default servings, voice step control (off until turned on, §6.12), other parent logins

### 6.2a Owner features
- **Sign-up requests:** a queue of families asking to join (§8.3). Approving one emails them a sign-up code; declining sends nothing
- Set, change, or turn off the **sign-up keyword**, and create or revoke codes by hand
- **Recipe submissions:** review recipes families submit (§6.10), and release or decline each
- **Fix requests:** review reports from families, apply a suggested fix as a lesson patch, or revert one (§6.11)
- See the list of families (name, number of profiles, last active). This is the only cross-family view. The owner never sees other families' kids' names, photos, or progress.
- Set a new password for a parent, as a fallback when the reset email (§8.3) doesn't reach them
- Remove a family. This is destructive, so it's paired with a restore (§8.5)

### 6.3 Shopping list logic
The parent starts a **shopping trip** by picking queued lessons. A trip holds its own check-off state, so changing the queue later doesn't scramble a list mid-shop. Ending the trip marks its lessons `shopped`.

1. Collect the ingredient lines from the trip's lessons, with any diet-filter substitutions (§2.1) already applied.
2. Scale each line to that queue item's serving count (§6.6).
3. Convert each line to the ingredient's **base unit** using the registry's conversions (e.g. grams per cup of flour).
4. **Merge by canonical ingredient ID.** This is the main reason the ingredient registry exists.
5. Remove pantry staples (keep them viewable in a collapsed "you should have" section).
6. Round up to **purchase units** (e.g. 15 oz can, dozen eggs, bunch, head), with the exact amount used shown alongside.
7. Group by **store section** (meat & fish, produce, herbs, dairy & eggs, bread & tortillas, grains & pasta, canned & jarred, sauces, oils & vinegars, baking, specialty, frozen, spices).
8. Mark perishables. If lessons have planned dates, show perishables only for lessons within the next N days (default 7, adjustable). Lessons with no planned date always show their perishables, marked "no date set."
9. Lines with no amount ("salt to taste," "oil for the pan") appear once, with no quantity.
10. Check-off state persists, so the list survives closing the app mid-shop.
11. The list works offline. Stores often have weak signal, so the trip is cached on the phone, and check-offs sync when the connection returns.

A lesson queued once for several profiles is one cook, so it's counted once. The same lesson queued as two separate items is two cooks, and counted twice.

### 6.4 Photos
- Open the camera via file input with `capture`, or an equivalent.
- **Resize on the device** before upload (long edge about 1600px, JPEG about 0.8 quality).
- Store in object storage (§8), linked to the attempt.
- If the upload fails (Wi-Fi drop), the photo is kept on the device and retried. It is never lost because the network was down.
- Photos are only visible to the family that took them (§2.5, §8.3).

### 6.5 Lesson intro slideshows
**Recommendation:** an in-app slideshow engine driven by each lesson's data, not pre-rendered video files.
- Each lesson's `intro` field is a list of slides (image, caption, duration, transition) plus a music loop ID.
- The app plays it full screen so it looks and feels like a video.
- It can include the profile's own photo from an earlier lesson ("Last time you made…").
- Includes a mute toggle and a skip button.

**Alternative:** render an MP4 per lesson from the same slide data.

**Revisit if:** intros need to be shared or played outside the app. Because both approaches use the same slide data, MP4 export can be added later.

**Images for intros:** the parent's photos, free-license stock images, or a consistent set of illustrated ingredient icons. Once a kid has cooked a lesson, their photo can replace the stock hero image.

**Music:** a small set of royalty-free loops (upbeat, calm, baking). The license for each track must be recorded in the repo.

### 6.6 Scaling (recommendation)
Scaling isn't plain multiplication. Each lesson declares how it scales (§7.3):
- **Free scaling** (most stovetop dishes): any serving count.
- **Fixed multipliers** (baking, pastry, yeast doughs, and anything with a set pan size): only the listed multipliers, e.g. 0.5×, 1×, 2×. The scaler shows only the serving counts those allow.
- **Countable items** (eggs, tortillas, chicken thighs) round to whole units. Each line can set its rounding (up, down, or nearest), with a minimum of 1.
- **Pan size and time notes** can differ per multiplier, e.g. "at 2×, use two sheet pans" or "add 10 minutes at 2×." Cook mode shows the note for the current multiplier.
- **"To taste" and "for the pan" lines** don't scale.
- **The serving picker** sits on the lesson card and starts at the queued serving count, which itself starts at the family default. Changing it updates the prep amounts and any counts in the cook steps ("make 4 wells"). A fixed-multiplier lesson offers only its allowed sizes.
- **After shopping** (recommendation, approved): if the count changes after the lesson's shopping trip, the picker shows "You shopped for N. Check there's enough before you start." It warns and doesn't block.
- Amounts display as kitchen-measurable quantities: fractions a measuring set has (⅛, ¼, ⅓, ½, ⅔, ¾), switching to the next unit up when sensible (16 tbsp → 1 cup).

### 6.7 Units (recommendation)
- Kids see **US customary** measures (cups, spoons, °F) in Prep and Cook, because that's what's in the kitchen drawer.
- The registry stores base units (g, ml, count) for merging (§6.3).
- The shopping list shows US purchase units (oz, lb, cans, bunches).
- **Revisit if** a family wants metric. A per-family unit setting can be added without changing the content files.

### 6.8 Helper (to be specced)
A guided helper modeled on **Kels** in KennelOS (`NoliCommoveri/KennelOS`: End-State guide §33, `docs/KennelOS_Kels_Roadmap.md`). Used by **both kids and parents**, each with their own menu of tasks.
- Like Kels, it's a **scripted chat**, not an AI model: every line is written in the task scripts. It opens from a floating **Ask** button.
- It **walks through tasks one step at a time**, saves each answer as it's given (or keeps a resumable draft), and writes through the same code as the pages.
- It **finds things** ("where's my shopping list?") and **explains things** (an FAQ with a "Show me" for each answer).
- Possible kid tasks: pick what to cook next, find a lesson, explain a cooking term.
- Possible parent tasks: plan the week, set up the pantry, review safety for the queue.
- Its name, character, and full task list are specced later.

### 6.10 Family recipes and the community directory (bonus)
A bonus feature, after the core app works. Families can cook their own recipes in the same lesson player.
- **My recipes.** A parent adds a recipe for their own family. Only that family sees it. It runs in the lesson player like any lesson: Prep checklists, cook mode, timers, photo, and reflection. It has no Intro or Learn stage unless the parent adds cards.
- **Submit to the library.** A parent can submit a family recipe to the owner. The owner reviews it, can edit it, and releases or declines it.
- **Community directory.** Released recipes go into a searchable directory. Any parent can search it and add a recipe to their family's recipes. Released recipes carry no family name, profile names, or photos from the submitting family (recommendation).
- **Entry is a guided flow, not a file upload.** No CSV or file import. The parent is walked through one thing at a time, and the helper (§6.8) can run the same flow:
  1. Title, servings, total time, and a photo if they have one
  2. Ingredients, each picked from the registry by search with amount and unit. An ingredient not in the registry is typed in and flagged for the owner
  3. Equipment, picked from the registry
  4. Steps, one at a time, each with its safety level and an optional timer with its label
  5. Review, then save
- **The hard block applies** (`CLAUDE.md`, §2.1). Every family recipe runs the same checks as the library: registry ingredients are checked by species, and all text (title, ingredient names, steps, notes) goes through the blocked-word scan. A recipe that fails can't be saved until it's fixed. A typed-in ingredient can't be species-checked until the owner adds it to the registry, so the blocked-word scan is the only check on it until then. That's a known gap.
- **Diet filters** apply to family recipes and directory recipes the same as to library lessons.
- **Scaling** works for registry ingredients. Typed-in ingredients scale as plain numbers, and the shopping list shows them without merging.

### 6.9 First-run wizard (to be specced)
A first run for a new family, like KennelOS's (End-State guide §11 and "Getting Started" in §33). It runs after a family signs up with a code or the keyword (§8.3). Each part saves as it's answered and can be skipped.
- **Family setup:** profiles (one per person, shared, or a mix), each marked **kid or adult**, default servings, diet filters, pantry staples, and the parent PIN (required, §8.3).
- **A warning for first-time parents:** the recipes haven't all been test-cooked. Read each lesson through before your kids cook it, and mark it test-cooked once you have (§6.2).
- **Each profile's first run:** it sets up its chef locker and avatar, and picks its theme.
- **Requirement: a profile intro.** Right after that, a short intro shows the profile how to use the app from their side, drawn in the theme they just picked (Kitchen Quest's is a "tutorial quest"). One card per thing they'll do, each with a "try it" tap where it helps:
  - find a lesson and **ask to cook it** (the request goes to a parent); adult profiles see **Cook this**, which queues it directly
  - the **serving picker**
  - **Prep:** check off ingredients and equipment, and cook mode unlocks
  - **cook mode:** Next and Back, timers (several at once), safety banners, and the thermometer check
  - take the **photo** and write the **reflection**
  - where **progress** shows: their theme's reward per dish, skills, and rank
  - **if something in a lesson looks wrong:** kids are told to tell a grown-up; adult profiles get the **Suggest a fix** card (§6.11)
  - the **Ask** button for the helper (§6.8)

  A shared profile sees it once, together. Any card can be skipped, and the whole intro can be replayed from the profile's locker. Words stay short and plain, and nothing animates while a card is being read (§5.5).
- **Requirement: a parent tour.** A short set of cards that shows parents how to use the app, one task per card: queue a lesson and pick who it's for, set servings, use the shopping list, review safety and mark a lesson test-cooked, the parent PIN, photos and the gallery, and **Suggest a fix** (how to report something wrong in a lesson, what to write in "what should it say instead", and how the answer comes back, §6.11). Each card can be skipped, and the whole tour can be replayed from family settings.
- **Then an introduction to the helper** (§6.8).

Until the wizard is built, the test-cook warning shows as a one-time notice on a parent's first sign-in.

### 6.11 Fix requests and lesson patches (recommendation)
Parents and adult learners report what's wrong in a lesson, and the owner pushes the fix from the browser. **The owner isn't the cooking expert**, so the person reporting proposes the correction, and the app checks it before it goes live.
- **Suggest a fix.** A "Suggest a fix" control on the lesson card and on each step, behind the parent PIN (adult profiles can use it too). The app fills in the lesson, version, step, and serving count. The reporter picks a type (wrong amount or time, unclear step, safety problem, **unclean ingredient**, or other), writes what's wrong, and says **what it should say instead**: the new amount, time, or wording. They choose from a list of the step's own fields, so the suggestion is already shaped as an edit.
- **Owner queue.** "Fix requests" on the owner screens (§6.2a), grouped by lesson, showing the current text beside the suggested text. Safety and unclean-ingredient reports also email the owner through Resend right away.
- **Apply from the browser.** The owner can accept a suggestion as written, or edit it first, and press **Apply**. That creates a **lesson patch** that goes live for every family at once. Patches are limited to fields that can't change the dish's makeup: an amount, a unit, a time, a timer length, a step's text, a tip or "should look like" note, or a doneness target. Swapping or adding an ingredient isn't a patch; it needs a content change (below).
- **Checks before a patch goes live.** The same checks as the linter (§7.4) run in the app: the blocked-word scan on all new text, unit and amount checks, and the food-safety rules (a doneness step keeps its thermometer target, and targets can't go below the safe minimums in §3). A patch that fails can't be applied, and the owner sees why.
- **Every patch can be undone.** Each patch has **Revert** beside it on the owner screen (the restore rule in `CLAUDE.md`). Reverting puts the lesson back the way it was.
- **Versions.** A patch raises the lesson's version, so attempts and test-cooks record exactly what was cooked. The reporter's family sees the outcome on that lesson ("Fixed: eggs now 1 per person"), or the owner's reply if it's declined.
- **Folding patches into the files.** Live patches sit on top of the content files. From time to time, in a session, Claude writes the applied patches into the lesson files, runs the linter, and clears them from the database. The owner doesn't have to do anything for this.
- **Bigger changes** (a new ingredient, a new step, a different method) are logged on the fix request as "needs a content change" and are made in a session or in the GitHub web editor.

### 6.12 Hands-free step advance — Recommendation
Kids have messy hands mid-cook, and the main kitchen device is likely an Android phone propped on the counter.
- **For every device (Phase 2):**
  - **Tap zone:** the whole lower half of a cook-mode step advances, so a knuckle or wrist works.
  - **Page-turner remote:** a Bluetooth page-turner (the kind musicians use) acts as a keyboard, so cook mode treats its keys (arrows, Page Up/Down, Space, Enter) as Next and Back. It works offline, with no mic.
- **Voice (Later):** short commands: "next," "back," and "again" (reads the step aloud).
  - **Requirement: voice is off until a parent turns it on** for the family in family settings, behind the parent PIN. Chrome usually sends what the mic hears to Google, so it's the parent's choice.
  - Uses the browser's built-in speech recognition. **Android Chrome first.**
  - The mic button shows only where the device supports recognition, checked by feature, not by browser name. Where it's missing, nothing breaks; the tap zone and remote still work.
  - **No "switch to Chrome" prompt on iPhone or iPad.** Every iOS browser runs on Safari's engine, so Chrome there gains nothing. iPhone voice may be added later as a "try it" feature if Safari families ask for it.
  - Chrome usually sends the audio to Google to recognize it. When the connection drops, voice pauses quietly with a small "voice paused, no connection" note, and taps keep working.
  - Listening pauses while the app reads a step aloud, so it doesn't hear itself.
  - **Food-safety checks (§3) need a tap.** A stray "next" can't pass a doneness check.

---

## 7. Content as data

Library lessons, recipes, and ingredients are **JSON files in the repo**, separate from the app code. Family recipes and the community directory (§6.10) are the exception: they live in D1. Adding lessons means adding files, not changing code. Recipe text must be written originally, not copied from published sources.

**Recipes are not required to be test-cooked.** The linter checks that content is well formed, not that a recipe works. A parent can mark a lesson **test-cooked** after cooking it (§6.2), which puts a test-kitchen stamp on that lesson for their family (§5.4). The first-run wizard (§6.9) tells new parents that recipes may not have been cooked yet, and to read a lesson through before their kids cook it.

### 7.1 Files
```
content/
  ingredients.json        # canonical ingredient registry
  equipment.json          # tools: id, name, icon, category
  skills.json             # skill pins: id, name, pin shape
  cuisines.json           # passport regions, and cuisine → region
  units.json              # unit numbers and names (7 is Desserts)
  schema/                 # JSON Schemas for the registries and lesson files
  rules/                  # clean-species allowlist, blocked words, allowed phrases
  lessons/
    01-spring-rolls.json
    ...
  music/                  # loops + LICENSES.md
  images/                 # + LICENSES.md
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
  "animalSource": null,
  "animalPart": null,
  "rawHandling": null,
  "contains": ["gluten"],
  "icon": null,
  "watch": null
}
```
- `contains` lists the diet tags (§2.1) the ingredient has. An empty list means none. A family filter hides any lesson using an ingredient whose `contains` includes one of its tags.
- `animalSource` is **required for anything that comes from an animal**: the species, e.g. `"cattle"`, `"chicken"`, `"anchovy"`, `"bonito"`. `null` means not animal-derived. The linter checks it against the allowlist of clean species (§7.4).
- `animalPart` is required alongside `animalSource`: `"meat"`, `"fat"`, `"blood"`, `"bone"`, `"egg"`, `"milk"`, and so on. The linter rejects `"blood"` from any animal, and `"fat"` from cattle, sheep, or goats (§2.1). Fat from poultry (e.g. chicken schmaltz) and from fish is allowed.
- `rawHandling` is `"poultry"`, `"meat"`, `"fish"`, or `"egg"` for ingredients that trigger the food-safety checks in §3.
- `icon` is null when the ingredient uses its section's generic icon (§5.3a).
- For ingredients on the hidden-source list (§2.1), `watch` carries a short note, e.g. `"Check casing: must be collagen or skinless"`.

### 7.3 Lesson file (sketch)
```json
{
  "id": "14-bulgogi",
  "version": 3,
  "number": 14,
  "track": "core",
  "unit": 4,
  "title": "Beef Bulgogi",
  "image": "dishes/bulgogi.svg",
  "cuisine": "korean",
  "skill": "Thin slicing & marinating",
  "skills": ["thin-slicing", "marinating"],
  "prereqs": [],
  "servings": 6,
  "totalMinutes": 60,
  "scaling": { "mode": "free" },
  "intro": { "slides": [ { "image": "...", "caption": "...", "seconds": 5 } ], "music": "upbeat-1" },
  "learn": {
    "move": "...",
    "why": [ { "id": "slice-thin", "title": "...", "body": "..." } ],
    "wrong": [ { "sign": "...", "fix": "..." } ],
    "callback": { "lesson": 28, "body": "..." },
    "quiz": [ { "q": "...", "choices": ["..."], "answer": 0, "explain": "..." } ]
  },
  "ingredients": [
    { "ingredient": "beef-sirloin", "amount": 2.5, "unit": "lb", "prep": "sliced thin", "group": "Beef" },
    { "ingredient": "sesame-seeds", "amount": 1, "unit": "tbsp", "optional": true, "group": "To serve" },
    { "ingredient": "egg", "amount": 2, "unit": "count", "round": "up" }
  ],
  "substitutions": [ { "for": "asian-pear", "use": "pear-bosc", "reason": "availability", "note": "or a grated apple" } ],
  "equipment": ["chef-knife", "cutting-board", "skillet", "thermometer"],
  "steps": [
    { "id": "slice-beef", "text": "...", "safety": "adult-nearby", "tip": "...", "why": "slice-thin" },
    { "id": "marinate", "text": "...", "safety": "solo", "timerSeconds": 1800, "timerLabel": "Marinade" },
    { "id": "check-beef", "type": "doneness", "text": "...", "safety": "adult-nearby", "target": { "temp": 145, "unit": "F" } }
  ]
}
```
- `version` goes up whenever a **released** lesson's steps or ingredients change. Attempts record the version they were cooked from. Before release, lessons stay at version 1 however often they're edited.
- Step `id`s are stable. Inserting a step never changes another step's `id`, so saved progress in a lesson stays attached to the right step.
- `scaling` is `{ "mode": "free" }` or `{ "mode": "fixed", "multipliers": [0.5, 1, 2], "notes": { "2": "Use two sheet pans" } }` (§6.6).
- `substitutions[].reason` is `"availability"` or a diet tag (e.g. `"dairy"`). Diet-reason substitutions are the ones a family filter can apply (§2.1).
- `learn.why` cards have ids that steps point to with `why`. The "same move, other dishes" card isn't written by hand; it's built from `skills` across all lessons. `skills.json` holds each skill's one-line idea for the skill detail view.
- `cuisine` is an ID in `cuisines.json`, which maps it to a passport region. `skills` are IDs in `skills.json` and drive the skill pins. `skill` is the display line.

**Added in Phase 1** (the schemas in `content/schema/` are the full reference):
- **Steps:** `type` is `step`, `doneness`, or `wash`. `hazard` is the short line an adult profile sees ("Hot stove"), required on every step that isn't solo. `handles` lists the raw ingredients a step touches. A doneness `target` is a thermometer temperature or, for egg-only baking, a `look` (see §7.4).
- **Step text** can say `{n:egg}` (the scaled count) or `{qty:egg}` (amount and label), so "1 large egg" or "2 large eggs" comes out right at every size.
- **Ingredient lines:** `"amount": null` with a `text` ("a few grinds") never scales, and `"scale": false` keeps an amount fixed ("for the pan"). `min` sets a count's floor.
- **Registry:** `countLabel` gives counted items their words ("large egg", "large eggs"). `units` defines package units ("28-oz can"). `"measure": "butter"` shows butter as sticks and tablespoons.
- `learn.move` is a card with a title and body. Free scaling can carry pan notes from a serving count up (`"notes": [{ "from": 9, "text": "…" }]`).

### 7.4 Content linter (runs at build time and in CI)
The linter must reject content when:
- the JSON doesn't match the schema
- a lesson references an ingredient ID missing from the registry
- an ingredient is unclean under §2.1 (checked through `animalSource`, `animalPart`, and the blocked-word list below). There is no override or exception mechanism for this check
- a step has no safety level
- a prerequisite points to a lesson that doesn't exist, or prerequisites form a loop
- a unit has no conversion to its ingredient's base unit
- an equipment, skill, or cuisine ID is missing from its registry
- a substitution's `use` is missing from the registry, is unclean, or (for a diet-reason substitution) doesn't actually remove the conflicting tag
- an animal-derived ingredient has no `animalSource`, or its `animalSource` isn't on the allowlist of clean species. The allowlist is a content file; adding to it is a change to §2.1 and needs the owner's say-so
- lesson text (steps, tips, cards, notes, substitution notes) names a blocked food from a word list (pork, bacon, ham, lard, suet, tallow, beef dripping, blood sausage, black pudding, shrimp, crab, lobster, clam, oyster, mussel, scallop, squid, octopus, catfish, eel, and so on). A word that's fine in context ("turkey bacon," "mushroom stir-fry sauce, not oyster sauce") is allowed by an exact-phrase allowlist in the content, never by turning the check off
- a lesson uses an ingredient with `rawHandling` but has no doneness check step, or has no wash-hands step after the raw-handling step (§3)
- step IDs within a lesson aren't unique, or a step with a timer has no `timerLabel`
- a core lesson has no `learn.move`, no `learn.why` card, or no `learn.wrong` entry, or a step's `why` points to a card that doesn't exist
- a fixed-scaling lesson has no multipliers, or they don't include 1×
- a step that `handles` raw food isn't followed directly by a `wash` step, or a raw ingredient is never marked as handled
- a lesson with raw meat, poultry, or fish has no doneness step with a thermometer temperature. **Recommendation, waiting on the owner:** a lesson whose only raw ingredient is egg baked into a dough (cookies) may use a visual doneness check instead
- a step that isn't solo has no `hazard`
- a callback points to a lesson that doesn't exist
- the lesson can't be scaled and filled cleanly at every serving size it offers

The linter must **warn** (without failing the build) when:
- a lesson uses an ingredient with a `watch` note
- a lesson has no intro slides yet
- a skill is used by only one lesson, so its "other dishes" card would be empty
- a lesson reuses a skill from an earlier lesson but has no `learn.callback`
- an ingredient or tool uses its category's fallback icon

---

## 8. Architecture

### 8.1 Hosting — Recommendation
- Use the owner's existing **git → Cloudflare** deploy stack: a **Worker** serving the app and API, **D1** for structured data, and **R2** for photos.
- Own subdomain, e.g. `cook.immotus.app`. This app is not a game, so it stays separate from the `games.immotus.app` hub.

A backend is needed because the app is multi-family: each family's progress, queue, and photos must be stored per family and reachable from any of that family's devices.

### 8.2 Front end — Recommendation
- Build it as an installable **PWA**, and cache the active lesson so a Wi-Fi drop mid-recipe doesn't break cook mode.
- The framework choice is open: Vite with a lightweight component framework, or plain web components. Use CSS custom properties for theme tokens. CSS animations are fine for most motion; use an animation library only for complex sequences (stamp slam, rank up).
- **Offline beyond reading:** the active lesson, the current shopping trip, check-offs, attempt progress, and photos waiting to upload are all stored on the device and synced when the connection returns.

**Platform limits to design around (mostly iOS):**
- **Timers:** iOS pauses a web app's code when it's in the background or the screen locks. Timers store their end time and compare against the clock, so they show the right time when the app comes back. A ding can't play while the app isn't on screen, so cook mode keeps the screen awake, and the timer strip shows "ended 2 min ago" if one finished while the app was hidden.
- **Sound:** iOS blocks audio until the user taps something. The first tap in a cook session unlocks sound.
- **Wake Lock:** older iOS versions don't support it in an installed app. Where it's missing, cook mode shows a one-time tip to raise the device's auto-lock time.

### 8.3 Accounts and access (basic, per §2.5) — Recommendation
- **Open sign-up, gated by a code or keyword.** Anyone can reach the sign-up page, but creating an account needs one of:
  - a **sign-up code**, single-use. A family without one fills in a short request form (name, email, a note). The owner gets the request in her queue (§6.2a) and an email about it. Approving emails the family a code through Resend.
  - the **sign-up keyword**, a word the owner sets and shares however she likes. She can change it or turn it off at any time.
  - The request form is the one public form that writes to the database. It's limited to one pending request per email address.
- **Parent login:** email and password. Store passwords hashed with a standard algorithm (PBKDF2 via Web Crypto is available in Workers). Sessions use a long-lived, httpOnly cookie, so kitchen devices stay logged in.
  - **Password reset by email,** sent through **Resend**. "Forgot password" emails a one-time link that expires after an hour. The owner can also set a new password from the owner screens (§6.2a) as a fallback.
  - **Not included, on purpose:** email verification at sign-up, two-factor login, rate limiting beyond the platform defaults.
  - **Revisit if:** the app opens to families the owner doesn't know.
- **Kids don't log in.** A device logged in as a family shows the profile picker (chef lockers).
- **Parent PIN: required,** one per family, set during the first run (§6.9). Kitchen devices are logged in as a parent, so every parent-only screen asks for the PIN, including approving a kid's lesson request. Stored as a hash. It's a convenience lock, not a security boundary.
  - A forgotten PIN is reset by a parent entering their account password.
- **Family scoping:** every API query filters by the logged-in session's `family_id`. No endpoint accepts a family ID from the client.
  - **The one exception** is the owner's endpoints (§6.2a). They're open only to a parent with `is_owner`, and they return family names, kid counts, and last-active dates. Nothing else.
- **Photos:** stored in R2 under `families/{family_id}/…`, served only through the Worker after checking the session's family. R2 is not exposed publicly.

### 8.4 Data model (D1)
Every table holding a family's data carries `family_id`. `families` is the family itself. `invites`, `signup_requests`, `settings`, `community_recipes`, and `lesson_patches` belong to the owner or the whole app, not to a family.
- `families` (id, name, default_servings, diet_filters, parent_pin_hash, created_at)
- `parents` (id, family_id, email, password_hash, is_owner)
- `password_resets` (token_hash, family_id, parent_id, expires_at, used_at)
- `invites` (code, created_by, email, used_by_family_id, created_at, revoked)
- `signup_requests` (id, name, email, note, created_at, status: pending → approved | declined, invite_code)
- `settings` (key, value). Holds the sign-up keyword, among others
- `family_recipes` (id, family_id, title, servings, total_minutes, body_json, photo_key, created_at, updated_at, source_community_id)
- `fix_requests` (id, family_id, reporter_parent_id, reporter_profile_id, lesson_id, lesson_version, step, servings, kind, field, current_value, suggested_value, note, created_at, status: open → fixed | declined | duplicate | needs_content_change, owner_reply, patch_id)
- `lesson_patches` (id, lesson_id, base_version, field_path, old_value, new_value, fix_request_id, applied_by, applied_at, reverted_at). No `family_id`: patches apply to the shared library
- `recipe_submissions` (id, family_id, family_recipe_id, submitted_at, status: pending → released | declined, community_recipe_id)
- `community_recipes` (id, title, body_json, released_at, released_by). No `family_id`: released recipes belong to the shared directory, not a family
- `sessions` (id, parent_id, family_id, created_at, last_seen)
- `profiles` (id, family_id, name, avatar, theme, audience: kid | adult, track: core | beginner). One person or several sharing it (§1)
- `queue` (id, family_id, lesson_id, servings, planned_date, status: requested → assigned → shopped → cooked, requested_by_profile_id)
- `queue_profiles` (queue_id, family_id, profile_id)
- `shopping_trips` (id, family_id, created_at, ended_at)
- `trip_lessons` (trip_id, family_id, queue_id)
- `attempts` (id, family_id, queue_id, lesson_id, lesson_version, servings, started_at, finished_at, checklist_state, eater_rating)
- `attempt_profiles` (attempt_id, family_id, profile_id, rating, notes). Every profile on the cook, each with its own reflection
- `test_cooks` (family_id, lesson_id, lesson_version, parent_id, cooked_on)
- `photos` (id, family_id, attempt_id, r2_key, created_at)
- `pantry` (family_id, ingredient_id)
- `shopping_checks` (family_id, trip_id, ingredient_id, checked)
- Stamps, pins, and rank are computed from `attempts` and the content files, not stored separately (**recommendation**; cache them if it gets slow).
- The lesson library and ingredient registry are content files shared by all families (§7). They are not stored per family.

### 8.5 Operations from the browser
The owner has no command line (see `CLAUDE.md`). Everything operational is done on a token-gated **`/ops` page** in the Worker, modeled on the MCCE repo's `src/ops.js` and `src/migrate.js`.
- `/ops` is reached with a separate `OPS_TOKEN` secret, not a parent login.
- **Migrations** are SQL files bundled into the Worker. `/ops` lists each one as applied, pending, or drifted, and **Apply pending** runs them in order. Each migration is all-or-nothing, and the runner stops at the first failure and shows the error.
- **Backup export** downloads every table as one JSON file. **Import** restores from that file.
- **Every destructive control has a restore beside it.** Resetting the database, or removing a family (§6.2a), is only offered alongside the export that can bring it back. Photos in R2 are covered by the family photo download (§6.2) and kept for a grace period after a family is removed.
- Deploys are git → Cloudflare Workers Builds. A schema change reaches production by editing a migration file in the GitHub web editor, letting it deploy, and pressing **Apply pending**.
- Anything that must be set up by hand in the Cloudflare dashboard (the D1 database, the R2 bucket, the `OPS_TOKEN` secret, and the `RESEND_API_KEY` secret) or in Resend (verifying the sending domain, whose DNS records are added in the Cloudflare dashboard) is listed for the owner before the phase that needs it.

---

## 9. Build phases

Each phase should be deployed and usable before the next begins.

| Phase | Scope | Done when |
|---|---|---|
| **0. Look & feel** | Theme mockups for the kids to choose from (§5.2; done, they chose Kitchen Quest), then Kitchen Quest's tokens, the per-profile theme switch, the house style for the picker and parent screens, fonts, the core art set (§5.3a), and a **component showcase page** with every themed component from §5.4 in a demo state | The kids have picked a theme and the owner approves the look. **No features are built before this.** |
| **0b. Second theme** | Chef's Passport: its tokens, its core art set, and its version of every component on the showcase page. Built as soon as Phase 0 is approved | A profile can switch between Kitchen Quest and Chef's Passport, and the owner approves the Passport look |
| **1. Content core** | JSON schema; ingredient, equipment, skill, and cuisine registries; clean-species allowlist and blocked-word list; linter; scaling and unit display (§6.6–6.7); and 4 sample lessons covering different units (suggested: 4 Shakshuka, 14 Bulgogi, 38 Biscuits, 49 Cookies) | The linter passes and the sample lessons render read-only at every allowed serving count |
| **1b. Families & accounts** | `/ops` page with migrations and backup export/import (§8.5), D1 schema, sign-up codes, keyword, and the request queue, parent login, sessions, password reset email (Resend), parent PIN, profiles (single or shared) and the profile picker, family settings, owner screens, diet filtering of the library | Two test families sign up with codes, and neither can see the other's kids, data, or photos. A backup export restores cleanly into an empty database |
| **2. Lesson player** | Learn, Prep, Cook mode, food-safety checks, timers, wake lock, tap zone and page-turner remote (§6.12), attempts saved for every profile on the cook, offline cache and sync, fix requests and lesson patches (§6.11) | A kid can cook a sample lesson start to finish on a tablet, including with Wi-Fi off partway through. Parents see the one-time test-cook notice. A parent in a test family suggests a fix, the owner applies it from the browser, every family sees the change, and the owner reverts it |
| **3. Parent planning & shopping** | Queue (with kid requests), safety review, mark test-cooked, shopping trips with merging, pantry, check-off persistence, offline list | A parent reviews safety, marks a lesson test-cooked, then shops for 3 queued lessons from their phone |
| **4. Photos & reflect** | Camera, resize, R2 upload with retry, Reflect stage, gallery, family photo download | A photo taken on the tablet shows in the gallery on the parent's phone |
| **5. Progress & delight** | Course progress, ranks, skills earned, celebrations, sound, and the art for them, in both built themes | Completing a lesson earns its reward and skill with full animation in both themes |
| **6. Intros** | Slideshow engine, music loops, skip/mute | Every sample lesson has a working intro |
| **7. Content fill** | The remaining 46 lessons, written in separate content sessions | All 50 lessons pass the linter |
| **8. Helper & first run** | First-run wizard (§6.9) and the helper (§6.8), once both are specced | A new family goes from sign-up to their first queued lesson through the wizard, and kids and parents can each finish a helper task |
| **9. Family recipes (bonus)** | My recipes with the guided entry flow, submission and owner review, the community directory (§6.10) | A parent enters a recipe through the flow, a kid cooks it, and the owner releases a submitted one to the directory, where another test family finds and adds it |
| **Later** | More themes: Food Truck and Recipe Scrapbook (§5.2), beginner track (§11), capstone meal-timing lessons, split roles when profiles cook together, voice "next step" (§6.12), CSV export to the homeschool management system | — |

**Testing (every phase):** automated tests run in CI alongside the linter. At minimum they cover family scoping (no endpoint returns another family's rows or photos), lesson patches (the hard block and food-safety checks reject a bad patch, and revert restores the lesson), scaling and rounding, unit conversion, shopping-list merging, and the migration runner.

---

## 10. Open questions

None right now.

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
- Beginner profiles pick from the same themes (§5.2), shown with bigger art, fewer words, and more animation feedback on every tap.
- Rewards work the same way on both tracks, so siblings on different tracks collect the same kind of reward.

### Data hooks to include now
- Lesson files have `track: "core" | "beginner"` (§7.3).
- Profiles have `track` (§8.4). A profile shows lessons from its track. A parent can open individual lessons from the other track to a profile. Kids on different tracks need separate profiles.
- Steps can carry an `image` and an `audioText` field. These are optional for core lessons and required for beginner lessons, which the linter enforces once the beginner track starts.
- The shopping list already combines lessons across profiles, so beginner and core lessons queued the same week merge into one list automatically.
