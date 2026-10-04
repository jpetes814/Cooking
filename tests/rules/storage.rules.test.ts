import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";
import { deleteObject, getBytes, ref, uploadBytes } from "firebase/storage";

const ME = { uid: "me", email: "me@example.com" };
const OTHER = { uid: "other", email: "other@example.com" }; // on the allowlist, but it's not their folder
const STRANGER = { uid: "stranger", email: "stranger@example.com" }; // signed in, not on the allowlist

let env: RulesTestEnvironment;

const as = (who: { uid: string; email: string }) => env.authenticatedContext(who.uid, { email: who.email }).storage();
const jpeg = { contentType: "image/jpeg" };
const small = new Uint8Array(1024);

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-recipe-box-rules",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8180 },
    storage: { rules: readFileSync("storage.rules", "utf8"), host: "127.0.0.1", port: 9199 },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "config/allowlist"), { emails: [ME.email, OTHER.email] });
    await uploadBytes(ref(ctx.storage(), "users/me/photos/p1.jpg"), small, jpeg);
    await uploadBytes(ref(ctx.storage(), "users/stranger/photos/p1.jpg"), small, jpeg);
  });
});

describe("photos", () => {
  it("you can add, see, and delete your own", async () => {
    await assertSucceeds(uploadBytes(ref(as(ME), "users/me/photos/p2.jpg"), small, jpeg));
    await assertSucceeds(getBytes(ref(as(ME), "users/me/photos/p1.jpg")));
    await assertSucceeds(deleteObject(ref(as(ME), "users/me/photos/p1.jpg")));
  });

  it("nobody else can see, add, or delete them", async () => {
    await assertFails(getBytes(ref(as(OTHER), "users/me/photos/p1.jpg")));
    await assertFails(uploadBytes(ref(as(OTHER), "users/me/photos/p9.jpg"), small, jpeg));
    await assertFails(deleteObject(ref(as(OTHER), "users/me/photos/p1.jpg")));
    await assertFails(getBytes(ref(env.unauthenticatedContext().storage(), "users/me/photos/p1.jpg")));
  });

  it("signed-in strangers get nothing, even in their own folder", async () => {
    await assertFails(getBytes(ref(as(STRANGER), "users/stranger/photos/p1.jpg")));
    await assertFails(uploadBytes(ref(as(STRANGER), "users/stranger/photos/p2.jpg"), small, jpeg));
  });

  it("only takes images under 5 MB, and never overwrites", async () => {
    await assertFails(uploadBytes(ref(as(ME), "users/me/photos/p3.jpg"), small, { contentType: "text/html" }));
    await assertFails(uploadBytes(ref(as(ME), "users/me/photos/p4.jpg"), new Uint8Array(5 * 1024 * 1024 + 1), jpeg));
    await assertFails(uploadBytes(ref(as(ME), "users/me/photos/p1.jpg"), small, jpeg));
  });

  it("everything else is closed", async () => {
    await assertFails(uploadBytes(ref(as(ME), "users/me/other/x.jpg"), small, jpeg));
    await assertFails(uploadBytes(ref(as(ME), "public/x.jpg"), small, jpeg));
  });
});
