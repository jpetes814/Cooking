import { COOK, createUser, resetEmulators, setAllowlist, SHOPPER, STRANGER, TESTER } from "./firebase";

export default async function globalSetup() {
  await resetEmulators();
  for (const email of [TESTER, COOK, SHOPPER, STRANGER]) await createUser(email);
  await setAllowlist([TESTER, COOK, SHOPPER]);
}
