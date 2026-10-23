// The kitchen intro (plan §6.9): every card's screenshot is there in both
// themes, its boxes match its lines, and the parts it points at still exist.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { introCards } from '../public/intro.js';
import SHOTS from '../public/intro-shots.js';
import { makeEnv, family } from './helpers/worker.js';

test('every intro card has its screenshot in both themes, kid and adult', () => {
  for (const quest of [true, false]) {
    for (const adult of [false, true]) {
      const cards = introCards({ quest, adult });
      assert.equal(cards.length, 12);
      for (const c of cards.filter((x) => x.shot)) {
        const s = SHOTS[`${quest ? 'quest' : 'passport'}-${c.shot}`];
        assert.ok(s, `${c.title}: no screenshot`);
        assert.ok(existsSync(new URL(`../public/${s.img}`, import.meta.url)), s.img);
        assert.ok(s.boxes.length, `${c.title}: no boxes`);
        for (const b of s.boxes) assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= 100.01 && b.y + b.h <= 100.01, `${c.title}: a box outside the picture`);
        if (c.lines.length > 1) assert.equal(s.boxes.length, c.lines.length, `${c.title}: a numbered box per line`);
      }
    }
  }
});

// The screenshots go stale when a screen changes: the buttons the cards name
// must still be on the screens (retake them with tools/intro-shots.js).
test('the buttons the intro names are still in the app', () => {
  const src = ['app.js', 'player.js', 'rewards.js'].map((f) => readFileSync(new URL(`../public/${f}`, import.meta.url), 'utf8')).join('\n');
  for (const words of ['I want to make this', 'Cook this', 'Skip to Prep', 'Plate it', 'Suggest a fix', 'Why?', 'How it works', 'Main quest', 'Side quests', 'Skill tree', 'My journey', 'More recipes']) {
    assert.ok(src.includes(words), `"${words}" isn't in the app any more`);
  }
});

test('the intro is new for a profile until it is finished or skipped, on its own profile only', async () => {
  const env = await makeEnv();
  const a = await family(env, 'Carsons', 'jen@example.com');
  const b = await family(env, 'Smiths', 'pat@example.com');
  const ava = (await a.post('/api/profiles', { people: [{ name: 'Ava', color: 'tomato' }] })).body.id;
  const intro = async () => (await a.get('/api/profiles')).body.profiles.find((p) => p.id === ava).intro;
  assert.equal(await intro(), 'new');
  assert.equal((await b.post(`/api/profiles/${ava}/intro`)).status, 404, "another family's profile");
  assert.equal(await intro(), 'new');
  assert.equal((await a.post(`/api/profiles/${ava}/intro`)).status, 200);
  assert.equal(await intro(), 'seen');
});
