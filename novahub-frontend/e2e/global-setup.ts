import { createDbAssertions, assertE2eDatabaseConfigured } from './helpers/db-assertions';

export default async function globalSetup(): Promise<void> {
  assertE2eDatabaseConfigured();
  const db = createDbAssertions();
  try {
    await db.resetIsolatedDatabase();
  } finally {
    await db.close();
  }
}
