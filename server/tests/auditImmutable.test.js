// The database itself refuses to change or delete audit rows.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { makeContext, resetDb } from './helpers.js';

let t;
beforeAll(() => {
  t = makeContext();
});
afterAll(() => t.close());
beforeEach(() => resetDb(t.db));

describe('AuditLog is append-only at the database level', () => {
  it('allows INSERT but rejects UPDATE and DELETE, and the row stays unchanged', async () => {
    const row = await t.db.prisma.auditLog.create({ data: { action: 'TEST_EVENT', outcome: 'ALLOWED' } });
    const id = row.id.toString();

    await expect(t.db.pool.query('UPDATE "AuditLog" SET "action" = $1 WHERE id = $2', ['EDITED', id])).rejects.toThrow(/append-only/);
    await expect(t.db.pool.query('DELETE FROM "AuditLog" WHERE id = $1', [id])).rejects.toThrow(/append-only/);

    const { rows } = await t.db.pool.query('SELECT action FROM "AuditLog" WHERE id = $1', [id]);
    expect(rows[0].action).toBe('TEST_EVENT');
  });
});
