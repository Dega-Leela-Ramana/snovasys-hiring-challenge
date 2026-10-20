import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { makeContext, resetDb, createUser, loginAgent, sessionCookieFrom, TEST_PASSWORD } from './helpers.js';

let t;
beforeAll(() => {
  t = makeContext();
});
afterAll(() => t.close());
beforeEach(() => resetDb(t.db));

describe('register', () => {
  it('creates a USER, normalises the email and starts a session', async () => {
    const res = await request(t.app)
      .post('/api/auth/register')
      .send({ email: '  New@Example.COM ', name: 'New Person', password: TEST_PASSWORD });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'new@example.com', name: 'New Person', role: 'USER' });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|scrypt/);
    expect(sessionCookieFrom(res)).toBeTruthy();
  });

  it('stores only a hash, never the password', async () => {
    await request(t.app).post('/api/auth/register').send({ email: 'h@example.com', name: 'H', password: TEST_PASSWORD });
    const row = await t.db.prisma.user.findUnique({ where: { email: 'h@example.com' } });
    expect(row.passwordHash).not.toContain(TEST_PASSWORD);
    expect(row.passwordHash.startsWith('scrypt$')).toBe(true);
  });

  it('REJECTS a role in the body and creates no account (mass assignment)', async () => {
    const res = await request(t.app)
      .post('/api/auth/register')
      .send({ email: 'evil@example.com', name: 'Evil', password: TEST_PASSWORD, role: 'ADMIN' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await t.db.prisma.user.count()).toBe(0);
  });

  it('rejects short passwords and bad emails', async () => {
    const short = await request(t.app).post('/api/auth/register').send({ email: 'a@example.com', name: 'A', password: 'short' });
    expect(short.status).toBe(400);
    const badEmail = await request(t.app).post('/api/auth/register').send({ email: 'not-an-email', name: 'A', password: TEST_PASSWORD });
    expect(badEmail.status).toBe(400);
  });

  it('treats emails case-insensitively when checking for duplicates', async () => {
    await request(t.app).post('/api/auth/register').send({ email: 'dup@example.com', name: 'A', password: TEST_PASSWORD });
    const second = await request(t.app).post('/api/auth/register').send({ email: 'DUP@example.com', name: 'B', password: TEST_PASSWORD });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('EMAIL_TAKEN');
  });
});

describe('login and session', () => {
  it('logs in, sets a hardened cookie, and /me returns the user', async () => {
    await createUser(t, { email: 'a@example.com', name: 'Alice' });
    const login = await request(t.app).post('/api/auth/login').send({ email: 'a@example.com', password: TEST_PASSWORD });
    expect(login.status).toBe(200);
    const cookieLine = login.headers['set-cookie'].find((c) => c.startsWith('tv.sid='));
    expect(cookieLine).toMatch(/HttpOnly/i);
    expect(cookieLine).toMatch(/SameSite=Lax/i);
    expect(cookieLine).toMatch(/Path=\//);

    const me = await request(t.app).get('/api/auth/me').set('Cookie', sessionCookieFrom(login));
    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({ email: 'a@example.com', name: 'Alice', role: 'USER' });
    expect(me.body.user.passwordHash).toBeUndefined();
  });

  it('answers identically for a wrong password and an unknown email (no account enumeration)', async () => {
    await createUser(t, { email: 'a@example.com' });
    const wrong = await request(t.app).post('/api/auth/login').send({ email: 'a@example.com', password: 'wrong-password-123' });
    const unknown = await request(t.app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'wrong-password-123' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(unknown.body).toEqual(wrong.body);
  });

  it('refuses a deactivated account with the same generic answer', async () => {
    await createUser(t, { email: 'off@example.com', isActive: false });
    const res = await request(t.app).post('/api/auth/login').send({ email: 'off@example.com', password: TEST_PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('answers 401 on /me without a session', async () => {
    const res = await request(t.app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('issues a NEW session id on login and kills the old one (session fixation)', async () => {
    await createUser(t, { email: 'a@example.com' });
    const agent = request.agent(t.app);
    const first = await agent.post('/api/auth/login').send({ email: 'a@example.com', password: TEST_PASSWORD });
    const second = await agent.post('/api/auth/login').send({ email: 'a@example.com', password: TEST_PASSWORD });
    const cookieA = sessionCookieFrom(first);
    const cookieB = sessionCookieFrom(second);
    expect(cookieA).toBeTruthy();
    expect(cookieB).toBeTruthy();
    expect(cookieB).not.toBe(cookieA);
    const replay = await request(t.app).get('/api/auth/me').set('Cookie', cookieA);
    expect(replay.status).toBe(401);
  });

  it('logout destroys the session on the server: replaying the old cookie fails', async () => {
    await createUser(t, { email: 'a@example.com' });
    const login = await request(t.app).post('/api/auth/login').send({ email: 'a@example.com', password: TEST_PASSWORD });
    const cookie = sessionCookieFrom(login);
    expect((await request(t.app).get('/api/auth/me').set('Cookie', cookie)).status).toBe(200);
    const out = await request(t.app).post('/api/auth/logout').set('Cookie', cookie);
    expect(out.status).toBe(204);
    const replay = await request(t.app).get('/api/auth/me').set('Cookie', cookie);
    expect(replay.status).toBe(401);
  });
});
