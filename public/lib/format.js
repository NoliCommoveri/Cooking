// Copied from src/content/format.js by tools/build-library.js. Don't edit here.
// How a content file is written out (plan §7.5): two-space indents; a list's
// items one to a line where each fits in about 600 characters (a dish, a step,
// a card), and anything else that fits in a line of about 120 kept on one
// line. The manager section writes every file this way, and so does
// tools/format-content.js, so a change from the browser shows in GitHub as
// the lines it changed, not the whole file.

const WIDTH = 120;
const ITEM = 600;

const inline = (v) => {
  if (Array.isArray(v)) return v.length ? `[${v.map(inline).join(', ')}]` : '[]';
  if (v && typeof v === 'object') {
    const parts = Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`);
    return parts.length ? `{ ${parts.join(', ')} }` : '{}';
  }
  return JSON.stringify(v);
};

function block(v, indent, lead, item = false) {
  const one = inline(v);
  if (typeof v !== 'object' || v === null || indent.length + lead.length + one.length <= (item ? ITEM : WIDTH)) return one;
  const inner = indent + '  ';
  if (Array.isArray(v)) return `[\n${v.map((x) => inner + block(x, inner, '', true)).join(',\n')}\n${indent}]`;
  const rows = Object.entries(v).map(([k, x]) => {
    const key = `${JSON.stringify(k)}: `;
    return inner + key + block(x, inner, key);
  });
  return `{\n${rows.join(',\n')}\n${indent}}`;
}

// The top level always opens onto its own lines, so a file reads as a list of fields.
export function formatJson(v) {
  if (typeof v !== 'object' || v === null) return JSON.stringify(v) + '\n';
  const one = inline(v);
  if (one.length <= WIDTH && !Object.values(v).some((x) => typeof x === 'object' && x !== null)) return `${one}\n`;
  if (Array.isArray(v)) return `[\n${v.map((x) => '  ' + block(x, '  ', '', true)).join(',\n')}\n]\n`;
  return `{\n${Object.entries(v).map(([k, x]) => `  ${JSON.stringify(k)}: ${block(x, '  ', `${JSON.stringify(k)}: `)}`).join(',\n')}\n}\n`;
}
