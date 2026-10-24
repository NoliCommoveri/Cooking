// The Structured Progression syllabus (plan §6.17, §12): the four Levels as
// homeschool courses, built from the Levels' content so it stays current as
// weeks are written. The words are a draft for the owner to approve.
import { PARTS, PART_NAMES, plannedMinutes, hoursOf } from './lib/levels.js';
import { LEVEL_OUTLINES } from './level-outlines.js';
const root = document.getElementById('syllabus');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const getJSON = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`Couldn't load ${u}`); return r.json(); };
const { levels } = await getJSON('/content/levels.json');
const L3 = levels.find((x) => x.id === 'level-3');

// Hours the way a course counts them at setup (§12.4): each week's recipe
// (or a practice or capstone week's own time), plus the parts kept on.
const weeks = L3.weeks.map((w) => ({ ...w, id: w.recipe }));
const recipeMinutes = (id) => weeks.find((w) => w.recipe === id)?.recipeMinutes ?? 0;
const allHours = hoursOf(plannedMinutes(weeks, recipeMinutes));
const recipeHours = hoursOf(plannedMinutes(weeks, recipeMinutes, []));
const partHours = (p) => hoursOf(L3.weeks.filter((w) => !w.kind).reduce((n, w) => n + w[p].minutes, 0));
const avg = (p) => Math.round(L3.weeks.filter((w) => !w.kind).reduce((n, w) => n + w[p].minutes, 0) / L3.weeks.filter((w) => !w.kind).length);
const special = L3.weeks.filter((w) => w.kind);

// The four Levels at a glance, Level 3 from its content.
const glance = LEVEL_OUTLINES.map((o) => (o.built ? { ...o, name: L3.name, hours: allHours } : o));
// Where each Level starts, by what a learner can already do (§12: never by age).
const READY = {
  'Level 1 Helper': 'New cooks, working beside an adult the whole time',
  'Level 2 Apprentice': 'Cooks ready for short recipes, with an adult in the kitchen for all stove, oven, and knife work; a paring or nylon knife on soft foods',
  'Level 3 Cook': "Cooks ready for a chef's knife and the stove, with an adult nearby for heat and sharp knives",
  'Level 4 Chef': 'Cooks who can plan and cook on their own; an adult only needs to be home for deep frying and grilling',
};
const unitWeeks = (n) => L3.weeks.filter((w) => w.unit === n);
const what = (w) => w.title ?? (w.kind === 'capstone' ? 'Capstone: a full Sabbath meal' : 'Practice run');

root.innerHTML = `
<header class="d-hero"><img src="/img/logo.webp" alt="" width="110" height="110"><h1>Structured Progression: course syllabus</h1>
  <p>Complete cooking courses for homeschool families, from the fundamentals onward, published by Immotus Apps.</p>
  <p class="noprint"><button type="button" class="hbtn" onclick="print()">Print this syllabus</button> <a class="hbtn link" href="/demo/">Try a sample week</a> <a class="hbtn link" href="/syllabus/">Cook Around the World's syllabus</a></p></header>

<h2>About the program</h2>
<p>Structured Progression is four courses, called Levels, each a full school year of 36 weeks. They teach cooking by skill and food literacy: every week pairs a recipe with a reading, a hands-on drill, and a page that goes beyond the recipe, for a complete culinary and food-science education. Every recipe follows biblical food laws (Leviticus 11, Deuteronomy 14): no pork, shellfish, or other unclean foods, and no blood, suet, or tallow.</p>
<p><b>Who it's for:</b> families teaching cooking from the fundamentals onward, even for young cooks. Levels go by what a student can already do, not by age, so a family starts at the Level that fits and moves up.</p>

<h2>The four Levels</h2>
<table class="stack"><tr class="hd"><th>Level</th><th>Starts with</th><th>Time</th><th>Credit</th><th>Status</th></tr>
${glance.map((o) => `<tr><td class="t"><b>${esc(o.name)}</b></td><td data-l="Starts with">${esc(READY[o.name] ?? '')}</td><td data-l="Time">${esc(o.week)}${o.hours ? `, about ${o.hours} hours` : ''}</td><td data-l="Credit">${esc(o.credit)}</td><td data-l="Status">${o.built ? 'Ready now' : 'Being written'}</td></tr>`).join('')}</table>

<h2>How a week works</h2>
<p>Each week names one skill and has four parts, in this order:</p>
<div class="scroll"><table><tr><th>Part</th><th>What it is</th><th>Level 3 time</th></tr>
<tr><td><b>Knowledge</b></td><td>A reading, worksheet, quiz, or real-world task on the science and practice behind the week's skill</td><td>About ${avg('knowledge')} min</td></tr>
<tr><td><b>Drill</b></td><td>Hands-on practice of the technique without a full recipe</td><td>About ${avg('drill')} min</td></tr>
<tr><td><b>Recipe</b></td><td>A full dish that applies the skill, cooked step by step in the app with timers, safety notes, and a reflection</td><td>Varies by dish</td></tr>
<tr><td><b>Beyond the Recipe</b></td><td>A make-ahead or storage skill, or a page on what the Bible says about food</td><td>About ${avg('sabbath')} min</td></tr></table></div>
<ul>
  <li><b>Units of four weeks.</b> Weeks 1 to 3 teach and practise. Week 4 is the <b>mastery check</b>: the student cooks a different recipe with the same skill without help, then writes why it worked.</li>
  <li><b>A capstone</b> ends every Level: a Sabbath meal planned and cooked ahead.</li>
  <li><b>Recipes fit your family.</b> Each week has a few recipe options that teach its skill. When you set up the course, the app picks the best fit for your family's tastes and diet, and you can swap any week's recipe.</li>
  <li><b>Parts are optional.</b> At setup, you can turn off Knowledge, Drill, or Beyond the Recipe for the whole course; the recipe is always included. The hours adjust to match.</li>
</ul>

<h2>Level 3 Cook</h2>
<p>36 weeks in 9 units. ${esc(READY[L3.name])}.</p>
<h3>Learning objectives</h3>
<p>By the end of Level 3, a student:</p>
<ul>${L3.units.map((u) => `<li>${esc(u.goal)}.</li>`).join('')}</ul>

<h3>Hours and credit</h3>
<div class="scroll"><table><tr><th>Work</th><th>Hours</th></tr>
<tr><td>Recipes${special.length ? `, the practice run, and the capstone` : ''}</td><td>About ${recipeHours}</td></tr>
${PARTS.map((p) => `<tr><td>${PART_NAMES[p]}</td><td>About ${partHours(p)}</td></tr>`).join('')}
<tr><td><b>With every part</b></td><td><b>About ${allHours}</b></td></tr></table></div>
<div class="credit"><b>Suggested credit: 1 high-school elective credit</b><br>With every part, Level 3 is about ${allHours} hours of work. At the common rule of thumb of 120 to 180 hours per credit, that's one elective credit in most states. With parts turned off, the hours are lower, and the app shows the planned hours at setup. Your family decides; you know your student's work and your state's rules.</div>

<h3>Units</h3>
${L3.units.map((u) => `<h4>Unit ${u.number}: ${esc(u.name)}</h4><p><b>Goal:</b> ${esc(u.goal)}</p>
  <table class="stack"><tr class="hd"><th>Week</th><th>Recipe</th><th>Knowledge</th><th>Drill</th><th>Beyond the Recipe</th></tr>
  ${unitWeeks(u.number).map((w) => `<tr><td class="t"><span class="wk">Week </span>${w.week}</td><td data-l="Recipe">${esc(what(w))}${w.mastery ? ' <small class="mut">(mastery check)</small>' : ''}</td><td data-l="Knowledge">${esc(w.knowledge.title)}</td><td data-l="Drill">${esc(w.drill.title)}</td><td data-l="Beyond the Recipe">${esc(w.sabbath.title)}</td></tr>`).join('')}</table>`).join('')}
<p class="small mut">The recipe shown is each week's default. A family's course may cook another of the week's options.</p>

<h2>Levels 1, 2, and 4 (being written)</h2>
${LEVEL_OUTLINES.filter((o) => !o.built).map((o) => `<h3>${esc(o.name)}</h3><p>${esc(READY[o.name])}. ${esc(o.week)}${o.hours ? `, about ${o.hours} hours` : ''}. ${esc(o.credit)}.</p>
  <ol>${o.units.map((u) => `<li><b>${esc(u.name)}</b>${u.goal ? `: ${esc(u.goal)}` : ''}</li>`).join('')}</ol>`).join('')}

<h2>Pacing</h2>
<ul>
  <li><b>One week of the course each calendar week,</b> Sunday to Friday, for 36 weeks: one school year. The app loads each week's work on Sunday.</li>
  <li><b>Saturday is the Sabbath:</b> nothing is due or graded, and school work done that day isn't counted. Families are welcome to cook.</li>
  <li><b>Falling behind is fine.</b> A recipe not cooked by the end of its week moves to the next week, and the rest of the course moves with it. Working ahead is fine too.</li>
  <li><b>Unleavened Bread:</b> a week with a leavened recipe that lands on your family's unleavened days cooks an unleavened recipe with the same skill instead.</li>
</ul>

<h2>Materials</h2>
<p>A home kitchen with a stove and oven, and these tools: a chef's knife and honing steel, cutting boards (one for raw meat), a 12-inch skillet, a saucepan, a stockpot, a sheet pan and a roasting pan, mixing bowls, measuring cups and spoons, a wooden spoon and spatula, and an instant-read thermometer. Each recipe lists its own tools and a shopping list scaled to your family's servings.</p>

<h2>Safety and supervision</h2>
<p>Every recipe step is marked <b>Solo</b>, <b>Adult nearby</b> (an adult is in the kitchen), or <b>Adult hands-on</b> (an adult helps, for hot oil and frying), with a doneness check and target temperature for meat, poultry, fish, and eggs. In Level 2, an adult is in the kitchen for all stove, oven, and knife work. <b>Level 4 students cook on their own</b> and see adult-style safety notes, which name each hazard without asking for an adult, so assign Level 4 only to a student who can work independently.</p>

<h2>Assessment</h2>
<ul>
  <li><b>Mastery checks:</b> each unit ends with a recipe cooked without help and a written answer to "Why did it work?" A unit is mastered when its mastery week is cooked with that answer.</li>
  <li><b>Recipes are graded</b> by the parent with the rubric below, with one overall grade, or not at all. Grades are for the parent only.</li>
  <li><b>Knowledge, Drill, and Beyond the Recipe</b> are checked off when done; each counts toward hours by its planned time.</li>
</ul>
<div class="scroll"><table><tr><th>Rubric row (1 to 4)</th><th>What it looks at</th></tr>
<tr><td>Skill shown</td><td>The week's skill, done the way the lesson describes</td></tr>
<tr><td>Safety and cleanliness</td><td>Safe knife and heat handling, washing after raw food, a clean station</td></tr>
<tr><td>Following the recipe</td><td>Measuring, order of steps, timing</td></tr>
<tr><td>The result</td><td>The dish is cooked through and looks and tastes the way it should</td></tr>
<tr><td>The reflection</td><td>What went well, what they'd change, and where else they could use the skill</td></tr></table></div>
<p>The printable transcript lists each recipe cooked with its date, skill, hours, and grade; each part checked off with its planned hours; the units mastered; and the total hours. The parent enters the final grade and credit.</p>

<p class="d-foot">Clean Plate Recipes is published by Immotus Apps. This syllabus updates as the Levels are written.</p>`;
