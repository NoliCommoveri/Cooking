// The four Levels at a glance (plan §12.1, §12.5, §12.6), for the demo page
// and the Structured Progression syllabus. Level 3 is built, so its entry
// has no units here: its name, hours, and units come from content/levels/level-3.json;
// the others are the owner's outlines, still being written.
export const LEVEL_OUTLINES = [
  { name: 'Level 1 Helper', week: 'About 1 hour a week', credit: 'Hours tracked for your records', units: ['Clean hands, clean kitchen', 'Clean and unclean animals', 'Measuring', 'Mixing and no-bake recipes', 'Fruits: washing and soft cuts', 'Vegetables and salads', 'Tasting the basic flavors', 'Bread and baking with an adult', 'Capstone: set the table and help make a Sabbath meal'].map((name) => ({ name })) },
  { name: 'Level 2 Apprentice', week: 'About 2 hours a week', hours: 72, credit: 'A middle-grades elective', units: [
    ['Knife and heat safety', 'Cuts soft foods safely, handles hot pans and the oven with mitts, and knows what to do in a small kitchen fire'],
    ['Reading recipes and mise en place', 'Reads a recipe through, gathers and measures everything first, and cleans as they go'],
    ['Eggs', 'Cracks and separates eggs cleanly and cooks them scrambled, boiled, and fried to the right doneness'],
    ['Quick breads', 'Uses the muffin and biscuit methods, measures flour correctly, and tests doneness with a toothpick'],
    ['Boiling and simmering', 'Tells a boil from a simmer, cooks pasta and rice to doneness, and drains safely'],
    ['Labels and hidden unclean ingredients', 'Reads an ingredient list and spots ingredients from unclean sources'],
    ['Salt, herbs, and spices', 'Salts food by tasting, tells herbs from spices, and uses each at the right time'],
    ['Simple pan cooking', 'Preheats a pan, cooks without crowding, and flips and checks food for doneness'],
    ['Storage, leftovers, and Sabbath capstone', 'Stores food safely, reuses leftovers, and prepares one Sabbath dish from a written prep list'],
  ].map(([name, goal]) => ({ name, goal })) },
  { built: true, week: 'About 3½ hours a week', credit: 'One high-school elective credit in most states' },
  { name: 'Level 4 Chef', week: 'About 3¾ hours a week', hours: 135, credit: 'One high-school elective credit in most states', note: 'Learners work independently, with adult-style safety notes.', units: [
    ['Precision, speed, and scaling', 'Cuts fine and fast, weighs ingredients, and scales any recipe up or down accurately'],
    ['Braising, stewing, beef and lamb cuts', 'Matches tough cuts to low, slow, moist heat, sears for flavor, and cooks to fork-tender'],
    ['Pastry and enriched breads', 'Makes flaky pastry with cold fat, laminates a dough, and shapes an enriched yeast bread'],
    ['Foundational sauces', 'Thickens with a roux, builds an emulsion and rescues it if it breaks, and makes a pan sauce from fond'],
    ['Frying and grilling', 'Fries at a controlled oil temperature, sets up a breading station, and grills with direct and indirect heat'],
    ['Flavor profiles by cuisine', 'Names the core flavors of a cuisine, builds them from scratch, and adapts a dish to clean ingredients'],
    ['Menus, nutrition, and budgeting', 'Plans balanced meals, prices them per serving, and stretches ingredients across several meals'],
    ['Allergens, sourcing, and cooking for groups', 'Cooks safely for guests with allergies, judges where meat and fish come from, and serves 12 or more'],
    ['Sabbath capstone for household and guests', 'Plans, budgets, shops for, and cooks a full Sabbath meal for the household and guests, entirely on their own'],
  ].map(([name, goal]) => ({ name, goal })) },
];
