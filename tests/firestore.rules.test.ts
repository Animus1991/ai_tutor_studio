import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const PROJECT_ID = 'memora-rules-test';
const RULES_PATH = resolve(process.cwd(), 'firestore.rules');

let testEnv: RulesTestEnvironment;

function ownerDb(uid: string) {
  return testEnv.authenticatedContext(uid).firestore();
}

function strangerDb(uid: string) {
  return testEnv.authenticatedContext(uid).firestore();
}

describe('Firestore security rules', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: readFileSync(RULES_PATH, 'utf8'),
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  it('allows owners to create and read tasks', async () => {
    const db = ownerDb('alice');
    await assertSucceeds(
      setDoc(doc(db, 'users/alice/tasks/task1'), {
        title: 'Review notes',
        course: 'Biology',
        completed: false,
        userId: 'alice',
        createdAt: serverTimestamp(),
      }),
    );

    const snap = await getDoc(doc(db, 'users/alice/tasks/task1'));
    expect(snap.exists()).toBe(true);
  });

  it('denies cross-user task reads', async () => {
    const aliceDb = ownerDb('alice');
    await assertSucceeds(
      setDoc(doc(aliceDb, 'users/alice/tasks/task1'), {
        title: 'Private task',
        course: 'Biology',
        completed: false,
        userId: 'alice',
        createdAt: serverTimestamp(),
      }),
    );

    const bobDb = strangerDb('bob');
    await assertFails(getDoc(doc(bobDb, 'users/alice/tasks/task1')));
  });

  it('allows owners to create decks and flashcards', async () => {
    const db = ownerDb('alice');
    await assertSucceeds(
      setDoc(doc(db, 'users/alice/decks/deck1'), {
        title: 'Week 1',
        createdAt: serverTimestamp(),
      }),
    );

    await assertSucceeds(
      setDoc(doc(db, 'users/alice/flashcards/card1'), {
        deckId: 'deck1',
        front: 'Term',
        back: 'Definition',
        createdAt: serverTimestamp(),
      }),
    );
  });

  it('allows authenticated users to write yjs_state documents', async () => {
    const db = ownerDb('alice');
    await assertSucceeds(
      setDoc(doc(db, 'yjs_state/default_room'), {
        updatedAt: new Date().toISOString(),
        payload: 'demo',
      }),
    );
  });

  it('denies unauthenticated reads of user courses', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'users/alice/courses/course1')));
  });
});
