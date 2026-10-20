// The tests TRUNCATE tables. This guard makes sure they can never point at a real database.
export function assertTestDatabaseUrl(url, mainUrl = process.env.DATABASE_URL) {
  if (!url) {
    throw new Error('TEST_DATABASE_URL is not set. Copy server/.env.example to server/.env and fill it in.');
  }
  let name;
  try {
    name = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
  } catch {
    throw new Error('TEST_DATABASE_URL is not a valid URL');
  }
  if (!/test/i.test(name)) {
    throw new Error(
      `Refusing to run: database "${name}" does not look like a test database (its name must contain "test").`,
    );
  }
  if (mainUrl && url === mainUrl) {
    throw new Error('Refusing to run: TEST_DATABASE_URL is the same as DATABASE_URL.');
  }
}
