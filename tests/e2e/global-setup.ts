import { COOK, COPIER, createUser, resetEmulators, setAllowlist, SHOPPER, STRANGER, TESTER } from "./firebase";

export default async function globalSetup() {
  await resetEmulators();
  for (const email of [TESTER, COOK, SHOPPER, COPIER, STRANGER]) await createUser(email);
  await setAllowlist([TESTER, COOK, SHOPPER, COPIER]);
}
