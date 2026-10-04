import { createUser, resetEmulators, setAllowlist, STRANGER, TESTER } from "./firebase";

export default async function globalSetup() {
  await resetEmulators();
  for (const email of [TESTER, STRANGER]) await createUser(email);
  await setAllowlist([TESTER]);
}
