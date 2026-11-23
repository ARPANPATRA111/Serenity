/**
 * Certificate design kit.
 *
 * One declarative description per design produces both outputs Serenity needs:
 *   - `toCanvasJSON`  the editable Fabric 5 document the editor opens;
 *   - `toSvg`         a vector proof for thumbnails and the landing showcase.
 *
 * Every shape is centre-origin, so rotation means the same thing in Fabric and
 * SVG. Fonts are limited to families the editor can load (see
 * lib/fonts/googleFonts) and that the public pages also ship, so a proof and
 * the design opened from it look alike.
 */

export const PAGE_WIDTH = 842;
export const PAGE_HEIGHT = 595;

export type FontRole = 'serif' | 'sans' | 'script';

const FABRIC_FONT: Record<FontRole, string> = {
  serif: 'Fraunces',
  sans: 'Manrope',
  script: 'Pinyon Script',
};

/** Fallback stacks for standalone SVG (an <img> cannot use page web fonts). */
const SVG_FONT: Record<FontRole, string> = {
  serif: "Fraunces, Georgia, 'Times New Roman', serif",
  sans: "Manrope, 'Segoe UI', Arial, sans-serif",
  script: "'Pinyon Script', 'Brush Script MT', 'Segoe Script', cursive",
};

type Common = { angle?: number; opacity?: number };

export type RectShape = Common & {
  kind: 'rect';
  x: number; y: number; w: number; h: number;
  fill?: string; stroke?: string; strokeWidth?: number; radius?: number;
};

export type EllipseShape = Common & {
  kind: 'ellipse';
  x: number; y: number; rx: number; ry?: number;
  fill?: string; stroke?: string; strokeWidth?: number;
};

export type TextShape = Common & {
  kind: 'text';
  /** Anchor: the centre for `align: 'center'`, the left edge for `'left'`. */
  x: number; y: number; w: number;
  text: string;
  font: FontRole;
  size: number;
  color: string;
  weight?: number;
  italic?: boolean;
  /** Fabric charSpacing, in thousandths of an em. */
  spacing?: number;
  align?: 'center' | 'left';
  /** Binds the text to a spreadsheet column. */
  field?: 'Name';
  /** The mandatory, locked verification link. */
  verification?: boolean;
};

export type Shape = RectShape | EllipseShape | TextShape;

export type CertificateDesign = {
  id: string;
  name: string;
  category: string;
  background: string;
  /** The synthetic recipient shown on public proofs. */
  sampleName: string;
  shapes: Shape[];
};

/** A ring of rotated ellipses: a guilloche rosette Fabric can edit. */
export function rosette(
  x: number, y: number, radius: number, count: number, stroke: string,
  options: { squash?: number; strokeWidth?: number; opacity?: number } = {},
): EllipseShape[] {
  const { squash = 0.42, strokeWidth = 0.8, opacity } = options;
  return Array.from({ length: count }, (_, index) => ({
    kind: 'ellipse' as const, x, y, rx: radius, ry: radius * squash,
    angle: (180 / count) * index, stroke, strokeWidth, opacity,
  }));
}

// ------------------------------------------------------------------ Fabric

function fabricObject(shape: Shape): Record<string, unknown> {
  const common = {
    angle: shape.angle ?? 0,
    opacity: shape.opacity ?? 1,
    originX: 'center',
    originY: 'center',
  };

  if (shape.kind === 'rect') {
    return {
      type: 'rect', ...common, left: shape.x, top: shape.y, width: shape.w, height: shape.h,
      fill: shape.fill ?? 'transparent', stroke: shape.stroke ?? null,
      strokeWidth: shape.stroke ? shape.strokeWidth ?? 1 : 0,
      rx: shape.radius ?? 0, ry: shape.radius ?? 0,
    };
  }

  if (shape.kind === 'ellipse') {
    return {
      type: 'ellipse', ...common, left: shape.x, top: shape.y, rx: shape.rx, ry: shape.ry ?? shape.rx,
      fill: shape.fill ?? 'transparent', stroke: shape.stroke ?? null,
      strokeWidth: shape.stroke ? shape.strokeWidth ?? 1 : 0,
    };
  }

  const left = shape.align === 'left';
  const text: Record<string, unknown> = {
    type: shape.field ? 'variableTextbox' : 'textbox',
    ...common,
    originX: left ? 'left' : 'center',
    left: shape.x, top: shape.y, width: shape.w,
    text: shape.text,
    fontFamily: FABRIC_FONT[shape.font],
    fontSize: shape.size,
    fontWeight: shape.weight ?? 400,
    fontStyle: shape.italic ? 'italic' : 'normal',
    fill: shape.color,
    textAlign: left ? 'left' : 'center',
    charSpacing: shape.spacing ?? 0,
    styles: [],
  };

  if (shape.field) {
    Object.assign(text, { dynamicKey: shape.field, isPlaceholder: true, editable: false });
  }
  if (shape.verification) {
    Object.assign(text, {
      isVerificationUrl: true, isLocked: true, editable: false, visible: true,
      lockScalingX: true, lockScalingY: true, hasControls: false,
    });
  }
  return text;
}

export function toCanvasJSON(design: CertificateDesign): string {
  return JSON.stringify({
    version: '5.3.0',
    background: design.background,
    objects: design.shapes.map(fabricObject),
  });
}

// --------------------------------------------------------------------- SVG

const escapeXml = (value: string) => value.replace(/[<>&"']/g, (char) =>
  ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]!);

const n = (value: number) => Number(value.toFixed(2));

export type ProofValues = { Name: string; Issuer: string; Date: string; VERIFICATION_URL: string };

export const SAMPLE_VALUES: Omit<ProofValues, 'Name'> = {
  Issuer: 'Serenity Institute',
  Date: '24 November 2026',
  VERIFICATION_URL: 'serenity.app/verify/SR-24X9-Q7',
};

function fill(text: string, values: ProofValues) {
  return text.replace(/\{\{(Name|Issuer|Date|VERIFICATION_URL)\}\}/g, (_, key: keyof ProofValues) => values[key]);
}

function svgShape(shape: Shape, values: ProofValues, inline: boolean): string {
  const rotate = shape.angle ? ` transform="rotate(${n(shape.angle)} ${n(shape.x)} ${n(shape.y)})"` : '';
  const opacity = shape.opacity !== undefined && shape.opacity !== 1 ? ` opacity="${shape.opacity}"` : '';

  if (shape.kind === 'rect') {
    const stroke = shape.stroke ? ` stroke="${shape.stroke}" stroke-width="${shape.strokeWidth ?? 1}"` : '';
    const radius = shape.radius ? ` rx="${shape.radius}"` : '';
    return `<rect x="${n(shape.x - shape.w / 2)}" y="${n(shape.y - shape.h / 2)}" width="${shape.w}" height="${shape.h}"${radius} fill="${shape.fill ?? 'none'}"${stroke}${rotate}${opacity}/>`;
  }

  if (shape.kind === 'ellipse') {
    const stroke = shape.stroke ? ` stroke="${shape.stroke}" stroke-width="${shape.strokeWidth ?? 1}"` : '';
    return `<ellipse cx="${n(shape.x)}" cy="${n(shape.y)}" rx="${shape.rx}" ry="${n(shape.ry ?? shape.rx)}" fill="${shape.fill ?? 'none'}"${stroke}${rotate}${opacity}/>`;
  }

  const anchor = shape.align === 'left' ? 'start' : 'middle';
  const spacing = shape.spacing ? ` letter-spacing="${n((shape.spacing / 1000) * shape.size)}"` : '';
  const weight = shape.weight && shape.weight !== 400 ? ` font-weight="${shape.weight}"` : '';
  const italic = shape.italic ? ' font-style="italic"' : '';
  const family = ` font-family="${SVG_FONT[shape.font]}"${inline ? ` class="cert-${shape.font}"` : ''}`;
  // Single-line text sits on its optical centre.
  const baseline = shape.y + shape.size * 0.34;
  return `<text x="${n(shape.x)}" y="${n(baseline)}" text-anchor="${anchor}" font-size="${shape.size}" fill="${shape.color}"${family}${weight}${italic}${spacing}${rotate}${opacity}>${escapeXml(fill(shape.text, values))}</text>`;
}

function svgBody(design: CertificateDesign, values: ProofValues, inline: boolean) {
  return `<rect width="${PAGE_WIDTH}" height="${PAGE_HEIGHT}" fill="${design.background}"/>${design.shapes
    .map((shape) => svgShape(shape, values, inline))
    .join('')}`;
}

function proofValues(design: CertificateDesign, name?: string): ProofValues {
  return { Name: name ?? design.sampleName, ...SAMPLE_VALUES };
}

/** Standalone SVG as a data URI, for <img> thumbnails. */
export function toProofDataUri(design: CertificateDesign, name?: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}">${svgBody(design, proofValues(design, name), false)}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * An SVG <symbol> whose text uses `cert-serif`, `cert-sans` and `cert-script`
 * classes, so on the public pages it renders in the real web fonts.
 */
export function toProofSymbol(design: CertificateDesign, symbolId: string, name?: string): string {
  return `<symbol id="${symbolId}" viewBox="0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}">${svgBody(design, proofValues(design, name), true)}</symbol>`;
}
