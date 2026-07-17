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
  updateDoc,
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

  it("matches member emails case-insensitively", async () => {
    const ownerDb = authenticatedDb("owner", "owner@example.com");
    // Token email mixed case; allow-list stored lowercased
    const memberDb = authenticatedDb("member", "Member@Example.com");
    const roomPath = "rooms/case-room-1234";

    await assertSucceeds(
      setDoc(doc(ownerDb, roomPath), {
        ownerId: "owner",
        memberEmails: ["owner@example.com", "member@example.com"],
        createdAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(getDoc(doc(memberDb, roomPath)));
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

describe("student-safe social", () => {
  it("enforces invite-only study circles", async () => {
    const alice = authenticatedDb("alice", "alice@school.edu");
    const bob = authenticatedDb("bob", "bob@school.edu");

    await assertSucceeds(
      setDoc(doc(alice, "studyCircles/circle1"), {
        name: "Chem pod",
        topic: "Midterm",
        ownerId: "alice",
        memberEmails: ["alice@school.edu"],
        purpose: "learning",
        createdAt: serverTimestamp(),
      }),
    );

    await assertFails(getDoc(doc(bob, "studyCircles/circle1")));
    await assertSucceeds(
      updateDoc(doc(alice, "studyCircles/circle1"), {
        memberEmails: ["alice@school.edu", "bob@school.edu"],
      }),
    );
    await assertSucceeds(getDoc(doc(bob, "studyCircles/circle1")));
  });

  it("allows create-only reports and enum kudos", async () => {
    const alice = authenticatedDb("alice", "alice@school.edu");
    const bob = authenticatedDb("bob", "bob@school.edu");

    await assertSucceeds(
      setDoc(doc(alice, "rooms/roomsafe01"), {
        ownerId: "alice",
        memberEmails: ["alice@school.edu", "bob@school.edu"],
        createdAt: serverTimestamp(),
      }),
    );

    await assertSucceeds(
      setDoc(doc(bob, "rooms/roomsafe01/reports/r1"), {
        reporterId: "bob",
        messageId: "m1",
        reason: "harassment",
        note: "",
        createdAt: serverTimestamp(),
      }),
    );
    await assertFails(getDoc(doc(alice, "rooms/roomsafe01/reports/r1")));

    await assertSucceeds(
      setDoc(doc(bob, "rooms/roomsafe01/kudos/k1"), {
        fromUserId: "bob",
        toUserId: "alice",
        kind: "helpful",
        createdAt: serverTimestamp(),
      }),
    );
    await assertFails(
      setDoc(doc(bob, "rooms/roomsafe01/kudos/k2"), {
        fromUserId: "bob",
        toUserId: "alice",
        kind: "superlike",
        createdAt: serverTimestamp(),
      }),
    );
  });
});
