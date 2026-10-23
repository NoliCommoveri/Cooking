// Copied from src/content/grades.js by tools/build-library.js. Don't edit here.
// The homeschool rubric (plan §6.17, the syllabus's Assessment table): five
// rows, each scored 1 to 4. A parent can score the rubric, write a grade in
// their own words, or both. Shared by the Worker and the parent screens.

export const RUBRIC = [
  { key: 'skill', label: 'Skill shown', looks: 'The lesson\'s skill, done the way the Learn cards describe' },
  { key: 'safety', label: 'Safety and cleanliness', looks: 'Safe knife and heat handling, washing after raw food, a clean station' },
  { key: 'recipe', label: 'Following the recipe', looks: 'Measuring, order of steps, timing' },
  { key: 'result', label: 'The result', looks: 'The dish is cooked through and looks and tastes the way it should' },
  { key: 'reflection', label: 'The reflection', looks: 'What went well, what they\'d change, and where else they could use the skill' },
];

export const GRADE_TEXT_MAX = 40;

// A grade's rubric average (1 to 4, one decimal), or null if the rubric
// wasn't scored.
export function rubricAverage(g) {
  if (!g || RUBRIC.some((r) => g[r.key] == null)) return null;
  return Math.round((RUBRIC.reduce((n, r) => n + g[r.key], 0) / RUBRIC.length) * 10) / 10;
}

// How a grade reads in one line: "B+", "3.4 / 4", or "B+ · 3.4 / 4".
export function gradeLine(g) {
  const avg = rubricAverage(g);
  return [g?.grade_text, avg == null ? null : `${avg.toFixed(1)} / 4`].filter(Boolean).join(' · ');
}
