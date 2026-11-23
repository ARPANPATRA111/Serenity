import { rosette, type CertificateDesign, type Shape } from './designKit';

/**
 * The curated library: fourteen complete designs, each in its own palette, built
 * with the design kit so the landing showcase, the gallery thumbnail and the
 * editable template are the same drawing.
 *
 * Ids and names are the ones the earlier curated set used, so saved links,
 * bookmarks and tests that open `?template=bundled-…` keep working; only the
 * artwork changed. Every design carries exactly one {{Name}} field and one
 * locked verification link.
 */

const C = 421; // horizontal centre

function signatures(
  left: number, right: number, y: number,
  { ink, rule, label, font = 'serif' as const, leftLabel = 'Issued by', rightLabel = 'Date of issue' }:
  { ink: string; rule: string; label: string; font?: 'serif' | 'sans'; leftLabel?: string; rightLabel?: string },
): Shape[] {
  return [
    { kind: 'text', x: left, y, w: 220, text: '{{Issuer}}', font, size: 17, color: ink, weight: font === 'sans' ? 700 : 500 },
    { kind: 'rect', x: left, y: y + 20, w: 190, h: 1, fill: rule },
    { kind: 'text', x: left, y: y + 36, w: 220, text: leftLabel.toUpperCase(), font: 'sans', size: 9, color: label, spacing: 240, weight: 600 },
    { kind: 'text', x: right, y, w: 220, text: '{{Date}}', font, size: 17, color: ink, weight: font === 'sans' ? 700 : 500 },
    { kind: 'rect', x: right, y: y + 20, w: 190, h: 1, fill: rule },
    { kind: 'text', x: right, y: y + 36, w: 220, text: rightLabel.toUpperCase(), font: 'sans', size: 9, color: label, spacing: 240, weight: 600 },
  ];
}

const verification = (x: number, y: number, color: string, align: 'center' | 'left' = 'center'): Shape => ({
  kind: 'text', x, y, w: 460, text: '{{VERIFICATION_URL}}', font: 'sans', size: 9, color, align, verification: true,
});

// 1. Indigo and gold, for honours and achievement --------------------------
const indigoGold: CertificateDesign = {
  id: 'bundled-achievement',
  name: 'Milestone Achievement',
  category: 'Achievement',
  background: '#151a3b',
  sampleName: 'Aarav Mehta',
  shapes: [
    { kind: 'rect', x: C, y: 297.5, w: 802, h: 555, stroke: '#c9a55a', strokeWidth: 1.6 },
    { kind: 'rect', x: C, y: 297.5, w: 784, h: 537, stroke: '#c9a55a', strokeWidth: 0.6, opacity: 0.6 },
    ...[[40, 40], [802, 40], [40, 555], [802, 555]].map(([x, y]): Shape => ({ kind: 'rect', x, y, w: 12, h: 12, angle: 45, fill: '#c9a55a' })),
    ...rosette(C, 112, 50, 24, '#c9a55a', { strokeWidth: 0.7 }),
    { kind: 'ellipse', x: C, y: 112, rx: 25, fill: '#151a3b', stroke: '#c9a55a', strokeWidth: 1.2 },
    { kind: 'ellipse', x: C, y: 112, rx: 19, stroke: '#c9a55a', strokeWidth: 0.6 },
    { kind: 'text', x: C, y: 112, w: 60, text: 'A', font: 'serif', size: 24, color: '#e8cf8e', weight: 600 },
    { kind: 'text', x: C, y: 196, w: 640, text: 'CERTIFICATE OF ACHIEVEMENT', font: 'sans', size: 14, color: '#d8b76a', weight: 700, spacing: 420 },
    { kind: 'text', x: C, y: 240, w: 600, text: 'This honour is proudly presented to', font: 'serif', size: 17, color: '#c4c9e6', italic: true },
    { kind: 'text', x: C, y: 304, w: 680, text: '{{Name}}', font: 'script', size: 66, color: '#f3e2b3', field: 'Name' },
    { kind: 'rect', x: C, y: 348, w: 320, h: 1, fill: '#c9a55a', opacity: 0.7 },
    { kind: 'text', x: C, y: 382, w: 600, text: 'For outstanding achievement and an exceptional contribution to the programme.', font: 'sans', size: 14, color: '#b5bbdc' },
    ...signatures(262, 580, 452, { ink: '#f1f2f9', rule: '#c9a55a', label: '#8f96c0' }),
    verification(C, 548, '#8f96c0'),
  ],
};

// 2. Coral and navy, modern workshop --------------------------------------
const coralWorkshop: CertificateDesign = {
  id: 'bundled-workshop',
  name: 'Workshop Participation',
  category: 'Workshop',
  background: '#fffaf6',
  sampleName: 'Priya Nair',
  shapes: [
    { kind: 'ellipse', x: 812, y: -10, rx: 236, fill: '#ff7a59' },
    { kind: 'ellipse', x: 676, y: -64, rx: 150, fill: '#ffc3a6', opacity: 0.85 },
    { kind: 'ellipse', x: 780, y: 190, rx: 34, fill: '#2b2d6e' },
    { kind: 'ellipse', x: 0, y: 595, rx: 168, fill: '#2b2d6e' },
    { kind: 'ellipse', x: 122, y: 536, rx: 40, fill: '#ffc857' },
    { kind: 'text', x: 80, y: 112, w: 400, text: 'HANDS-ON WORKSHOP', font: 'sans', size: 13, color: '#f0613d', weight: 800, spacing: 420, align: 'left' },
    { kind: 'text', x: 80, y: 162, w: 560, text: 'Certificate of Participation', font: 'serif', size: 42, color: '#24265f', weight: 600, align: 'left' },
    { kind: 'text', x: 80, y: 232, w: 400, text: 'Proudly awarded to', font: 'sans', size: 15, color: '#6b6f8e', align: 'left' },
    { kind: 'text', x: 80, y: 288, w: 600, text: '{{Name}}', font: 'serif', size: 54, color: '#1d1f4a', weight: 600, align: 'left', field: 'Name' },
    { kind: 'rect', x: 140, y: 336, w: 120, h: 5, radius: 2.5, fill: '#ff7a59' },
    { kind: 'text', x: 80, y: 376, w: 560, text: 'for taking part in every session of the design-thinking workshop.', font: 'sans', size: 15, color: '#4b4f72', align: 'left' },
    { kind: 'text', x: 262, y: 470, w: 220, text: '{{Issuer}}', font: 'sans', size: 15, color: '#1d1f4a', weight: 700, align: 'left' },
    { kind: 'text', x: 262, y: 492, w: 220, text: 'Organiser', font: 'sans', size: 11, color: '#8a8fb0', align: 'left' },
    { kind: 'text', x: 520, y: 470, w: 220, text: '{{Date}}', font: 'sans', size: 15, color: '#1d1f4a', weight: 700, align: 'left' },
    { kind: 'text', x: 520, y: 492, w: 220, text: 'Date', font: 'sans', size: 11, color: '#8a8fb0', align: 'left' },
    verification(262, 548, '#8a8fb0', 'left'),
  ],
};

// 3. Emerald diploma for courses ------------------------------------------
const emeraldDiploma: CertificateDesign = {
  id: 'bundled-academic-course',
  name: 'Academic Course Completion',
  category: 'Education',
  background: '#fbf8f0',
  sampleName: 'Ananya Iyer',
  shapes: [
    { kind: 'rect', x: 62, y: 297.5, w: 124, h: 595, fill: '#0f4d3f' },
    { kind: 'rect', x: 127, y: 297.5, w: 3, h: 595, fill: '#c9a55a' },
    ...rosette(62, 297.5, 42, 22, '#d9bd7a', { strokeWidth: 0.7 }),
    { kind: 'ellipse', x: 62, y: 297.5, rx: 20, fill: '#0f4d3f', stroke: '#d9bd7a', strokeWidth: 1 },
    { kind: 'ellipse', x: 62, y: 297.5, rx: 6, fill: '#d9bd7a' },
    { kind: 'text', x: 485, y: 104, w: 600, text: 'UNIVERSITY PROGRAMME', font: 'sans', size: 12, color: '#0f4d3f', weight: 800, spacing: 460 },
    { kind: 'text', x: 485, y: 160, w: 640, text: 'Certificate of Completion', font: 'serif', size: 46, color: '#14261f', weight: 500 },
    { kind: 'rect', x: 485, y: 202, w: 64, h: 2, fill: '#c9a55a' },
    { kind: 'text', x: 485, y: 240, w: 600, text: 'This certifies that', font: 'serif', size: 17, color: '#5b6b63', italic: true },
    { kind: 'text', x: 485, y: 298, w: 640, text: '{{Name}}', font: 'serif', size: 52, color: '#0f4d3f', weight: 600, field: 'Name' },
    { kind: 'text', x: 485, y: 356, w: 600, text: 'has completed every course requirement with distinction.', font: 'sans', size: 15, color: '#4a5a52' },
    ...signatures(340, 630, 446, { ink: '#14261f', rule: '#9aa89f', label: '#7d8b84', leftLabel: 'Programme director', rightLabel: 'Date of award' }),
    verification(485, 550, '#7d8b84'),
  ],
};

// 4. Midnight tech for hackathons -----------------------------------------
const midnightTech: CertificateDesign = {
  id: 'bundled-hackathon',
  name: 'Hackathon Completion',
  category: 'Participation',
  background: '#0b1020',
  sampleName: 'Kabir Singh',
  shapes: [
    ...Array.from({ length: 11 }, (_, i): Shape => ({ kind: 'rect', x: 70 + i * 70, y: 297.5, w: 1, h: 595, fill: '#172042' })),
    ...Array.from({ length: 8 }, (_, i): Shape => ({ kind: 'rect', x: C, y: 18 + i * 70, w: 842, h: 1, fill: '#172042' })),
    { kind: 'ellipse', x: 706, y: 128, rx: 170, fill: '#6d5dfc', opacity: 0.32 },
    { kind: 'ellipse', x: 770, y: 210, rx: 90, fill: '#00d1b2', opacity: 0.22 },
    { kind: 'ellipse', x: 110, y: 560, rx: 150, fill: '#00d1b2', opacity: 0.16 },
    { kind: 'rect', x: 72, y: 138, w: 5, h: 58, radius: 2, fill: '#00d1b2' },
    { kind: 'text', x: 92, y: 116, w: 420, text: '// HACKATHON 2026', font: 'sans', size: 13, color: '#00d1b2', weight: 800, spacing: 300, align: 'left' },
    { kind: 'text', x: 92, y: 160, w: 600, text: 'Certificate of Completion', font: 'sans', size: 40, color: '#ffffff', weight: 800, align: 'left' },
    { kind: 'text', x: 92, y: 226, w: 400, text: 'Awarded to', font: 'sans', size: 14, color: '#8b93b8', align: 'left' },
    { kind: 'text', x: 92, y: 280, w: 620, text: '{{Name}}', font: 'sans', size: 52, color: '#b3a8ff', weight: 800, align: 'left', field: 'Name' },
    { kind: 'text', x: 92, y: 338, w: 560, text: 'for building, shipping and demoing a working product in 36 hours.', font: 'sans', size: 15, color: '#b7bedc', align: 'left' },
    { kind: 'rect', x: 166, y: 398, w: 148, h: 34, radius: 17, fill: '#141b38', stroke: '#2f3a66', strokeWidth: 1 },
    { kind: 'text', x: 166, y: 398, w: 140, text: 'Team Nebula', font: 'sans', size: 13, color: '#e6e8f5', weight: 600 },
    { kind: 'rect', x: 334, y: 398, w: 168, h: 34, radius: 17, fill: '#141b38', stroke: '#2f3a66', strokeWidth: 1 },
    { kind: 'text', x: 334, y: 398, w: 160, text: 'Top 10 finalist', font: 'sans', size: 13, color: '#e6e8f5', weight: 600 },
    { kind: 'text', x: 92, y: 482, w: 240, text: '{{Issuer}}', font: 'sans', size: 15, color: '#ffffff', weight: 700, align: 'left' },
    { kind: 'text', x: 92, y: 504, w: 240, text: 'Organised by', font: 'sans', size: 11, color: '#8b93b8', align: 'left' },
    { kind: 'text', x: 360, y: 482, w: 240, text: '{{Date}}', font: 'sans', size: 15, color: '#ffffff', weight: 700, align: 'left' },
    { kind: 'text', x: 360, y: 504, w: 240, text: 'Demo day', font: 'sans', size: 11, color: '#8b93b8', align: 'left' },
    verification(92, 552, '#6c759c', 'left'),
  ],
};

// 5. Rose and burgundy for recognition ------------------------------------
const roseRecognition: CertificateDesign = {
  id: 'bundled-employee',
  name: 'Employee Recognition',
  category: 'Corporate',
  background: '#fcf2f1',
  sampleName: 'Meera Kapoor',
  shapes: [
    { kind: 'ellipse', x: 0, y: 0, rx: 120, fill: '#f4d4d9' },
    { kind: 'ellipse', x: 842, y: 595, rx: 120, fill: '#f4d4d9' },
    { kind: 'rect', x: C, y: 297.5, w: 792, h: 545, stroke: '#7a1f3d', strokeWidth: 3 },
    { kind: 'rect', x: C, y: 297.5, w: 772, h: 525, stroke: '#cf95a3', strokeWidth: 1 },
    ...rosette(C, 98, 38, 18, '#c9879a', { strokeWidth: 0.7 }),
    { kind: 'ellipse', x: C, y: 98, rx: 20, fill: '#7a1f3d' },
    { kind: 'rect', x: C, y: 98, w: 12, h: 12, angle: 45, fill: '#f7dfe4' },
    { kind: 'text', x: C, y: 164, w: 600, text: 'EMPLOYEE RECOGNITION', font: 'sans', size: 12, color: '#7a1f3d', weight: 800, spacing: 500 },
    { kind: 'text', x: C, y: 212, w: 640, text: 'Certificate of Excellence', font: 'serif', size: 42, color: '#3b0f1f', weight: 500 },
    { kind: 'text', x: C, y: 256, w: 500, text: 'with gratitude to', font: 'serif', size: 16, color: '#8c5a66', italic: true },
    { kind: 'text', x: C, y: 316, w: 680, text: '{{Name}}', font: 'script', size: 64, color: '#7a1f3d', field: 'Name' },
    { kind: 'text', x: C, y: 378, w: 580, text: 'For leadership, care and an outstanding year of service to the team.', font: 'sans', size: 14, color: '#6e4a53' },
    ...signatures(290, 552, 446, { ink: '#3b0f1f', rule: '#cf95a3', label: '#a07a84', leftLabel: 'On behalf of' }),
    verification(C, 540, '#a07a84'),
  ],
};

// 6. Saffron and magenta for festivals and events --------------------------
const saffronFestival: CertificateDesign = {
  id: 'bundled-event',
  name: 'Event Participation',
  category: 'Event',
  background: '#fff8ea',
  sampleName: 'Rohan Das',
  shapes: [
    { kind: 'rect', x: C, y: 36, w: 842, h: 72, fill: '#f59e0b' },
    { kind: 'rect', x: C, y: 76, w: 842, h: 8, fill: '#e11d74' },
    ...Array.from({ length: 15 }, (_, i): Shape => ({ kind: 'ellipse', x: 28 + i * 56, y: 36, rx: 9, fill: '#ffd27a' })),
    { kind: 'rect', x: C, y: 576, w: 842, h: 38, fill: '#e11d74' },
    { kind: 'rect', x: C, y: 553, w: 842, h: 8, fill: '#f59e0b' },
    { kind: 'text', x: C, y: 138, w: 640, text: 'NATIONAL YOUTH FESTIVAL', font: 'sans', size: 13, color: '#e11d74', weight: 800, spacing: 420 },
    { kind: 'text', x: C, y: 188, w: 680, text: 'Certificate of Participation', font: 'serif', size: 44, color: '#3a1d0c', weight: 600 },
    { kind: 'text', x: C, y: 236, w: 500, text: 'is presented to', font: 'serif', size: 16, color: '#8a5a34', italic: true },
    { kind: 'text', x: C, y: 292, w: 680, text: '{{Name}}', font: 'serif', size: 54, color: '#c2410c', weight: 700, field: 'Name' },
    { kind: 'text', x: C, y: 348, w: 580, text: 'for taking part with energy and spirit in the festival programme.', font: 'sans', size: 15, color: '#6b4a2e' },
    ...signatures(290, 552, 424, { ink: '#3a1d0c', rule: '#d9a35f', label: '#9a7552', font: 'sans' }),
    verification(C, 520, '#9a7552'),
  ],
};

// 7. Ocean blue for professional training ---------------------------------
const oceanTraining: CertificateDesign = {
  id: 'bundled-training',
  name: 'Professional Training',
  category: 'Course',
  background: '#ffffff',
  sampleName: 'Ishaan Verma',
  shapes: [
    { kind: 'rect', x: C, y: 74, w: 842, h: 148, fill: '#0b3d91' },
    { kind: 'ellipse', x: 842, y: -14, rx: 150, fill: '#1557c0' },
    { kind: 'ellipse', x: 744, y: -46, rx: 108, fill: '#2f74e0', opacity: 0.6 },
    { kind: 'text', x: 70, y: 56, w: 500, text: 'PROFESSIONAL TRAINING', font: 'sans', size: 13, color: '#9cc3ff', weight: 800, spacing: 440, align: 'left' },
    { kind: 'text', x: 70, y: 100, w: 600, text: 'Certificate of Completion', font: 'serif', size: 38, color: '#ffffff', weight: 600, align: 'left' },
    { kind: 'text', x: 70, y: 204, w: 400, text: 'This is to certify that', font: 'sans', size: 15, color: '#5d6b85', align: 'left' },
    { kind: 'text', x: 70, y: 258, w: 560, text: '{{Name}}', font: 'serif', size: 50, color: '#0b3d91', weight: 600, align: 'left', field: 'Name' },
    { kind: 'rect', x: 120, y: 302, w: 100, h: 4, radius: 2, fill: '#22c1ee' },
    { kind: 'text', x: 70, y: 340, w: 500, text: 'has completed 40 hours of instructor-led training and the final assessment.', font: 'sans', size: 15, color: '#44516b', align: 'left' },
    { kind: 'ellipse', x: 694, y: 320, rx: 66, fill: '#eef5ff', stroke: '#0b3d91', strokeWidth: 2 },
    { kind: 'ellipse', x: 694, y: 320, rx: 56, stroke: '#22c1ee', strokeWidth: 1 },
    ...rosette(694, 320, 80, 16, '#9cc3ff', { strokeWidth: 0.5, squash: 0.18, opacity: 0.8 }),
    { kind: 'text', x: 694, y: 308, w: 120, text: 'CERTIFIED', font: 'sans', size: 11, color: '#0b3d91', weight: 800, spacing: 260 },
    { kind: 'text', x: 694, y: 336, w: 120, text: '2026', font: 'serif', size: 24, color: '#0b3d91', weight: 600 },
    { kind: 'text', x: 70, y: 456, w: 240, text: '{{Issuer}}', font: 'sans', size: 15, color: '#0b2a5e', weight: 700, align: 'left' },
    { kind: 'text', x: 70, y: 478, w: 240, text: 'Lead trainer', font: 'sans', size: 11, color: '#7a879f', align: 'left' },
    { kind: 'text', x: 330, y: 456, w: 240, text: '{{Date}}', font: 'sans', size: 15, color: '#0b2a5e', weight: 700, align: 'left' },
    { kind: 'text', x: 330, y: 478, w: 240, text: 'Completed on', font: 'sans', size: 11, color: '#7a879f', align: 'left' },
    { kind: 'rect', x: C, y: 590, w: 842, h: 10, fill: '#22c1ee' },
    verification(70, 540, '#7a879f', 'left'),
  ],
};

// 8. Ivory minimal ---------------------------------------------------------
const ivoryMinimal: CertificateDesign = {
  id: 'bundled-minimal',
  name: 'Minimal General Certificate',
  category: 'Other',
  background: '#f7f4ee',
  sampleName: 'Sara Thomas',
  shapes: [
    { kind: 'rect', x: C, y: 297.5, w: 762, h: 515, stroke: '#1b1b1b', strokeWidth: 0.8 },
    { kind: 'text', x: C, y: 126, w: 600, text: 'CERTIFICATE', font: 'sans', size: 12, color: '#1b1b1b', weight: 700, spacing: 800 },
    { kind: 'rect', x: C, y: 152, w: 40, h: 1, fill: '#b08d57' },
    { kind: 'text', x: C, y: 194, w: 600, text: 'of Recognition', font: 'serif', size: 40, color: '#1b1b1b', italic: true },
    { kind: 'text', x: C, y: 284, w: 680, text: '{{Name}}', font: 'serif', size: 58, color: '#1b1b1b', weight: 400, field: 'Name' },
    { kind: 'text', x: C, y: 346, w: 560, text: 'In recognition of commitment, craft and care.', font: 'serif', size: 17, color: '#6b665d', italic: true },
    ...signatures(300, 542, 436, { ink: '#1b1b1b', rule: '#b08d57', label: '#8b857a', font: 'sans' }),
    verification(C, 520, '#8b857a'),
  ],
};

// 9. Red, black and gold for sports ----------------------------------------
const sportsChampion: CertificateDesign = {
  id: 'bundled-sports',
  name: 'Sports Champion',
  category: 'Sports',
  background: '#111214',
  sampleName: 'Arjun Reddy',
  shapes: [
    { kind: 'rect', x: 760, y: 297.5, w: 70, h: 900, angle: 24, fill: '#e11d2e' },
    { kind: 'rect', x: 846, y: 297.5, w: 26, h: 900, angle: 24, fill: '#f5c518' },
    { kind: 'rect', x: 676, y: 297.5, w: 10, h: 900, angle: 24, fill: '#e11d2e', opacity: 0.55 },
    { kind: 'rect', x: 670, y: 236, w: 28, h: 96, angle: 16, fill: '#e11d2e' },
    { kind: 'rect', x: 716, y: 236, w: 28, h: 96, angle: -16, fill: '#2563eb' },
    { kind: 'ellipse', x: 693, y: 318, rx: 66, fill: '#f5c518' },
    { kind: 'ellipse', x: 693, y: 318, rx: 54, stroke: '#b8860b', strokeWidth: 2 },
    ...rosette(693, 318, 50, 14, '#d4a514', { strokeWidth: 0.6, squash: 0.3 }),
    { kind: 'text', x: 693, y: 318, w: 80, text: '1', font: 'serif', size: 58, color: '#111214', weight: 700 },
    { kind: 'text', x: 70, y: 116, w: 420, text: 'CHAMPIONSHIP 2026', font: 'sans', size: 13, color: '#f5c518', weight: 800, spacing: 420, align: 'left' },
    { kind: 'text', x: 70, y: 166, w: 520, text: 'Certificate of Victory', font: 'sans', size: 40, color: '#ffffff', weight: 800, align: 'left' },
    { kind: 'text', x: 70, y: 234, w: 400, text: 'Awarded to', font: 'sans', size: 14, color: '#a3a3a3', align: 'left' },
    { kind: 'text', x: 70, y: 288, w: 520, text: '{{Name}}', font: 'sans', size: 52, color: '#ffffff', weight: 800, align: 'left', field: 'Name' },
    { kind: 'rect', x: 120, y: 334, w: 100, h: 5, radius: 2.5, fill: '#e11d2e' },
    { kind: 'text', x: 70, y: 372, w: 480, text: 'First place, inter-college athletics meet, 400 m sprint.', font: 'sans', size: 15, color: '#d4d4d4', align: 'left' },
    { kind: 'text', x: 70, y: 468, w: 240, text: '{{Issuer}}', font: 'sans', size: 15, color: '#ffffff', weight: 700, align: 'left' },
    { kind: 'text', x: 70, y: 490, w: 240, text: 'Sports committee', font: 'sans', size: 11, color: '#a3a3a3', align: 'left' },
    { kind: 'text', x: 320, y: 468, w: 240, text: '{{Date}}', font: 'sans', size: 15, color: '#ffffff', weight: 700, align: 'left' },
    { kind: 'text', x: 320, y: 490, w: 240, text: 'Meet date', font: 'sans', size: 11, color: '#a3a3a3', align: 'left' },
    verification(70, 548, '#8a8a8a', 'left'),
  ],
};

// 10. Violet for conference speakers ----------------------------------------
const violetSpeaker: CertificateDesign = {
  id: 'bundled-conference',
  name: 'Conference Speaker',
  category: 'Event',
  background: '#f5f2ff',
  sampleName: 'Dr. Kavya Rao',
  shapes: [
    { kind: 'ellipse', x: 842, y: 0, rx: 262, fill: '#7c3aed' },
    { kind: 'ellipse', x: 700, y: -44, rx: 168, fill: '#a78bfa', opacity: 0.85 },
    { kind: 'ellipse', x: 830, y: 176, rx: 86, fill: '#f472b6', opacity: 0.9 },
    { kind: 'ellipse', x: 40, y: 575, rx: 96, fill: '#c4b5fd', opacity: 0.7 },
    { kind: 'text', x: 80, y: 120, w: 420, text: 'TECH SUMMIT 2026', font: 'sans', size: 13, color: '#7c3aed', weight: 800, spacing: 420, align: 'left' },
    { kind: 'text', x: 80, y: 170, w: 520, text: 'Speaker Certificate', font: 'serif', size: 46, color: '#24124d', weight: 600, align: 'left' },
    { kind: 'text', x: 80, y: 238, w: 400, text: 'With thanks to', font: 'sans', size: 15, color: '#6b5b95', align: 'left' },
    { kind: 'text', x: 80, y: 292, w: 560, text: '{{Name}}', font: 'serif', size: 50, color: '#4c1d95', weight: 600, align: 'left', field: 'Name' },
    { kind: 'text', x: 80, y: 348, w: 520, text: 'for an inspiring keynote on building inclusive products.', font: 'sans', size: 15, color: '#5b4b85', align: 'left' },
    { kind: 'rect', x: 162, y: 404, w: 164, h: 34, radius: 17, fill: '#ede9fe' },
    { kind: 'text', x: 162, y: 404, w: 160, text: 'Keynote speaker', font: 'sans', size: 13, color: '#5b21b6', weight: 700 },
    { kind: 'text', x: 80, y: 478, w: 240, text: '{{Issuer}}', font: 'sans', size: 15, color: '#24124d', weight: 700, align: 'left' },
    { kind: 'text', x: 80, y: 500, w: 240, text: 'Host', font: 'sans', size: 11, color: '#8b7fb3', align: 'left' },
    { kind: 'text', x: 330, y: 478, w: 240, text: '{{Date}}', font: 'sans', size: 15, color: '#24124d', weight: 700, align: 'left' },
    { kind: 'text', x: 330, y: 500, w: 240, text: 'Session date', font: 'sans', size: 11, color: '#8b7fb3', align: 'left' },
    verification(80, 550, '#8b7fb3', 'left'),
  ],
};

// 11. Maroon and gold for graduation ----------------------------------------
const maroonGraduation: CertificateDesign = {
  id: 'bundled-graduation',
  name: 'Graduation Honours',
  category: 'Education',
  background: '#fbf6ee',
  sampleName: 'Vihaan Gupta',
  shapes: [
    { kind: 'rect', x: C, y: 297.5, w: 800, h: 553, stroke: '#7f1d1d', strokeWidth: 6 },
    { kind: 'rect', x: C, y: 297.5, w: 778, h: 531, stroke: '#c9a55a', strokeWidth: 1.2 },
    ...[[32, 32], [810, 32], [32, 563], [810, 563]].map(([x, y]): Shape => ({ kind: 'rect', x, y, w: 22, h: 22, fill: '#7f1d1d' })),
    ...[[32, 32], [810, 32], [32, 563], [810, 563]].map(([x, y]): Shape => ({ kind: 'rect', x, y, w: 8, h: 8, angle: 45, fill: '#c9a55a' })),
    { kind: 'text', x: C, y: 100, w: 600, text: 'CLASS OF 2026', font: 'sans', size: 12, color: '#7f1d1d', weight: 800, spacing: 520 },
    { kind: 'text', x: C, y: 150, w: 680, text: 'Graduation Honours', font: 'serif', size: 48, color: '#3b0a0a', weight: 600 },
    { kind: 'text', x: C, y: 200, w: 500, text: 'conferred upon', font: 'serif', size: 16, color: '#7c5c4c', italic: true },
    { kind: 'text', x: C, y: 258, w: 680, text: '{{Name}}', font: 'script', size: 62, color: '#7f1d1d', field: 'Name' },
    { kind: 'text', x: C, y: 316, w: 600, text: 'with first-class distinction, Bachelor of Science.', font: 'sans', size: 14, color: '#6b4f43' },
    ...rosette(C, 418, 50, 26, '#c9a55a', { strokeWidth: 0.7 }),
    { kind: 'ellipse', x: C, y: 418, rx: 27, fill: '#7f1d1d', stroke: '#c9a55a', strokeWidth: 1.2 },
    { kind: 'text', x: C, y: 418, w: 60, text: 'MMXXVI', font: 'serif', size: 9, color: '#f3e2b3', weight: 600, spacing: 160 },
    ...signatures(212, 630, 420, { ink: '#3b0a0a', rule: '#c9a55a', label: '#9a7b6c', leftLabel: 'Registrar', rightLabel: 'Convocation' }),
    verification(C, 532, '#9a7b6c'),
  ],
};

// 12. Sage and sunflower for volunteers -------------------------------------
const sageVolunteer: CertificateDesign = {
  id: 'bundled-volunteer',
  name: 'Volunteer Appreciation',
  category: 'Community',
  background: '#f6f8f1',
  sampleName: 'Neha Joshi',
  shapes: [
    { kind: 'ellipse', x: 842, y: 595, rx: 214, fill: '#cfe3c0' },
    { kind: 'ellipse', x: 784, y: 566, rx: 116, fill: '#8fbf7a', opacity: 0.85 },
    { kind: 'ellipse', x: 0, y: 0, rx: 140, fill: '#f2d27a', opacity: 0.75 },
    { kind: 'ellipse', x: 96, y: 92, rx: 26, ry: 10, angle: 35, fill: '#5b8c4a' },
    { kind: 'ellipse', x: 124, y: 80, rx: 22, ry: 9, angle: -25, fill: '#7aa865' },
    { kind: 'ellipse', x: 744, y: 470, rx: 24, ry: 9, angle: -40, fill: '#5b8c4a' },
    { kind: 'text', x: C, y: 116, w: 600, text: 'VOLUNTEER APPRECIATION', font: 'sans', size: 12, color: '#3f6b33', weight: 800, spacing: 440 },
    { kind: 'text', x: C, y: 178, w: 500, text: 'Thank You', font: 'script', size: 72, color: '#2f4f27' },
    { kind: 'text', x: C, y: 238, w: 600, text: 'This certificate is gratefully presented to', font: 'serif', size: 16, color: '#6b7a5f', italic: true },
    { kind: 'text', x: C, y: 292, w: 680, text: '{{Name}}', font: 'serif', size: 50, color: '#2f4f27', weight: 600, field: 'Name' },
    { kind: 'rect', x: C, y: 334, w: 80, h: 3, radius: 1.5, fill: '#e0a93b' },
    { kind: 'text', x: C, y: 368, w: 580, text: 'for giving time, energy and heart to our community programme.', font: 'sans', size: 14, color: '#5c6a52' },
    ...signatures(290, 552, 432, { ink: '#2f4f27', rule: '#a9c39a', label: '#7d8c72', font: 'sans', leftLabel: 'Coordinator' }),
    verification(C, 526, '#7d8c72'),
  ],
};

// 13. Charcoal and mint for internships --------------------------------------
const mintInternship: CertificateDesign = {
  id: 'bundled-internship',
  name: 'Internship Completion',
  category: 'Corporate',
  background: '#ffffff',
  sampleName: 'Zoya Khan',
  shapes: [
    { kind: 'rect', x: 812, y: 297.5, w: 60, h: 595, fill: '#1f2937' },
    { kind: 'rect', x: 772, y: 297.5, w: 12, h: 595, fill: '#34d399' },
    { kind: 'rect', x: 754, y: 297.5, w: 4, h: 595, fill: '#34d399', opacity: 0.5 },
    { kind: 'rect', x: 92, y: 92, w: 44, h: 44, radius: 10, fill: '#1f2937' },
    { kind: 'text', x: 92, y: 92, w: 44, text: 'S', font: 'serif', size: 24, color: '#34d399', weight: 600 },
    { kind: 'text', x: 70, y: 160, w: 500, text: 'INTERNSHIP PROGRAMME', font: 'sans', size: 12, color: '#059669', weight: 800, spacing: 440, align: 'left' },
    { kind: 'text', x: 70, y: 206, w: 620, text: 'Certificate of Completion', font: 'serif', size: 42, color: '#111827', weight: 600, align: 'left' },
    { kind: 'text', x: 70, y: 266, w: 400, text: 'Presented to', font: 'sans', size: 14, color: '#6b7280', align: 'left' },
    { kind: 'text', x: 70, y: 316, w: 600, text: '{{Name}}', font: 'sans', size: 46, color: '#111827', weight: 800, align: 'left', field: 'Name' },
    { kind: 'text', x: 70, y: 370, w: 600, text: 'for completing a 12-week product engineering internship.', font: 'sans', size: 15, color: '#4b5563', align: 'left' },
    { kind: 'text', x: 70, y: 458, w: 240, text: '{{Issuer}}', font: 'sans', size: 15, color: '#111827', weight: 700, align: 'left' },
    { kind: 'text', x: 70, y: 480, w: 240, text: 'Mentor', font: 'sans', size: 11, color: '#9ca3af', align: 'left' },
    { kind: 'text', x: 320, y: 458, w: 240, text: '{{Date}}', font: 'sans', size: 15, color: '#111827', weight: 700, align: 'left' },
    { kind: 'text', x: 320, y: 480, w: 240, text: 'Completed', font: 'sans', size: 11, color: '#9ca3af', align: 'left' },
    verification(70, 540, '#9ca3af', 'left'),
  ],
};

// 14. Confetti for creative awards -------------------------------------------
const CONFETTI = ['#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];
const confetti: Shape[] = Array.from({ length: 36 }, (_, index): Shape => {
  const top = index < 18;
  const column = index % 18;
  const x = 30 + column * 46 + (index % 3) * 6;
  const y = top ? 34 + (index % 4) * 14 : 564 - (index % 4) * 14;
  const fill = CONFETTI[index % CONFETTI.length];
  return index % 3 === 0
    ? { kind: 'rect', x, y, w: 12, h: 5, radius: 2, angle: (index * 37) % 180, fill }
    : { kind: 'ellipse', x, y, rx: 4 + (index % 3) * 1.5, fill };
});
const confettiAward: CertificateDesign = {
  id: 'bundled-art',
  name: 'Art & Design Award',
  category: 'Achievement',
  background: '#fffdf7',
  sampleName: 'Ira Malhotra',
  shapes: [
    ...confetti,
    { kind: 'text', x: C, y: 136, w: 600, text: 'CREATIVE ARTS FESTIVAL', font: 'sans', size: 12, color: '#e11d48', weight: 800, spacing: 440 },
    { kind: 'text', x: C, y: 190, w: 600, text: 'Best in Show', font: 'serif', size: 54, color: '#1e1b4b', weight: 600 },
    { kind: 'text', x: C, y: 242, w: 400, text: 'awarded to', font: 'serif', size: 16, color: '#6b6880', italic: true },
    { kind: 'text', x: C, y: 298, w: 680, text: '{{Name}}', font: 'script', size: 62, color: '#7c3aed', field: 'Name' },
    { kind: 'text', x: C, y: 356, w: 600, text: 'for the most original work in the illustration category.', font: 'sans', size: 14, color: '#57536e' },
    ...signatures(290, 552, 412, { ink: '#1e1b4b', rule: '#d6d3e8', label: '#8f8aa8', font: 'sans', leftLabel: 'Jury chair' }),
    verification(C, 498, '#8f8aa8'),
  ],
};

/**
 * Ordered for the landing showcase: palettes alternate light and dark, and
 * each marquee row (the first and second half) mixes categories.
 */
export const CERTIFICATE_DESIGNS: CertificateDesign[] = [
  indigoGold, coralWorkshop, emeraldDiploma, midnightTech, roseRecognition, saffronFestival, oceanTraining,
  sportsChampion, violetSpeaker, maroonGraduation, ivoryMinimal, sageVolunteer, confettiAward, mintInternship,
];
