// The app's browser files have no build step, so a syntax error would only show
// on a family's device. This catches it in CI instead.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

test('public/app.js parses', () => {
  const r = spawnSync(process.execPath, ['--check', 'public/app.js'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});

test('the app shell loads its script and styles', () => {
  const html = readFileSync('public/index.html', 'utf8');
  assert.match(html, /<script type="module" src="app.js">/);
  assert.match(html, /href="app.css"/);
});

for (const f of ['public/player.js', 'public/cooks.js', 'public/voice.js', 'public/demo.js', 'public/syllabus.js', 'public/rewards.js', 'public/sound.js']) {
  test(`${f} parses`, () => {
    const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  });
}

test('the demo and syllabus pages load their scripts', () => {
  assert.match(readFileSync('public/demo/index.html', 'utf8'), /<script type="module" src="\/demo.js">/);
  assert.match(readFileSync('public/syllabus/index.html', 'utf8'), /<script type="module" src="\/syllabus.js">/);
});

test('every icon the player and demo draw is in public/icons.svg', () => {
  const sprite = readFileSync('public/icons.svg', 'utf8');
  const have = new Set([...sprite.matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]));
  const player = readFileSync('public/player.js', 'utf8') + readFileSync('public/demo.js', 'utf8');
  const used = new Set([...player.matchAll(/'((?:i|s|t)-[a-z]+)'/g)].map((m) => m[1]));
  used.add('plate');
  for (const id of used) assert.ok(have.has(id), `icons.svg has no "${id}"`);
});

test('every icon and skill glyph the rewards draw is in public/icons.svg, with the map beside them', async () => {
  const sprite = readFileSync('public/icons.svg', 'utf8');
  const have = new Set([...sprite.matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]));
  const src = readFileSync('public/rewards.js', 'utf8');
  for (const m of src.matchAll(/icons\.svg#((?:i|g)-[a-z]+)/g)) assert.ok(have.has(m[1]), `icons.svg has no "${m[1]}"`);
  const { skills, regions } = JSON.parse(readFileSync('public/content/registry.json', 'utf8'));
  for (const s of Object.values(skills)) assert.ok(have.has(`g-${s.pin.glyph}`), `icons.svg has no glyph for ${s.id}`);
  for (const r of Object.keys(regions)) assert.ok(existsSync(`public/img/map/map-${r}.png`), `no map layer for ${r}`);
});

test('the lesson player can scale and show every lesson at every size', async () => {
  const { scaleLesson, servingOptions } = await import('../public/lib/scale.js');
  const reg = JSON.parse(readFileSync('public/content/registry.json', 'utf8'));
  for (const L of reg.lessons) {
    const lesson = JSON.parse(readFileSync(`public/content/lessons/${L.id}.json`, 'utf8'));
    for (const n of servingOptions(lesson)) {
      const s = scaleLesson(lesson, reg.ingredients, n);
      assert.ok(s.steps.every((st) => typeof st.text === 'string' && !/\{(n|qty):/.test(st.text)), `${L.id} at ${n}`);
    }
  }
});

test('every skill glyph has an icon in the sprite', () => {
  const sprite = readFileSync('public/icons.svg', 'utf8');
  const reg = JSON.parse(readFileSync('public/content/registry.json', 'utf8'));
  for (const s of Object.values(reg.skills)) assert.match(sprite, new RegExp(`<symbol id="g-${s.pin.glyph}"`), `${s.id}: g-${s.pin.glyph}`);
});

test('voice commands: next, back, and again, the last one heard wins', async () => {
  const { parseCommand } = await import('../public/voice.js');
  assert.equal(parseCommand(['Next']), 'next');
  assert.equal(parseCommand(['next step please']), 'next');
  assert.equal(parseCommand(['go back']), 'back');
  assert.equal(parseCommand(['previous']), 'back');
  assert.equal(parseCommand(['say it again']), 'again');
  assert.equal(parseCommand(['repeat that']), 'again');
  assert.equal(parseCommand(['next no wait back']), 'back');
  assert.equal(parseCommand(['nexus', 'next']), 'next', 'a lower guess is used when the best has no command');
  assert.equal(parseCommand(['backpack', 'the textbook']), null, 'only whole words count');
  assert.equal(parseCommand(['stir the onions']), null);
});
