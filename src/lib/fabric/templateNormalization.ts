/**
 * Repairs template JSON before Fabric loads it.
 *
 * Templates saved by the editor are always well-formed, but templates written
 * by hand (the curated gallery templates, imported JSON, seed data) can omit
 * fields that Fabric 5.3 needs:
 *
 * - A text object without `styles` loads with `styles === undefined`, and
 *   every later serialisation throws inside fabric.util.stylesToArray. The
 *   editor then cannot save, cannot record undo history, and cannot generate.
 * - A `{{Column}}` placeholder stored as a plain `textbox` with a
 *   `dynamicKey` (or typed "VariableTextbox") is not recognised as a
 *   variable, so generation printed the literal "{{Column}}".
 *
 * Normalisation is idempotent and never changes well-formed objects.
 */

type SerializedObject = Record<string, unknown> & { type?: unknown; objects?: unknown };

const TEXT_TYPES = new Set(['text', 'i-text', 'itext', 'textbox', 'variabletextbox']);
const VARIABLE_CAPABLE_TYPES = new Set(['textbox', 'variabletextbox']);

function normalizeObject(input: unknown): unknown {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input;
  const object: SerializedObject = { ...(input as SerializedObject) };
  const type = typeof object.type === 'string' ? object.type.toLowerCase() : '';

  if (TEXT_TYPES.has(type)) {
    if (!object.styles || typeof object.styles !== 'object') object.styles = [];
    if (VARIABLE_CAPABLE_TYPES.has(type) && typeof object.dynamicKey === 'string' && object.dynamicKey.trim()) {
      object.type = 'variableTextbox';
    }
  }

  if (object.textBaseline === 'alphabetical') object.textBaseline = 'alphabetic';

  if (Array.isArray(object.objects)) object.objects = object.objects.map(normalizeObject);
  return object;
}

export function normalizeTemplateObjects<T>(objects: T[]): T[] {
  return objects.map((object) => normalizeObject(object) as T);
}

/** Parses (when needed) and normalises a serialised canvas. Returns a new object. */
export function normalizeTemplateJSON<T extends { objects?: unknown[] }>(json: string | T): T {
  const parsed = (typeof json === 'string' ? JSON.parse(json) : json) as T;
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.objects)) return parsed;
  return { ...parsed, objects: normalizeTemplateObjects(parsed.objects) };
}

/**
 * Replaces `{{Column}}` tokens in ordinary text with values from a
 * spreadsheet row, exactly as the editor's preview does: keys match
 * case-insensitively, and tokens with no matching column stay as written.
 */
export function substituteInlineTokens(text: string, row: Record<string, unknown>): string {
  if (!text.includes('{{')) return text;
  let result = text;
  for (const [key, value] of Object.entries(row)) {
    const pattern = new RegExp(`\\{\\{${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}\\}`, 'gi');
    result = result.replace(pattern, () => String(value ?? ''));
  }
  return result;
}
