// Security rules tests. Need the Firestore emulator (Java 21+):  npm run test:rules
import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, test } from "vitest";

const CODE = "test-garden";
let env;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-eden",
    firestore: { rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8") },
  });
});
afterAll(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "gardens", CODE), { name: "Eden" });
    await setDoc(doc(ctx.firestore(), "gardens", CODE, "waterings", "w1"),
      { zone: "A1", by: "Papa", day: "2026-09-20", at: new Date() });
  });
});

const user = () => env.authenticatedContext("anon-user").firestore();
const stranger = () => env.unauthenticatedContext().firestore();
const waterings = (db, code = CODE) => collection(db, "gardens", code, "waterings");
const good = { zone: "B3", by: "Papa", day: "2026-09-21", at: serverTimestamp() };

describe("garden code", () => {
  test("a signed-in user can check whether a code exists", async () => {
    await assertSucceeds(getDoc(doc(user(), "gardens", CODE)));
    await assertSucceeds(getDoc(doc(user(), "gardens", "wrong-code")));
  });
  test("nobody can list the codes", async () => {
    await assertFails(getDocs(collection(user(), "gardens")));
  });
  test("nobody can create or change a garden", async () => {
    await assertFails(setDoc(doc(user(), "gardens", "new-garden"), { name: "x" }));
    await assertFails(updateDoc(doc(user(), "gardens", CODE), { name: "x" }));
  });
  test("signed-out visitors can't even check a code", async () => {
    await assertFails(getDoc(doc(stranger(), "gardens", CODE)));
  });
});

describe("waterings", () => {
  test("readable with the right code only", async () => {
    await assertSucceeds(getDocs(waterings(user())));
    await assertFails(getDocs(waterings(user(), "wrong-code")));
    await assertFails(getDocs(waterings(stranger())));
  });

  test("a valid watering can be added", async () => {
    await assertSucceeds(addDoc(waterings(user()), good));
  });

  test("not with a wrong code, nor signed out", async () => {
    await assertFails(addDoc(waterings(user(), "wrong-code"), good));
    await assertFails(addDoc(waterings(stranger()), good));
  });

  test.each([
    ["missing name", { ...good, by: undefined }],
    ["empty name", { ...good, by: "" }],
    ["name too long", { ...good, by: "x".repeat(41) }],
    ["bad day format", { ...good, day: "21/09/2026" }],
    ["bad zone id", { ...good, zone: "../x" }],
    ["client-chosen time", { ...good, at: new Date() }],
    ["extra field", { ...good, note: "hi" }],
  ])("rejected: %s", async (_, data) => {
    const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    await assertFails(addDoc(waterings(user()), clean));
  });

  test("waterings can't be edited or deleted", async () => {
    const w1 = doc(user(), "gardens", CODE, "waterings", "w1");
    await assertFails(updateDoc(w1, { by: "Someone else" }));
    await assertFails(deleteDoc(w1));
  });
});
