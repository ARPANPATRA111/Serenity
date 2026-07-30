import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { getBytes, ref, uploadString } from 'firebase/storage';
import { afterAll, beforeAll, describe, test } from 'vitest';

let environment: RulesTestEnvironment;

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'demo-serenity',
    storage: {
      rules: readFileSync(resolve(process.cwd(), 'storage.rules'), 'utf8'),
    },
  });

  await environment.withSecurityRulesDisabled(async context => {
    await uploadString(ref(context.storage(), 'certificates/existing.txt'), 'private fixture');
  });
});

afterAll(async () => {
  await environment?.cleanup();
});

describe('Storage signed-route boundary', () => {
  test('anonymous and authenticated browser uploads are denied', async () => {
    const anonymousStorage = environment.unauthenticatedContext().storage();
    const userStorage = environment.authenticatedContext('user-a').storage();

    await assertFails(uploadString(ref(anonymousStorage, 'certificates/anonymous.txt'), 'blocked'));
    await assertFails(uploadString(ref(userStorage, 'certificates/user-a.txt'), 'blocked'));
  });

  test('direct browser downloads are denied', async () => {
    const userStorage = environment.authenticatedContext('user-a').storage();
    await assertFails(getBytes(ref(userStorage, 'certificates/existing.txt')));
  });
});
