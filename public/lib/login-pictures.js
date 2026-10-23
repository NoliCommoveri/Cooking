// Copied from src/content/login-pictures.js by tools/build-library.js. Don't edit here.
// The 30 kid login pictures (plan §8.3a, owner 2026-10-23). A kid logs in with
// their first name and last initial, one of these, and a password. The ids are
// stored, so they never change; the art is the symbol `lp-<id>` in
// public/icons.svg. Every one is a kitchen tool or a clean food (§2.1).
export const LOGIN_PICTURES = [
  ['whisk', 'Whisk'], ['frying-pan', 'Frying pan'], ['stock-pot', 'Pot'], ['wooden-spoon', 'Wooden spoon'],
  ['rolling-pin', 'Rolling pin'], ['oven-mitt', 'Oven mitt'], ['chef-hat', 'Chef hat'], ['measuring-cup', 'Measuring cup'],
  ['mixing-bowl', 'Mixing bowl'], ['teapot', 'Teapot'], ['apple', 'Apple'], ['carrot', 'Carrot'],
  ['egg', 'Egg'], ['cheese', 'Cheese'], ['bread', 'Bread'], ['lemon', 'Lemon'],
  ['strawberry', 'Strawberry'], ['pear', 'Pear'], ['tomato', 'Tomato'], ['corn', 'Corn'],
  ['broccoli', 'Broccoli'], ['mushroom', 'Mushroom'], ['bell-pepper', 'Pepper'], ['cherries', 'Cherries'],
  ['watermelon', 'Watermelon'], ['banana', 'Banana'], ['pumpkin', 'Pumpkin'], ['cupcake', 'Cupcake'],
  ['cookie', 'Cookie'], ['honey', 'Honey'],
].map(([id, name]) => ({ id, name }));

export const isLoginPicture = (id) => LOGIN_PICTURES.some((p) => p.id === id);

// "Ava C": a first name (letters, spaces, hyphens, apostrophes) and one letter.
// Returns { name, key } or an error message. The key ignores case, spaces, and
// periods, so "Ava C", "ava c.", and "AvaC" all match.
export function loginName(first, initial) {
  const f = String(first ?? '').trim().replace(/\s+/g, ' ');
  const i = String(initial ?? '').trim().replace(/\./g, '');
  if (!f) return { error: 'Enter a first name.' };
  if (f.length > 20) return { error: 'The first name is too long (20 letters at most).' };
  if (!/^[\p{L}][\p{L} '’-]*$/u.test(f)) return { error: 'The first name can have letters, spaces, hyphens, and apostrophes.' };
  if (!/^\p{L}$/u.test(i)) return { error: 'The last initial is one letter.' };
  const name = `${f} ${i.toUpperCase()}`;
  return { name, key: loginKey(name) };
}

// The key a typed login name is matched on.
export const loginKey = (typed) => String(typed ?? '').toLowerCase().replace(/[\s.]/g, '');
