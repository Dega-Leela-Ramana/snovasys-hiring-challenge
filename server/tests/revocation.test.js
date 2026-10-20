// Standard #3 from the brief: taking access away works immediately.
// For accounts, "immediately" means: the VERY NEXT request after the change is refused,
// using the same cookie the user already held.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { makeContext, resetDb, createUser, loginAgent } from './helpers.js';
import { destroyUserSessions } from '../src/services/sessions.js';

let t;
beforeAll(() => {
  t = makeContext();
});
afterAll(() => t.close());
beforeEach(() => resetDb(t.db));

async function sessionRowsFor(userId) {
  const { rows } = await t.db.pool.query(`SELECT count(*)::int AS n FROM session WHERE sess ->> 'userId' = $1`, [userId]);
  return rows[0].n;
}

describe('revocation of accounts', () => {
  it('blocks the next request after the account is deactivated, and removes the session row', async () => {
    const user = await createUser(t, { email: 'a@example.com' });
    const agent = await loginAgent(t, 'a@example.com');
    expect((await agent.get('/api/auth/me')).status).toBe(200);
    expect(await sessionRowsFor(user.id)).toBe(1);

    await t.db.prisma.user.update({ where: { id: user.id }, data: { isActive: false } });

    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(await sessionRowsFor(user.id)).toBe(0);
  });

  it('blocks the next request after the account is deleted', async () => {
    const user = await createUser(t, { email: 'gone@example.com' });
    const agent = await loginAgent(t, 'gone@example.com');
    await t.db.prisma.user.delete({ where: { id: user.id } });
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('uses the CURRENT role, not the role at login time (no stale privileges)', async () => {
    const user = await createUser(t, { email: 'admin@example.com', role: 'ADMIN' });
    const agent = await loginAgent(t, 'admin@example.com');
    expect((await agent.get('/api/auth/me')).body.user.role).toBe('ADMIN');
    await t.db.prisma.user.update({ where: { id: user.id }, data: { role: 'USER' } });
    expect((await agent.get('/api/auth/me')).body.user.role).toBe('USER');
  });

  it('destroyUserSessions logs the user out of every device and nobody else', async () => {
    const alice = await createUser(t, { email: 'alice@example.com' });
    await createUser(t, { email: 'bob@example.com' });
    const phone = await loginAgent(t, 'alice@example.com');
    const laptop = await loginAgent(t, 'alice@example.com');
    const bob = await loginAgent(t, 'bob@example.com');

    await destroyUserSessions(t.db.pool, alice.id);

    expect((await phone.get('/api/auth/me')).status).toBe(401);
    expect((await laptop.get('/api/auth/me')).status).toBe(401);
    expect((await bob.get('/api/auth/me')).status).toBe(200);
  });
});
