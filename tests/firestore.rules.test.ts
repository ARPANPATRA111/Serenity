import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, describe, test } from 'vitest';

let environment: RulesTestEnvironment;

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'demo-serenity',
    firestore: {
      rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
    },
  });

  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, 'users/user-a'), {
        email: 'user-a@example.test',
        isPremium: false,
        certificatesGenerated: 1,
      }),
      setDoc(doc(db, 'certificates/cert-a'), {
        userId: 'user-a',
        recipientName: 'Test Recipient',
        recipientEmail: 'private@example.test',
      }),
      setDoc(doc(db, 'templates/private-a'), {
        userId: 'user-a',
        isPublic: false,
      }),
      setDoc(doc(db, 'templates/public-a'), {
        userId: 'user-a',
        isPublic: true,
      }),
      setDoc(doc(db, 'events/event-a'), {
        id: 'event-a',
        userId: 'user-a',
        name: 'Private planning context',
      }),
      setDoc(doc(db, '_adminSecrets/console'), { passphraseHash: 'scrypt$32768$8$1$c2FsdA==$aGFzaA==' }),
      setDoc(doc(db, '_adminUsage/2026-09-30'), { reads: 10, requests: 1 }),
      setDoc(doc(db, 'adminAuditLog/entry-a'), { action: 'premium.granted', target: 'user-a' }),
      setDoc(doc(db, 'generationBatches/batch-a'), { userId: 'user-a', certificateCount: 3 }),
    ]);
  });
});

afterAll(async () => {
  await environment?.cleanup();
});

describe('Firestore tenant and authority boundaries', () => {
  test('anonymous users cannot enumerate certificate documents', async () => {
    const db = environment.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'certificates/cert-a')));
  });

  test('owners can read their certificate while another user cannot', async () => {
    const ownerDb = environment.authenticatedContext('user-a').firestore();
    const otherDb = environment.authenticatedContext('user-b').firestore();

    await assertSucceeds(getDoc(doc(ownerDb, 'certificates/cert-a')));
    await assertFails(getDoc(doc(otherDb, 'certificates/cert-a')));
  });

  test('direct template reads are denied so public responses use API allowlists', async () => {
    const anonymousDb = environment.unauthenticatedContext().firestore();
    const ownerDb = environment.authenticatedContext('user-a').firestore();
    const otherDb = environment.authenticatedContext('user-b').firestore();

    await assertFails(getDoc(doc(anonymousDb, 'templates/public-a')));
    await assertFails(getDoc(doc(ownerDb, 'templates/private-a')));
    await assertFails(getDoc(doc(otherDb, 'templates/private-a')));
  });

  test('browser clients cannot grant premium or change usage counters', async () => {
    const ownerDb = environment.authenticatedContext('user-a').firestore();

    await assertFails(updateDoc(doc(ownerDb, 'users/user-a'), { isPremium: true }));
    await assertFails(updateDoc(doc(ownerDb, 'users/user-a'), { certificatesGenerated: 0 }));
  });

  test('direct event access is denied so APIs can return public-safe projections', async () => {
    const ownerDb = environment.authenticatedContext('user-a').firestore();
    const anonymousDb = environment.unauthenticatedContext().firestore();

    await assertFails(getDoc(doc(ownerDb, 'events/event-a')));
    await assertFails(getDoc(doc(anonymousDb, 'events/event-a')));
    await assertFails(setDoc(doc(ownerDb, 'events/new-event'), { userId: 'user-a', name: 'Injected' }));
  });

  test('browser clients cannot mutate server-owned resources', async () => {
    const ownerDb = environment.authenticatedContext('user-a').firestore();

    await assertFails(setDoc(doc(ownerDb, 'certificates/new-cert'), { userId: 'user-a' }));
    await assertFails(deleteDoc(doc(ownerDb, 'templates/private-a')));
  });

  test('users cannot set plan fields that the operator console owns', async () => {
    const ownerDb = environment.authenticatedContext('user-a').firestore();

    await assertFails(updateDoc(doc(ownerDb, 'users/user-a'), { premiumUntil: '2099-01-01T00:00:00.000Z' }));
    await assertFails(updateDoc(doc(ownerDb, 'users/user-a'), { premiumSource: 'console' }));
  });

  test('operator console data is unreachable from browsers, even for operator accounts', async () => {
    const anonymousDb = environment.unauthenticatedContext().firestore();
    const ownerDb = environment.authenticatedContext('user-a').firestore();
    // The console claim grants nothing at the rules layer: console data is
    // only ever read through the Admin SDK behind the console session checks.
    const operatorDb = environment.authenticatedContext('ops-admin', { serenityAdmin: true, email_verified: true }).firestore();

    for (const db of [anonymousDb, ownerDb, operatorDb]) {
      await assertFails(getDoc(doc(db, '_adminSecrets/console')));
      await assertFails(setDoc(doc(db, '_adminSecrets/console'), { passphraseHash: 'attacker-chosen' }));
      await assertFails(getDoc(doc(db, '_adminUsage/2026-09-30')));
      await assertFails(getDoc(doc(db, 'adminAuditLog/entry-a')));
      await assertFails(setDoc(doc(db, 'adminAuditLog/forged'), { action: 'premium.granted' }));
    }
  });

  test('generation batch summaries are server-only', async () => {
    const ownerDb = environment.authenticatedContext('user-a').firestore();
    const anonymousDb = environment.unauthenticatedContext().firestore();

    await assertFails(getDoc(doc(ownerDb, 'generationBatches/batch-a')));
    await assertFails(getDoc(doc(anonymousDb, 'generationBatches/batch-a')));
    await assertFails(setDoc(doc(ownerDb, 'generationBatches/batch-b'), { userId: 'user-a', certificateCount: 999 }));
  });
});
