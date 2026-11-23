/** The gallery proof and the editable Fabric file share the same paper geometry. */
export const HONOURS_ID = 'bundled-honours';
export const HONOURS_NAME = 'Hackathon Honours';
const paper = '#fffcf2';
const ink = '#193f36';
const foil = '#dbc184';
const serif = 'Georgia';
const sans = 'Arial';

function box(left: number, top: number, width: number, height: number, fill: string) {
  return { type: 'rect' as const, left, top, width, height, fill, strokeWidth: 0 };
}

function inscription(text: string, left: number, top: number, width: number, fontSize: number, fontFamily = sans, fill = ink) {
  return { type: 'textbox' as 'textbox' | 'variableTextbox', text, left, top, width, fontSize, fontFamily, fill, styles: {} };
}

function engraving(x: number, y: number, radius: number, angle: number) {
  return {
    type: 'ellipse' as const, left: x, top: y, rx: radius, ry: radius * 0.44,
    angle, originX: 'center', originY: 'center', fill: 'transparent', stroke: foil, strokeWidth: 0.95,
  };
}

const nameField = {
  ...inscription('{{Name}}', 65, 319, 480, 40, serif),
  type: 'variableTextbox' as const, dynamicKey: 'Name', isPlaceholder: true, editable: false,
};
const verification = {
  ...inscription('{{VERIFICATION_URL}}', 65, 544, 505, 10),
  isVerificationUrl: true, isLocked: true, editable: false, visible: true,
  lockScalingX: true, lockScalingY: true, hasControls: false,
};

const objects = [
  box(564, 0, 278, 595, ink),
  box(575, 13, 1, 569, foil), box(828, 13, 1, 569, foil),
  box(575, 13, 254, 1, foil), box(575, 581, 254, 1, foil),
  ...Array.from({ length: 30 }, (_, i) => engraving(702, 298, 118, 6 * i)),
  { ...engraving(702, 298, 44, 0), ry: 44, fill: ink },
  { ...engraving(702, 298, 39, 0), ry: 39 },
  inscription('S', 685, 267, 42, 49, serif, foil),
  box(674, 81, 56, 1, foil), box(674, 514, 56, 1, foil),
  box(65, 74, 44, 3, '#aa8141'),
  inscription('Honours Programme', 65, 89, 440, 17),
  inscription('Certificate of', 61, 152, 490, 59, serif),
  inscription('Achievement', 61, 215, 490, 59, serif),
  inscription('Awarded to', 65, 292, 400, 16),
  nameField,
  inscription('For completing the hackathon.', 65, 390, 480, 18),
  box(65, 464, 456, 1, '#c1c6ad'),
  inscription('{{Issuer}}', 65, 481, 278, 18, serif),
  inscription('{{Date}}', 359, 483, 166, 15),
  verification,
];

export const honoursCanvasJSON = JSON.stringify({ version: '5.3.0', background: paper, objects });

const escape = (value: string) => value.replace(/[<>&"']/g, (char) =>
  ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]!);

/** Only synthetic values are used for the public gallery and sample roster. */
export function honoursProof(name: string) {
  const values: Record<string, string> = {
    '{{Name}}': name, '{{Issuer}}': 'Serenity Studio', '{{Date}}': 'November 2026',
    '{{VERIFICATION_URL}}': 'Sample certificate',
  };
  const marks = objects.map((object) => {
    if (object.type === 'rect') {
      return `<rect x="${object.left}" y="${object.top}" width="${object.width}" height="${object.height}" fill="${object.fill}"/>`;
    }
    if (object.type === 'ellipse') {
      return `<ellipse cx="${object.left}" cy="${object.top}" rx="${object.rx}" ry="${object.ry}" transform="rotate(${object.angle} ${object.left} ${object.top})" fill="${object.fill}" stroke="${object.stroke}" stroke-width="${object.strokeWidth}"/>`;
    }
    return `<text x="${object.left}" y="${object.top + object.fontSize}" font-family="${object.fontFamily}" font-size="${object.fontSize}" fill="${object.fill}">${escape(values[object.text] ?? object.text)}</text>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 842 595"><rect width="842" height="595" fill="${paper}"/>${marks}</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

