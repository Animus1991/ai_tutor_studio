import { readFile } from "node:fs/promises";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const PROJECT_ID = "demo-memora-rules";
let environment: RulesTestEnvironment;

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: await readFile("firestore.rules", "utf8"),
    },
  });
});

beforeEach(async () => {
  await environment.clearFirestore();
});

afterAll(async () => {
  await environment.cleanup();
});

const authenticatedDb = (
  uid: string,
  email: string,
  emailVerified = true,
) =>
  environment
    .authenticatedContext(uid, {
      email,
      email_verified: emailVerified,
    })
    .firestore();

describe("owner-scoped user data", () => {
  it("allows an owner task and denies cross-user reads", async () => {
    const ownerDb = authenticatedDb("alice", "alice@example.com");
    const strangerDb = authenticatedDb("bob", "bob@example.com");
    const taskRef = doc(ownerDb, "users/alice/tasks/task-1");

    await assertSucceeds(
      setDoc(taskRef, {
        title: "Review",
        course: "Math",
        completed: false,
        userId: "alice",
        createdAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(getDoc(taskRef));
    await assertFails(
      getDoc(doc(strangerDb, "users/alice/tasks/task-1")),
    );
  });

  it("denies writes from an unverified account", async () => {
    const unverifiedDb = authenticatedDb(
      "alice",
      "alice@example.com",
      false,
    );
    await assertFails(
      setDoc(doc(unverifiedDb, "users/alice/tasks/task-1"), {
        title: "Review",
        course: "Math",
        completed: false,
        userId: "alice",
        createdAt: serverTimestamp(),
      }),
    );
  });
});

describe("collaboration membership", () => {
  it("allows owners and accepted member emails but denies strangers", async () => {
    const ownerDb = authenticatedDb("owner", "owner@example.com");
    const memberDb = authenticatedDb("member", "member@example.com");
    const strangerDb = authenticatedDb("stranger", "stranger@example.com");
    const roomPath = "rooms/private-room-123";

    await assertSucceeds(
      setDoc(doc(ownerDb, roomPath), {
        ownerId: "owner",
        memberEmails: ["owner@example.com", "member@example.com"],
        createdAt: serverTimestamp(),
      }),
    );

    await assertSucceeds(getDoc(doc(ownerDb, roomPath)));
    await assertSucceeds(getDoc(doc(memberDb, roomPath)));
    await assertFails(getDoc(doc(strangerDb, roomPath)));
  });

  it("allows room members to write messages and blocks non-members", async () => {
    const ownerDb = authenticatedDb("owner", "owner@example.com");
    const memberDb = authenticatedDb("member", "member@example.com");
    const strangerDb = authenticatedDb("stranger", "stranger@example.com");
    const roomId = "private-room-123";

    await assertSucceeds(
      setDoc(doc(ownerDb, `rooms/${roomId}`), {
        ownerId: "owner",
        memberEmails: ["owner@example.com", "member@example.com"],
        createdAt: serverTimestamp(),
      }),
    );

    await assertSucceeds(
      setDoc(doc(memberDb, `rooms/${roomId}/messages/member-message`), {
        roomId,
        user: "Member",
        text: "Hello",
        userId: "member",
        createdAt: serverTimestamp(),
      }),
    );
    await assertFails(
      setDoc(doc(strangerDb, `rooms/${roomId}/messages/stranger-message`), {
        roomId,
        user: "Stranger",
        text: "Hello",
        userId: "stranger",
        createdAt: serverTimestamp(),
      }),
    );
  });
});
