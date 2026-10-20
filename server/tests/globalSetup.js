// Runs once before all tests: checks the safety guard, then applies migrations to the TEST database.
import 'dotenv/config';
import { execSync } from 'node:child_process';
import { assertTestDatabaseUrl } from './guard.js';

export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  assertTestDatabaseUrl(url);
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
}
