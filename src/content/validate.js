// A small JSON Schema checker, enough for the content schemas in content/schema/.
// Supports: type, enum, const, required, properties, additionalProperties, items,
// minItems, minimum, maximum, minLength, pattern, oneOf, and local $ref (#/$defs/...).

const typeOf = v => v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v;
const fits = (v, t) => t === typeOf(v) || (t === 'number' && typeof v === 'number');

export function validate(value, schema, root = schema, path = '') {
  const errs = [];
  const at = path || '(top)';
  if (schema.$ref) {
    const def = schema.$ref.replace('#/', '').split('/').reduce((o, k) => o[k], root);
    return validate(value, def, root, path);
  }
  if (schema.oneOf) {
    const tries = schema.oneOf.map(s => validate(value, s, root, path));
    const ok = tries.filter(t => t.length === 0).length;
    if (ok === 1) return errs;
    if (ok > 1) return [`${at}: matches ${ok} of the allowed shapes, needs exactly 1`];
    // none fit: report the closest shape's problems
    return tries.reduce((a, b) => (b.length < a.length ? b : a));
  }
  if (schema.type) {
    const types = [].concat(schema.type);
    if (!types.some(t => fits(value, t))) return [`${at}: should be ${types.join(' or ')}, is ${typeOf(value)}`];
  }
  if ('const' in schema && value !== schema.const) errs.push(`${at}: should be ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) errs.push(`${at}: should be one of ${schema.enum.join(', ')}`);
  if (typeof value === 'string') {
    if (schema.minLength && value.length < schema.minLength) errs.push(`${at}: is empty`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errs.push(`${at}: "${value}" doesn't match ${schema.pattern}`);
  }
  if (typeof value === 'number') {
    if ('minimum' in schema && value < schema.minimum) errs.push(`${at}: is below ${schema.minimum}`);
    if ('maximum' in schema && value > schema.maximum) errs.push(`${at}: is above ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems && value.length < schema.minItems) errs.push(`${at}: needs at least ${schema.minItems} item(s)`);
    if (schema.items) value.forEach((v, i) => errs.push(...validate(v, schema.items, root, `${path}[${i}]`)));
  }
  if (typeOf(value) === 'object') {
    for (const k of schema.required || []) if (!(k in value)) errs.push(`${path ? path + '.' : ''}${k}: is required`);
    const props = schema.properties || {};
    for (const [k, v] of Object.entries(value)) {
      const p = `${path ? path + '.' : ''}${k}`;
      if (props[k]) errs.push(...validate(v, props[k], root, p));
      else if (schema.additionalProperties === false) errs.push(`${p}: isn't a known field`);
      else if (typeof schema.additionalProperties === 'object') errs.push(...validate(v, schema.additionalProperties, root, p));
    }
  }
  return errs;
}
