import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";

const ME = { uid: "me", email: "me@example.com" };
const OTHER = { uid: "other", email: "other@example.com" }; // on the allowlist, but it's not their folder
const STRANGER = { uid: "stranger", email: "stranger@example.com" }; // signed in, not on the allowlist

let env: RulesTestEnvironment;

const as = (who: { uid: string; email: string }) => env.authenticatedContext(who.uid, { email: who.email }).firestore();
const staples = (items: string[] = ["salt"]) => ({ items, updatedAt: 1 });

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-recipe-box-rules",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8180 },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "config/allowlist"), { emails: [ME.email, OTHER.email] });
    await setDoc(doc(db, "users/me/pantry/staples"), staples());
    await setDoc(doc(db, "users/stranger/pantry/staples"), staples());
  });
});

describe("pantry", () => {
  it("you can read and change your own", async () => {
    await assertSucceeds(getDoc(doc(as(ME), "users/me/pantry/staples")));
    await assertSucceeds(setDoc(doc(as(ME), "users/me/pantry/staples"), staples(["salt", "cumin"])));
    await assertSucceeds(deleteDoc(doc(as(ME), "users/me/pantry/staples")));
  });

  it("someone else on the allowlist can't see or touch yours", async () => {
    await assertFails(getDoc(doc(as(OTHER), "users/me/pantry/staples")));
    await assertFails(setDoc(doc(as(OTHER), "users/me/pantry/staples"), staples()));
  });

  it("signed-in strangers get nothing, even in their own folder", async () => {
    await assertFails(getDoc(doc(as(STRANGER), "users/stranger/pantry/staples")));
    await assertFails(setDoc(doc(as(STRANGER), "users/stranger/pantry/staples"), staples()));
  });

  it("signed-out visitors get nothing", async () => {
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, "users/me/pantry/staples")));
  });

  it("rejects malformed pantries", async () => {
    await assertFails(setDoc(doc(as(ME), "users/me/pantry/staples"), { items: "salt", updatedAt: 1 }));
    await assertFails(setDoc(doc(as(ME), "users/me/pantry/staples"), { items: ["salt"] }));
    const tooMany = Array.from({ length: 301 }, (_, i) => `item ${i}`);
    await assertFails(setDoc(doc(as(ME), "users/me/pantry/staples"), staples(tooMany)));
  });

  it("matches emails without caring about capitals", async () => {
    const shouty = env.authenticatedContext("me", { email: "ME@Example.com" }).firestore();
    await assertSucceeds(getDoc(doc(shouty, "users/me/pantry/staples")));
  });
});

describe("everything else", () => {
  it("unlisted paths are closed, even in your own folder", async () => {
    await assertFails(setDoc(doc(as(ME), "users/me/secrets/x"), { a: 1 }));
    await assertFails(setDoc(doc(as(ME), "notes/x"), { a: 1 }));
  });

  it("config can't be read or changed from the app", async () => {
    await assertFails(getDoc(doc(as(ME), "config/allowlist")));
    await assertFails(setDoc(doc(as(ME), "config/allowlist"), { emails: [ME.email, STRANGER.email] }));
  });
});
