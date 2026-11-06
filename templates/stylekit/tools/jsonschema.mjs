// Toon Studio Style Kit: a small JSON Schema validator, enough for style.schema.json (generated from the app's zod
// schemas): $ref (#/$defs/...), type, const, enum, properties, required, additionalProperties, propertyNames, items,
// min/maxItems, min/maxLength, pattern, minimum/maximum, exclusiveMinimum/Maximum, anyOf/oneOf/allOf. No dependencies.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const typeOf = v => v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v === 'number' ? (Number.isInteger(v) ? 'integer' : 'number') : typeof v;
const typeOk = (want, v) => { const t = typeOf(v); return want === t || (want === 'number' && t === 'integer'); };
const rxCache = new Map();
const rx = p => { if (!rxCache.has(p)) { let r; try { r = new RegExp(p, 'u'); } catch { r = new RegExp(p); } rxCache.set(p, r); } return rxCache.get(p); };
const show = v => { const s = JSON.stringify(v); return s && s.length > 40 ? s.slice(0, 40) + '...' : s; };

/** Validate `value` against `schema` (with `rootDoc` for $ref). Returns a list of { path, message } (empty = valid). */
export function validate(schema, value, rootDoc = schema, at = '', errs = []) {
  if (schema === true || schema == null) return errs;
  if (schema === false) { errs.push({ path: at, message: 'is not allowed' }); return errs; }
  if (schema.$ref) {
    const m = /^#\/(\$defs|definitions)\/(.+)$/.exec(schema.$ref);
    const target = m ? rootDoc[m[1]]?.[decodeURIComponent(m[2])] : schema.$ref === '#' ? rootDoc : null;
    if (!target) { errs.push({ path: at, message: `unknown schema reference ${schema.$ref}` }); return errs; }
    validate(target, value, rootDoc, at, errs);
  }
  if (schema.type) { const ts = Array.isArray(schema.type) ? schema.type : [schema.type]; if (!ts.some(t => typeOk(t, value))) { errs.push({ path: at, message: `must be ${ts.join(' or ')} (it is ${typeOf(value)})` }); return errs; } }
  if ('const' in schema && JSON.stringify(schema.const) !== JSON.stringify(value)) errs.push({ path: at, message: `must be ${show(schema.const)}` });
  if (schema.enum && !schema.enum.some(e => JSON.stringify(e) === JSON.stringify(value))) errs.push({ path: at, message: `must be one of ${schema.enum.map(show).join(', ')}` });
  if (typeof value === 'string') {
    const n = [...value].length;
    if (schema.minLength != null && n < schema.minLength) errs.push({ path: at, message: schema.minLength === 1 ? 'must not be empty' : `must be at least ${schema.minLength} characters` });
    if (schema.maxLength != null && n > schema.maxLength) errs.push({ path: at, message: `must be at most ${schema.maxLength} characters (it is ${n})` });
    if (schema.pattern && !rx(schema.pattern).test(value)) errs.push({ path: at, message: `${show(value)} does not match ${schema.pattern}` });
  }
  if (typeof value === 'number') {
    if (schema.minimum != null && value < schema.minimum) errs.push({ path: at, message: `must be >= ${schema.minimum}` });
    if (schema.maximum != null && value > schema.maximum) errs.push({ path: at, message: `must be <= ${schema.maximum}` });
    if (typeof schema.exclusiveMinimum === 'number' && value <= schema.exclusiveMinimum) errs.push({ path: at, message: `must be > ${schema.exclusiveMinimum}` });
    if (typeof schema.exclusiveMaximum === 'number' && value >= schema.exclusiveMaximum) errs.push({ path: at, message: `must be < ${schema.exclusiveMaximum}` });
    if (!Number.isFinite(value)) errs.push({ path: at, message: 'must be a finite number' });
  }
  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) errs.push({ path: at, message: `needs at least ${schema.minItems} item${schema.minItems === 1 ? '' : 's'}` });
    if (schema.maxItems != null && value.length > schema.maxItems) errs.push({ path: at, message: `may hold at most ${schema.maxItems} items` });
    if (schema.items && typeof schema.items === 'object') value.forEach((v, i) => validate(schema.items, v, rootDoc, `${at}[${i}]`, errs));
    if (Array.isArray(schema.prefixItems)) schema.prefixItems.forEach((s, i) => i < value.length && validate(s, value[i], rootDoc, `${at}[${i}]`, errs));
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const r of schema.required ?? []) if (!(r in value)) errs.push({ path: at ? `${at}.${r}` : r, message: 'is missing' });
    const props = schema.properties ?? {};
    for (const [k, v] of Object.entries(value)) {
      const p = at ? `${at}.${k}` : k;
      if (schema.propertyNames) validate(schema.propertyNames, k, rootDoc, `${p} (name)`, errs);
      if (k in props) validate(props[k], v, rootDoc, p, errs);
      else if (schema.additionalProperties === false) errs.push({ path: p, message: 'is not a known field' });
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') validate(schema.additionalProperties, v, rootDoc, p, errs);
    }
  }
  if (schema.allOf) for (const s of schema.allOf) validate(s, value, rootDoc, at, errs);
  if (schema.anyOf && !schema.anyOf.some(s => !validate(s, value, rootDoc, at, []).length)) {
    const firsts = schema.anyOf.map(s => validate(s, value, rootDoc, at, [])[0]).filter(Boolean);
    errs.push(firsts[0] && schema.anyOf.length === 1 ? firsts[0] : { path: at, message: `does not match any allowed form (${firsts.map(e => e.message).slice(0, 2).join(' / ')})` });
  }
  if (schema.oneOf && schema.oneOf.filter(s => !validate(s, value, rootDoc, at, []).length).length !== 1) errs.push({ path: at, message: 'must match exactly one allowed form' });
  return errs;
}
/** { ok, why } like the app's parseManifest: the first three problems as "field: message". */
export function check(schema, value, rootDoc = schema) {
  const e = validate(schema, value, rootDoc);
  return e.length ? { ok: false, why: e.slice(0, 3).map(x => `${x.path || '(root)'}: ${x.message}`).join('; ') } : { ok: true };
}
let doc = null;
/** The kit's style.schema.json (next to tools/). */
export function styleSchema() {
  if (!doc) doc = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'style.schema.json'), 'utf8'));
  return doc;
}
export const validateManifest = raw => { const d = styleSchema(); return check(d.$defs.style, raw, d); };
export const validateLookSchema = raw => { const d = styleSchema(); return check(d.$defs.look, raw, d); };
