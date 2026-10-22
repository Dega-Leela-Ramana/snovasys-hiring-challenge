
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { makeContext, resetDb } from './helpers.js';
import {
  writeAudit,
  verifyAuditChain,
} from '../src/services/auditLog.js';

let t;

beforeAll(() => {
  t = makeContext();
});

afterAll(() => t.close());

beforeEach(() => resetDb(t.db));

describe('AuditLog hash chain', () => {
  it('creates linked hashes for consecutive audit events', async () => {
    const first = await writeAudit(t.db.prisma, {
      action: 'TEST_FIRST',
      outcome: 'ALLOWED',
    });

    const second = await writeAudit(t.db.prisma, {
      action: 'TEST_SECOND',
      outcome: 'ALLOWED',
    });

    expect(first.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.prevHash).toBeNull();
    expect(second.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(second.prevHash).toBe(first.hash);

    await expect(verifyAuditChain(t.db.prisma)).resolves.toMatchObject({
      valid: true,
      checked: 2,
      total: 2,
      legacyCount: 0,
    });
  });

    it('detects changes to an event after it was hashed', async () => {
    const original = await writeAudit(t.db.prisma, {
      action: 'ORIGINAL_EVENT',
      outcome: 'ALLOWED',
    });

    await t.db.pool.query(
      `ALTER TABLE "AuditLog" DISABLE TRIGGER USER`,
    );

    try {
      await t.db.pool.query(
        `UPDATE "AuditLog" SET action = $1 WHERE id = $2`,
        ['TAMPERED_EVENT', original.id.toString()],
      );
    } finally {
      await t.db.pool.query(
        `ALTER TABLE "AuditLog" ENABLE TRIGGER USER`,
      );
    }

    await expect(verifyAuditChain(t.db.prisma)).resolves.toMatchObject({
      valid: false,
      reason: 'EVENT_HASH_MISMATCH',
      firstInvalidId: original.id.toString(),
    });
  });
  it('allows legacy unhashed rows before the chain starts', async () => {
    await t.db.prisma.auditLog.create({
      data: { action: 'LEGACY_EVENT', outcome: 'ALLOWED' },
    });

    await writeAudit(t.db.prisma, {
      action: 'CHAIN_START',
      outcome: 'ALLOWED',
    });

    await expect(verifyAuditChain(t.db.prisma)).resolves.toMatchObject({
      valid: true,
      checked: 1,
      total: 2,
      legacyCount: 1,
    });
  });
});
