import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";

const ME = { uid: "me", email: "me@example.com" };
const OTHER = { uid: "other", email: "other@example.com" }; // on the allowlist, but it's not their folder
const STRANGER = { uid: "stranger", email: "stranger@example.com" }; // signed in, not on the allowlist

let env: RulesTestEnvironment;

const as = (who: { uid: string; email: string }) => env.authenticatedContext(who.uid, { email: who.email }).firestore();
const staples = (items: string[] = ["salt"]) => ({ items, updatedAt: 1 });
const recipe = (overrides: Record<string, unknown> = {}) => ({
  title: "Tomato soup",
  source: { kind: "manual", url: null },
  servings: 4,
  ingredients: [{ raw: "2 cups stock", qty: 2, unit: "cup", name: "stock" }],
  steps: ["Simmer"],
  tags: [],
  notes: "",
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

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
    await setDoc(doc(db, "users/me/recipes/r1"), recipe());
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

describe("recipes", () => {
  it("you can list, read, add, edit, and delete your own", async () => {
    await assertSucceeds(getDocs(collection(as(ME), "users/me/recipes")));
    await assertSucceeds(getDoc(doc(as(ME), "users/me/recipes/r1")));
    await assertSucceeds(setDoc(doc(as(ME), "users/me/recipes/r2"), recipe({ title: "Pancakes" })));
    await assertSucceeds(updateDoc(doc(as(ME), "users/me/recipes/r1"), { title: "Roasted tomato soup", updatedAt: 2 }));
    await assertSucceeds(deleteDoc(doc(as(ME), "users/me/recipes/r1")));
  });

  it("nobody else can see or change them", async () => {
    await assertFails(getDocs(collection(as(OTHER), "users/me/recipes")));
    await assertFails(getDoc(doc(as(OTHER), "users/me/recipes/r1")));
    await assertFails(setDoc(doc(as(OTHER), "users/me/recipes/r9"), recipe()));
    await assertFails(deleteDoc(doc(as(OTHER), "users/me/recipes/r1")));
    await assertFails(setDoc(doc(as(STRANGER), "users/stranger/recipes/r1"), recipe()));
  });

  it("rejects malformed recipes", async () => {
    const ref = doc(as(ME), "users/me/recipes/bad");
    await assertFails(setDoc(ref, recipe({ title: "" })));
    await assertFails(setDoc(ref, recipe({ title: "x".repeat(121) })));
    await assertFails(setDoc(ref, recipe({ ingredients: "2 cups stock" })));
    await assertFails(setDoc(ref, recipe({ steps: Array.from({ length: 61 }, () => "stir") })));
    await assertFails(setDoc(ref, recipe({ createdAt: "yesterday" })));
    const noNotes: Record<string, unknown> = recipe();
    delete noNotes.notes;
    await assertFails(setDoc(ref, noNotes));
  });

  it("allows up to 10 photos, and older recipes without any", async () => {
    const photo = (i: number) => [`p${i}`, { path: `users/me/photos/p${i}.jpg`, url: null, addedAt: i }];
    const photos = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => photo(i)));
    await assertSucceeds(setDoc(doc(as(ME), "users/me/recipes/r3"), recipe({ photos: photos(10) })));
    await assertFails(setDoc(doc(as(ME), "users/me/recipes/r4"), recipe({ photos: photos(11) })));
    await assertFails(setDoc(doc(as(ME), "users/me/recipes/r5"), recipe({ photos: ["p1"] })));
    await assertSucceeds(updateDoc(doc(as(ME), "users/me/recipes/r1"), { "photos.p1": { path: "x", url: null, addedAt: 1 } }));
  });

  it("takes ratings from 1 to 5, a cleared rating, and a cooked log", async () => {
    const ref = doc(as(ME), "users/me/recipes/r1");
    await assertSucceeds(updateDoc(ref, { rating: 5 }));
    await assertSucceeds(updateDoc(ref, { rating: null }));
    await assertSucceeds(updateDoc(ref, { cooked: [1, 2, 3] }));
    await assertFails(updateDoc(ref, { rating: 6 }));
    await assertFails(updateDoc(ref, { rating: 0 }));
    await assertFails(updateDoc(ref, { rating: 4.5 }));
    await assertFails(updateDoc(ref, { cooked: "yesterday" }));
    await assertFails(updateDoc(ref, { cooked: Array.from({ length: 201 }, (_, i) => i) }));
  });

  it("editing can't change when it was first saved", async () => {
    await assertFails(updateDoc(doc(as(ME), "users/me/recipes/r1"), { createdAt: 99, updatedAt: 2 }));
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
