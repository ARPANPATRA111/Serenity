/**
 * One definition of what a reusable template keeps when it leaves the canvas:
 * on Save, on Export JSON, on Duplicate, and in undo history.
 *
 * Fabric 5 serialises only its own properties. Everything Serenity adds
 * (the protected verification URL, clickable links, locks, variable fields)
 * must be named explicitly, or it is silently lost. Exports used to call a
 * bare `canvas.toJSON()`, so a re-imported template had a second, unprotected
 * "{{VERIFICATION_URL}}" text and links that no longer opened in the PDF.
 */

/** Custom properties kept in undo history and every saved template. */
export const TEMPLATE_OBJECT_PROPS = [
  'dynamicKey',
  'isPlaceholder',
  'verificationId',
  'isVerificationUrl',
  'isClickableLink',
  'isLocked',
  // Fabric 5 never serialises `editable`, but the template invariants require
  // the verification URL to be stored as non-editable.
  'editable',
] as const;

/** History properties plus the editor's boundary marker, which is filtered out. */
export const TEMPLATE_EXPORT_PROPS = [...TEMPLATE_OBJECT_PROPS, 'isBoundary'] as const;

export const VERIFICATION_URL_TEXT = '{{VERIFICATION_URL}}';

/** Largest template file Import accepts. Saved templates are far smaller. */
export const MAX_TEMPLATE_FILE_BYTES = 10 * 1024 * 1024;

type SerializedObject = Record<string, unknown>;
type SerializedCanvas = Record<string, unknown> & { objects?: unknown };

/**
 * Removes editor-only objects from a serialised canvas and repairs Fabric's
 * own `alphabetical` textBaseline typo. Mutates and returns `json`.
 */
export function cleanSerializedTemplate<T extends SerializedCanvas>(json: T): T {
  if (Array.isArray(json.objects)) {
    json.objects = (json.objects as SerializedObject[])
      .filter((object) => !object?.isBoundary)
      .map((object) => {
        if (object?.textBaseline === 'alphabetical') object.textBaseline = 'alphabetic';
        return object;
      });
  }
  return json;
}

/** True for the protected verification URL and the verification QR code. */
export function isProtectedTemplateObject(object: unknown): boolean {
  if (!object || typeof object !== 'object') return false;
  const candidate = object as SerializedObject;
  return candidate.isVerificationUrl === true || typeof candidate.verificationId === 'string';
}

export type TemplateImportResult =
  | { ok: true; template: SerializedCanvas & { objects: SerializedObject[] }; repairs: string[] }
  | { ok: false; error: string };

interface ParseTemplateOptions {
  /** Whether Fabric can build an object of this serialised type. */
  isKnownType?: (type: string) => boolean;
}

const TEXT_TYPES = new Set(['text', 'i-text', 'itext', 'textbox', 'variabletextbox']);

function isPlainObject(value: unknown): value is SerializedObject {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function findUnknownType(objects: unknown[], isKnownType: (type: string) => boolean): string | null {
  for (const object of objects) {
    if (!isPlainObject(object) || typeof object.type !== 'string' || !object.type) return '(missing)';
    if (!isKnownType(object.type)) return object.type;
    if (Array.isArray(object.objects)) {
      const nested = findUnknownType(object.objects, isKnownType);
      if (nested) return nested;
    }
  }
  return null;
}

function isLegacyVerificationText(object: SerializedObject): boolean {
  const type = typeof object.type === 'string' ? object.type.toLowerCase() : '';
  return TEXT_TYPES.has(type) && object.text === VERIFICATION_URL_TEXT && !object.isVerificationUrl;
}

/**
 * Parses an imported template file before anything on the canvas changes.
 *
 * Files exported by earlier releases lack the custom properties. Their
 * verification URL is recognised by its exact placeholder text and protected
 * again. Every problem that would leave the user unable to save or generate is
 * reported here, so a bad file never replaces the design on screen.
 */
export function parseTemplateFile(text: string, options: ParseTemplateOptions = {}): TemplateImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' };
  }

  if (!isPlainObject(parsed) || !Array.isArray(parsed.objects)) {
    return { ok: false, error: 'This file is not a Serenity template: it has no list of design objects.' };
  }

  const isKnownType = options.isKnownType ?? (() => true);
  const unknownType = findUnknownType(parsed.objects, isKnownType);
  if (unknownType) {
    return {
      ok: false,
      error: unknownType === '(missing)'
        ? 'This template contains an object without a type, so it cannot be opened.'
        : `This template contains an unsupported object type ("${unknownType}"), so it cannot be opened.`,
    };
  }

  const repairs: string[] = [];
  let objects = (parsed.objects as SerializedObject[]).map((object) => ({ ...object }));

  // Older exports dropped the verification flag. Protect the first placeholder
  // text again and remove exact copies, which would print "{{VERIFICATION_URL}}".
  if (!objects.some((object) => object.isVerificationUrl === true)) {
    const legacy = objects.filter(isLegacyVerificationText);
    if (legacy.length > 0) {
      const [kept, ...extra] = legacy;
      Object.assign(kept, { isVerificationUrl: true, isLocked: true, editable: false });
      repairs.push('The verification link from an older export was protected again.');
      if (extra.length > 0) {
        const extraSet = new Set(extra);
        objects = objects.filter((object) => !extraSet.has(object));
        repairs.push(`${extra.length} duplicate verification placeholder${extra.length === 1 ? ' was' : 's were'} removed.`);
      }
    }
  }

  if (objects.filter((object) => object.isVerificationUrl === true).length > 1) {
    return { ok: false, error: 'This template has more than one verification link. A certificate can have only one.' };
  }
  if (objects.filter((object) => typeof object.verificationId === 'string').length > 1) {
    return { ok: false, error: 'This template has more than one verification QR code. A certificate can have at most one.' };
  }

  return { ok: true, template: { ...parsed, objects }, repairs };
}
