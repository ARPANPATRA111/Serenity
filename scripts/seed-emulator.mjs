import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { hashPassphrase } from './admin/lib/passphrase.mjs';

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || 'demo-serenity';
if (!projectId.startsWith('demo-')) {
  throw new Error('Refusing to seed a non-demo Firebase project');
}

process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';

const app = initializeApp({ projectId });
const db = getFirestore(app);
const auth = getAuth(app);

const users = [
  { uid: 'user-a', email: 'user-a@example.test', displayName: 'User A' },
  { uid: 'user-b', email: 'user-b@example.test', displayName: 'User B' },
];

// Local operator account for the console. The claim and passphrase below are
// test-only values that exist solely in the demo emulator project.
const operator = { uid: 'ops-admin', email: 'ops-admin@example.test', displayName: 'Console Operator' };
const LOCAL_CONSOLE_PASSPHRASE = 'local-console-passphrase';

for (const user of [...users, operator]) {
  try {
    await auth.createUser({ ...user, password: 'Test-only-123!', emailVerified: true });
  } catch (error) {
    if (error?.code !== 'auth/uid-already-exists' && error?.code !== 'auth/email-already-exists') throw error;
  }
  if (user.uid === operator.uid) {
    await auth.setCustomUserClaims(operator.uid, { serenityAdmin: true });
    continue;
  }
  await db.collection('users').doc(user.uid).set({
    id: user.uid,
    email: user.email,
    name: user.displayName,
    emailVerified: true,
    isPremium: false,
    certificatesGenerated: user.uid === 'user-a' ? 2 : 0,
    createdAt: Timestamp.now(),
  }, { merge: true });
}

const templateDefinitions = [
  ['academic-course', 'Academic Course Completion', 'Academic', '#4f46e5'],
  ['workshop', 'Workshop Participation', 'Workshop', '#0f766e'],
  ['training', 'Training Completion', 'Training', '#1d4ed8'],
  ['achievement', 'Achievement Award', 'Awards', '#b45309'],
  ['employee', 'Employee Recognition', 'Recognition', '#be123c'],
  ['compliance', 'Compliance Training', 'Corporate', '#334155'],
  ['event', 'Event Participation', 'Events', '#7c3aed'],
  ['speaker', 'Speaker Appreciation', 'Appreciation', '#c2410c'],
  ['volunteer', 'Volunteer Appreciation', 'Appreciation', '#15803d'],
  ['hackathon', 'Hackathon Award', 'Awards', '#0369a1'],
  ['internship', 'Internship Completion', 'Academic', '#4338ca'],
  ['minimal', 'Minimal General Certificate', 'General', '#111827'],
];

function createCanvasJson(label, accent) {
  return JSON.stringify({
    version: '5.3.0',
    background: '#ffffff',
    objects: [
      { type: 'rect', left: 20, top: 20, width: 802, height: 555, fill: 'transparent', stroke: accent, strokeWidth: 4 },
      { type: 'textbox', left: 421, top: 120, originX: 'center', originY: 'center', width: 650, text: label.toUpperCase(), fontFamily: 'Montserrat', fontSize: 24, fontWeight: 700, textAlign: 'center', fill: accent },
      { type: 'textbox', left: 421, top: 255, originX: 'center', originY: 'center', width: 650, text: '{{Name}}', dynamicKey: 'Name', isPlaceholder: true, fontFamily: 'Playfair Display', fontSize: 48, fontWeight: 600, textAlign: 'center', fill: '#111827', editable: false },
      { type: 'textbox', left: 421, top: 355, originX: 'center', originY: 'center', width: 620, text: 'Presented by {{Issuer}} on {{Date}}', fontFamily: 'Inter', fontSize: 16, textAlign: 'center', fill: '#475569' },
      { type: 'textbox', left: 421, top: 570, originX: 'center', originY: 'center', width: 350, text: '{{VERIFICATION_URL}}', fontFamily: 'Courier New', fontSize: 9, textAlign: 'center', fill: '#64748b', editable: false, visible: true, isVerificationUrl: true, isLocked: true, lockScalingX: true, lockScalingY: true, hasControls: false },
    ],
  });
}

const batch = db.batch();
const demoEvents = [
  {
    id: 'event-serenity-buildathon',
    name: 'Serenity Buildathon 2026',
    type: 'Hackathon',
    description: 'A demo hackathon used to validate optional event context on certificate verification pages.',
    organizerName: 'Serenity Demo Organization',
    startAt: new Date(Date.now() - 7 * 86_400_000).toISOString(),
    endAt: new Date(Date.now() - 6 * 86_400_000).toISOString(),
    timezone: 'Asia/Kolkata',
    venueName: 'Innovation Hall',
    city: 'Kolkata',
    country: 'India',
    websiteUrl: 'https://example.test/buildathon',
    registrationUrl: 'https://example.test/buildathon/register',
    coverImageUrl: '',
    galleryImageUrls: [],
    links: [{ label: 'Demo results', url: 'https://example.test/buildathon/results' }],
    tags: ['hackathon', 'demo'],
  },
  {
    id: 'event-accessible-web-workshop',
    name: 'Accessible Web Workshop',
    type: 'Workshop',
    description: 'A demo workshop event for editor linking and backward-compatible verification testing.',
    organizerName: 'Serenity Community',
    timezone: 'UTC',
    galleryImageUrls: [],
    links: [],
    tags: ['workshop', 'accessibility'],
  },
];

for (const event of demoEvents) {
  const now = new Date().toISOString();
  batch.set(db.collection('events').doc(event.id), {
    ...event,
    userId: 'user-a',
    createdAt: now,
    updatedAt: now,
  });
}

for (const [slug, name, category, accent] of templateDefinitions) {
  const id = `curated-${slug}`;
  batch.set(db.collection('templates').doc(id), {
    id,
    name,
    normalizedName: name.toLocaleLowerCase('en-US'),
    canvasJSON: createCanvasJson(name, accent),
    thumbnail: null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    certificateCount: 0,
    isPublic: true,
    publicationStatus: 'public',
    publishedAt: Timestamp.now(),
    reviewedAt: Timestamp.now(),
    schemaVersion: 2,
    source: 'serenity_curated',
    creatorName: 'Serenity',
    stars: 0,
    tags: [category.toLocaleLowerCase('en-US'), 'curated'],
    category,
    certificateMetadata: {
      title: name,
      issuedBy: 'Organization Name',
      description: '',
      ...(slug === 'hackathon' ? { eventId: 'event-serenity-buildathon' } : {}),
    },
  });
}

for (let index = 0; index < 8; index += 1) {
  const id = `demo-certificate-${String(index + 1).padStart(2, '0')}`;
  const createdMillis = Date.now() - index * 86_400_000;
  // Production records store createdAt as an ISO string (see the certificates API).
  const createdAt = new Date(createdMillis).toISOString();
  batch.set(db.collection('certificates').doc(id), {
    id,
    userId: 'user-a',
    recipientName: `Demo Recipient ${index + 1}`,
    recipientEmail: `recipient-${index + 1}@example.test`,
    title: 'Course Completion',
    issuerName: 'Demo Organization',
    templateId: 'curated-academic-course',
    templateName: 'Academic Course Completion',
    generationBatchId: index < 4 ? 'demo-batch-a' : 'demo-batch-b',
    // Mixed on purpose: older releases stored issuedAt as a Timestamp or a number.
    issuedAt: index % 2 === 0 ? Timestamp.fromMillis(createdMillis) : createdMillis,
    createdAt,
    updatedAt: Timestamp.fromMillis(createdMillis),
    isActive: true,
    viewCount: index,
    emailStatus: index % 3 === 0 ? 'sent' : 'not_sent',
    ...(index < 2 ? { eventId: 'event-serenity-buildathon' } : {}),
  });
}
// Records shaped exactly as the deployed main branch wrote them, plus the
// edge cases verification must keep handling.
const legacyCreated = new Date(Date.now() - 40 * 86_400_000);
const legacyBase = {
  templateId: 'local',
  userId: 'user-a',
  templateName: 'Legacy Template',
  title: 'Certificate of Completion',
  description: '',
  issuerName: 'Legacy Organization',
  viewCount: 3,
  metadata: { Name: 'Legacy Recipient', Email: 'legacy@example.test' },
  certificateImage: '',
  createdAt: legacyCreated.toISOString(),
  issuedAt: legacyCreated.getTime(),
};
batch.set(db.collection('certificates').doc('LegacyMain01'), {
  ...legacyBase, id: 'LegacyMain01', recipientName: 'Legacy Recipient', recipientEmail: 'legacy@example.test', isActive: true,
});
batch.set(db.collection('certificates').doc('LegacyNoFlag1'), {
  ...legacyBase, id: 'LegacyNoFlag1', recipientName: 'Record Without Active Flag',
});
batch.set(db.collection('certificates').doc('Revoked_Cert-01'), {
  ...legacyBase, id: 'Revoked_Cert-01', recipientName: 'Revoked Recipient', isActive: false,
});

batch.set(db.collection('generationBatches').doc('demo-batch-a'), {
  id: 'demo-batch-a',
  userId: 'user-a',
  templateId: 'curated-academic-course',
  templateName: 'Academic Course Completion',
  title: 'Course Completion',
  issuerName: 'Demo Organization',
  certificateCount: 4,
  recipientsWithEmail: 4,
  createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  updatedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
});

batch.set(db.collection('emailLogs').doc('demo-email-1'), {
  to: 'recipient-1@example.test',
  certificateId: 'demo-certificate-01',
  messageId: 'demo-message-1',
  userId: 'user-a',
  hasAttachment: true,
  sentAt: Timestamp.fromMillis(Date.now() - 86_400_000),
});

batch.set(db.collection('leads').doc('demo-lead-1'), {
  userId: 'anonymous',
  email: 'user-b@example.test',
  feature: 'pro_pricing',
  timestamp: Date.now() - 2 * 86_400_000,
  metadata: { requirements: 'About 400 certificates per month for our university events.', source: 'landing_pricing' },
  createdAt: Timestamp.fromMillis(Date.now() - 2 * 86_400_000),
});
batch.set(db.collection('waitlist').doc('user-b@example.test'), {
  email: 'user-b@example.test',
  features: ['pro_pricing'],
  createdAt: Timestamp.fromMillis(Date.now() - 2 * 86_400_000),
  source: 'feature_gate',
});

batch.set(db.collection('_adminSecrets').doc('console'), {
  passphraseHash: await hashPassphrase(LOCAL_CONSOLE_PASSPHRASE),
  updatedAt: new Date().toISOString(),
  updatedBy: 'seed',
});
batch.set(db.collection('_adminSecrets').doc('lockout'), { failures: 0, windowStart: 0, lockedUntil: 0 });

await batch.commit();

console.log(`Seeded ${users.length} users, 1 console operator, ${demoEvents.length} events, ${templateDefinitions.length} curated templates, 8 demo and 3 legacy-shaped certificates, and console data into ${projectId}.`);
