// The Structured Progression syllabus (plan §6.17, §12): the Levels as
// homeschool courses, built from the Levels' content so it stays current as
// weeks are written. The Levels show once their release is launched (§8.6);
// until then the Worker serves none, and the page says they're coming. The
// words are a draft for the owner to approve.
import { PARTS, PART_NAMES, plannedMinutes, hoursOf } from './lib/levels.js';
import { allLevels } from './level-outlines.js';
const root = document.getElementById('syllabus');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const getJSON = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`Couldn't load ${u}`); return r.json(); };
const { levels } = await getJSON('/content/levels.json');

const hero = `<header class="d-hero"><img src="/img/logo.webp" alt="" width="110" height="110"><h1>Structured Progression: course syllabus</h1>
  <p>Complete cooking courses for homeschool families, from the fundamentals onward, published by Immotus Apps.</p>
  <p class="noprint">${levels.length ? '<button type="button" class="hbtn" onclick="print()">Print this syllabus</button> <a class="hbtn link" href="/demo/">Try a sample week</a> ' : ''}<a class="hbtn link" href="/syllabus/">Cook Around the World's syllabus</a></p></header>`;

if (!levels.length) {
  root.innerHTML = `${hero}
<h2>Coming soon</h2>
<p>Structured Progression is being built: complete courses, called Levels, each a full school year of 36 weeks, teaching cooking by skill and food literacy. Its syllabus is published here when the Levels open to every family.</p>
<p>In the meantime, <a href="/syllabus/">Cook Around the World</a> is ready now, with grades and a transcript for homeschool families.</p>
<p class="d-foot">Clean Plate Recipes is published by Immotus Apps.</p>`;
} else {
  const all = allLevels(levels);
  const L3 = levels.find((x) => x.id === 'sp-3') ?? levels[0];
  // Hours the way a course counts them at setup (§12.4): each week's Familiar
  // dish (or a practice or capstone week's own time), plus the parts kept on.
  const hoursOfLevel = (L) => {
    const weeks = L.weeks.map((w) => ({ ...w, id: w.familiar }));
    const recipeMinutes = (id) => weeks.find((w) => w.familiar === id)?.recipeMinutes ?? 0;
    const partHours = (p) => hoursOf(L.weeks.reduce((n, w) => n + w[p].minutes, 0));
    return { all: hoursOf(plannedMinutes(weeks, recipeMinutes)), recipes: hoursOf(plannedMinutes(weeks, recipeMinutes, [])), part: partHours };
  };
  const avg = (p) => Math.round(L3.weeks.reduce((n, w) => n + w[p].minutes, 0) / L3.weeks.length);
  const what = (w) => (w.kind === 'capstone' ? 'Capstone: a full Sabbath meal' : 'Practice run');
  const unitWeeks = (L, n) => L.weeks.filter((w) => w.unit === n);

  const levelSection = (L) => {
    const h = hoursOfLevel(L), special = L.weeks.some((w) => w.kind);
    return `<h2>${esc(L.name)}</h2>
<p>36 weeks in ${L.units.length} units. ${esc(L.ready)}.${L.note ? ` ${esc(L.note)}` : ''}</p>
<h3>Learning objectives</h3>
<p>By the end of ${esc(L.name.split(' ').slice(0, 2).join(' '))}, a student:</p>
<ul>${L.units.map((u) => `<li>${esc(u.goal)}.</li>`).join('')}</ul>
<h3>Hours and credit</h3>
<div class="scroll"><table><tr><th>Work</th><th>Hours</th></tr>
<tr><td>Recipes${special ? ', the practice runs, and the capstone' : ''}</td><td>About ${h.recipes}</td></tr>
${PARTS.map((p) => `<tr><td>${PART_NAMES[p]}</td><td>About ${h.part(p)}</td></tr>`).join('')}
<tr><td><b>With every part</b></td><td><b>About ${h.all}</b></td></tr></table></div>
<div class="credit"><b>Suggested credit: ${esc(L.credit)}</b><br>With every part, ${esc(L.name)} is about ${h.all} hours of work. With parts turned off, the hours are lower, and the app shows the planned hours at setup. Your family decides; you know your student's work and your state's rules.</div>
<h3>Units</h3>
${L.units.map((u) => `<h4>Unit ${u.number}: ${esc(u.name)}</h4><p><b>Goal:</b> ${esc(u.goal)}</p>
  <table class="stack"><tr class="hd"><th>Week</th><th>Familiar</th><th>Explore</th><th>Knowledge</th><th>Drill</th><th>Beyond the Recipe</th></tr>
  ${unitWeeks(L, u.number).map((w) => `<tr><td class="t"><span class="wk">Week </span>${w.week}${w.mastery ? ' <small class="mut">(mastery)</small>' : ''}</td>${w.familiar
    ? `<td data-l="Familiar">${esc(w.title)}</td><td data-l="Explore">${esc(w.exploreTitle)}</td>`
    : `<td data-l="Recipe" colspan="2">${esc(what(w))}</td>`}<td data-l="Knowledge">${esc(w.knowledge.title)}</td><td data-l="Drill">${esc(w.drill.title)}</td><td data-l="Beyond the Recipe">${esc(w.sabbath.title)}</td></tr>`).join('')}</table>`).join('')}`;
  };

  root.innerHTML = `${hero}
<h2>About the program</h2>
<p>Structured Progression is a set of courses, called Levels, each a full school year of 36 weeks. They teach cooking by skill and food literacy: every week pairs a recipe with a reading, a hands-on drill, and a page that goes beyond the recipe, for a complete culinary and food-science education. Every recipe follows biblical food laws (Leviticus 11, Deuteronomy 14): no pork, shellfish, or other unclean foods, and no blood, suet, or tallow.</p>
<p><b>Who it's for:</b> families teaching cooking from the fundamentals onward, even for young cooks. Levels go by what a student can already do, not by age, so a family starts at the Level that fits and moves up.</p>
<p><b>The same units at every Level.</b> Every Level covers the same nine units, by cooking method, at the same lengths, so siblings on different Levels stay in step. What climbs from Level to Level is how hard the recipes are and the new way each skill is used.</p>

<h2>The Levels</h2>
<table class="stack"><tr class="hd"><th>Level</th><th>Starts with</th><th>Time</th><th>Credit</th><th>Status</th></tr>
${all.map((o) => `<tr><td class="t"><b>${esc(o.name)}</b></td><td data-l="Starts with">${esc(o.ready)}</td><td data-l="Time">${esc(o.week)}${o.hours ? `, about ${hoursOfLevel(o).all} hours` : ''}</td><td data-l="Credit">${esc(o.credit)}</td><td data-l="Status">${o.later ? 'Being planned' : 'Ready now'}</td></tr>`).join('')}</table>

<h2>How a week works</h2>
<p>Each week names one skill and has four parts, in this order:</p>
<div class="scroll"><table><tr><th>Part</th><th>What it is</th><th>Level 3 time</th></tr>
<tr><td><b>Knowledge</b></td><td>A reading, worksheet, quiz, or real-world task on the science and practice behind the week's skill</td><td>About ${avg('knowledge')} min</td></tr>
<tr><td><b>Drill</b></td><td>Hands-on practice of the technique without a full recipe</td><td>About ${avg('drill')} min</td></tr>
<tr><td><b>Recipe</b></td><td>A full dish that applies the skill, cooked step by step in the app with timers, safety notes, and a reflection</td><td>Varies by dish</td></tr>
<tr><td><b>Beyond the Recipe</b></td><td>A make-ahead or storage skill, or a page on what the Bible says about food</td><td>About ${avg('sabbath')} min</td></tr></table></div>
<ul>
  <li><b>Two dishes each week.</b> Every recipe week has a <b>Familiar</b> dish most families already know and an <b>Explore</b> dish from another part of the world, both teaching the same skill. At setup, you choose which one each week starts with, and the learner can cook the other instead any week.</li>
  <li><b>Units by cooking method:</b> ${esc(L3.units.map((u) => u.name).join(', '))}. The last week of each unit is its <b>mastery check</b>: the student cooks with the unit's skill without help, then writes why it worked.</li>
  <li><b>A capstone</b> ends every Level: a Sabbath meal planned and cooked ahead.</li>
  <li><b>Parts are optional.</b> At setup, you can turn off Knowledge, Drill, or Beyond the Recipe for the whole course; the recipe is always included. The hours adjust to match.</li>
</ul>

${levels.map((L) => levelSection(all.find((o) => o.name === L.name))).join('')}

<h2>Level 1 Helper (being planned)</h2>
<p>${esc(all[0].ready)}. ${esc(all[0].week)}. The same nine units, picture-first and read aloud, with the child's jobs marked.</p>

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
<p>Every recipe step is marked <b>Solo</b>, <b>Adult nearby</b> (an adult is in the kitchen), or <b>Adult hands-on</b> (an adult helps, for hot oil and frying), with a doneness check and target temperature for meat, poultry, fish, and eggs. In Level 2, an adult is in the kitchen for all stove, oven, and knife work. <b>Level 4 students cook on their own</b> and see adult-style safety notes, which name each hazard without asking for an adult, so assign Level 4 only to a student who can work independently. An adult is at home for Level 4's deep frying and grilling.</p>

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
}
