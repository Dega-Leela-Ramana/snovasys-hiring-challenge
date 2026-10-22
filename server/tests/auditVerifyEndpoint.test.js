
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  makeContext,
  resetDb,
  createUser,
  loginAgent,
} from './helpers.js';
import { writeAudit } from '../src/services/auditLog.js';

let t;

beforeAll(() => {
  t = makeContext();
});

afterAll(async () => {
  if (t) await t.close();
});

beforeEach(async () => {
  await resetDb(t.db);
});

describe('Admin audit verification endpoint', () => {
  it('allows an admin to verify the audit chain', async () => {
    await createUser(t, {
      email: 'audit-admin@example.com',
      role: 'ADMIN',
    });

    const adminAgent = await loginAgent(t, 'audit-admin@example.com');

    await writeAudit(t.db.prisma, {
      action: 'TEST_EVENT',
      outcome: 'ALLOWED',
    });

    const response = await adminAgent.get('/api/admin/audit/verify');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      valid: true,
      checked: 1,
      total: 1,
      legacyCount: 0,
    });
  });

  it('denies an ordinary user access to audit verification', async () => {
    await createUser(t, {
      email: 'audit-user@example.com',
      role: 'USER',
    });

    const userAgent = await loginAgent(t, 'audit-user@example.com');

    const response = await userAgent.get('/api/admin/audit/verify');

    expect([401, 403, 404]).toContain(response.status);
    expect(response.status).not.toBe(200);
  });
});
