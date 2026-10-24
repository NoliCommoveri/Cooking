// The syllabus page (plan §6.17), built from the course outline so it stays
// current as lessons are written. The words are a draft for the owner to approve.
import { numberCourse, courseEntries } from './lib/course.js';
const root = document.getElementById('syllabus');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const getJSON = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`Couldn't load ${u}`); return r.json(); };
const [R, C] = await Promise.all([getJSON('/content/registry.json'), getJSON('/content/course.json')]);

// Lesson numbers follow the course order; a pick-one group shares one (1a, 1b, 1c).
const NUM = numberCourse(C.dishes).labels;
const units = [...new Set(C.dishes.map((d) => d.unit))];
// Desserts reads as itself, wherever the owner puts it in the course.
const unitName = (u) => (R.units[u] === 'Desserts' ? 'Desserts' : `Unit ${u}: ${R.units[u]}`);

// Pick-one groups (§4.0) count once on a student's path through the course.
const byId = Object.fromEntries(C.dishes.map((d) => [d.id, d]));
const groups = courseEntries(C.dishes).filter((e) => e.pickOne).map((e) => e.ids);
const inGroup = new Set(groups.flat());
const pathLessons = C.dishes.filter((d) => !inGroup.has(d.id)).length + groups.length;
const avg = (ids) => ids.reduce((n, x) => n + byId[x].minutes, 0) / ids.length;
// Hours: each dish's cooking time, plus about 15 minutes a lesson for Learn and the reflection.
const EXTRA = 15;
const pathMinutes = C.dishes.filter((d) => !inGroup.has(d.id)).reduce((n, d) => n + d.minutes + EXTRA, 0)
  + groups.reduce((n, g) => n + avg(g) + EXTRA, 0);
const hours = Math.round(pathMinutes / 60);
// The common rule of thumb is 120–180 hours of work for one credit. Suggest the
// nearest quarter credit to the middle of that range.
const credit = Math.max(0.25, Math.round((pathMinutes / 60 / 150) * 4) / 4);
const creditText = { 0.25: '¼ credit', 0.5: '½ credit', 0.75: '¾ credit', 1: '1 credit' }[credit] ?? `${credit} credit`;
const estimated = C.dishes.filter((d) => d.estimated).length;

// The skills, and where the course first teaches each one.
const firstTaught = {};
for (const d of C.dishes) for (const s of d.skills) firstTaught[s] ??= d.unit;
const skillsIn = (u) => [...new Set(C.dishes.filter((d) => d.unit === u).flatMap((d) => d.skills))].filter((s) => firstTaught[s] === u);

root.innerHTML = `
<header class="d-hero"><img src="/img/logo.webp" alt="" width="110" height="110"><h1>Clean Plate Recipes: course syllabus</h1>
  <p>A cooking course for kids, built for homeschool families and published by Immotus Apps.</p>
  <p class="noprint"><button type="button" class="hbtn" onclick="print()">Print this syllabus</button> <a class="hbtn link" href="/demo/">Try a sample lesson</a></p></header>

<h2>About the course</h2>
<p>Each lesson pairs one cooking skill with one real dish that uses it. Students learn why the skill works, gather and measure their ingredients, cook step by step with built-in timers and safety guidance, and reflect on the result. Dishes come from many cuisines, and every recipe follows biblical food laws (Leviticus 11, Deuteronomy 14): no pork, shellfish, or other unclean foods, and no blood, suet, or tallow.</p>
<p><b>Who it's for:</b> students 10 and up who have done some cooking. For complete courses that start from the fundamentals, with knowledge, drills, and mastery checks, see <a href="/syllabus/structured-progression/">Structured Progression</a>.</p>

<h2>Learning objectives</h2>
<p>By the end of the course, a student can:</p>
<ul>
  <li>Use a chef's knife safely to julienne, chop, dice, and slice.</li>
  <li>Control heat on the stove: simmer, sear, stir-fry, braise, and reduce.</li>
  <li>Build flavor with aromatics, spices, marinades, and sauces, including a roux.</li>
  <li>Make doughs and batters, from biscuits and flatbreads to a yeast dough.</li>
  <li>Roast, bake, and fry with an adult, and judge doneness with a thermometer.</li>
  <li>Follow food-safety practice: washing hands and boards after raw food, and safe cooking temperatures.</li>
  <li>Read a recipe, scale it to a different number of servings, and plan the order of the work.</li>
  <li>Explain why each technique works, and use it in a dish they haven't cooked before.</li>
</ul>

<h2>Course at a glance</h2>
<div class="scroll"><table><tr><th>Dishes</th><th>Skills</th><th>On one student's path</th><th>Estimated hours</th></tr>
<tr><td>${C.dishes.length}</td><td>${Object.keys(firstTaught).length}</td><td>${pathLessons} lessons</td><td>About ${hours}</td></tr></table></div>
<p class="small mut">Foundation skills have three lessons to choose from, and a student cooks one of each, so a student's path is ${pathLessons} lessons. Hours count each lesson's cooking time plus about ${EXTRA} minutes for the Learn cards and the reflection${estimated ? `; ${estimated} lessons are still being written, so their times are estimates` : ''}.</p>

<div class="credit"><b>Suggested credit: ${creditText}</b><br>The course is about ${hours} hours of work. At the common rule of thumb of 120 to 180 hours per credit, we suggest ${creditText} for the full course. Your family decides; you know your student's work and your state's rules.</div>

<h2>Pacing</h2>
<ul>
  <li><b>Two lessons a week:</b> about ${Math.ceil(pathLessons / 2)} weeks, one school year.</li>
  <li><b>One lesson a week:</b> about ${pathLessons} weeks, across two school years.</li>
  <li>Start with Unit 1. Nearly every lesson uses knife work, so we suggest a Unit 1 lesson first. After that, units can be taken in order, or mixed.</li>
</ul>

<h2>Units</h2>
${units.map((u) => {
  const sk = skillsIn(u).map((s) => R.skills[s]?.name ?? s);
  return `<h3>${esc(unitName(u))}</h3>${sk.length ? `<p><b>New skills:</b> ${sk.map(esc).join(', ')}</p>` : ''}
  <div class="scroll"><table><tr><th>#</th><th>Dish</th><th>Cuisine</th><th>Skill</th><th>Time</th></tr>${C.dishes.filter((d) => d.unit === u).map((d) => `<tr><td>${NUM[d.id]}</td><td>${esc(d.title)}${d.pickOne ? `<br><small class="mut">Pick one with ${C.dishes.filter((x) => x.pickOne === d.pickOne && x.id !== d.id).map((x) => esc(x.title)).join(', ')}</small>` : ''}</td><td>${esc(R.cuisines[d.cuisine]?.name ?? d.cuisine)}</td><td>${esc(d.skill)}</td><td>${d.estimated ? '~' : ''}${d.minutes} min</td></tr>`).join('')}</table></div>`;
}).join('')}

<h2>Materials</h2>
<p>A home kitchen with a stove and oven, and these tools: a chef's knife and cutting board, a 12-inch skillet, a saucepan and a large pot, a sheet pan, mixing bowls, measuring cups and spoons, a wooden spoon and spatula, and an instant-read thermometer. Each lesson lists its own tools and a shopping list scaled to your family's servings.</p>

<h2>Safety and supervision</h2>
<p>Every step is marked <b>Solo</b>, <b>Adult nearby</b> (an adult is in the kitchen), or <b>Adult hands-on</b> (an adult helps, for hot oil and frying). Lessons include washing hands and boards after raw food, and a doneness check with a target temperature for meat, poultry, fish, and eggs. Recipes may not have been test-cooked by every family, so a parent reads each lesson before the student cooks it.</p>

<h2>Assessment</h2>
<p>In the app's homeschool mode, a parent can grade each cook. Grades are for the parent only. Each row is scored 1 to 4:</p>
<div class="scroll"><table><tr><th>Row</th><th>What it looks at</th></tr>
<tr><td>Skill shown</td><td>The lesson's skill, done the way the Learn cards describe</td></tr>
<tr><td>Safety and cleanliness</td><td>Safe knife and heat handling, washing after raw food, a clean station</td></tr>
<tr><td>Following the recipe</td><td>Measuring, order of steps, timing</td></tr>
<tr><td>The result</td><td>The dish is cooked through and looks and tastes the way it should</td></tr>
<tr><td>The reflection</td><td>What went well, what they'd change, and where else they could use the skill</td></tr></table></div>
<p>Families can also give one overall grade, or not grade at all. A printable transcript lists the lessons cooked, with dates, skills, hours, and grades.</p>

<p class="d-foot">Clean Plate Recipes is published by Immotus Apps. This syllabus updates as lessons are written.</p>`;
