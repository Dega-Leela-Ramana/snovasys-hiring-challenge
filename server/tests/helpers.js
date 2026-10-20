import 'dotenv/config';
import request from 'supertest';
import { loadConfig } from '../src/config.js';
import { createDb } from '../src/db.js';
import { createApp } from '../src/app.js';
import { assertTestDatabaseUrl } from './guard.js';

export const TEST_PASSWORD = 'correct-horse-battery-staple';

// Test configuration: cheap password hashing (fast tests) and generous rate limits.
export function baseTestConfig(extraEnv = {}) {
  assertTestDatabaseUrl(process.env.TEST_DATABASE_URL);
  return loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: process.env.TEST_DATABASE_URL,
    SESSION_SECRET: `unit-test-only-${'x'.repeat(40)}`,
    SCRYPT_N: '1024',
    LOGIN_RATE_MAX: '1000',
    REGISTER_RATE_MAX: '1000',
    API_RATE_MAX: '100000',
    ...extraEnv,
  });
}

// Builds a real app against the real test database. Close it in afterAll.
export function makeContext(config = baseTestConfig(), dbOverride) {
  const db = dbOverride ?? createDb(config.databaseUrl);
  const app = createApp({ config, db });
  return {
    config,
    db,
    app,
    ctx: app.locals.ctx,
    routes: app.locals.routes,
    close: () => db.close(),
  };
}

export async function resetDb(db) {
  assertTestDatabaseUrl(process.env.TEST_DATABASE_URL);
  await db.pool.query(
    'TRUNCATE TABLE "DocumentPermission", "Document", "AuditLog", "User", "session" RESTART IDENTITY CASCADE',
  );
}

export async function createUser(t, { email, name = 'Test User', role = 'USER', password = TEST_PASSWORD, isActive = true }) {
  const passwordHash = await t.ctx.hasher.hash(password);
  return t.db.prisma.user.create({ data: { email, name, role, passwordHash, isActive } });
}

// A supertest agent that keeps cookies, already logged in through the real login endpoint.
export async function loginAgent(t, email, password = TEST_PASSWORD) {
  const agent = request.agent(t.app);
  const res = await agent.post('/api/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Login failed in test helper: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return agent;
}

// "tv.sid=VALUE" from a response's Set-Cookie header, or null.
export function sessionCookieFrom(res) {
  const line = (res.headers['set-cookie'] ?? []).find((c) => c.startsWith('tv.sid='));
  return line ? line.split(';')[0] : null;
}
