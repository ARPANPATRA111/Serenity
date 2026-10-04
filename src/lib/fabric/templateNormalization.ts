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
 * - Earlier editor releases drew placeholder chrome as a glyph stroke (a
 *   dashed blue outline around every letter) and the old Exit Preview put
 *   the same stroke on any text containing `{{`. Saved templates can carry
 *   it, and on ordinary text it printed. Only those exact editor strokes are
 *   removed; strokes a designer chose are kept.
 *
 * Normalisation is idempotent and never changes well-formed objects.
 */

type SerializedObject = Record<string, unknown> & { type?: unknown; objects?: unknown };

const TEXT_TYPES = new Set(['text', 'i-text', 'itext', 'textbox', 'variabletextbox']);
const VARIABLE_CAPABLE_TYPES = new Set(['textbox', 'variabletextbox']);

/** Stroke + dash pairs that only the editor itself ever put on text. */
const EDITOR_CHROME_STROKES: Array<{ stroke: string; dash: number[] }> = [
  { stroke: '#001eff', dash: [5, 5] }, // placeholder outline, earlier releases
  { stroke: '#3b82f6', dash: [4, 2] }, // restored by the old Exit Preview
];

export function isEditorChromeStroke(object: object): boolean {
  const { stroke: rawStroke, strokeDashArray: dash } = object as { stroke?: unknown; strokeDashArray?: unknown };
  const stroke = typeof rawStroke === 'string' ? rawStroke.toLowerCase() : '';
  return EDITOR_CHROME_STROKES.some((chrome) => chrome.stroke === stroke
    && Array.isArray(dash) && dash.length === chrome.dash.length
    && dash.every((value, index) => value === chrome.dash[index]));
}

/** The stroke values text has when no stroke was ever chosen for it. */
export const NO_TEXT_STROKE = { stroke: null, strokeWidth: 0, strokeDashArray: null } as const;

function normalizeObject(input: unknown): unknown {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input;
  const object: SerializedObject = { ...(input as SerializedObject) };
  const type = typeof object.type === 'string' ? object.type.toLowerCase() : '';

  if (TEXT_TYPES.has(type)) {
    if (!object.styles || typeof object.styles !== 'object') object.styles = [];
    if (isEditorChromeStroke(object)) Object.assign(object, NO_TEXT_STROKE);
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
