// The kitchen intro (plan §6.9, owner, 2026-10-23): a few cards from Chef
// Ruth on how the kitchen and a cook work, each with a screenshot of the real
// screen and boxes drawn around the parts it's about. It opens on its own for
// a profile with no cooks that hasn't seen it, and How it works replays it.
//
// The screenshots and their boxes come from tools/intro-shots.js, which takes
// them from the running app (intro-shots.js is its output). Retake them when a
// screen they show changes.
import { RUTH } from './ruth.js';
import SHOTS from './intro-shots.js';

// A card: its title, its lines (**word** is bold), and its screenshot (a key
// in SHOTS, before the theme). A screenshot with several boxes numbers them,
// to match the lines.
export function introCards({ quest, adult }) {
  const tabs = quest ? ['Main quest', 'Side quests', 'Skill tree'] : ['My journey', 'More recipes', 'Passport'];
  return [
    { title: quest ? 'Welcome to your Quest board!' : 'Welcome to your Recipe box!', lines: [
      "I'm Chef Ruth. Here's a quick look around your kitchen before your first cook. Tap **Next** to keep going, or **Skip** any time.",
    ] },
    { title: tabs[0], shot: 'path', lines: [
      "This is where you see the dishes you're assigned to cook. You can scroll down to see everything you'll be learning, but remember, recipes that are higher on the screen generally should be completed earlier than lower ones.",
    ] },
    { title: tabs[1], shot: 'more', lines: [
      "Here are all the recipes available to be cooked in Clean Plate. That's the ones that are part of the main course, plus any that adults have added themselves that are available to your family. You can search by a dish name or an ingredient to see what we have available.",
    ] },
    { title: tabs[2], shot: 'progress', lines: [
      quest ? "This is where you track your progress. As you cook, you'll earn crests and rank up."
        : "This is where you track your progress. As you cook, you'll collect stamps and skill pins and rank up.",
    ] },
    adult
      ? { title: 'Cook this', shot: 'ask-adult', lines: [
        "If you see something you want to cook that's not next on your list, no problem! Tap **Cook this** and it goes straight to your queue.",
      ] }
      : { title: 'Asking to cook', shot: 'ask', lines: [
        "If you see something you'd like to cook, but it's either not in your assignments or it's currently slated for the future, you can always ask to have it added or moved! Your parent will say yes or not now, using their PIN.",
      ] },
    { title: 'The lesson card', shot: 'card', lines: [
      "Every cook starts here. Pick how many people you're cooking for, and if someone's cooking with you, tap their name so it counts for them too.",
    ] },
    { title: 'Learn', shot: 'learn', lines: [
      "First come a few Learn cards: the move you'll practice, why it works, and how to tell if it's going wrong, then a quick quiz. Already know it? Tap **Skip to Prep**.",
    ] },
    { title: 'Prep', shot: 'prep', lines: [
      'Get everything out before you start. Check off each ingredient, then each tool. Cook mode unlocks once they\'re all checked.',
    ] },
    { title: 'Cook mode', shot: 'cook', lines: [
      '**Next** and **Back** move through the steps.',
      'Tap a timer to start it. You can run more than one at a time.',
      adult ? 'A safety banner points out the hazard on that step.' : 'A safety banner means slow down. It says when an adult needs to help.',
      '**Why?** tells you what a step is for.',
      'Tap an underlined word to see what it means.',
    ], after: 'When a step asks you to check the temperature, use the thermometer before you move on.' },
    { title: 'Plate it', shot: 'plate', lines: [
      `After the last step, tap **Plate it**. Rate how it turned out and say what you'd change next time. That's when it counts on your ${tabs[2]}.`,
    ] },
    adult
      ? { title: 'Something look wrong?', shot: 'fix', lines: [
        "Tap **Suggest a fix** on the lesson or on any step. Say what's wrong and what it should say instead. What comes of it shows on that lesson.",
      ] }
      : { title: 'Something look wrong?', shot: 'fix', lines: [
        'If a step or an amount looks wrong, stop and tell an adult. They can tap **Suggest a fix** to send it to us.',
      ] },
    { title: "You're ready!", lines: [
      'That\'s it! Time for your first cook. You can see this again any time with **How it works** at the top of your kitchen.',
    ] },
  ];
}

// Opens over the kitchen (mount, inside its themed section). onDone runs once,
// when it's finished or skipped.
export function openIntro({ el, mount, profile, onDone }) {
  const quest = profile.theme === 'quest';
  const cards = introCards({ quest, adult: profile.audience === 'adult' });
  const T = quest
    ? { card: 'q-panel lore intro', btn: 'q-btn', back: 'q-back', kick: 'q-kick' }
    : { card: 'p-card p-lore intro', btn: 'p-btn', back: 'p-back', kick: 'p-kick' };
  const rich = (s) => s.split(/\*\*(.+?)\*\*/).map((x, i) => (i % 2 ? el('b', {}, x) : x));
  const ov = el('div', { class: 'whyov intro-ov' });
  let i = 0;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    ov.remove();
    document.removeEventListener('keydown', onKey);
    onDone?.();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const shotOf = (c) => (c.shot ? SHOTS[`${quest ? 'quest' : 'passport'}-${c.shot}`] : null);

  const draw = () => {
    const c = cards[i];
    const shot = shotOf(c);
    const many = (shot?.boxes.length ?? 0) > 1 && c.lines.length > 1;
    const figure = shot ? el('figure', { class: 'intro-shot', style: `aspect-ratio:${shot.w}/${shot.h};width:min(100%, calc(${many ? 34 : 42}vh * ${shot.w} / ${shot.h}))` },
      el('img', { src: shot.img, alt: '', width: shot.w, height: shot.h }),
      shot.boxes.map((b, k) => el('i', { class: 'intro-box', style: `left:${b.x}%;top:${b.y}%;width:${b.w}%;height:${b.h}%` }, many ? el('span', {}, String(k + 1)) : null))) : null;
    const last = i === cards.length - 1;
    const card = el('article', { class: T.card, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'intro-title' },
      quest ? null : el('i', { class: 'tape t1' }),
      el('div', { class: 'intro-ruth' }, el('img', { src: RUTH.photo, alt: '', width: shot ? 48 : 96, height: shot ? 48 : 96 }),
        el('div', {}, el('p', { class: T.kick }, `${RUTH.name} · ${i + 1} of ${cards.length}`), el('h4', { id: 'intro-title' }, c.title))),
      figure,
      many ? el('ol', { class: 'intro-lines' }, c.lines.map((l) => el('li', {}, rich(l)))) : c.lines.map((l) => el('p', {}, rich(l))),
      c.after ? el('p', {}, rich(c.after)) : null,
      el('div', { class: 'intro-dots', 'aria-hidden': 'true' }, cards.map((_, k) => el('i', { class: k === i ? 'on' : '' }))),
      el('div', { class: quest ? 'q-nav' : 'p-nav' },
        last ? null : el('button', { type: 'button', class: `${T.back} intro-skip`, onclick: close }, 'Skip'),
        i ? el('button', { type: 'button', class: T.back, onclick: () => { i--; draw(); } }, 'Back') : null,
        el('button', { type: 'button', class: T.btn, onclick: () => { if (last) close(); else { i++; draw(); } } }, last ? "Let's cook!" : 'Next')));
    ov.replaceChildren(card);
    card.querySelector(`.${T.btn}`).focus({ preventScroll: true });
  };
  draw();
  mount.append(ov);
  document.addEventListener('keydown', onKey);
  return { close };
}
