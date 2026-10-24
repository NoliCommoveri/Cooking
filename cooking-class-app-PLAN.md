# Kids Cooking Class App — Overview Plan

**Status:** Phases 0, 0b, and 1 are done. Phase 1b is built and waits on the owner's dashboard setup (`docs/setup.md`) and test.
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

**Two programs, one app — Requirement (owner, 2026-10-23).** The 75-lesson course in §4 is **Cook Around the World**, offered and marketed to casual families and adults (owner, 2026-10-23). The **Levels** (Helper, Apprentice, Cook, Chef; §12) are **the homeschool curriculum**, built inside this app beside it, sharing its families, profiles, food rules, shopping, schedule, and transcript. Cook Around the World stays open to every family. Level 3 is built first.

**The beginner track (§11) is replaced by Levels 1 and 2** (owner, 2026-10-23).

### Users
| User | Device | Main jobs |
|---|---|---|
| Owner (Jen) | Any | Everything a parent can do, plus setting the beta word, reviewing shared recipes (§6.10), and managing families |
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
  - **Honey is allowed** (owner ruling, 2026-10-22). The bee itself isn't clean, but its honey is, the way the plan treats milk and eggs from clean animals. The rules file lists it as an allowed product, not a clean species.
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
  - Ground dried crayfish, shrimp powder, and shrimp-flavored bouillon cubes, which many West African recipes (jollof, egusi, pepper soup) add for flavor. Leave them out; check bouillon labels.
  - Imitation crab (often pollock, but may contain crab or shellfish extract).
  - Carmine or cochineal (an insect-derived red coloring) in some candies, yogurts, and drinks.
  - Suet, in mincemeat, Christmas pudding, some dumplings, and some pastry.
  - Beef tallow, used for frying by some restaurants and in some store-bought fries, pastry, and shortening blends.
- **Per-family dietary filters** are an extra layer on top of the hard block. Filters are per family, not per kid. Each family can add its own restrictions (e.g. vegetarian, nut-free, dairy-free) using the `contains` tags on the ingredient registry (§7.2). A lesson that conflicts with a family's filters is hidden from that family. If the lesson lists an allowed substitution that resolves the conflict, it is shown with that substitution applied instead. **An optional ingredient never hides a lesson** (owner, 2026-10-22): one that conflicts is left out for that family, and the lesson says so.
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
- **Requirement: photos are off unless the owner turns them on for a family** (owner, 2026-10-22). Storing every family's photos costs money, and the feature is really for the owner's family. The switch is per family, on `/ops`; families can't turn it on themselves. With photos off, the photo step, the gallery, and the photo download don't show, and everything else (progress, ratings, reflections, Print our progress) works the same.

---

## 3. Lesson structure

Each lesson has these stages:

1. **Intro.** A 30–45 second animated slideshow (§6.5): the finished dish, the skill, why it matters, an ingredient preview, time and safety level, and a "Let's cook" button.
2. **Learn.** 3–6 short concept cards with a "why it works" angle. An optional quiz of 2–3 questions follows. **The quiz never blocks cooking.** The cards follow a set shape (below) so every lesson teaches how its skill carries over to other dishes.
3. **Prep (mise en place).** An ingredient checklist with amounts scaled to the chosen servings, then an equipment checklist. Cook mode unlocks once every item is checked.
4. **Cook mode.** One step per screen. Each step has a checkbox, a big Next control (with hands-free options, §6.12), inline timers where needed (several can run at once), a safety level, and an optional tip or "what it should look like" note. The screen stays awake for the whole cook. Some steps are food-safety checks (below).
5. **Plate and photo.** The camera opens directly, and the photo saves to this attempt. Only for a family with photos on (§2.6); otherwise this stage is skipped.
6. **Reflect.** A 1–5 rating, a "what would I change?" note, and an optional rating from whoever ate it.

### Learn stage: teaching the why — Requirement (owner, 2026-10-22)
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

### Food-safety checks — Requirement (owner, 2026-10-22)
Separate from safety levels, which are about who must be in the kitchen. These are about the food.
- **Doneness check.** Any lesson that cooks raw poultry, ground meat, whole cuts, fish, or eggs to a safe point has a check step with a thermometer target (e.g. poultry 165°F, ground beef 160°F, fish 145°F). Every such lesson lists a thermometer in its equipment. **The app doesn't require a reading** (owner, 2026-10-22): the step shows the target clearly and is checked off like any other step.
- **Raw-handling steps.** After a step that handles raw meat, poultry, fish, or eggs, the next step is a wash-hands-and-board step.
- **Raw and lightly cooked eggs** (Caesar dressing, hollandaise) use pasteurized eggs, or the lesson says why not.
- **Raw dough.** Lessons with raw flour or raw egg in a dough or batter include a "don't taste the raw dough" tip.
- The linter enforces the first two (§7.4).

---

## 4. Curriculum: Cook Around the World (75 dishes)

**Named Cook Around the World** (owner, 2026-10-23): the course for casual families and adults, beside the Levels, which are the homeschool curriculum (§12). Everything in this section is unchanged by that.


Lessons are grouped into units by skill. International and American dishes are mixed within each unit, and breakfast dishes are spread across the units. The tables below are in course order (owner, 2026-10-22): units in order, prerequisites first, easier before harder, and cuisines alternated within each unit. **A lesson's number is its place in that order**, not something stored on the lesson (§4.1). The safety levels below are set in the content. Parents can't change them.

### 4.0 Foundation skills and choose-one lessons — Requirement (owner, 2026-10-22)
- **Foundation skills** are the ones most other lessons build on: the knife cuts (julienne, fine chopping and mincing, dicing, slicing), heat control, building a sauce, a roux, cutting in fat, and a yeast dough.
- **Every foundation skill is taught by at least two lessons, and a family picks one.** The two dishes come from very different cuisines, so every family can find one it will actually cook, and nobody skips the skill. Either lesson counts as done for the skill.
- **Knife work comes first, strongly suggested.** Nearly every lesson uses it. The app nudges parents toward a Unit 1 lesson before anything else, but doesn't block them (§6.2).
- **Parents can see foundations at a glance** (§6.2): foundation lessons are marked in the library and the queue, and choose-one lessons are shown side by side.
- **Prerequisites:** a lesson that needs a foundation skill unlocks when either lesson teaching it is done. The exception is a lesson built on the dish itself: 41 serves 40a's biscuits, so it still needs 40a.
- **Each foundation skill has three lessons to pick from** (owner, 2026-10-22). The added dishes sit beside the lesson they pair with and share its number, with a letter each (1a, 1b, 1c); the unit tables mark each group with "pick one with". Slicing is already taught three times (5, 27, 28), so it has no added dishes.

| Foundation skill | Pick one of |
|---|---|
| Julienne | 1a Spring rolls · 1b Chicken fajitas · 1c Baked shoestring fries |
| Fine chopping | 2a Fattoush · 2b Chimichurri steak · 2c Tuna salad sandwiches |
| Dicing | 3a Pico + fish tacos · 3b Ratatouille · 3c Minestrone |
| Heat control | 6a French omelet · 6b Grilled cheese + tomato soup · 6c Challah French toast |
| Building a sauce | 8a Shakshuka · 8b Spaghetti marinara · 8c Honey-garlic chicken |
| Roux | 15a Mac and cheese · 15b Chicken and spinach crêpes · 15c Japanese chicken curry |
| Cutting in fat | 40a Buttermilk biscuits · 40b Rugelach · 40c Baked beef empanadas |
| Yeast dough | 43a Cinnamon rolls · 43b Challah · 43c Homemade pizza |
| Slicing | 5, 27, and 28 already teach it |

- A prerequisite can name a whole pick-one group (any roux lesson, 15a–15c), and then any lesson in it counts. 41 still needs 40a itself, because it's served on those biscuits.

### 4.1 Lesson numbers and the family's course plan — Requirement (owner, 2026-10-22)
- **A lesson's number is its place in the course**, not a field on the lesson. Ids and picture names carry no number (`shakshuka`, `dishes/shakshuka.png`), and lessons point at each other by id: callbacks, prerequisites, and a kitchen word's "practiced in" lesson.
- **A pick-one group shares one number**, with a letter for each dish in it: 1a, 1b, 1c. On one cook's path the course is 59 lessons, so a number says how far through it someone is ("Quest 27 of 59").
- `content/course.json` holds every planned dish in the **suggested order**, which keeps every prerequisite first. A prerequisite names a dish, or `pick:<skill>` for any dish in that pick-one group.
- **Course plans** (owner, 2026-10-22: built in Phase 3 with the weekly schedule, §6.18). A family can have one or more courses, each for one or more profiles. A parent can view a course's whole plan, reorder it, remove dishes, put them back, and pick the dish for each pick-one group. A profile's lesson and quest numbers come from its course's plan; a profile on no course uses the suggested order. Removing a dish from a pick-one group drops its letter; a group left with one dish has no letter, and an emptied group has no number.
- A plan that puts a lesson before one it builds on, or removes one it needs, shows a note. It's a suggestion, not a block, like the knife-work nudge (§4.0).
- The public demo and syllabus use the suggested order.

### Unit 1 — Knife work and assembly
| # | Dish | Cuisine | Skill | Max safety | Notes |
|---|---|---|---|---|---|
| 1a | Fresh spring rolls | Vietnamese | Julienne, rolling rice paper | Adult nearby | Chicken instead of shrimp/pork; peanut + hoisin dip |
| 1b | Chicken fajitas | Tex-Mex | Julienne: peppers and onions in thin strips · *pick one with 1a, 1c* | Adult nearby | Check tortillas for lard |
| 1c | Baked shoestring fries | American | Julienne: potatoes into thin sticks · *pick one with 1a, 1b* | Adult nearby | Baked, not fried |
| 2a | Fattoush | Lebanese | Fine chopping, toasting pita | Adult nearby | Sumac sub: lemon zest + salt |
| 2b | Chimichurri steak | Argentine | Fine chopping: parsley, garlic, oregano · *pick one with 2a, 2c* | Adult nearby | Steak to 145°F |
| 2c | Tuna salad sandwiches | American | Fine chopping: celery, onion, pickles, herbs · *pick one with 2a, 2b* | Adult nearby | Tuna is clean (fins and scales) |
| 3a | Pico de gallo + Baja fish tacos | Mexican | Dicing; broiling fish | Adult nearby | Cod/tilapia. Broiled, not battered and fried: frying is first taught in 53 |
| 3b | Ratatouille | French | Dicing: eggplant, zucchini, pepper, tomato · *pick one with 3a, 3c* | Adult nearby | |
| 3c | Minestrone | Italian | Dicing · *pick one with 3a, 3b* | Adult nearby | |
| 4 | Chicken Caesar + homemade dressing & croutons | American | Whisked dressing, cubing bread | Adult nearby | Pasteurized eggs or mayo base |
| 5 | Smash burgers + quick pickles | American | Thin slicing, quick pickle, high-heat sear | Adult nearby | |

### Unit 2 — Stovetop basics
| # | Dish | Cuisine | Skill | Max safety | Notes |
|---|---|---|---|---|---|
| 6a | French-style omelet (breakfast) | American/French | Heat control, rolling an omelet | Adult nearby | |
| 6b | Grilled cheese + tomato soup | American | Heat control · *pick one with 6a, 6c* | Adult nearby | |
| 6c | Challah French toast | Jewish | Heat control · *pick one with 6a, 6b* | Adult nearby | Store-bought challah, or from 43b |
| 7 | Crispy hash browns (breakfast) | American | Squeezing out moisture, crisping | Adult nearby | |
| 8a | Shakshuka | N. African / Middle Eastern | Building a sauce, poaching eggs in it | Adult nearby | |
| 8b | Spaghetti marinara | Italian | Building a sauce · *pick one with 8a, 8c* | Adult nearby | |
| 8c | Honey-garlic chicken | Chinese-American | Building a sauce · *pick one with 8a, 8b* | Adult nearby | Honey is allowed (§2.1) |
| 9 | Chicken fried rice | Chinese | High-heat stir-fry, day-old rice | Adult nearby | Mushroom stir-fry sauce, not oyster sauce |
| 10 | Oyakodon | Japanese | Simmering, setting egg gently | Adult nearby | Mirin sub: rice vinegar + sugar; dashi sub: chicken broth + soy |
| 11 | Chicken adobo | Filipino | Braising, reducing | Adult nearby | |
| 12 | Breakfast burritos (breakfast) | American | Timing several components, rolling | Adult nearby | Beef chorizo or turkey sausage; check casings, or use bulk |
| 13 | Cacio e pepe | Italian | Emulsion | Adult nearby | |
| 14 | Eggs Benedict (breakfast) | American | Poaching eggs, hollandaise | Adult nearby | Turkey bacon or smoked salmon. Pasteurized eggs for the hollandaise. Prereq: 13 |
| 15a | Stovetop mac and cheese | American | Roux → béchamel → cheese sauce | Adult nearby | Foundation for every roux lesson |
| 15b | Chicken and spinach crêpes | French | Roux → béchamel, crêpe batter · *pick one with 15a, 15c* | Adult nearby | |
| 15c | Japanese chicken curry | Japanese | Roux with curry powder, from scratch · *pick one with 15a, 15b* | Adult nearby | Make the roux from scratch: store-bought curry blocks can contain pork or beef fat |

### Unit 3 — Spices and flavor bases
| # | Dish | Cuisine | Skill | Max safety | Notes |
|---|---|---|---|---|---|
| 16 | Chana masala | Indian | Blooming spices, onion-tomato base | Adult nearby | Amchur sub: lemon |
| 17 | Beef chili | American | Batch browning, toasting spices | Adult nearby | |
| 18 | Misir wot | Ethiopian | Spiced lentils | Adult nearby | Berbere sub: paprika + cayenne + warm spices; serve with rice |
| 19 | Red beans and rice | Louisiana | Onion/celery/pepper base, simmering beans until creamy | Adult nearby | Chicken andouille instead of ham hock; check casings |
| 20 | Jollof rice with chicken | Nigerian | Blended pepper base, cooking rice in the sauce | Adult nearby | Scotch bonnet → jalapeño. No dried crayfish or shrimp bouillon |
| 21 | BBQ pulled chicken + coleslaw | American | Dry rub, reducing a sauce | Adult nearby | |
| 22 | Chicken tagine with olives | Moroccan | Layered spice braise | Adult nearby | Preserved lemon sub; ras el hanout sub; Dutch oven |
| 23 | Peanut stew (maafe) | Malian | Building a one-pot stew | Adult nearby | Peanut butter; carries the peanut tag |
| 24 | Koshari | Egyptian | Building a dish in layers, crispy onions | Adult nearby | Lentils, rice, pasta, tomato sauce |
| 25 | Butter chicken | Indian | Marinating, finishing with cream | Adult nearby | |
| 26 | Jerk chicken | Jamaican | Wet marinade, broiling | Adult nearby | Habanero or jalapeño |

### Unit 4 — Breaking down and slicing meat, marinades
| # | Dish | Cuisine | Skill | Max safety | Notes |
|---|---|---|---|---|---|
| 27 | Beef bulgogi | Korean | Thin slicing (partly frozen), marinating | Adult nearby | Asian pear sub: Bosc pear or apple |
| 28 | Philly cheesesteak | American | Thin slicing (deliberate repeat of 27) | Adult nearby | Prereq: 27 |
| 29 | Lomo saltado | Peruvian | Beef stir-fry | Adult nearby | Aji amarillo sub: yellow bell pepper + cayenne |
| 30 | Suya (spiced beef skewers) | Nigerian | Thin slicing, dry rub, broiling | Adult nearby | Ground-peanut spice rub; carries the peanut tag |
| 31 | Chicken yassa | Senegalese | Citrus-mustard marinade, slow-cooked onions | Adult nearby | |
| 32 | Chicken tinga tacos | Mexican | Braising, shredding | Adult nearby | |
| 33 | Matzo ball soup from a whole chicken | Jewish | Breaking down a bird, making stock | Adult nearby | Oil or chicken schmaltz in the matzo balls |

### Unit 5 — Dough and batter
| # | Dish | Cuisine | Skill | Max safety | Notes |
|---|---|---|---|---|---|
| 34 | Blueberry muffins (breakfast) | American | Muffin method, avoiding overmixing | Adult nearby | |
| 35 | Skillet cornbread | American | Preheated skillet | Adult nearby | Pairs with 17 |
| 36 | Pão de queijo | Brazilian | Scalded tapioca dough | Adult nearby | |
| 37 | Skillet naan | Indian | Yogurt dough, high-heat skillet | Adult nearby | |
| 38 | Pupusas | Salvadoran | Masa dough, griddle | Adult nearby | Lard-free beans |
| 39 | Ugali with sukuma wiki | Kenyan | Stiff cornmeal dough, braised greens | Adult nearby | White cornmeal and collard greens |
| 40a | Buttermilk biscuits (breakfast) | American | Cutting in cold fat, folding for layers | Adult nearby | Butter, not lard |
| 40b | Rugelach | Jewish | Cutting in fat · *pick one with 40a, 40c* | Adult nearby | Butter and cream cheese dough |
| 40c | Baked beef empanadas | Argentine | Cutting in fat, filling and crimping · *pick one with 40a, 40b* | Adult nearby | Butter dough, not lard |
| 41 | Biscuits + sausage gravy (breakfast) | American | Milk gravy on a roux | Adult nearby | Bulk turkey sausage (no casing). Prereq: 40a, and any roux lesson (15) |
| 42 | Gyoza | Japanese | Pleating, fry-then-steam | Adult nearby | Chicken or beef filling |
| 43a | Cinnamon rolls (breakfast) | American | First yeast dough: kneading, proofing, shaping | Adult nearby | |
| 43b | Challah | Jewish | Yeast dough: kneading, proofing, braiding · *pick one with 43a, 43c* | Adult nearby | Honey is allowed (§2.1) |
| 43c | Homemade pizza | Italian | Yeast dough: kneading, stretching · *pick one with 43a, 43b* | Adult nearby | Veggie, or turkey pepperoni |

### Unit 6 — Oven, roasting, frying
| # | Dish | Cuisine | Skill | Max safety | Notes |
|---|---|---|---|---|---|
| 44 | Homemade granola (breakfast) | American | Oven browning, stirring partway | Adult nearby | Mixing steps are Solo; oven steps make the lesson Adult nearby |
| 45 | Meatloaf with glaze | American | Binders, thermometer | Adult nearby | |
| 46 | Swedish meatballs | Swedish | Browning, roux gravy | Adult nearby | Beef; cranberry for lingonberry. Prereq: any roux lesson (15) |
| 47 | Roast chicken + pan gravy | American | Roasting, resting, carving, gravy | Adult nearby | Prereq: any roux lesson (15) |
| 48 | Pot roast | American | Long oven braise | Adult nearby | |
| 49 | Bobotie | South African | Spiced ground beef baked under an egg custard | Adult nearby | Ground beef, curry powder, apricot jam |
| 50 | Spanakopita | Greek | Phyllo, layering | Adult nearby | |
| 51 | Spinach & mushroom quiche | French | Pastry, blind baking, custard | Adult nearby | No bacon |
| 52 | Chicken pot pie | American | Roux filling + pie crust | Adult nearby | Prereq: any roux lesson (15), and 51 |
| 53 | Chicken katsu | Japanese | Breading station, shallow frying | **Adult hands-on** | Tonkatsu sauce sub |
| 54 | Kelewele (spiced plantains) | Ghanaian | Shallow frying | **Adult hands-on** | Plantains from the produce aisle |
| 55 | Fish and chips | British | Batter, deep-frying with a thermometer | **Adult hands-on** | Cod or haddock; fry in vegetable oil, never beef dripping |

### Desserts
| # | Dish | Cuisine | Skill | Max safety | Notes |
|---|---|---|---|---|---|
| 56 | Brown butter chocolate chip cookies | American | Browning butter, creaming | Adult nearby | |
| 57 | Malva pudding | South African | A sponge pudding soaked in a warm butter-cream sauce | Adult nearby | Apricot jam |
| 58 | Churros with chocolate *(alt: panna cotta)* | Spanish/Mexican *(Italian)* | Choux dough, frying *(gelatin swap)* | **Adult hands-on** *(Adult nearby)* | Panna cotta: beef gelatin or agar-agar |
| 59 | Apple pie with lattice | American | Advanced pastry | Adult nearby | Prereq: 51 |

### Capstone
- **Multi-dish meal timing.** Example: bulgogi + fried rice + spring rolls. Requires a "plan the timeline" stage that the single-dish lessons don't have. Design it after the core lesson player works.

### Equipment note
None of the 75 dishes requires a stand mixer. Lessons that use one in typical recipes (cinnamon rolls, challah, pizza dough, cookies, churros, pão de queijo) must be written for hand mixing or hand kneading.

---

## 5. UI and visual design

> If a frontend-design skill is available in the Claude Code environment, load it before starting any UI work.

### 5.1 Tone and age target
- Target ages **10 and up** (owner, 2026-10-23; first designed for 11–12). It should feel like a **cooking video game**, not a preschool app and not a productivity tool.
- **Say "adult," not "grown-up"** (owner, 2026-10-23), in everything a kid reads: "Ask an adult to start," "Ask an adult."
- Playful, warm, and tactile. Avoid baby-ish mascots, a sing-song tone, and anything kids this age would find embarrassing.

### 5.2 Themes
**Requirement: each profile picks its own theme.** Kids choose; there is no single app-wide theme.

- **Same rewards, different look.** Every theme shows the same progress underneath: a reward per completed dish, a pin per skill, and a rank. Each theme draws them its own way.
- **Ranks — Requirement (owner, 2026-10-23).** Six ranks, by the number of different dishes a profile has cooked: Kitchen Apprentice (0), Prep Cook (5), Line Cook (15), Sous Chef (30), Head Chef (50), and Executive Chef (75, the whole course). Cooking a dish again doesn't count twice, and nothing cooked on the Sabbath counts (§6.18).
- **Family recipes count toward rank only (owner, 2026-10-23).** A family's own recipe, or a User-shared recipe it cooks (§6.10), counts as a dish toward rank, but earns no stamp, node, or skill, since a recipe has no set cuisine or course skill. Lessons, including the Appointed Times unit's (§6.19), earn all three.
- **Every theme supplies its own treatment for every component in §5.4.** §5.4 gives the Chef's Passport treatment and §5.4a the Kitchen Quest one. The banned patterns in §5.6 apply to all of them.
- **The look follows the profile.** On a shared device, the theme switches when a profile is picked from the chef lockers. The profile picker and parent screens use a neutral house style.
- **Theme tokens are CSS custom properties,** one set per theme, applied at the root when a profile is active.
- **Requirement: Kitchen Quest is built first, then Chef's Passport as soon as possible.** The kids chose from the Phase 0 mockups (`mockups/theme-picker.html`). Food Truck and Recipe Scrapbook come later (§9). A profile can switch to any built theme at any time.

**Themes:**
- **Chef's Passport + Kitchen Ranks.** Each dish earns an inked stamp for its cuisine in a passport book. Stamp pages are grouped by region, and the world map lights up as regions fill in. Ranks go Kitchen Apprentice → Prep Cook → Line Cook → Sous Chef → Head Chef → Executive Chef, and each changes the hat or apron on the chef avatar. §5.4 describes this one. Built second.
- **Kitchen Quest** (built first): an RPG-style skill tree. Each unit is a path, and each dish is a node on it. Clearing a quest lights its node. Ranks show as a level and title (Level 1 Kitchen Apprentice … Level 6 Executive Chef). §5.4a describes this one.
- **Food Truck** (later): each lesson adds a menu item to the kid's own food truck.
- **Recipe Scrapbook** (later): progress lives in a scrapbook.

### 5.3 Visual language
- **Surfaces:** recipe cards with a paper texture, tape on the corners, and a slight rotation. Use a corkboard, a chalkboard menu, or a tile-backsplash texture for backgrounds.
- **Palette (recommendation):** warm kitchen colors defined as CSS tokens — tomato red, butter yellow, basil green, cream paper, cast-iron charcoal. An optional "night kitchen" dark theme.
- **Typography (recommendation):** a chunky, rounded display font for headings (e.g. **Lilita One**, **Fredoka**, or **Baloo 2**), a highly readable body font (e.g. **Nunito**), and a handwritten accent font for notes and reflections (e.g. **Caveat**). All are SIL OFL fonts on Google Fonts. Body text in cook mode must stay readable from about an arm's length away, so the body size there is large (≥ 20px).
- **Icons:** custom SVG illustrations in one consistent style. Don't rely on emoji as the main iconography.

### 5.3a Art production (recommendation)
The themed components need a lot of art, and every theme added later (§5.2) needs its own set: a dish illustration for every lesson, an icon for every ingredient (they hop into the bowl) and every tool (pegboard), a stamp per region, a pin per skill, a small drawing per kitchen word (§6.1), and avatar outfits per rank.
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
- **Rank outfits:** Kitchen Apprentice wears a paper cap and plain apron; Prep Cook a short chef's hat and butter apron; Line Cook a taller hat, red neckerchief, and striped apron; Sous Chef a pleated hat, buttoned jacket, and navy apron; Head Chef the tallest hat with a gold band; Executive Chef (owner, 2026-10-23) an even taller hat with a gold band and star, and a black jacket with gold buttons.

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
| Helper | Chef Ruth (§6.8) on a floating **Ask** button, and a chat on recipe cards (Chef Ruth) and sticky notes (the kid) |
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
| Helper | Chef Ruth (§6.8) as a guide character on a floating **Ask** button, and a chat styled as a dialogue box |
| Photos | Taking a photo hangs a framed snapshot in a **trophy hall**. The gallery is the trophy hall |
| Rank up | A full-screen **level-up**: the new title and crest, with a pixel burst |
| Profile picker | The house-style chef's lockers (§5.2), same as every theme |

### 5.5 Motion and sound
- **Small, frequent actions** (check an item, Next): quick and satisfying, about 150–350 ms.
- **Milestones** (lesson done, stamp earned, rank up): bigger celebrations are fine — a stamp slamming down with an ink splat, steam puffs, a sprinkles burst.
- **Nothing should animate while a kid is reading a step.** Motion must not pull attention away from the cooking instructions.
- Honor `prefers-reduced-motion` with simpler fades.
- **Optional sound effects:** timer ding, a light sizzle on Next, a stamp thunk. Include a mute toggle that is remembered per device. Sounds are made in the browser, with no audio files (owner, 2026-10-23), and are on until muted. The mute toggle silences the effects but not the timer, which rings until it's stopped (§6.1).

### 5.6 Banned patterns
Do **not** use:
- **Pill-shaped chips, tags, badges, or status labels** (small colored rounded-rectangle labels, `border-radius: 9999px` text tags, "tag clouds"). Show status through an **icon plus shape plus position**, or through themed objects (stamps, pins, banners).
- The default look of any component library (Bootstrap, unstyled shadcn, default Tailwind UI) left un-themed.
- A generic SaaS dashboard look: gray-bordered card grids, purple-blue gradients, flat stat tiles.
- Tiny tap targets. The minimum is **56px** in cook mode, since kids will be tapping with messy hands.

### 5.7 Parent view
- Uses the same theme, but toned down and **built for scanning**. She's in a store, on a phone.
- The shopping list is styled as a **grocery notepad** with handwritten-style checkmarks, grouped by store section. Still no pills.
- **The parent menu** (owner, 2026-10-23), modeled on MCCE's parents app: every parent screen sits behind one **Menu** button that opens a panel from the side, in groups, one group open at a time, opening on the group of the screen being read. The app's name goes back to the Queue, where the Parents button lands.
  - **Learning path:** Queue, Shopping, Kitchen staples, Progress
  - **Recipes:** Our recipes, User-shared recipes (§6.10)
  - **Setup:** Courses, Profiles, Family settings, Logins & PIN
  - **Owner** (the owner only): Families & beta word, Fix requests, Recipe reviews, Reported recipes (§6.2a)
  - **Go to Lockers** and **Sign out** (owner, 2026-10-23), below the groups, as top-level commands. There's no Lock button: leaving the parent screens locks the PIN on its own (§8.3).
- **Dish cards** (owner, 2026-10-23): on the queue and the course screens, a dish's name opens a short card, since many dishes are new to families: a line about the dish, its main ingredients (not flour, salt, oil, and the like), how it cooks (stovetop, oven, both, or no cooking), and the time. Every planned dish has them in `content/course.json` (`about`, `main`, `method`); an Appointed Times lesson carries its own; a family recipe's come from its "why we make this" card, its ingredients, and how it cooks, which the entry flow asks.

---

## 6. Features

### 6.1 Kid features
- Profile picker (chef lockers), showing only this family's profiles. For a lesson queued for several profiles, any of them can start it, and the cook is shared
- **Kid login** (owner, 2026-10-23): a kid logs in with their first name and last initial, their own cooking picture, and a password, all set by a parent; they skip the lockers and land in their own kitchen, with no parent screens (§8.3a)
- **The kitchen in two tabs** (owner, 2026-10-23), pinned to the bottom where a thumb is, as in MCCE Kids, drawn by the theme: **Main quest / My journey** (this week and next, open: what's queued for this profile, then its course's lessons scheduled for those weeks; a queued lesson with no date counts as current, and one a parent dated counts by its date. Everything later on its path, a pick-one group's other dishes dropping out once one is cooked or queued, is under a **See more** expander (owner, 2026-10-23). Without a course schedule there are no weeks, so the whole path is under See more) and **Side quests / More recipes** (every unit, the Appointed Times unit with its User-shared shelf, and Our recipes, each folded shut, with a search over dish names and ingredients that opens what matches). Progress and rewards become a third tab with Phase 5
- Lesson browser by unit (in More recipes), with locked lessons whose prerequisites this profile hasn't done shown as a "coming up" card (not hidden)
- Full lesson flow (§3)
- Serving scaler (defaults to the family's serving count; limits in §6.6)
- Multiple concurrent timers; a timer keeps running if the kid moves to another step or closes and reopens the app (see §8.2 for iOS limits)
- **Request a lesson** (recommendation, approved 2026-10-22): a kid can tap "I want to make this," which adds a request to the parent's queue to approve or decline
- **Adult profiles don't ask.** On an adult profile the button is **Cook this**: it queues the lesson for that profile straight away, with no approval and no parent PIN, and it goes on the shopping list like any queued lesson. A shared profile with a kid on it is a kid profile, so it still asks
- Screen Wake Lock during Prep and Cook
- **Kitchen words** (recommendation, approved): cooking words in step text (dice, mince, simmer, fold the dough…) are underlined. Tapping one opens a card with what it means in kid terms, including a size or look they can picture ("smaller than a grain of rice"), a small drawing, and the lesson that practices it. The card is drawn by the profile's theme, like the Why? card. The words live in `content/terms.json` (§7.1), and the linter won't let a lesson use a cooking word that isn't defined there (§7.4)
- Progress, ranks, skills earned, and gallery, drawn by the profile's theme (§5.4, §5.4a)

### 6.2 Parent features
- **Foundations first** (§4.0): foundation lessons carry a foundation marker (an icon and a word, never a pill) in the library and the queue. Choose-one lessons sit side by side with "Pick one." A new family's queue suggests a Unit 1 knife lesson first. Queuing anything else before any knife lesson shows a short note: "Most lessons use knife work. We suggest a Unit 1 lesson first." It's a suggestion, not a block. The parent tour (§6.9) has a card on foundations.
- **Queue:** the one "up next" list in both modes. A parent adds lessons by hand, approves a profile's request (§6.1), or lets a course's weekly schedule fill it (§6.18). Each queued lesson is for one or more profiles (§1), with a serving count (defaults to the family's) and an optional planned date. Shopping, safety review, and cooks all work from the queue the same way, however a lesson got there
- **Shopping list** (§6.3)
- **Safety review:** before approving a lesson, see every step marked adult-nearby or adult-hands-on
- **Gallery:** all photos, filterable by profile and lesson, with reflections (families with photos on, §2.6)
- **Download all photos:** the family's photos as a download, so they don't live only in the app
- **Family recipes** (§6.10): add the family's own recipes, share them to the community directory, and add recipes from it
- **Swap for an Appointed Time meal instead** (§6.19), in a queued lesson's "⋯" menu
- **Mark test-cooked:** after cooking a lesson themselves, a parent can mark it test-cooked for their family (§7). Optional; lessons don't need it to be shown to kids
- **Preview as a learner** (owner, 2026-10-23): on each lesson on the queue (requests, course lessons, and lessons added by hand), the lesson picked in Add a lesson, each of the family's own recipes, and each written lesson in the course editor, a parent goes through the lesson the way one of their profiles will see it: that profile's theme, kid or adult, and the family's diet swaps. Prep doesn't need checking off, any stage is a tap away, and **nothing is saved or counted**. It opens over the page, so a course being edited isn't lost. The owner has the same in the manager section (§7.5)
- **Kitchen staples:** ingredients the family usually has, grouped as "May already have" on lists (§6.3)
- **Delete our family** and **Download our data** (§6.14)
- **Print our progress** (§6.15)
- **Family settings:** family name, profiles (add, rename, avatar, theme, who's on each), dietary filters (§2.1), default servings, voice step control (off until turned on, §6.12), other parent logins, and each kid profile's login: name, picture, password, log out everywhere, turn off (§8.3a)

### 6.2a Owner features
- Set, change, or turn off the **beta word** (§8.3), and see how many sign-ups are waiting on their email code
- **Recipe reviews:** recipes a parent sent for review after a leaven flag, a hard-block flag, or a typed-in ingredient (§6.10); clear or decline each
- **Reported recipes:** directory recipes families reported (§6.10), with **Hide** and **Unhide** on each
- **Fix requests:** review reports from families; **Apply in the manager** opens the lesson in the manager section with the suggestion filled in (§6.11, §7.5); revert a lesson patch made before the manager section existed
- See the list of families (name, number of profiles, last active). This is the only cross-family view. The owner never sees other families' kids' names, photos, or progress.
- Set a new password for a parent, as a fallback when the reset email (§8.3) doesn't reach them
- Remove a family. This is destructive, so it's on `/ops`, beside that family's download and Restore a family (§8.5)

### 6.3 Shopping — Requirement (owner, 2026-10-22)
**Shopping is optional.** Nothing a learner does waits on it: any lesson can be started whether or not anyone made a list. What it's for is letting a parent see, at a glance, what the coming lessons need.

**What you'll need** (the Shopping screen). The upcoming uncooked lessons, week by week: lessons queued by hand with no date first ("No date set"), then each week, with the course's weeks worked out ahead (§6.18). This week and next week are open; later weeks are folded. Each week lists its lessons and the ingredients they use, merged and grouped by store section, in the amounts the recipes use.

**Make a shopping list** (when the parent wants one):
1. "How many lessons are you shopping for?", a dropdown counting from the next lesson not cooked yet. Once a number is picked, the names of the lessons it covers show. It always counts from the next uncooked lesson, even ones on an earlier list (owner, 2026-10-22): a parent who already bought something ticks it as on hand.
2. A preview of everything those lessons need, where the parent ticks what they have on hand. Ticks are for this list only.
3. **Create shopping list** for the rest. In the store, items are checked off; check-offs are saved as they're tapped, so the list survives closing the app. Something ticked as on hand can be put back on the list. **Done shopping** is optional, and so is everything else here. **Delete list** has an Undo.

**How the list is worked out:**
1. Collect the ingredient lines from the lessons, with any diet-filter substitutions (§2.1) already applied, and drop ingredients the diet leaves out.
2. Scale each line to that lesson's serving count (§6.6).
3. Convert each line to the ingredient's **base unit** using the registry's conversions (e.g. grams per cup of flour).
4. **Merge by canonical ingredient ID.** This is the main reason the ingredient registry exists.
5. **Kitchen staples** (salt, oil, and others the family adds by searching, on Shopping → Staples) are grouped first under **"May already have"** in What you'll need and the list preview, so the parent can check the cupboard first. On the finished list they're in their store aisles like everything else (owner, 2026-10-22: staples get shopped for too; 2026-10-23: grouped first, and in their aisles on the list).
6. Round up to **purchase units** (e.g. 28-oz can, dozen eggs, bunch, head), with the amount the recipes use shown alongside. Package sizes are typical US store sizes, set in `content/ingredients.json` (`purchaseUnit`), for the owner to check.
7. Group by **store section** (produce, herbs, meat & fish, dairy & eggs, bread & tortillas, grains & pasta, canned & jarred, sauces, oils & vinegars, baking, spices, specialty, frozen).
8. Lines with no amount ("warm, for scooping," "oil for the pan") appear once, with no quantity.
9. **No perishable rules** (owner, 2026-10-22): parents know what keeps. Nothing is held back or marked.

A lesson queued once for several profiles is one cook, so it's counted once. The same lesson queued as two separate items is two cooks, and counted twice.

**Later:** the list working offline in the store waits with Phase 2d (owner, 2026-10-22).

### 6.4 Photos
- Open the camera via file input with `capture`, or an equivalent.
- **Resize on the device** before upload (long edge about 1600px, JPEG about 0.8 quality).
- Store in object storage (§8), linked to the attempt.
- If the upload fails (Wi-Fi drop), the photo is kept on the device and retried. It is never lost because the network was down.
- Photos are only visible to the family that took them (§2.5, §8.3).
- Only families with photos turned on (§2.6) see any of this.

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

### 6.8 Chef Ruth, the helper — Requirement (owner, 2026-10-23)
The helper is **Chef Ruth** (she/her). Her picture is `content/images/brand/chef-ruth.png`, supplied by the owner. She's modeled on **Kels** in KennelOS (`NoliCommoveri/KennelOS`: End-State guide §33, `docs/KennelOS_Kels_Roadmap.md`).
- **Her most useful job is collecting information** that the app keeps on several different pages, in one chat. She asks one thing at a time and saves it where the page would have, so a parent never has to know which screen holds what.
- **The first-run wizard is one of her tasks** (§6.9), not a separate flow.
- **Parents first.** She's built on the parent screens first. Chef Ruth in the kitchen, for kids, comes later.

**How she works** (recommendations, from Kels; to confirm before building):
- **Scripted, not AI.** Every line she says is written in her task scripts. Nothing goes to an AI service.
- **She chats like a person (owner, 2026-10-23).** One message at a time: a half beat, then typing dots for a second or so, then the message, and the chat scrolls to each one as it lands. Her buttons and questions show only once she's done talking, and on a tour she steps aside only after her line is in. Her buttons and questions are part of the chat (owner, 2026-10-23): they sit right under her last message, on the parent's side like an answer, and scroll with the chat, not pinned to the bottom.
- **Ordinary saves.** She saves through the same API calls as the pages, and checks answers with the same shared rules (the food rules, the PIN, servings limits). She never gets her own copy of a rule; a rule she needs moves into a shared, tested module that the page uses too.
- **Where she lives:** a floating **Chef Ruth** button, with her picture, on every parent screen (so it's behind the parent PIN), and on a new family's empty locker screen until Getting started is done (§6.9). It opens her chat as its own parent page, with **Save for later** and **Cancel** in its header. A dot on the button shows while a task is unfinished.
- **Her first message** (owner's wording, 2026-10-23): "Hi, I'm Ruth, your Clean Plate guru! I'm here to help you learn to navigate the app and get your family in the kitchen!" For a new family it goes straight on to Getting started (§6.9). Otherwise it's followed by **Doing something** (her task list, with a search box) and, later, **Finding something** and **Understanding something** (below). An unfinished task is offered first. Once a task starts, she doesn't offer another one (owner, 2026-10-23): a task ends with a thank-you, and her button opens her menu again.
- **One thing at a time, saved as answered.** Settings save the moment they're answered. A task that makes something new from several answers (a few profiles, a course) keeps a resumable draft and ends with a review to approve, so nothing half-made shows in a kid's kitchen.
- **Fixes happen in the chat.** If she can collect it in the chat, she does. She sends a parent to a page only for something too big for a chat (a long editor), and says so first.
- **She explains, then points the way (owner, 2026-10-23).** Before each question, one short line on what it's for; after the answer, where to change it later (§6.9 has examples).
- **Her voice:** warm and short. Each task opens with a line that says yes to it ("Of course, let's get your family set up!"), then "I'll ask you a few questions and save each answer as we go. You can stop any time and pick up where you left off. Sound good?", answered **Sounds great, let's start!** / **Never mind**. At most one friendly phrase per message; the rest is the task. "Adult," never "grown-up."
- **Every task has search words** for the task list, written by us.

**Her first tasks** (recommendation, in build order; each pulls together what lives on more than one page):

| Task | What she collects | Pages it saves to today |
|---|---|---|
| **Getting started** | The first run (§6.9): family name and PIN, servings, diet, profiles, kid logins, casual or homeschool, a course | Logins & PIN, Family settings, Profiles, each profile's Kid login, Courses |
| **Add people to our family** | A roster of names first; then for each, kid or adult, and for a kid, a login if the parent wants one (§8.3a) | Profiles, each profile's Kid login |
| **Set up our learning path** | Casual or homeschool, Plan our weeks, then a course: who it's for, the start week, the pick-one choices (§4.0), and how many lessons a week | Family settings, Courses |
| **Plan this week** | What each kid cooks this week (course lessons, extras, swaps), then whether to make a shopping list for it | Queue, Shopping |
| **Our diet and kitchen** | Diet filters, default servings, kitchen staples | Family settings, Shopping → Staples |

**Show me around (owner, 2026-10-23; built).** A second flow, from her menu, separate from Getting started: she visits every parent screen in the Menu's order, starting with the Queue (the owner's screens last, for the owner only). At each one she says what it's for, steps aside so the screen shows for 8 seconds (her button brings her back sooner), then pops back and says how to use it, with **Next**, **Let me see it again**, and **Stop the tour**. **Let me see it again** (owner, 2026-10-23) steps aside for 15 seconds so the parent can click around, then she comes back and asks "Ready to see the next screen?" (on the last screen, "Ready to finish the tour?") with the same three buttons. The tour ends with **Thanks, Chef Ruth!**, which closes her chat. It's the parent tour (§6.9).

**Later** (recommendation):
- **Finding something:** a parent types words ("staples", "Ella's login", "PIN") and she says where it is, with a button to it (Kels's Find).
- **Understanding something:** how the app works, as an FAQ with a **Show me** for each answer, using Show me around's step-aside.
- **Chef Ruth in the kitchen:** kid tasks (pick what to cook next, find a lesson, explain a kitchen word) and the profile intro (§6.9).
- She can also run the family-recipe entry flow (§6.10) once the tasks above are built.

### 6.10 Family recipes and the community directory
No longer a bonus (owner, 2026-10-22): sharing recipes is central for the Appointed Times unit (§6.19), so this comes with it (Phase 4c). Families can cook their own recipes in the same lesson player.
- **My recipes.** A parent adds a recipe for their own family. Only that family sees it. It runs in the lesson player like any lesson: Prep checklists, cook mode, timers, photo, and reflection. It has no Intro or Learn stage unless the parent adds cards.
- **Share a recipe — Requirement (owner, 2026-10-22).** A parent can share a recipe at any time, marked **General** or **Feast day** (§6.19). Every shared recipe follows the same routine:
  1. The checks run: the hard block (species check and blocked-word scan, below) and the leaven check (§6.19).
  2. **Passes the hard block, every ingredient from the registry:** it's shared to the community directory right away, with no owner review first. It gets the Unleavened badge if it earns one, and Good for Feast Days if it was shared as a feast-day recipe.
  3. **Has a typed-in ingredient** (owner, 2026-10-22: the owner reviews typed-in ingredients): the parent sees a notice with only **Send for review**. It can't be shared until the owner clears it, usually by adding the ingredient to the registry, where it's species-checked like any other. Its family can still save and cook it meanwhile.
  4. **Flagged for leaven** (a feast-day recipe with a leaven ingredient, in its ingredients or its step text): the parent sees "Our automated ingredients checker flagged this as possibly containing leaven, so it will not be presented as an appropriate option for the spring Appointed Time. If you disagree and would like a human review, please click the \"Send for review\" button." Below it are **Send for review** (greyed out once pressed, "Sent for review") and **Share recipe**, which shares it now without the Unleavened badge. A parent can press both (owner, 2026-10-22): it's shared without the badge, and gets the badge if the review clears it.
  5. **Flagged by the hard block:** the parent sees a matching notice with only **Send for review**. It can't be shared until a review clears it.
- **Owner review.** Recipes sent for review wait on the owner screens (§6.2a). The owner clears one, deciding the Unleavened badge for a typed-in ingredient or a leaven flag (a cleared review shares the recipe as the parent asked), or declines it with a short note. Adding a typed-in ingredient to the registry is done in the content editor (§7.5). The parent sees the answer on the recipe, the way fix requests report back (§6.11). **A review only clears a false alarm** (a "crab apple" tripping the word scan, a typed-in "beef bacon"); it never lets unclean food through (§2.1).
- **Community directory: "User-shared recipes."** Shared recipes go into a searchable directory, open to every family. Any parent can search it and add a recipe to their family's recipes. **A shared recipe carries no identifier at all** (owner, 2026-10-22): no family name, no profile names, nothing that says who shared it. It's labeled only "User-shared recipes".
- **No photos in the directory** (owner, 2026-10-22). A shared recipe never carries a photo, even one the sharing family took; it always shows the placeholder art for its meal type (§6.19).
- **Report and Hide** (owner, 2026-10-22). Any parent can **Report** a directory recipe, behind the parent PIN, with a type (unclean ingredient, food-safety problem, wrong or unclear, inappropriate, other) and a note. Reports wait on the owner screens (§6.2a), and unclean-ingredient and food-safety reports email the owner right away, as fix requests do (§6.11). The owner can **Hide** any directory recipe, reported or not: it leaves the directory and the swap picker at once. **Unhide** puts it back (the restore rule in `CLAUDE.md`). Copies families already added stay in their recipes, with a note that it was taken out of the directory (recommendation).
- **Entry is a guided flow, not a file upload.** No CSV or file import. The parent is walked through one thing at a time, and Chef Ruth (§6.8) can run the same flow:
  1. Title, servings, total time, and a photo if they have one (families with photos on, §2.6; the photo stays with that family and is never shared). The photo step comes with the camera (Phase 4); until then a recipe shows its meal-type picture
  2. Ingredients, each picked from the registry by search with amount and unit. An ingredient not in the registry is typed in, and sharing it then needs the owner's review (above)
  3. Equipment, picked from the registry
  4. Steps, one at a time, each with its safety level and an optional timer with its label. A doneness step needs its thermometer target, and the safe minimums apply (§3). A step that isn't solo asks for its hazard line, and a step that handles a raw ingredient is followed by a wash-hands step the flow adds for the parent (recommendation, §3, §7.4)
  5. Meal type (for the placeholder art, §6.19), how it cooks (for its dish card, §5.7), and, optionally, a "why we make this" card, like a lesson's Learn stage
  6. Review, then save or share
- **The hard block applies** (`CLAUDE.md`, §2.1). Every family recipe runs the same checks as the library: registry ingredients are checked by species, and all text (title, ingredient names, steps, notes) goes through the blocked-word scan. A recipe that fails can't be saved or shared until it's fixed or a review clears a false alarm. A typed-in ingredient can't be species-checked until the owner adds it to the registry, so the blocked-word scan is the only check on it in the family's own recipes. That's why a recipe with one can't be shared until the owner reviews it.
- **Diet filters** apply to family recipes and directory recipes the same as to library lessons.
- **Scaling** works for registry ingredients. Typed-in ingredients scale as plain numbers, and the shopping list shows them without merging.

### 6.9 First run: Chef Ruth's Getting started
**Requirement (owner, 2026-10-23): the first run is Chef Ruth's Getting started task** (§6.8), like Kels's Getting Started in KennelOS (End-State guide §11 and §33).
- **Straight into her chat (owner, 2026-10-23).** After sign-up, a new family lands on the empty locker screen with Chef Ruth floating on it, and her chat opens on its own. **The family name and parent PIN are her first questions**, replacing today's "Your family" screen.
- **Getting started can't be skipped (owner, 2026-10-23).** There's no **Never mind** and no way to dismiss it. If the app is closed partway, every answer so far is kept and she picks up at the next question. The lockers and parent screens open once it's done. Afterwards it can be run again from her task list, to change answers, but only until the family gets cooking (owner, 2026-10-23): once a lesson is in the queue or a dish is cooked, it's a one-time flow that's done, and it leaves her menu. Settings are changed on their own pages after that.
- **Her opening for a new family** (owner's wording, 2026-10-23), right after her first message: "Since you're a new user, I'm going to get you all set up! I'll ask you some questions and use your answers to configure your settings, get your little chefs their kitchen profiles, and get the first recipes in their queues! Sound good?", answered **Sounds great, let's start!** only. It takes the place of the standard task opening (§6.8).
- **What she asks, in order (owner, 2026-10-23).** Each part saves as it's answered. Nothing optional is in it: kitchen staples, another parent's login, and the rest are left to their own pages or her other tasks.
  1. **Family name and parent PIN** (§8.3).
  2. **Default servings** (§2.2).
  3. **Allergies and diet:** the family's diet filters (§2.1).
  4. **Learners:** the profiles, each kid or adult, one person or shared (§1).
  5. **Logins for kids:** for each kid profile, whether to give them their own login, and if yes, she sets it up with them: first name and last initial, a picture, a password (§8.3a).
  6. **Casual or homeschool** (§6.17).
  7. **Offer to set up a course** (§6.18). If yes: who it's for, a name (optional), the start date, and lessons per week. She tells the parent they can edit the course to change the lesson order or drop lessons. In casual mode, saying yes turns on Plan our weeks, and she says so (owner, 2026-10-23).
  8. **No course: she offers to add a first lesson by hand (owner, 2026-10-23).** She asks what they'd like to start with: **Chicken**, **Beef**, **Fish**, or **Vegetarian**. She offers the first lesson in course order that matches, with its number, name, and the line about the dish (its dish card, §5.7), to add or not. If they say no, she offers the next matching lesson. If they say no to that one too, she says no problem, and tells them where to add lessons themselves (Menu → Queue → + Add a lesson).
     - Only written lessons the family's diet filters allow are offered. A lesson "matches" by the main protein in its required ingredients (`mainProtein` in `src/content/getting-started.js`): chicken, beef, or fish, not counting a sauce like fish sauce; vegetarian means nothing required carries meat or fish (an optional ingredient doesn't count). **Sides, breads, and desserts aren't offered** (owner, 2026-10-23: fattoush, not shoestring fries): they're marked `"meal": false` in `content/course.json`. The lesson is added for every learner, and she says it can be changed in the Queue. Today the first offers are 1a Fresh spring rolls (chicken), 2b Chimichurri steak (beef), 2c Tuna salad sandwiches (fish), and 2a Fattoush (vegetarian).
- **Before and after every question (owner, 2026-10-23).** Before each question she says in one short line what it's for, for example that a profile can be shared by several kids, or that each kid can have their own profile even if they plan to cook together. After the answer, she says where to change it later ("You can change this any time in Menu → Family settings."). This holds for all her tasks (§6.8).
- **Her last lines (owner's wording, 2026-10-23),** in place of the one-time test-cook notice: "Great, you're ready to get cooking!" and "As a reminder, Clean Plate is still in beta testing. We strongly suggest that you review each recipe with your child as some of them have never been cooked by our team. If you find anything concerning in a recipe,  we appreciate you giving feedback so we can correct it as soon as possible." Then **Let's go!** opens the lockers.
- **A warning for first-time parents:** the recipes haven't all been test-cooked. Read each lesson through before your kids cook it, and mark it test-cooked once you have (§6.2).
- **Each profile's first run** (in the kitchen, later with Chef Ruth in the kitchen, §6.8): it sets up its chef locker and avatar, and picks its theme.
- **Requirement: a profile intro.** Right after that, a short intro shows the profile how to use the app from their side, drawn in the theme they just picked (Kitchen Quest's is a "tutorial quest"). One card per thing they'll do, each with a "try it" tap where it helps:
  - find a lesson and **ask to cook it** (the request goes to a parent); adult profiles see **Cook this**, which queues it directly
  - the **serving picker**
  - **Prep:** check off ingredients and equipment, and cook mode unlocks
  - **cook mode:** Next and Back, timers (several at once), safety banners, and the thermometer check
  - take the **photo** and write the **reflection**
  - where **progress** shows: their theme's reward per dish, skills, and rank
  - **if something in a lesson looks wrong:** kids are told to tell an adult; adult profiles get the **Suggest a fix** card (§6.11)
  - the **Ask** button for Chef Ruth, once she's in the kitchen (§6.8)

  - **Owner's copy (2026-10-23), so far.** Main quest: "This is where you see the dishes you're assigned to cook. You can scroll down to see everything you'll be learning, but remember, recipes that are higher on the screen generally should be completed earlier than lower ones." Side quests: "Here are all the recipes available to be cooked in Clean Plate. That's the ones that are part of the main course, plus any that adults have added themselves that are available to your family. You can search by a dish name or an ingredient to see what we have available." Skill tree: "This is where you track your progress. As you cook, you'll earn badges and rank up." Asking to cook, kid: "If you see something you'd like to cook, but it's either not in your assignments or it's currently slated for the future, you can always ask to have it added or moved! Your parent will say yes or not now, using their PIN." Adult: "If you see something you want to cook that's not next on your list, no problem! Tap **Cook this** and it goes straight to your queue." Chef's Passport uses the same lines; only the tab names differ. "Badges" is the owner's word for both themes (2026-10-23), since kids know it; the screens keep their own names (crests, skill pins, stamps).
  - **Built as the kitchen intro (owner, 2026-10-23).** Twelve cards, each with Chef Ruth's picture: a welcome, the three tabs, asking to cook (Cook this for an adult), one card per stage of a cook (the lesson card, Learn, Prep, cook mode, Plate it), something looks wrong (tell an adult; Suggest a fix for an adult), and "You're ready!". The cook-flow and something-looks-wrong copy is Claude's draft, for the owner to change. Each card but the first and last shows a screenshot of the real screen in the profile's theme, with boxes drawn around the parts it's about; cook mode numbers its five boxes to match its lines. It opens on its own once, for a profile with no cooks that hasn't finished or skipped it, and **How it works** at the top of the kitchen replays it. No "try it" taps for now. Screenshots are taken with `tools/intro-shots.js` in a session, and retaken when a screen they show changes.

  A shared profile sees it once, together. Any card can be skipped, and the whole intro can be replayed from the profile's locker. Words stay short and plain, and nothing animates while a card is being read (§5.5).
- **Requirement: a parent tour.** A short set of cards that shows parents how to use the app, one task per card: queue a lesson and pick who it's for, set servings, use the shopping list, review safety and mark a lesson test-cooked, the parent PIN, photos and the gallery, and **Suggest a fix** (how to report something wrong in a lesson, what to write in "what should it say instead", and how the answer comes back, §6.11). Each card can be skipped, and the whole tour can be replayed from family settings. **Built as Chef Ruth's Show me around** (§6.8, owner, 2026-10-23): a card per parent screen, each shown for a few seconds, replayable from her menu.

Until Getting started is built, the test-cook warning shows as a one-time notice on a parent's first sign-in.

### 6.11 Fix requests and lesson patches — Requirement (owner, 2026-10-22)
Parents and adult learners report what's wrong in a lesson, and the owner pushes the fix from the browser. **The owner isn't the cooking expert**, so the person reporting proposes the correction, and the app checks it before it goes live.
- **Suggest a fix.** A "Suggest a fix" control on the lesson card and on each step, behind the parent PIN (adult profiles can use it too). The app fills in the lesson, version, step, and serving count. The reporter picks a type (wrong amount or time, unclear step, safety problem, **unclean ingredient**, or other), writes what's wrong, and says **what it should say instead**: the new amount, time, or wording. They choose from a list of the step's own fields, so the suggestion is already shaped as an edit.
- **Owner queue.** "Fix requests" on the owner screens (§6.2a), grouped by lesson, showing the current text beside the suggested text. Safety and unclean-ingredient reports also email the owner through Resend right away.
- **Apply from the browser.** **Apply in the manager** opens the lesson in the manager section (§7.5) with the suggestion filled in. The owner can keep it as written or change anything first, add a note back, and save; the save goes live for every family like any other, and marks the request fixed. *Until 2026-10-23 Apply made a **lesson patch** on top of the files instead; patches already live keep working until their lesson is next saved (§7.5).*
- **Checks before a patch goes live.** The same checks as the linter (§7.4) run in the app: the blocked-word scan on all new text, unit and amount checks, and the food-safety rules (a doneness step keeps its thermometer target, and targets can't go below the safe minimums in §3). A patch that fails can't be applied, and the owner sees why.
- **Every fix can be undone.** A save has **Undo** on the manager section's Saves page; a lesson patch from before has **Revert** beside it on the owner screen (the restore rule in `CLAUDE.md`).
- **Versions.** A fix raises the lesson's version, so attempts and test-cooks record exactly what was cooked. The reporter's family sees the outcome on that lesson ("Fixed: eggs now 1 per person"), or the owner's reply if it's declined.
- **Folding patches into the files.** A lesson patched before the manager section existed opens in the editor with its patches on it, and saving it writes them into its file (§7.5).
- **Bigger changes** (a new ingredient, a new step, a different method) are made in the content editor (§7.5). **Owner ruling (2026-10-23):** once the editor is built, **Apply** opens the editor with the suggestion filled in and the save goes into the files, replacing patches; the live patches are written into the files in that session.

### 6.12 Hands-free step advance
Kids have messy hands mid-cook, and the main kitchen device is likely an Android phone propped on the counter.
- **On hold** (owner, 2026-10-22):
  - **Tap zone:** the whole lower half of a cook-mode step advances, so a knuckle or wrist works.
  - **Page-turner remote:** a Bluetooth page-turner (the kind musicians use) acts as a keyboard, so cook mode treats its keys (arrows, Page Up/Down, Space, Enter) as Next and Back. It works offline, with no mic.
- **Voice — Requirement, Phase 2 (owner, 2026-10-22):** short commands: "next" (moves on and reads the new step aloud), "back," and "again" (reads the step aloud).
  - **Requirement: voice is off until a parent turns it on** for the family in family settings, behind the parent PIN. Chrome usually sends what the mic hears to Google, so it's the parent's choice.
  - Uses the browser's built-in speech recognition. **Android Chrome first.**
  - The mic button shows only where the device supports recognition, checked by feature, not by browser name. Where it's missing, nothing breaks; the on-screen buttons still work.
  - **No "switch to Chrome" prompt on iPhone or iPad.** Every iOS browser runs on Safari's engine, so Chrome there gains nothing. iPhone voice may be added later as a "try it" feature if Safari families ask for it.
  - Chrome usually sends the audio to Google to recognize it. When the connection drops, voice pauses quietly with a small "voice paused, no connection" note, and the buttons keep working.
  - Listening pauses while the app reads a step aloud, so it doesn't hear itself.
  - **A doneness step (§3) needs a tap.** On it, "next" reads the target temperature aloud instead of moving on, so a stray "next" can't skip it.

---

## 7. Content as data

Library lessons, recipes, and ingredients are **JSON files in the repo**, separate from the app code. Family recipes and the community directory (§6.10) are the exception: they live in D1. Adding lessons means adding files, not changing code. Recipe text must be written originally, not copied from published sources.

**Recipes are not required to be test-cooked.** The linter checks that content is well formed, not that a recipe works. A parent can mark a lesson **test-cooked** after cooking it (§6.2), which puts a test-kitchen stamp on that lesson for their family (§5.4). Getting started (§6.9) tells new parents that recipes may not have been cooked yet, and to read a lesson through before their kids cook it.

### 7.1 Files
```
content/
  ingredients.json        # canonical ingredient registry
  equipment.json          # tools: id, name, icon, category
  skills.json             # skill pins: id, name, pin shape
  terms.json              # kitchen words: the word, its forms, what it means, the lesson that teaches it
  cuisines.json           # passport regions, and cuisine → region
  units.json              # unit numbers and names (7 is Desserts)
  hidden.json             # lessons the owner hid from every family (§7.5)
  schema/                 # JSON Schemas for the registries and lesson files
  rules/                  # clean-species allowlist, blocked words, allowed phrases, cooking words that need a kitchen-words entry
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
  "purchaseUnit": { "label": "5-lb bag", "many": "5-lb bags", "amount": 2268 },
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
  "id": "beef-bulgogi",
  "version": 3,
  "track": "core",
  "unit": 4,
  "title": "Beef Bulgogi",
  "image": "dishes/beef-bulgogi.png",
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
    "callback": { "lesson": "french-omelet", "body": "..." },
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

### 7.4 Content linter (runs at build time, in CI, and on every save in the content editor, §7.5)
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
- a lesson with raw meat, poultry, or fish has no doneness step with a thermometer temperature. A lesson whose only raw ingredient is egg baked into a dough (cookies) may use a visual doneness check instead (owner approved)
- a step that isn't solo has no `hazard`
- a callback points to a lesson that doesn't exist
- the lesson can't be scaled and filled cleanly at every serving size it offers
- step text uses a cooking word from `rules/kitchen-words.json` that `terms.json` doesn't define yet, or two kitchen words claim the same form

The linter must **warn** (without failing the build) when:
- a lesson uses an ingredient with a `watch` note
- a lesson has no intro slides yet
- a skill is used by only one lesson, so its "other dishes" card would be empty
- a lesson reuses a skill from an earlier lesson but has no `learn.callback` (a dish in the same pick-one group doesn't count as earlier, since a family cooks only one of them)
- an ingredient or tool uses its category's fallback icon

### 7.5 The content editor — Requirement (owner, 2026-10-23; built in Phase 10)
**The owner keeps the content up to date from the browser, with no session.** Anything a session does to `content/` the owner can do in the **manager section**, and the change is written into the repo files themselves, not laid on top of them.
- **Where: the manager section at `/manage`** (owner, 2026-10-23), its own app at its own address, not part of the owner screens or the family app, with no link to it from the family app. It has its own sign-in screen and its own cookie, and **only the owner's login** opens it; every `/manage` route checks for the owner. The one way in from the family app is a fix request's **Apply in the manager** on the owner screens (§6.11).
- **What it covers: every file under `content/` except the schemas** (those change with the code).
  - **Units:** add a unit, rename one, reorder them, and remove an empty one. Units are numbered 1, 2, 3… in course order with seasonal units after them; adding, moving, or removing a unit renumbers every place a number is (units.json, course.json, and the lesson files).
  - **Lessons:** add a new lesson to any unit, blank or as a copy of another; write a planned dish; edit every part of a lesson, from a form built from the lesson schema, so a field a session adds shows up on its own; add, delete, and reorder steps, ingredients, cards, and the rest; move a lesson to another unit or another place in the course (a dish that leaves its unit leaves its pick-one group); hide a lesson from every family and unhide it (`content/hidden.json`); edit a dish card. The course entry's copies of the lesson's title, unit, cuisine, skills, picture, time, safety, and prerequisites follow the lesson; its skill line is its own wording.
  - **Registries:** ingredients, tools, skills, kitchen words, cuisines, and regions.
  - **The food rules (§2.1):** on each ingredient the owner names the animal and part it comes from (or none), and edits the clean-animal list, the animals whose fat is blocked, the allowed products, the blocked words, the allowed phrases, the leaven words, and the kitchen-word watch list. **The owner's ruling is the final word**; the scan flags things for her, and the checks hold every lesson, swap, and family recipe to what she has set.
  - **Pictures:** a dish picture is uploaded on the lesson's page, made a PNG of at most 1024 pixels wide in the browser, and saved to `content/images/dishes/`. Every lesson needs its picture before it can be saved.
- **How a save goes live.**
  1. Changes are staged in the browser (kept there across a reload) until **Review and save**. The editor runs the content linter (§7.4) as the owner types and lists anything to fix; only problems the changes bring count.
  2. On Save, the Worker runs the same checks again and refuses a save that fails, saying which rule and where.
  3. The Worker commits the changed files, in one layout (`src/content/format.js`, also `tools/format-content.js`), to the `content-edits` branch through the GitHub API with the `GITHUB_TOKEN` Worker secret. Once `main` has everything on `content-edits`, the next save starts from `main`, so a session's commits are kept.
  4. The publish workflow (`.github/workflows/content-publish.yml`) merges `main` in, rebuilds the generated files (`src/worker/library-data.js`, `content-data.js`, `public/content/`, the web copy of a new picture), runs the linter and the tests, and only if all pass pushes the result to `main`. Cloudflare Workers Builds deploys it. If anything fails, `main` is left alone and the reason is posted on the save's commit.
  5. **Saves** lists each save as **Checking**, **Publishing**, **Live**, **Failed** (with the reason), or **Replaced** (a later save changed the same files).
- **Edits are checked against the latest files.** If a file changed on GitHub since the editor opened it, Save says so and changes nothing.
- **Every save can be undone.** **Undo** on Saves puts the files a save changed back the way they were, as a new save checked like any other (the restore rule in `CLAUDE.md`). A lesson's **History** loads any earlier version of it as a staged change.
- **Versions** (§7.3): a lesson's version goes up when its steps or ingredients change. A lesson patched from a fix request before the editor existed opens with its patches on it; saving it writes them into the file at a version past the patched one, and the patches stop applying once that file is live.
- **The hard rule holds.** Nothing the editor offers turns off the §2.1 checks. An ingredient from an animal off the clean list can't be saved, nor can any lesson using one. A word the scan flags in a clean context ("turkey bacon") is cleared by adding the exact phrase to the allowed phrases.
- **Preview as a learner (owner, 2026-10-23).** From a lesson's page, or its ⋯ menu on the course, the owner opens the lesson in the real lesson player, as it stands in the editor with any unsaved changes, in either theme, as a kid or an adult. Prep doesn't need checking off, a strip jumps to any stage (lesson card, Learn, Prep, Cook, Reflect), and **nothing is saved or counted**: no cook, no reflection, no stamp, nothing on any family's progress.
- **New and moved lessons:** the owner picks the unit and the place. Lesson numbers follow from the course order (§4.1), so moving a lesson renumbers the course.
- **Course plans (owner, 2026-10-23).** A new lesson joins every family's existing course plans at its place in the order, included (checked), as well as the suggested order. A hidden lesson comes out of every course plan as well as the library; unhiding it puts it back. Its lesson file is still built, so a cook already started on it still opens.
- **Not covered:** the app's code. A new kind of field, screen, or feature still needs a session; a new lesson, unit, ingredient, rule, or picture never does.
- **Owner setup, in a browser, before it can save:** a fine-grained GitHub token with Contents read and write and Actions read on this repository, pasted into the Worker as the `GITHUB_TOKEN` secret on the Cloudflare dashboard, and **Apply pending** pressed on `/ops` (steps in `docs/setup.md`). `/ops` shows whether GitHub is connected.

### 6.13 Website and legal pages — Requirement (owner, 2026-10-22)
The app lives at **`cleanplate.immotus.app`**, and its front door is a simple public website.
- **Landing page** at `/` for anyone not logged in: what the app is in a few lines (a cooking course for kids, one skill and one real dish per lesson, with biblically clean recipes), a few dish pictures, and **Sign up** and **Log in**. A logged-in device goes straight to the chef's lockers, or, on a kid login (§8.3a), straight to that kid's kitchen.
- **Publisher: Immotus Apps** (owner, 2026-10-22). The landing page, the demo page, and the privacy policy and terms name it as the publisher.
- **Privacy policy** (`/privacy`) and **terms of use** (`/terms`), short and plain, linked from the landing page and the sign-up page. Sign-up says "By signing up you agree to the terms and privacy policy."
- The words are the owner's. Claude drafts them from the points below, and the owner approves or rewrites them before launch. **They aren't legal advice**, and the owner should have someone qualified read them.
- **What the privacy policy covers** (what's true of the app as built):
  - What's stored: parent emails, hashed passwords and PIN, the family name, profile names and avatar colors, theme, diet settings, what each profile has cooked, ratings and reflections, and photos.
  - Kids don't have email accounts. A parent makes each profile and chooses its name; first names or nicknames are enough. A parent can give a kid profile a login: first name, last initial, a cooking picture, and a password (§8.3a); the password is stored hashed, and no email or other contact detail is asked for.
  - Who sees it: only the family. The owner sees family names, profile counts, and last-active dates, and nothing else.
  - No ads, no selling or sharing of data, no tracking or analytics scripts.
  - Photos are kept only for families the owner has turned them on for.
  - Services that handle it: Cloudflare (hosting, database, photos) and Resend (email).
  - How long it's kept: until the family deletes it, or a year after the family was last active (§6.14).
- **What the terms cover:** the app is free and offered as-is; recipes may not have been test-cooked (§7), so a parent reads a lesson before kids cook it; adults decide supervision, using the safety banners as a guide (§3); families are responsible for their own allergies, and diet filters are a help, not a guarantee; the owner may remove an account that misuses the app.
- **Recommendation: serve the fonts from the app itself** instead of Google Fonts, so the "no third parties beyond Cloudflare and Resend" line in the privacy policy is true. Today every page load asks Google for the fonts.

### 6.14 Leaving, and inactive accounts — Requirement (owner, 2026-10-22)
- **Delete our family (self-serve).** In family settings, behind the parent PIN and the account password. It deletes the family, every parent login, every profile, all progress, and all photos. Next to it is **Download our data** (everything about the family, photos included), offered before deleting.
- **Inactive accounts purge automatically.** A family whose parents haven't used the app for a year (`families.last_active_at`, which any use of a logged-in device refreshes) is deleted the same way. A scheduled job in the Worker checks every couple of weeks, so "a year" is approximate, and the app never promises an exact date. Cloudflare runs the job, so nothing is set up by hand.
- **Requirement (owner, 2026-10-22):** email every parent in the family 30 days and 7 days before an inactive purge ("log in once to keep your account"). Logging in cancels it.
- **Requirement (owner, 2026-10-22): a 30-day grace period** after a self-serve delete. The family disappears at once (no login, nothing shown to anyone), and the rows and photos are erased after 30 days. During those 30 days the owner can restore it from `/ops` if a parent asks, which keeps the rule that a destructive action has a restore. The privacy policy says so.
- Removing a family from `/ops` (§8.5) stays as it is.
- **Built 2026-10-23** (owner: during the beta): Delete our family and Download our data in family settings, the grace period, Bring back on `/ops`, and the daily erase job. The owner's own family can't be deleted from the app (it holds the owner screens); Remove on `/ops` still can. Photos aren't built yet, so there are none to download or erase. The inactive purge and its warning emails are not built yet.

### 6.15 Print our progress — Requirement (owner, 2026-10-22)
A printable record of what each profile has cooked, for homeschool records.
- In the parent area. Pick one profile or all of them.
- One table per profile, with the profile name at the top: **date, dish, cuisine, skill, and rating** for every lesson that profile has cooked, oldest first.
- Made as a page styled for paper, printed from the browser (or saved as PDF from the print dialog). It needs no extra software.
- **Didn't make it** (owner, 2026-10-23: kids will do a test run on the couch): each row has a button, parents only, that takes back a cook a kid marked done but didn't make. It comes off for everyone on that cook: it doesn't finish a lesson, earn a stamp, pin, rank, or skill, or show on Print our progress, and the queued lesson it closed goes back on the queue. It shows an Undo, which puts it back as it was. Not on paper or in the CSV.
- **The same rows as a CSV download** (owner, 2026-10-22), which also answers the "CSV export to the homeschool management system" item in Later (§9).
- **Homeschool transcript — Requirement (owner, 2026-10-22: "a GREAT idea"; specced 2026-10-23).** A printable course record per profile, homeschool mode only, built on the same rows.
  - **Details**, per profile, set on the transcript page: student name (the profile's name if blank), course name and code, school year, and optional From and To dates to cover one school year. The homeschool's own name is one per family and prints at the top. "Clean Plate Recipes, published by Immotus Apps" prints as the curriculum.
  - **What's on it** (owner, 2026-10-23): everything cooked that counts, so course lessons, extra lessons, and family recipes, but nothing cooked on the Sabbath (§6.18). Each row: date, dish, cuisine, skill, hours (the lesson's time), and grade. Then the skills, the lessons cooked, and the total hours.
  - **Final grade and credit** (owner, 2026-10-23): the app shows the parent the rubric average of the cooks graded with the rubric, and the total hours, on screen only; the parent types the final grade and the credit, or leaves them off.
- **Grading** (owner, 2026-10-23), homeschool mode, parents only: the rubric (§6.17, each row 1–4), a grade in the parent's own words (anything: "A-", "92", "Excellent"), or both. Graded from a **Grades** page listing cooks still waiting for a grade, and from a Grade button on each Progress row (not printed). Nothing is graded on the Sabbath, and a Sabbath cook can't be graded on another day. Built 2026-10-23.

### 6.16 Demo page — Requirement (owner, 2026-10-22)
A public page at **`/demo`** that the owner shares with other moms: no account, no beta word, and nothing saved to any account. It runs the real lesson player, so what moms try is what kids get.
- **Header:** the logo, two or three lines on what the app is (Claude drafts, the owner approves, as with §6.13), "by Immotus Apps", and **Sign up**. Sign-up still asks for the beta word while one is set.
- **Theme switch:** Kitchen Quest or Chef's Passport. Everything below redraws in the chosen theme.
- **Kid or adult switch:** shows how the safety banners read for each (§3).
- **The sample lessons** (owner, 2026-10-22): the four samples, plus the three julienne lessons (1a–1c) under "Pick one" to show a foundation skill's choices. Lessons written later don't join the demo unless the owner asks. Each is a card that opens the full player: lesson card and serving picker, Learn, Prep, Cook, timers, kitchen words, Why? cards. Progress stays on that device only.
- **Diet preview:** tick filters (dairy-free, gluten-free, and the rest of the diet tags, §2.1) and the sample lessons swap ingredients, leave out optional ones, or drop out, the same as for a real family.
- **Shopping preview:** the real shopping flow (§6.3) with the sample lessons as a pretend family's next few weeks, drawn as the parent screen (§5.7): What you'll need by week, How many lessons, the I-have-this preview, and the list, rounded to store packages. A few pretend kitchen staples show "May already have". Check-offs work but aren't kept; nothing is saved.
- **The whole course:** all 75 planned dishes, by unit, each with its cuisine and skill, marking the ones that can be tried now, like the printed recipe book.
- **Skills view:** the same course shown as its unique skills instead of its dishes. Each skill lists the dish that first teaches it and the later dishes that practice it, and marks foundation skills and their pick-one groups (§4.0).
- **Course data:** the course list and each dish's skills come from one content file, `content/course.json` (number, dish, unit, cuisine, skill ids, the skill line, and its picture), checked by the linter against `skills.json` and the lesson files. Today the 75 dishes live only in the plan's tables (§4), and only the written lessons have skill ids, so this file is written for the demo: a skill id for every planned dish, with any new ids added to `skills.json`. As lessons are written (Phase 7), their files must match it.

### 6.17 Homeschool mode and the syllabus — Requirement (owner, 2026-10-22)
Families use the app one of two ways, and the parent picks in family settings (behind the PIN). It can be changed at any time, and switching modes never deletes anything.
- **Casual mode** (the default): the app as described everywhere else. No due dates, no grades, no transcript.
- **Homeschool mode** adds, for the parent only:
  - **A course plan with a weekly schedule** (§6.18) for every profile, always on. The parent sets the whole course up once.
  - **Course details:** course name and code, and school year. These feed the transcript (§6.15).
  - **Due dates:** a lesson's week in the schedule is its due date. The queue shows what's due this week and what's overdue. Kids see "due Friday" on the lesson card. **Overdue shows only to the parent** (owner, 2026-10-22); kids see nothing about being late.
  - **Optional grading:** after a cook, the parent can grade it with the rubric (owner, 2026-10-22: skill shown, safety and cleanliness, following the recipe, the result, and the reflection, each scored 1–4), give a single grade, or leave it ungraded. Grades roll up per profile and print on the transcript. **Grades are parent-only** (owner, 2026-10-22): kids never see them.
- **Lessons outside the course** can still be queued by hand or requested. They count as cooked, and don't move the schedule.
- **Syllabus page:** a public page, linked from the landing page and the demo page as **"Using this as a homeschool course? Review our syllabus."** It's built from `content/course.json` (§6.16) so it stays current as lessons are written, and prints cleanly. It covers:
  - the course description and who it's for (ages 10 and up with some kitchen experience; the beginner track comes later, §11)
  - learning objectives: knife work, heat control, building flavor, doughs and batters, food safety, and reading and following a recipe
  - the units, each with its skills and dishes, and the foundation skills with their pick-one lessons
  - estimated hours and pacing options, e.g. one lesson a week across a school year. **Hours count only what a learner is expected to cook** (owner, 2026-10-22): one student's path (59 lessons, §4.1), with each pick-one group counted once at its dishes' average time. The Appointed Times unit (§6.19) is optional, so it's listed in its own section and left out of the hours and credit
  - **a suggested credit value** (owner, 2026-10-22), worked out from those hours once `content/course.json` has every lesson's time. The common rule of thumb is about 120–180 hours of work for one credit, so the full course likely suggests half a credit; the syllabus shows the hours it's based on, and says the family decides
  - materials: the core tools, and that each lesson lists its own shopping
  - safety: the safety levels and adult supervision (§3)
  - how it can be assessed: the rubric above, the reflection questions, and the transcript
  - the food rules (§2.1) in one plain line, and "published by Immotus Apps"

### 6.18 Course plans and the weekly schedule — Requirement (owner, 2026-10-22)
Set the whole course up once, and the app loads each week's lessons. Always on in homeschool mode. In casual mode it's optional: **Plan our weeks** in family settings, off by default.
- **Setting up a course:** pick the profiles it's for (one or more; siblings can share a course or each have their own), the dishes and their order (starting from the suggested order, §4.1, with one dish ticked in each pick-one group by default; a parent can tick more than one, and each one ticked is scheduled), a start date, and lessons per week. Foundations first (§4.0) is a note, not a block. The setup shows the planned finish date.
- **Weeks run Sunday to Friday; Saturday is the Sabbath** (owner, 2026-10-22), for every family. Nothing is scheduled or due on Saturday. Each week's lessons join the queue on its Sunday (owner, 2026-10-22); a parent sees the weeks ahead in What you'll need (§6.3) and on the course's plan.
- **On the Sabbath** (owner, 2026-10-22), opening the app shows a banner on the lockers, the kitchen, and the parent screens: "Shabbat shalom! While you're welcome to follow the recipe, please note that grading and due dates are not available on the Sabbath. We hope your family enjoys the rest!" Due dates and overdue are hidden that day, and grading (Phase 4b) won't be offered. The Sabbath is Saturday by the device's own calendar, midnight to midnight.
- **Nothing cooked or graded on the Sabbath counts** (owner, 2026-10-22), for any lesson or recipe. A cook finished on Saturday is still saved with its reflection, but it doesn't finish a course lesson, close a queued one, earn a stamp, pin, rank, or skill, or show on Print our progress or the transcript, and it can't be graded on another day. The lesson stays up next, to cook on another day.
- **The schedule is worked out, not stored.** Each week holds the next unfinished lessons in the plan, at the course's pace. A lesson is finished when a cook of it is finished with any of the course's profiles on it.
- **Rollover (owner, 2026-10-22): everything shifts.** A lesson not cooked by the end of its week goes first the next week, and every later lesson moves back a week. The parent sees the planned finish and how far behind it is ("2 weeks behind"); kids don't.
- **Cooking ahead is fine.** A lesson cooked early counts, and the rest of the schedule moves up.
- **A kid cooking off their list needs an adult — Requirement (owner, 2026-10-23).** On a kid profile, a lesson that isn't on their list is flagged as early (later on their path) or off their path, and starting it asks for the parent PIN. The parent picks **Add as an additional assigned meal** or **Replace an assigned meal**, and a request approved on the Queue screen offers the same two choices. Neither pushes the assigned lessons back: an extra counts as done without taking a week's place, and a replaced course lesson goes first next week, as with a swap (§6.19). Adult profiles aren't asked.
- **Skip this week**, for breaks and vacations, pushes everything back a week. A skipped week can be put back.
- **Skip this recipe** (owner, 2026-10-22), one tap for a parent on a lesson in this week: the lesson comes out of the course plan, and the next unfinished lesson takes its place this week. It shows an Undo, and a skipped lesson can be put back from the plan at any time. Skipping a lesson another one builds on shows the prerequisite note (§4.1).
- **Cook another recipe** (owner, 2026-10-22), one tap for a parent: pulls the next unfinished lesson into this week as an extra, for this week only. If it's cooked, the rest of the schedule moves up, as with cooking ahead. If it isn't, it goes back to its place, isn't overdue, and nothing shifts.
- **Changing the plan mid-course** (reorder, remove, add back, change the pace or start date) recomputes the weeks. Cooks already done stay done.
- A course's lessons are queued for all its profiles together, as one cook (§1). A profile can be on only one course at a time.
- **A lesson's due day is the Friday of its week** (owner, 2026-10-22; shown to kids in homeschool mode as "due Friday"); it isn't overdue until the week is over.
- Only lessons a family can cook are scheduled: written, kept in the plan, and not hidden by its diet settings. The rest join the schedule when they can be cooked, and the parent sees how many are waiting.
- **Ending a course** takes its lessons not yet shopped for out of the queue. An ended course can be put back from Courses.
- Switching modes never deletes a course. Turning off Plan our weeks in casual mode keeps the plan and stops loading weeks; the lessons already in the queue stay.

### 6.19 Appointed Times — Requirement (owner, 2026-10-22)
A seasonal unit for the appointed times, and a way to swap an Appointed Time meal into any week. **Its recipes can be for any of the Levitical holy days** (Leviticus 23: Passover and Unleavened Bread, Firstfruits, Shavuot, Trumpets, the Day of Atonement, Tabernacles; owner, 2026-10-22), though most will likely be for Unleavened Bread.
- **For every family** (owner, 2026-10-22). This is a niche app for families with these beliefs, and none of its religious elements (the unit, the swap, the Sabbath rules in §6.18) can be turned off.
- **It counts like any other cook** (owner, 2026-10-22): toward progress, ranks, skills, Print our progress, grades, and the transcript, except anything cooked or graded on the Sabbath, which never counts (§6.18).
- **The Appointed Times unit** sits beside the numbered course, like the capstone (§4). Its lessons aren't in the numbered course and don't move a family's numbers ("Quest 27 of 59" stays the same). **They're labeled A1, A2, and so on** (owner, 2026-10-22), in the order `content/units.json` lists them. It holds lessons we write (written so far: A1 unleavened flatbread and A2 cottage cheese crescent rolls (owner, 2026-10-22); ideas for more: roast lamb, a bitter-herbs salad, charoset, matzah ball soup, flourless chocolate cake, coconut macaroons) and a **User-shared recipes** shelf of recipes families share (below, §6.10): in the kitchen, the feast-day recipes other families shared, cooked straight from the directory (owner, 2026-10-23). In the queue and on cooks, one is `shared:<id>`. Unit lessons follow every rule other lessons do: the hard block (§2.1), diet filters, food-safety checks, and a Learn stage, which can say why the dish belongs to the feast.
- **Leaven** (owner, 2026-10-22: "a substance (as yeast) used to produce fermentation in dough or a liquid; especially sourdough; a material (as baking powder) used to produce a gas that lightens dough or batter"). An automatic check flags: yeast in every form and sourdough starter; baking powder, baking soda, baker's ammonia, and self-rising flour; and ready-made foods that usually contain leaven (bread, breadcrumbs, panko, pita, flour tortillas, most crackers, cake mixes). Plain flour, matzah, and egg whites whipped for lift aren't leaven, and neither are fermented foods and drinks that aren't a raising agent (owner, 2026-10-22): beer, soy sauce, vinegar of any kind, Worcestershire, and miso. Ready-made foods that are sometimes made without leaven are flagged anyway; a parent can send one for review. The list is a content file beside the blocked words (`content/rules/`). The check reads the ingredients and the step text, the way the blocked-word scan does (owner, 2026-10-22), so "a pinch of baking soda" in a step is caught. Leaven is a badge and a filter, not the hard block: no setting or review ever lets unclean food through (§2.1), but leaven is only about where a recipe shows.
- **Badges:**
  - **Unleavened:** applied automatically when every ingredient is in the registry and none is on the leaven list. A recipe with a typed-in ingredient doesn't get it unless a review clears it. Library lessons are checked the same way.
  - **Good for Feast Days:** applied when a parent shares a recipe as a feast-day recipe (roast lamb, for example). Every Appointed Times lesson has it, and **the owner can mark any course lesson Good for Feast Days** (owner, 2026-10-23), with a checkbox on the lesson's dish card in the content editor (§7.5). A recipe can carry both.
  - **Where they show** (owner, 2026-10-23): the kitchen's lesson and recipe cards, the dish card, the Swap picker, My recipes, and the User-shared recipes directory.
- **Swap for an Appointed Time meal instead:** an item in the "⋯" menu of every queued lesson, all year, parents only. It's kept out of the way: no button on the card. It opens a picker, and the meal picked takes that lesson's place this week.
  - A course lesson it replaces stays in the plan and goes first next week, and the rest move back a week (§6.18). **A swap never counts as behind** (owner, 2026-10-22): the parent approved it, so the planned finish moves back with it, the way Skip this week moves it, and nobody is shown as late. A lesson queued by hand is taken off the queue. Either way the swap shows an Undo.
  - **During the family's unleavened days** (§6.20; until that's built, February 1 through May 15, fixed every year): the picker shows only Unleavened recipes, in this order: the Appointed Times unit's lessons, then other library lessons that pass the leaven check, then parent recipes that pass it. It goes by the week being swapped, not the day the parent opens the picker (recommendation): a week that touches any unleavened day is unleavened-only.
  - **The rest of the year:** everything shows: the Appointed Times unit's lessons, then the course lessons marked Good for Feast Days, then every Good for Feast Days recipe, unleavened or not.
  - **Parent recipes in the picker are the whole community directory** (owner, 2026-10-22), plus the family's own recipes, with the family's diet filters applied. Hidden directory recipes never show. Picking a directory recipe adds it to the family's recipes (recommendation).
- **Placeholder art by meal type.** A shared recipe always shows a drawing for its meal type (§6.10): meat, poultry, fish, bread or flatbread, soup, salad or vegetables, side, dessert, drink. Claude draws them as SVG (`content/images/meals/`), one set for both themes. A unit lesson uses one until the owner makes its dish art.
- **Sharing a recipe** follows the routine in §6.10, the same for every recipe, Appointed Times or not.

### 6.20 Unleavened Bread dates — Requirement (owner, 2026-10-23)
The fixed February 1 to May 15 window (§6.19) is replaced by **each family's own dates**, because families keep different calendars and the feast moves by weeks from year to year.
- **Every family keeps Unleavened Bread** (owner, 2026-10-23). There is no "we don't observe it" answer, and nothing turns the unleavened rules off.
- **What's asked: the first day of Unleavened Bread** for the year. The app works out the seven days (Leviticus 23:6, the 15th to the 21st) from it.
- **One or two standard calendars, then deviations** (owner, 2026-10-23). A family picks a standard calendar, sees its dates for the year, and confirms them or changes the first day to its own. The standard calendars' dates are a content file (`content/calendars.json`: each calendar's name and its first day of Unleavened Bread by year), edited in the content editor (§7.5), so the owner adds next years' dates from the browser. **Which calendars** is the owner's to name (§10).
- **When the house goes unleavened is asked too** (owner, 2026-10-23): some families have cleared out their leaven before the feast, others are using it up. The question is "When should we stop suggesting leavened recipes?": **on the first day of the feast**, or **from a date we pick** (any day before it). The family's **unleavened days** run from that day to the last day of the feast.
  - **Recommendation: a "use it up" nudge.** In the two weeks before a family's unleavened days, Chef Ruth offers recipes that use up leaven (yeast, baking powder, bread) when a parent swaps or adds a lesson. It never changes the schedule on its own.
- **Where it's asked:** in Getting started, right after allergies and diet (§6.9), and in Family settings. **Every year again** (recommendation: from January 1), as one of Chef Ruth's tasks: "When will your family keep Unleavened Bread this year?" Until it's answered, the family's calendar's dates are used, with a note on the queue asking the parent to confirm. A family's first year uses the first standard calendar until it picks.
- **What the unleavened days change:**
  - **Swap:** a week that touches an unleavened day offers Unleavened recipes only (§6.19).
  - **The schedule** (§6.18, and the Levels, §12): **recommendation:** a leavened lesson isn't scheduled on an unleavened day. The schedule passes it over to the first week after the feast and fills its place with the next lesson that's unleavened, the way a swap moves a lesson, so it never counts as behind. A leavened lesson already in the queue is flagged on the Queue with a one-tap unleavened swap.
  - **The kitchen** (recommendation): a banner on the unleavened days, like the Sabbath's; leavened lessons show "After Unleavened Bread", and starting one asks for the parent PIN, like cooking off the path (§6.18).
  - **Level 3 setup:** a Level course whose bread weeks would land on the unleavened days says so when it's set up (§12).
- **Stored** in a new table, `unleavened_dates` (§8.4), created by the next release's draft migration (§8.6); nothing to set up by hand.

### 6.21 Family tastes, variations, and the recipe pool — Requirement (owner, 2026-10-23; revised 2026-10-24)
Each person rates what they love and hate, the app picks the best dish or **variation** for the people cooking it, and where nothing scores well tells the owner which recipe to write next. **"We can always add more recipes"** (owner, 2026-10-23): a gap is fixed by writing a variation or a dish, not by ignoring what people said.

**Ratings, not yes or no** (owner, 2026-10-24).
- **Five stars, per profile** (owner, 2026-10-24). Each item is rated **5 stars (absolute favorite), 4 (love), 3 (like), 2 (okay), 1 (hate)**, or **Haven't tried**. A shared profile rates as one.
  - **One absolute favorite** (owner, 2026-10-24): a profile has at most one 5-star item in each list (proteins, flavors, ingredients). Giving another item 5 stars asks to move the old favorite to 4.
- **No country list** (owner, 2026-10-24): many people have never tried a cuisine, so they can't say whether they like it. Families rate **flavors**, each shown with example dishes, and cuisines are learned from what they cook (below).
- **Who answers** (recommendation): a parent rates for any profile in Our tastes; a kid profile can also take a short taste quiz in its own kitchen, drawn in its theme. Either can change it later.

**What's rated** (Claude's draft, owner, 2026-10-24: "draft the lists"; the owner edits them). The lists are a content file, `content/tastes.json` (§8.6), edited in the content editor.
- **Proteins (10):** chicken, turkey, beef, lamb, white fish (cod, tilapia), salmon, tuna, eggs, beans and lentils, tofu.
- **Flavors (11), each with example dishes** (owner, 2026-10-24: common dishes that show the flavor, whether or not the app has a recipe for them; every example is one that's normally made without unclean food, §2.1):

| Flavor | Example dishes |
|---|---|
| **Warm, earthy spices** (cumin, coriander, turmeric) | chicken tikka masala, chana masala, beef kofta, chili con carne |
| **Chili heat** | buffalo chicken wings, Nashville hot chicken, spicy salsa, jalapeño poppers |
| **Ginger, garlic, and soy** | teriyaki chicken, beef and broccoli, chicken fried rice, lo mein |
| **Herby and lemony** | Greek lemon chicken, tabbouleh, chimichurri steak, pesto pasta |
| **Smoky and barbecue** | beef brisket, barbecue chicken, smoked-paprika chicken, chipotle beef tacos |
| **Creamy and cheesy** | mac and cheese, fettuccine Alfredo, chicken pot pie, cream of tomato soup |
| **Tangy and pickled** | dill pickles, vinegar coleslaw, Greek salad with feta, sauerbraten |
| **Sweet and savory** | honey-garlic chicken, sweet-and-sour chicken, orange chicken, chicken tagine with apricots |
| **Rich tomato** | spaghetti and meatballs, shakshuka, beef lasagna, tomato soup |
| **Coconut and tropical** | chicken coconut curry, coconut rice, jerk chicken with mango salsa |
| **Mild and buttery** | roast chicken and potatoes, buttered noodles, chicken noodle soup, mashed potatoes |


  "Mild and buttery" is there so a profile that likes plain food can say so.
- **Key ingredients (38),** the ones people have opinions on. Each lists the registry ingredients it covers (§7.2), so the app can tell which dishes use it; some have none yet and match once their ingredients are added: mushrooms, olives, cilantro, mint, raw onion, garlic, ginger, fresh tomato, bell peppers, hot peppers (jalapeño), eggplant, zucchini, spinach and leafy greens, cabbage and coleslaw, avocado, cucumber, radish, peas, corn, sweet potato, chickpeas, coconut, peanuts and peanut butter, sesame, feta and tangy cheeses, cottage cheese, sour cream and yogurt, mayonnaise, mustard, pickles, capers, raisins and dried fruit in savory food, cinnamon in savory food, fish sauce and anchovy, lemon and lime.
- **Limits, per family** (asked once, not starred): time on a cooking night (30, 45, 60 minutes, or no limit), budget per serving ($ under $3, $$ $3–6, $$$ over $6; recommendation), tools we don't have (food processor, blender, stand mixer, Dutch oven, cast iron, and other non-basic equipment), and **how adventurous** (stick to the familiar, a bit, bring it on), which decides how "Haven't tried" counts.

**Scoring** (recommendation). For the profiles on a cook (a course's profiles, or whoever a lesson is queued for):
- A version of a dish is **ruled out** if anyone on the cook rates its main protein or a required ingredient 1 star (an optional one that's hated is left out instead, as with diet filters, §2.1), or if it breaks a family limit.
- The rest are **scored** from everyone's stars for its protein, its key ingredients, and its flavors: an absolute favorite raises it most, then love and like; okay is neutral; Haven't tried is a small plus for an adventurous family and a small minus for a familiar one.
- **Learned over time:** each cook's Reflect rating and eater rating (§3) nudge the scores of its flavors, protein, and cuisine for those profiles. Cuisines are never asked; they're only learned.
- **A skill is never skipped.** When everything that teaches a needed skill is ruled out, the best-scoring one is offered with a short note ("Nothing for julienne fits everyone yet; this one is closest"), and the gap is counted (below).
- **The hard rule comes first.** Only dishes that pass the unclean-food block (§2.1) and the family's diet filters are ever scored.

**Variations — Requirement (owner, 2026-10-24): real versions of a recipe, not "use this instead".**
- A **variation** is a complete version of a lesson with the preference built in: its protein, amounts, timing, doneness target (chicken 165°F where the beef was 145°F), steps, equipment, title, and shopping list all change together. "Chimichurri chicken" is a variation of Chimichurri steak.
- **Same lesson** (owner, 2026-10-24): it teaches the same skill and counts as that lesson in progress, ranks, grades, and the transcript, shown as "Chimichurri chicken (a version of Chimichurri steak)". Its own Learn cards can differ where the food science does.
- **Each variation is tagged and scored** like a dish. The best one for the people cooking is picked by default; a parent sees the others and can choose.
- **Each variation is checked as a whole lesson** by the linter (§7.4): the hard block, food safety (doneness targets, wash-hands steps), the leaven check and badges (§6.19), and diet filters. A variation can't get past a rule its lesson follows.
- **Stored as changes on its lesson** (recommendation): in the lesson file, `variations` lists each one's id, title, tags, and what differs (ingredients, steps, equipment, times, Learn cards). A fix to a step they share reaches every variation. In the content editor (§7.5), **+ Add a variation** opens a copy of the lesson to change.
- **Substitutions stay for now** (§2.1). Common ones (a dairy-free mac and cheese) become variations over time.

**Tags on every dish and variation** — the shared vocabulary between ratings, picks, and gaps.
- **Where they live:** beside the dish card, on each dish's `course.json` entry (so all 75 are tagged, written or not), or on the lesson for a seasonal lesson (§6.19), as `tags`.
- **Set by the owner:** `protein` (one of the proteins, or `none` for a side, bread, or dessert), `flavors` (1 to 3), `heat` (mild, some, spicy), `budget` ($, $$, $$$), and `familiar` (everyday, new-ish, adventurous). Claude drafted all 77 (owner, 2026-10-24: "go"); the owner reviews them on the **Tags** page in the content editor, or on each dish card.
- **Worked out from a written lesson:** its key ingredients (required and optional, from `tastes.json`), cuisine, time, and equipment. Its protein tag is checked against its first meat or fish: a mismatch is a warning, since it can be on purpose (eggs Benedict is eggs, with turkey on top).
- **The linter** refuses a tag that isn't in the lists, more than 3 flavors, a taste item naming an ingredient that isn't in the registry, and any taste name or example dish with a blocked word (§2.1); it warns about dishes missing tags.
- **Built (2026-10-24), slice 11a.** Nothing in it is shown to families.

**New recipes tie to the teaching** (owner, 2026-10-23). Every recipe or variation added is written for a named skill: a Level week (§12) or a Cook Around the World pick-one group. No recipe is added just to be a recipe.

**Recipe gaps** (owner, 2026-10-23: "build data collection tools to drive it"), a page in the owner screens (§6.2a), counts only, no family named:
- **Slots:** each pick-one group, and each Level week once phase 12 is built.
- **Gaps:** for each slot, how many families have nothing that fits, or whose best fit scores low, and why ("Julienne: 5 families. Beef 1 star: 3; mushrooms 1 star: 2").
- **Write next:** the variation or new dish that would help the most of them, with its target tags ("a chicken variation of Chimichurri steak"; "a new julienne dish: chicken or beans, ginger-garlic-soy or herby, mild, under 45 minutes, $"). A variation is suggested first when one protein or ingredient is the problem. One tap opens it in the content editor with the skill and tags filled in.
- **Coverage,** before many families have rated: a grid of skills against protein, flavor, and heat, showing thin spots.
- **What people cook:** dishes and variations most swapped out, skipped, or rated low, and average stars by flavor.

**Privacy:** ratings are a family's data, removed with the family (§6.14) and included in Download our data. The privacy policy (§6.13) says the owner sees the counts above, never which family.

**Stored** in new tables (§8.4), from the next release's draft migration (§8.6).

---

## 8. Architecture

### 8.1 Hosting — Recommendation
- Use the owner's existing **git → Cloudflare** deploy stack: a **Worker** serving the app and API, **D1** for structured data, and **R2** for photos. R2 isn't needed until the owner turns photos on for a family (§2.6), so its bucket is set up then, not before.
- Own subdomain: **`cleanplate.immotus.app`** (owner, 2026-10-22). This app is not a game, so it stays separate from the `games.immotus.app` hub.

A backend is needed because the app is multi-family: each family's progress, queue, and photos must be stored per family and reachable from any of that family's devices.

### 8.2 Front end — Recommendation
- Build it as an installable **PWA** (owner, 2026-10-22: the kid app becomes one), and cache the active lesson so a Wi-Fi drop mid-recipe doesn't break cook mode.
- The framework choice is open: Vite with a lightweight component framework, or plain web components. Use CSS custom properties for theme tokens. CSS animations are fine for most motion; use an animation library only for complex sequences (stamp slam, rank up).
- **Offline beyond reading:** the active lesson, the current shopping trip, check-offs, attempt progress, and photos waiting to upload are all stored on the device and synced when the connection returns.

**Platform limits to design around (mostly iOS):**
- **Timers:** iOS pauses a web app's code when it's in the background or the screen locks. Timers store their end time and compare against the clock, so they show the right time when the app comes back. A ding can't play while the app isn't on screen, so cook mode keeps the screen awake, and the timer strip shows "ended 2 min ago" if one finished while the app was hidden.
- **Sound:** iOS blocks audio until the user taps something. The first tap in a cook session unlocks sound.
- **Wake Lock:** older iOS versions don't support it in an installed app. Where it's missing, cook mode shows a one-time tip to raise the device's auto-lock time.

### 8.3 Accounts and access (basic, per §2.5) — Recommendation
- **Open sign-up, verified by email — Requirement (owner, 2026-10-22).** Families join on their own, like any website; the owner doesn't invite or approve anyone.
  - Sign up asks for an email and a password. A six-digit code is emailed to that address through Resend, and entering it creates the family. The code works for 30 minutes and allows 5 tries.
  - The code screen says "We sent a code to …" and "Don't see it? Check your spam folder, or request a new one in 9:59", counting down 10 minutes before a new code can be sent.
  - The family's name and parent PIN are set in the first run, right after.
  - **Beta word:** while testing in the wild, the owner can set a word that sign-up asks for before any email is sent. She can change it or turn it off at any time; off means fully open.
  - **Planned (Phase 1c or later):** a human check before the email is sent (a "capture thing" or an unscramble-the-letters puzzle). Cloudflare Turnstile is the likely fit: free, and set up in the Cloudflare dashboard.
- **Parent login:** email and password. Store passwords hashed with a standard algorithm (PBKDF2 via Web Crypto is available in Workers). Sessions use a long-lived, httpOnly cookie, so kitchen devices stay logged in.
  - **Password reset by email,** sent through **Resend**. "Forgot password" emails a one-time link that expires after an hour. The owner can also set a new password from the owner screens (§6.2a) as a fallback.
  - **Not included, on purpose:** two-factor login, and rate limiting beyond the platform defaults and the 10-minute wait between codes.
  - **Revisit if:** sign-ups are abused (strangers' addresses used to send codes); the human check above is the first answer.
- **Family devices:** a device logged in as a parent shows the profile picker (chef lockers), as now.
- **Kid logins** (§8.3a): a kid profile can also have its own login (first name and last initial, a cooking picture, and a password), set by a parent. A device logged in that way opens only that kid's kitchen.
- **Parent PIN: required,** one per family, set during the first run (§6.9). Kitchen devices are logged in as a parent, so every parent-only screen asks for the PIN, including approving a kid's lesson request. Stored as a hash. It's a convenience lock, not a security boundary.
  - **It locks on its own (owner, 2026-10-23)** when a parent leaves the parent screens (to the lockers, a kitchen, anywhere else), and when the app opens anywhere else while it's still unlocked (a tab closed on a parent screen). Not during Getting started. There's no Lock button.
  - A forgotten PIN is reset by a parent entering their account password.
- **Family scoping:** every API query filters by the logged-in session's `family_id`. No endpoint accepts a family ID from the client.
  - **The one exception** is the owner's endpoints (§6.2a). They're open only to a parent with `is_owner`, and they return family names, kid counts, and last-active dates. Nothing else.
- **Photos:** stored in R2 under `families/{family_id}/…`, served only through the Worker after checking the session's family. R2 is not exposed publicly.

### 8.3a Kid logins — Requirement (owner, 2026-10-23)
**What the owner asked for** (Requirement):
- A kid can have their own login, **set up by a parent**: their **first name and last initial**, **a cooking picture** picked from 30, and **a password** of at least 6 characters (owner, 2026-10-23; no usernames to make up, as a big homeschool curriculum provider does it).
- A kid login has **no chef's lockers and no parent screens**. It goes straight to that kid's kitchen.
- **Kid profiles only.** Adult learners keep using the lockers on a parent login.
- **Logging out on a kid's device doesn't need the PIN.**
- **Parent and adult logins work as they do now:** email and password, the lockers, the parent PIN, and the parent screens.

**How it works** (Recommendation unless marked; ask the owner before building to anything not confirmed):
- **Optional, per profile.** A family that keeps using one parent-logged-in device with the lockers changes nothing. A kid login is something a parent adds to a profile.
- **Kid profiles only** (Requirement), a shared profile with a kid on it included; one login per profile, so the kids sharing it share the login. Changing a profile to adult turns its login off.
- **The login name:** a first name and one last initial, shown as "Ava C". Letters, spaces, hyphens, and apostrophes in the first name, 1 to 20 characters; the initial is one letter. Matching ignores case, spaces, and periods, so "Ava C", "ava c.", and "AvaC" are the same.
- **The login picture** (owner, 2026-10-23): one of 30 cooking pictures, each with an id and a name, drawn in the app's style and clean by §2.1: `whisk`, `frying-pan`, `stock-pot`, `wooden-spoon`, `rolling-pin`, `oven-mitt`, `chef-hat`, `measuring-cup`, `mixing-bowl`, `teapot`, `apple`, `carrot`, `egg`, `cheese`, `bread`, `lemon`, `strawberry`, `pear`, `tomato`, `corn`, `broccoli`, `mushroom`, `bell-pepper`, `cherries`, `watermelon`, `banana`, `pumpkin`, `cupcake`, `cookie`, `honey`. The kid picks the same picture when logging in.
- **Unique across the app: the name and picture together.** Two families can each have an "Ava C" with different pictures. When a parent picks the picture, the ones another "Ava C" already has show as taken. If all 30 are taken for a name, the parent uses a nickname for the first name.
- **Setting it up** (Parents → Profiles → the profile, behind the PIN): a **Kid login** part of the profile editor. **Give Ava a login** opens a dialog (the dialog rule in `CLAUDE.md`):
  - **Name:** first name (filled in from the profile's name) and last initial (filled in from the family name's first letter), both editable.
  - **Picture:** the 30 pictures in a grid, the taken ones dimmed.
  - **Password:** at least 6 characters, typed twice, with a Show button. The parent never sees it again after saving.
  - Saved, the profile shows the login as the kid will use it ("Ava C" and the picture) so the parent can tell them, with **Change name or picture**, **Change password**, **Log out everywhere** with "Logged in on 2 devices", and **Turn off login**.
  - **Turn off login** signs the kid out everywhere and removes the name, picture, and password. It deletes no cooks, progress, or photos, and the parent can turn it on again at any time with a new password (the restore rule in `CLAUDE.md`).
- **Forgotten password or picture:** there's no email, so a parent looks at the profile (the picture shows there) or sets a new password. The login screen tells a kid "Forgot? Ask an adult." The owner's set-a-password fallback (§6.2a) stays for parents only.
- **Logging in.** The Log in screen has an **Adult / Kid** choice at the top. Adult is email and password, as now. Kid is three steps on one screen, big and tappable: **Your name** ("Ava C"), **Your picture** (the 30 in a grid), and **Your password**. Wrong details say "That name, picture, and password don't match. Ask an adult if you're stuck." The choice is remembered on the device.
- **The kid session.** A cookie that lasts **14 days and renews each time the app is opened** (owner, 2026-10-23), kept in `kid_sessions` (§8.4) and carrying only the family and that one profile. A device is logged in as a parent or as a kid, never both; logging in as one logs the other out on that device.
- **What a kid login sees.**
  - Opening the app goes **straight to that kid's kitchen**, with its tabs (§6.1), lessons, celebrations, sound, and theme picker. Every other address in the app (the lockers, another profile's kitchen, `#/parent/…`, the first run) sends them back to it.
  - **Gone:** the Parents menu and button, the switch-profile or back-to-lockers control, the test-cook notice, Suggest a fix (it's behind the parent PIN), and the "⋯" queue menu.
  - A small **Log out** in the kitchen's settings, with "Log out of this device?" to confirm. No PIN (Requirement).
  - Kept: "I want to make this" (the request goes to the parents' Queue, §6.1), cooking a queued lesson, Reflect, and photos where the family has them on.
  - **Cooking with someone?** still lists the family's other profiles by name and avatar, so siblings can cook together; the cook is saved for each of them, as now.
- **An adult step on a kid's device.** Where a kid profile needs an adult today (Ask an adult to start, §6.1), the adult types the **family PIN** right there and picks Add as an additional assigned meal or Replace an assigned meal. On a kid login the PIN **approves that one action and unlocks nothing else**: it is sent with that request, checked, and never opens a parent screen or sets the session's PIN timer.
- **The server enforces it, not just the screens.** Every route stays family-scoped (§8.3), and a kid session is further limited to its own profile:
  - **Allowed:** who am I, logging out, the lesson library and live patches, the family's recipes and the User-shared shelf (read only), the family's profile names and avatars (for Cooking with someone?), and, for **its own profile only**, the kitchen queue, cooks, asking for a lesson, the theme, saving a cook it's on, its reflection, photos on its cooks, and the PIN-approved start above.
  - **Refused** with "Ask an adult," everything else: every parent and owner route, the PIN unlock, another profile's queue or cooks, and a reflection for another profile. A route added later is refused for kid sessions unless it's put on the allowed list.
- **Ends a kid's sessions:** Change password, Change name or picture, Turn off login, Log out everywhere, the profile being deleted or changed to adult, and the family being deleted (§6.14). A family restored from `/ops` within its grace period gets its kid logins back, with everyone logged out.
- **Offline cooks** (§6.2, Phase 2d): a cook saved on a device for a profile the logged-in session can't send (another profile's cook, left from a parent login) stays on the device until a session that can send it logs in.
- **Security stays basic** (§2.5): hashed passwords (the same PBKDF2 as parents'), no two-factor, no lockout. **Revisit if** someone guesses a kid's password: a short wait after several wrong tries is the first answer.
- **Migration:** `kid_logins` and `kid_sessions` (§8.4), bundled with the Worker. After it deploys, the owner presses **Apply pending** on `/ops`. Nothing to set up in the Cloudflare dashboard. The family backup, the full backup, and Download our data include `kid_logins` (password hashes only, as for parents); sessions are never exported.
- **The parent tour** (§6.9) gets a card when the tour is built: "Give a kid their own login."

**Build steps** (Phase 5b, in order; each ends with the tests passing):
1. **Data.** Migration `0013_kid_logins.sql`: `kid_logins` with a unique index on (`login_key`, `picture`) and one on `profile_id`; `kid_sessions`. `kid_logins` joins the family backup, the full backup, Download our data, and Delete our family; restoring a family brings logins back with no sessions.
2. **The 30 pictures.** One list in `src/content/login-pictures.js` (id and name), shared by the Worker (to check a picture id) and the app. The art goes in `public/icons.svg` as symbols `lp-<id>`, simple and readable at 56px, in both themes.
3. **Kid sessions** (`auth.js`). Their own cookie, `cpr_kid`, the token hashed in `kid_sessions` like a parent's. `readSession` returns either kind; a kid session carries `kid: true`, `family_id`, and `profile_id`. `requireParent` and `requireOwner` refuse a kid session. Logging in as one kind clears the other's cookie.
4. **The allowed list** (`api.js` dispatch). A route is open to a kid session only if it's registered with `{ kid: true }`; any other route answers 403 "Ask an adult." before its handler runs. The allowed routes check the profile with one helper (`ownProfile(s, pid)`): `GET /api/me`, `POST /api/logout`, `GET /api/library`, `GET /api/patches`, `GET /api/profiles` (names and avatars only for a kid), `PUT /api/profiles/<own>/theme`, `GET /api/profiles/<own>/queue`, `GET /api/profiles/<own>/cooks`, `POST /api/profiles/<own>/ask`, `POST /api/profiles/<own>/approve` (with the PIN in the body), `PUT /api/attempts/<id>` (a cook with its own profile on it), `PUT /api/attempts/<id>/reflection` (its own reflection only), the recipe and User-shared reads, and the safety summary the player shows. Photo routes join the list when photos are built.
5. **Logging in and the parent's controls.** `POST /api/kid-login` (name, picture, password). For parents behind the PIN: `GET /api/login-pictures?name=` (which pictures are taken for that name), and `GET`, `PUT`, `DELETE /api/profiles/<id>/login` (set up, change name or picture, change password, turn off), and `POST /api/profiles/<id>/login/logout-all`. Each change that ends sessions deletes that profile's `kid_sessions` rows.
6. **The PIN-approved start.** `POST /api/profiles/<own>/approve` from a kid session takes `pin` in the body and checks it against the family's PIN, without touching any session's PIN timer. A parent session works as now.
7. **The app: logging in.** The Log in screen's Adult / Kid choice; the Kid side's name, picture grid, and password.
8. **The app: a kid's device.** Starting up on a kid session goes to that kitchen; the router sends every other address back to it; the Parents button, back to lockers, Suggest a fix, the test-cook notice, and the "⋯" menu are left out; Log out goes in the kitchen settings; Ask an adult to start asks for the PIN and sends it with the approval.
9. **The app: the parent's side.** The profile editor's Kid login part and its dialog.
10. **Checks.** Worker tests for every allowed route with the kid's own profile and with a sibling's, every other route refused with a kid session (with and without the PIN), the name matching, the taken pictures, and each thing that ends sessions. A browser check at phone width on two devices (two browser contexts), as in the phase's "done when".

### 8.4 Data model (D1)
Every table holding a family's data carries `family_id`. `families` is the family itself. `signup_verifications`, `settings`, `community_recipes`, and `lesson_patches` belong to the owner or the whole app, not to a family.
- `families` (id, name, default_servings, diet_filters, parent_pin_hash, photos_enabled, created_at). `photos_enabled` is set only from `/ops` (§2.6)
- `parents` (id, family_id, email, password_hash, is_owner)
- `password_resets` (token_hash, family_id, parent_id, expires_at, used_at)
- `signup_verifications` (email, password_hash, code_hash, attempts, sent_at, expires_at). A sign-up waiting on its emailed code; removed when the family is created
- `settings` (key, value). Holds the beta word, among others
- `family_recipes` (id, family_id, title, servings, total_minutes, meal_type, body_json, version, photo_key, source_community_id, created_at, updated_at, deleted_at, held, cleared_words). `held`: saved but waiting on the owner's review of a blocked word, so it can't be cooked or shared; `cleared_words`: the words a review found to be a false alarm in this recipe. `body_json` is the recipe (`src/content/recipe.js`); `version` goes up with each edit; `deleted_at` keeps a deleted recipe for Undo. `photo_key` is the family's own photo, never shared
- `fix_requests` (id, family_id, reporter_parent_id, reporter_profile_id, lesson_id, lesson_version, step, servings, kind, field, current_value, suggested_value, note, created_at, status: open → fixed | declined | duplicate | needs_content_change, owner_reply, patch_id)
- `lesson_patches` (id, lesson_id, base_version, field_path, old_value, new_value, fix_request_id, applied_by, applied_at, reverted_at). No `family_id`: patches apply to the shared library
- `recipe_reviews` (id, family_id, family_recipe_id, reason: typed_in | leaven | hard_block, kind: general | feast, version, sent_at, status: pending → cleared | declined, unleavened, owner_reply, decided_at) (§6.10). `version` is the recipe's when sent, so an edit afterwards needs another review
- `community_recipes` (id, family_id, family_recipe_id, kind: general | feast, title, meal_type, body_json, unleavened, shared_at, updated_at, withdrawn_at, hidden_at). The directory's copy of a shared recipe. `family_id` lets the sharing family update or withdraw it and goes with the family; it is never shown to anyone
- `recipe_reports` (id, family_id, community_recipe_id, kind, note, created_at, status: open → hidden | dismissed, decided_at) (§6.10)
- `sessions` (id, parent_id, family_id, created_at, last_seen, pin_until). `id` is a hash of the cookie's token; `pin_until` is when the parent PIN must be entered again on that device
- `kid_logins` (profile_id, family_id, login_name, login_key, picture, password_hash, created_at, updated_at). One per kid profile at most (§8.3a). `login_name` is how it shows ("Ava C"); `login_key` is the same lowercased with spaces and periods taken out ("avac"); `picture` is a login picture id. The pair (`login_key`, `picture`) is unique across the whole app
- `kid_sessions` (id, profile_id, family_id, created_at, last_seen). Like `sessions`, `id` is a hash of the cookie's token. Not in backups, like `sessions`
- `profiles` (id, family_id, name, avatar, people, theme, audience: kid | adult, track: core | beginner). One person or several sharing it (§1); `people` lists each person's name and avatar color so a shared locker shows everyone
- `queue` (id, family_id, lesson_id, servings, planned_date, status: requested → assigned → shopped → cooked, requested_by_profile_id, course_id, source: manual | request | course, swap_of). A queued item is a library lesson or one of the family's recipes, whose `lesson_id` is `recipe:<id>` (the same on `attempts` and shopping lists). A swap (§6.19) is a queue row whose `swap_of` names what it replaced: `q:<queue id>` for a lesson queued by hand, or `c:<course id>:<lesson id>` for a course lesson. A course's lessons are queued with `course_id` set; their week comes from the schedule, not `planned_date`
- `courses` (id, family_id, name, code, school_year, start_date, per_week, created_at, archived_at) (§6.18)
- `course_profiles` (course_id, family_id, profile_id). A profile is on one active course at most
- `course_lessons` (course_id, family_id, lesson_id, position, removed)
- `course_weeks` (course_id, family_id, week_start, skipped, extra, swapped). A skipped week, how many extra lessons a parent pulled into a week, and how many of its course lessons were swapped for an Appointed Time meal (each takes a place at the pace, so the planned finish moves back); skipped lessons are `course_lessons.removed`
- `queue_profiles` (queue_id, family_id, profile_id)
- `shopping_lists` (id, family_id, created_at, done_at, deleted_at)
- `list_lessons` (list_id, family_id, position, lesson_id, servings, queue_id, course_id). The lessons as they were when the list was made; servings is for "You shopped for N" (§6.6)
- `list_on_hand` (list_id, family_id, ingredient_id). Left off that list only
- `list_checks` (list_id, family_id, ingredient_id)
- `attempts` (id, family_id, queue_id, lesson_id, lesson_version, servings, started_at, finished_at, checklist_state, eater_rating, removed_at). `removed_at`: a parent took it back with Didn't make it (§6.15); it counts for nothing, and Undo clears it
- `attempt_profiles` (attempt_id, family_id, profile_id, rating, notes, transfer, reflected_at). Every profile on the cook, each with its own reflection; transfer is the optional "what other dish could use this move?"
- `test_cooks` (family_id, lesson_id, lesson_version, parent_id, cooked_on)
- `photos` (id, family_id, attempt_id, r2_key, created_at)
- `pantry` (family_id, ingredient_id). Kitchen staples
- `unleavened_dates` (family_id, year, calendar, first_day, unleavened_from, confirmed_at) (§6.20). `calendar` is a standard calendar's id; `first_day` may differ from that calendar's date (a deviation); `confirmed_at` is null until the parent confirms the year
- `profile_ratings` (family_id, profile_id, kind: protein | flavor | ingredient, item, stars 1–5 or null for Haven't tried; at most one 5 per profile per kind, updated_at) (§6.21)
- `family_limits` (family_id, max_minutes, budget, missing_tools, adventurous, updated_at) (§6.21)
- `taste_learned` (family_id, profile_id, kind: flavor | protein | cuisine, item, adjust, cooks): what Reflect ratings have taught (§6.21), so the gaps page and picks don't recount every cook
- `course_programs` (course_id, family_id, program: `level-3`, …): which program a course is (§12). No row means Cook Around the World, so existing courses need no change
- `level_tasks` (family_id, course_id, week, part, profile_id, done_at): a Level week's recipe, drill, knowledge, and Sabbath task checked off per profile (§12.2); a mastery week's "why it worked" is saved with the cook's reflection
- **The next release adds tables only** (§8.6): no column is added to, and nothing is dropped from, a table that exists today
- Stamps, pins, and rank are computed from `attempts` and the content files, not stored separately (**recommendation**; cache them if it gets slow).
- The lesson library and ingredient registry are content files shared by all families (§7). They are not stored per family.

### 8.5 Operations from the browser
The owner has no command line (see `CLAUDE.md`). Everything operational is done on a token-gated **`/ops` page** in the Worker, modeled on the MCCE repo's `src/ops.js` and `src/migrate.js`.
- `/ops` is reached with a separate `OPS_TOKEN` secret, not a parent login.
- **Migrations** are SQL files bundled into the Worker. `/ops` lists each one as applied, pending, or drifted, and **Apply pending** runs them in order. Each migration is all-or-nothing, and the runner stops at the first failure and shows the error.
- **Backup export** downloads every table as one JSON file. **Import** restores from that file.
- **Every destructive control has a restore beside it.** Resetting the database, or removing a family (§6.2a), is only offered alongside the export that can bring it back. Photos in R2 are covered by the family photo download (§6.2) and kept for a grace period after a family is removed.
- Deploys are git → Cloudflare Workers Builds. A schema change reaches production by editing a migration file in the GitHub web editor, letting it deploy, and pressing **Apply pending**. During a big build, changes go into that build's single draft migration instead (§8.6).
- Anything that must be set up by hand in the Cloudflare dashboard (the D1 database, the R2 bucket, the `OPS_TOKEN` secret, the `RESEND_API_KEY` secret, and the `GITHUB_TOKEN` secret for the manager section, §7.5) or in Resend (verifying the sending domain, whose DNS records are added in the Cloudflare dashboard) is listed for the owner before the phase that needs it.

### 8.6 The next release: built beside the live app — Requirement (owner, 2026-10-23)
Everything planned on 2026-10-23 (Unleavened Bread dates, §6.20; family tastes and the recipe gaps page, §6.21; the Levels, §12; the Cook Around the World name, §4) is built **into the live app, switched off**, and turned on for everyone at once when it's ready.
- **The Next release switch** (on `/ops`):
  - **Preview for chosen families:** the owner turns the next release on for one family at a time (their own, a test family). Those families see the new screens and rules; every other family sees the app as it is.
  - **Launch for everyone** turns it on for all families. **Undo launch** is beside it, the restore (§8.5): the app goes back to how it was before launch (only preview families see it), and nothing anyone entered is lost.
  - **Built (2026-10-23):** the switch is kept in `settings` (`next_release`: launched, and the preview families' ids), so it needs no migration. `/api/me` tells the app `next_release` and `next_release_preview`; a preview family's parent screens say they're in the preview. A preview stays with a family through removal and restore, and is ignored for a family that's gone.
  - Until launch, today's behaviour stays for everyone else, including the fixed February 1 to May 15 swap window (§6.19).
- **New content is kept apart** in `content/levels/` (the Level weeks, drills, knowledge pages, Sabbath tasks, and their recipes) and `content/calendars.json`. The content editor (§7.5) edits them before launch; only preview families see them.
- **One migration for the whole build** (owner, 2026-10-23: "I don't want 40 migrations during this new build"). The next release's schema is a single **draft** migration, `0003_next_release.sql`, edited in place for the whole build:
  - **A draft may only create new tables and indexes.** It never alters or drops a table that exists today; the runner refuses a draft that tries. So the new build stores ratings, limits, and course programs in new tables (§8.4), not new columns.
  - **On `/ops` it shows as Draft.** Editing it isn't drift. **Re-apply draft** drops the tables it made and creates them again from the edited file. That loses only preview data, so the backup export and Import sit beside it (§8.5).
  - **Finalize** (at launch) freezes it into an ordinary applied migration, like `0001` and `0002`. The next big build starts its own single draft the same way.
  - **Built (2026-10-23):** a migration with `draft: true` in `migrations/index.js` is a draft. The runner keeps the tables each draft made in `_drafts` (and whether it's finalized), and refuses a draft statement that isn't `CREATE TABLE` or `CREATE INDEX` on a table it creates. `/ops/draft/<id>` has Re-apply draft (type REBUILD; the backup link before it), **Restore draft tables** (fills the draft's empty tables from an earlier export.json: the restore for Re-apply), and Finalize (type FINALIZE; only an unedited draft). `0003_next_release.sql` is the draft, empty so far.
  - Tests build the database from every migration, the draft included.

---

## 9. Build phases

Each phase should be deployed and usable before the next begins.

| Phase | Scope | Done when |
|---|---|---|
| **0. Look & feel** | Theme mockups for the kids to choose from (§5.2; done, they chose Kitchen Quest), then Kitchen Quest's tokens, the per-profile theme switch, the house style for the picker and parent screens, fonts, the core art set (§5.3a), and a **component showcase page** with every themed component from §5.4 in a demo state | The kids have picked a theme and the owner approves the look. **No features are built before this.** |
| **0b. Second theme** | Chef's Passport: its tokens, its core art set, and its version of every component on the showcase page. Built as soon as Phase 0 is approved | A profile can switch between Kitchen Quest and Chef's Passport, and the owner approves the Passport look |
| **1. Content core** | JSON schema; ingredient, equipment, skill, and cuisine registries; clean-species allowlist and blocked-word list; linter; scaling and unit display (§6.6–6.7); and 4 sample lessons covering different units (Shakshuka, Bulgogi, Biscuits, Cookies) | The linter passes and the sample lessons render read-only at every allowed serving count |
| **1b. Families & accounts** | `/ops` page with migrations and backup export/import (§8.5), D1 schema, open sign-up with an emailed code and the beta word, parent login, sessions, password reset email (Resend), parent PIN, profiles (single or shared) and the profile picker, family settings, owner screens, diet filtering of the library | Two test families sign up on their own, and neither can see the other's kids, data, or photos. A backup export restores cleanly into an empty database |
| **1c. Public launch** | The landing page, privacy policy, and terms (§6.13), fonts served from the app, Delete our family and Download our data, the inactive purge with its warning emails (§6.14), and the human check at sign-up (§8.3) if the owner wants it before launch | A visitor reads the landing page, signs up, and deletes their family from the browser. A test family left inactive past the limit is warned and then purged by the scheduled job. **The sign-up link isn't posted publicly before this phase is done** |
| **1d. Demo page** (built after 2a, before 2b) | `/demo` (§6.16): theme and kid/adult switches, the sample lessons in the real player, the diet preview, the shopping list preview, the whole course, the skills view, and `content/course.json`; the public syllabus page (§6.17) | A mom with only the link tries a sample lesson in both themes, toggles dairy-free and sees lessons change, and browses the course by dish and by skill, on her phone |
| **2. Lesson player** | Learn, Prep, Cook mode, kitchen words, food-safety checks, timers, wake lock, voice step control (§6.12), the installable PWA (§8.2), attempts saved for every profile on the cook, offline cache and sync, fix requests and lesson patches (§6.11) | A kid can cook a sample lesson start to finish on a tablet, including with Wi-Fi off partway through. Parents see the one-time test-cook notice. A parent in a test family suggests a fix, the owner applies it from the browser, every family sees the change, and the owner reverts it |
| **3. Parent planning & shopping** | Course plans and the weekly schedule (§4.1, §6.18), the casual/homeschool switch and due dates (§6.17), the queue (with kid requests), safety review, mark test-cooked, What you'll need and optional shopping lists with merging and package rounding (§6.3), kitchen staples, check-off persistence | A parent sets up a course for two siblings, sees this week's lessons in the queue, skips a week, and sees the schedule shift when a lesson isn't cooked. A parent reviews safety, marks a lesson test-cooked, sees what the next weeks need, then makes a list for 3 lessons and shops from their phone |
| **4. Photos & reflect** | The per-family photos switch on `/ops` (§2.6), camera, resize, R2 upload with retry, Reflect stage, gallery, family photo download, Print our progress with its CSV download (§6.15). The transcript moved to 4b (owner, 2026-10-22) | In a family with photos on, a photo taken on the tablet shows in the gallery on the parent's phone. A family with photos off cooks and reflects with no photo step |
| **4b. Homeschool mode** | Course details (name, code, school year), optional grading (not offered on the Sabbath, §6.18), and the transcript (§6.15, §6.17) | A parent in homeschool mode grades a cook and prints a transcript; switching back to casual hides it all and loses nothing |
| **4c. Appointed Times and shared recipes** (built next, owner, 2026-10-22) | The Appointed Times unit and its first lessons, the leaven list and check, the two badges, Swap for an Appointed Time meal instead with the spring filter (§6.19); My recipes with the guided entry flow, sharing with its notices, owner review, Report and Hide, the community directory, and the meal-type art (§6.10). Pulled forward from Phase 9 because sharing recipes is central for this unit (owner, 2026-10-22) | A parent enters a recipe through the flow and a kid cooks it; another test family finds it in the directory and adds it. A parent shares a feast-day recipe that passes and one that's flagged; the flagged one is sent for review and cleared from the owner screens; a recipe with a typed-in ingredient can't be shared until the owner clears it; a reported recipe is hidden and unhidden; in a test dated in March or on May 15, Swap shows only Unleavened recipes in the right order, and in June it shows every feast recipe |
| **5. Progress & delight** | Course progress, ranks, skills earned, celebrations, sound, and the art for them, in both built themes | Completing a lesson earns its reward and skill with full animation in both themes |
| **5b. Kid logins** (built 2026-10-23) | A login for a kid profile (first name and last initial, a cooking picture, and a password), set by a parent; the 30 login pictures; the kid login session, scoped to that one profile; the Log in screen's Adult / Kid choice; the kid's device opening straight to their kitchen, with no lockers and no parent screens; the parent's controls on the profile editor; the migration (§8.3a, build steps there) | A parent gives one of two siblings a login. On a second device, that kid logs in with their name, picture, and password and lands in their kitchen, cooks a queued lesson, and sees the reward. That device can't reach the lockers, the other sibling's kitchen, or any parent screen, by tapping or by typing an address, and the API refuses the parent routes even with the PIN. Off-path cooking still asks an adult for the PIN, right there. The parent changes the password and the kid's device is logged out. Parent logins work as before |
| **6. Intros** | Slideshow engine, music loops, skip/mute | Every sample lesson has a working intro |
| **7. Content fill** | The remaining 71 lessons, written in separate content sessions | All 75 lessons pass the linter |
| **8. Chef Ruth** (Getting started built 2026-10-23) | Chef Ruth on the parent screens (§6.8): her chat, Getting started (§6.9), and her first tasks. Chef Ruth in the kitchen comes after | A new family goes from sign-up to their first queued lesson through Getting started, and a parent sets up a course and plans a week in her chat, with everything showing on the pages it belongs to |
| **9. Family recipes** | Folded into 4c (§6.10) | — |
| **10. Content editor** (owner, 2026-10-23; built 2026-10-23) | The manager section at `/manage` with its owner-only sign-in, and the content editor in it (§7.5): the GitHub token check on `/ops`, the save path (checks, commit to `content-edits`, the workflow that builds, checks, and moves it to `main`, the save status), History and Revert, then the editors: lessons and units first, then registries and the food rules, then pictures | The owner adds a unit, adds a lesson to it, moves an existing lesson into it, and removes a step, all from the browser; each is live for every family after the deploy with no session. A save that breaks a rule is refused with the reason, and Revert puts a lesson back |
| **10b. Next release switch** (owner, 2026-10-23; built 2026-10-23) | §8.6: the switch on `/ops` (preview per family, Launch for everyone, Undo launch), the draft migration with Re-apply and Finalize, and `content/levels/`. Phases 11–13 are built behind it | A preview family sees a test screen that other families don't; Re-apply draft rebuilds an edited draft table; Undo launch puts the app back |
| **11. Tastes, variations, and the recipe pool** (owner, 2026-10-23: built first, right after the switch) | §6.21, in slices: **11a** tags (built 2026-10-24: protein, flavors, heat, budget, familiar on every dish; `content/tastes.json`; the Tags and Tastes pages in the content editor; Claude's drafted values); **11b** ratings (stars per profile, family limits, Our tastes, the Getting started step, Chef Ruth asking a few at a time, the kid's taste quiz); **11c** variations (lesson files, the editor, the linter, the player and shopping list using the chosen one, counting as the lesson); **11d** scoring and picks (course setup, Add a lesson, Chef Ruth, Swap; learning from Reflect); **11e** Recipe gaps | A preview family with a kid who rates mushrooms 1 star and beef 4 gets the beef variation with no mushrooms by default; a variation with a too-low doneness target is refused by the linter; the owner sees the gap that left another family short and opens a new variation from it, with its tags filled in |
| **12. Level 3 Cook** (owner, 2026-10-23: Level 3 first) | §12: the Level program beside Cook Around the World, Level 3's 36 weeks with its four parts, mastery weeks, skill-tagged swap-ins, the Level 3 recipes, Progress and transcript changes | A parent puts a teen on Level 3; the kid cooks week 1's recipe, checks off its drill, knowledge, and Sabbath task; a swap-in replaces a week's recipe; a mastery week asks for "why it worked"; the transcript shows Level 3's hours |
| **13. Unleavened Bread dates** (owner, 2026-10-23) | §6.20: the standard calendars file and its editor, the Getting started and Family settings questions, the yearly ask, the migration, and the swap, schedule, and kitchen changes; the fixed window comes out | Two test families on different calendars, one deviating by a day, see Swap go unleavened-only on their own weeks; a leavened course lesson due in the feast moves past it and doesn't count as behind; a family that hasn't confirmed sees the note |
| **Later** | Levels 2, 4, and 1 (§12), mini-courses (§10), More themes: Food Truck and Recipe Scrapbook (§5.2), capstone meal-timing lessons, split roles when profiles cook together, the tap zone and page-turner remote (§6.12, on hold), CSV export to the homeschool management system (Print our progress's CSV covers the basics, §6.15) | — |

**Phase 2d waits (owner, 2026-10-22):** the installable PWA and cooking offline (Phase 2's slice 2d) are built once pretty much everything else is done, not before Phase 2e. Until then, Phase 2's "Wi-Fi off partway through" check waits with it.

**Phase 3 rulings (owner, 2026-10-22):** Phase 3 comes before Phase 1c. Course plans and the weekly schedule (§6.18) move into Phase 3, slice 3a, with the queue; grading and the transcript stay in 4b. Kids' lesson requests are built. Package rounding is in Phase 3: every ingredient gets its store package sizes, and the registry's store sections become §6.3's list. The offline shopping list waits with 2d.

**Phase 5b is built (2026-10-23):** kid logins (§8.3a), after Phase 5 and before Phase 6. The owner applies its migration (0013) with Apply pending on `/ops`.

**Phase 4c is next (owner, 2026-10-22):** Appointed Times and shared recipes (§6.19, §6.10), with family recipes pulled forward from Phase 9, are built next: after Phase 4's first part (Reflect, Print our progress, the photos switch), before the rest of Phase 4 and before 4b.

**Testing (every phase):** automated tests run in CI alongside the linter. At minimum they cover family scoping (no endpoint returns another family's rows or photos), lesson patches (the hard block and food-safety checks reject a bad patch, and revert restores the lesson), scaling and rounding, unit conversion, shopping-list merging, and the migration runner.

---

## 10. Open questions

- **Which standard calendars** (one or two) Unleavened Bread dates come from (§6.20). The owner names them; Claude fills `content/calendars.json` from them.
- **Mini-courses** (themed short courses such as spicy, all-American, eco-fare): proposed 2026-10-23, then set aside for the Levels. A Level's skill-tagged weeks may cover the same need (run Level 3 as American, Mediterranean, or World Tour).

---

## 11. Planned: beginner track

**Status: replaced by Levels 1 and 2 (§12; owner, 2026-10-23).** Kept for its data hooks and rules, which the Levels use: `track` on lessons and profiles, step `image` and `audioText`, and no ages shown anywhere.

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

---

## 12. Levels: the companion program — Requirement (owner, 2026-10-23)

Four Levels, the homeschool curriculum (owner, 2026-10-23), built inside this app beside Cook Around the World (§1, §4). They teach by skill and food literacy, not by dish, and every Level ends with a Sabbath capstone. **The outlines below are the owner's suggestions** (owner, 2026-10-23), open to change, except where marked Requirement.

- **Same app, same rules.** Families, profiles, kid logins, the hard block (§2.1), diet filters, tastes (§6.21), shopping, the weekly schedule and the Sabbath (§6.18), Unleavened Bread dates (§6.20), grades, and the transcript all apply as they do for Cook Around the World.
- **Homeschool mode works on both programs** (owner, 2026-10-23): the Levels are the homeschool curriculum, and a homeschool family can also take Cook Around the World as an elective, with grades and the transcript (§6.17). The public syllabus page (§6.17) and the landing page (§6.13) get wording for both programs at launch.
- **A profile is on one program at a time:** Cook Around the World or a Level, through its course (§6.18). Siblings can be on different Levels. Cook Around the World stays open to every family (owner, 2026-10-23).
- **Levels go by what a learner can already do, never by age.** §11's rule stands: the app shows no ages. The ages in the owner's outline (6 to 15 and up) are a guide for writing only.
- **Build order** (owner, 2026-10-23): **Level 3 first**, then (recommendation) Level 2, Level 4, and Level 1, which needs the most new art and reading-light content.

### 12.1 The four Levels (owner's outline, 2026-10-23)
| Level | Time | Units, in order |
|---|---|---|
| **1 Helper** | ~1 hr/week | Clean hands, clean kitchen · Clean and unclean animals · Measuring · Mixing and no-bake recipes · Fruits: washing and soft cuts · Vegetables and salads · Tasting the basic flavors · Bread and baking with an adult · **Capstone:** set the table and help make a Sabbath meal |
| **2 Apprentice** | ~2 hrs/week | Knife and heat safety · Reading recipes and mise en place · Eggs · Boiling and simmering: rice, pasta · Labels and hidden unclean ingredients · Salt, herbs, and spices · Quick breads · Simple pan cooking · **Capstone:** storage, leftovers, and one Sabbath dish made from a prep list |
| **3 Cook** | ~3.5 hrs/week | §12.3 |
| **4 Chef** | ~3.5–4 hrs/week | Precision, speed, and scaling recipes · Braising, stewing, beef and lamb cuts · Foundational sauces · Frying and grilling · Pastry · Flavor profiles by cuisine · Menus, nutrition, and budgeting · Allergens, sourcing, and cooking for groups · **Capstone:** plan, budget, shop for, and cook Sabbath for the household plus guests |

Level 1's "Clean and unclean animals" and Level 2's "Labels and hidden unclean ingredients" teach the hard rule (§2.1) from the same rules files the app enforces, so the lessons and the block never disagree. Any Level with a leavened unit is placed away from spring the way §12.3 does (recommendation).

### 12.2 How a Level week works (from the Level 3 plan, owner, 2026-10-23)
- **Four parts a week:** a **Recipe** (a full dish that applies the unit's skill, through the usual lesson player, §3), a **Drill** (hands-on practice without a full recipe), **Knowledge** (a reading, worksheet, quiz, or real-world task), and a **Sabbath task** (prep-ahead, holding, or planning for the Sabbath meal). Drill, Knowledge, and Sabbath task are short pages a profile checks off; each counts toward hours (§6.15) by its planned time.
- **Units of four weeks.** Weeks 1–3 teach and practise. **Week 4 is the mastery check:** the student cooks a different recipe with the same skill without help, then writes why it worked. Progress and the transcript mark each mastered unit.
- **A week names a skill, and its recipe is a default.** Any recipe tagged with that week's skill can be swapped in (§6.21 picks the best fit for the family's tastes), so a family can run the year as American, Mediterranean, or World Tour. Cook Around the World lessons with the skill count as swap-ins too.
- **Sabbath tasks are done before the Sabbath.** Nothing cooked on the Sabbath counts (§6.18), so a Sabbath task and the capstone count when done Sunday to Friday; serving on the Sabbath is fine.
- **Leaven:** a leavened week landing on the family's unleavened days (§6.20) is passed over like any leavened lesson, and the Sabbath task that week uses an unleavened bread (A1, §6.19).

### 12.3 Level 3 Cook: 36 weeks, ~125 hours (one high-school elective credit in most states)
**Unit order — Requirement (owner, 2026-10-23): yeast dough moves from Unit 8 to Unit 2.** Taught late, it fell on Unleavened Bread in most years (2028 and 2029 overlap; 2027 clears by days, and any skipped week pushes it in). Research supports moving it: it needs only food safety, measuring, and the oven, not the units between; UK schools teach yeast rolls in the first year of secondary school; skills practised over many weeks are kept better than skills practised in a short block, so October bread gets about 28 weeks of Sabbath challah as practice; and an early, visible success builds the confidence teens most often lack. Knife cuts stay directly before sautéing, which uses them. Stock and soup now lands in April, around the feast (matzo ball soup).

| Unit | Weeks | Goal |
|---|---|---|
| 1 Food safety science | 1–4 | Uses a thermometer, knows the danger zone (40–140°F), and cools and reheats food safely |
| 2 Yeast dough | 5–8 | Mixes, kneads, proofs, shapes, and bakes a yeast dough, and judges when it's done |
| 3 Classic knife cuts and honing | 9–12 | Holds and hones a chef's knife; even dice, mince, and julienne |
| 4 Sautéing and aromatic bases | 13–16 | Controls pan heat, sweats vs. browns aromatics, deglazes |
| 5 Legumes and grains | 17–20 | Soaks and cooks dried beans and lentils; grains by absorption and pilaf |
| 6 Poultry and roasting | 21–24 | Handles raw poultry safely, roasts to 165°F, roasts vegetables evenly |
| 7 Fish | 25–28 | Identifies clean fish by fins and scales, judges freshness, cooks fish gently until it flakes |
| 8 Stock and soup | 29–32 | Makes a clear stock from bones or vegetables and builds a soup from it |
| 9 Balancing flavor and Sabbath capstone | 33–36 | Tastes and corrects salt, acid, fat, and heat; plans and cooks a full Sabbath meal ahead and reheats it safely |

| Week | Recipe | Drill | Knowledge | Sabbath task |
|---|---|---|---|---|
| 1 | Shakshuka (eggs set fully) | Calibrate a thermometer in ice water | Danger zone and how bacteria grow | Label and date containers |
| 2 | Beef burgers to 160°F | Temp-check thick vs. thin patties | Safe internal temperatures chart | Cool a cooked dish in an ice bath |
| 3 | Fried rice from chilled rice | Safe cooling of a batch of rice | Cross-contamination and board colors | Store a dish safely for the Sabbath |
| 4 | **Mastery:** beef kofta or meatloaf to 160°F | Set up a clean station unaided | Food safety quiz | Reheat a stored dish to 165°F |
| 5 | Pita bread | Bloom yeast; test water temperature | How yeast makes dough rise | Bake and freeze pita for the Sabbath |
| 6 | Sandwich loaf | Knead and windowpane test | Gluten and kneading | Bake a loaf Friday morning |
| 7 | Dinner rolls | Shape even rolls by weight | Proofing: under vs. over | Shape rolls Thursday; cold proof overnight |
| 8 | **Mastery:** challah | Braid a dough | Doneness: color, sound, 190°F inside | Challah for the Sabbath table (and from here on, recommendation) |
| 9 | Pico de gallo | Claw grip; dice 3 onions | Parts of a knife; knife types | Chop vegetables ahead for the Sabbath meal |
| 10 | Tabbouleh (fine mince) | Mince parsley and garlic | Honing vs. sharpening | Store prepped herbs so they stay fresh |
| 11 | Vegetable stir-fry (julienne) | Julienne carrots and peppers | Why even cuts cook evenly | Prep a full set of stir-fry vegetables ahead |
| 12 | **Mastery:** Israeli salad (fine dice) | Timed dice: one onion, one pepper | Name and size each classic cut | Prep and store all salad vegetables for the Sabbath |
| 13 | Garlic green beans | Shimmer test for hot oil | Oils and smoke points | Blanch and store beans for the Sabbath |
| 14 | Beef picadillo (sofrito base) | Sweat vs. brown onions | Browning and why it adds flavor | Make and freeze a sofrito batch |
| 15 | Cajun rice dressing with beef (trinity) | Deglaze a pan, scrape the fond | Aromatic bases across cuisines | Cook rice dressing ahead; cool safely |
| 16 | **Mastery:** beef ragù (soffritto base) | Sauté a mixed vegetable pan unaided | Explain sweat vs. sauté | Make ragù ahead for the Sabbath meal |
| 17 | Red lentil soup (mercimek) | Rinse and pick over lentils | Legume types and cook times | Freeze soup in portions |
| 18 | Red beans and rice (beef sausage, collagen-cased or skinless, or none; §2.1) | Quick-soak vs. overnight soak | Why beans are soaked | Soak beans Friday for a later meal |
| 19 | Rice pilaf | Toast grains in fat before liquid | Absorption vs. pasta method; ratios | Cook grains ahead and reheat with steam |
| 20 | **Mastery:** mujaddara (lentils and rice) | Cook a grain without a recipe card | Grains of the world worksheet | Make a legume dish that holds well for the Sabbath |
| 21 | Roasted vegetables | Cut vegetables to roast at the same rate | How roasting browns food | Roast a tray of vegetables ahead |
| 22 | Shish taouk (chicken thighs) | Trim and cube chicken safely | Raw poultry handling | Marinate chicken Friday for a later meal |
| 23 | Roast chicken pieces | Temp-check thigh and breast | Dark vs. white meat | Roast chicken ahead; hold and reheat |
| 24 | **Mastery:** whole roast chicken | Break down a cooked chicken | Carryover cooking and resting | Roast chicken as the Sabbath centerpiece |
| 25 | Baked salmon with lemon and herbs | Check a fillet for pin bones | Fins and scales: clean vs. unclean species | Plan a fish dish that serves well cold |
| 26 | Steamed fish with ginger and scallion | Judge freshness by smell, eyes, flesh | Store-bought fish: reading labels and names | Steam fish and chill for a cold plate |
| 27 | Poached cod in tomato sauce | Test doneness by flaking | Why fish cooks faster than meat | Make tomato sauce ahead; poach Friday |
| 28 | **Mastery:** pan-seared tilapia or trout | Skin a fillet | Species ID quiz | Cold fish salad for the Sabbath table |
| 29 | Vegetable stock | Skim and strain a stock | Stock vs. broth; why simmer, not boil | Freeze stock in portions |
| 30 | Chicken stock from the Unit 6 carcass (freeze it in week 24) | Cool stock quickly and lift off fat | Gelatin and body in stock | Make stock ahead for the week |
| 31 | Chicken noodle or matzo ball soup | Season a soup by tasting in stages | Soup families: clear, thick, puréed | Soup that improves when made ahead |
| 32 | **Mastery:** minestrone or beef and barley soup | Make stock without a recipe card | Clean labels on boxed stock and bouillon (§2.1) | Soup as the Sabbath starter |
| 33 | Vinaigrette and dressed salad | Fix a dish that's too salty, flat, or sour | Salt, acid, fat, heat | Draft the capstone menu |
| 34 | Beef stew or chili, seasoned in stages | Blind taste test; name what's missing | How cuisines balance differently | Write the shopping list and prep timeline |
| 35 | Practice run of one capstone dish | Taste and adjust without a recipe | Holding and reheating a full meal | Shop and do Thursday prep |
| 36 | **Capstone:** full Sabbath meal made ahead (main, side, bread, salad) | Run the kitchen unaided | Reflection: what worked, what to change | Serve the meal for the Sabbath |

The capstone pulls from every unit: safe temperatures (1), challah (2), knife work (3), an aromatic base (4), a grain or legume (5), a roast or fish (6–7), and soup (8).

- **New recipes:** most Level 3 recipes aren't in Cook Around the World (pico de gallo, tabbouleh, garlic green beans, picadillo, mujaddara, shish taouk, the fish weeks, the stocks, the breads, and others). Each is written as that week's default, tagged with its skill (§6.21). Cook Around the World lessons with the same skill (fish tacos for dicing, minestrone and matzo ball soup for soup, challah) are swap-ins.
- **Setup checks the calendar** (§6.20): a course whose Unit 2 would touch the family's unleavened days says so when it's set up. It comes with phase 13 (§9), after Level 3 itself.
