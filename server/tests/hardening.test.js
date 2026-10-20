import fs from 'node:fs';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { makeContext, baseTestConfig, resetDb, createUser, loginAgent, sessionCookieFrom, TEST_PASSWORD } from './helpers.js';
import { createApp } from '../src/app.js';
import { mountRoutes } from '../src/routes/registry.js';
import { makeRequireAuth, makeRequireAdmin } from '../src/middleware/auth.js';

let t;
beforeAll(() => {
  t = makeContext();
});
afterAll(() => t.close());
beforeEach(() => resetDb(t.db));

const concrete = (path) => `/api${path.replace(/:[A-Za-z]+/g, 'x')}`;

describe('default deny', () => {
  it('every route that is not marked public answers 401 to an anonymous caller', async () => {
    const protectedRoutes = t.routes.filter((r) => r.access !== 'public');
    expect(protectedRoutes.length).toBeGreaterThan(0);
    for (const r of protectedRoutes) {
      const res = await request(t.app)[r.method](concrete(r.path)).send({});
      expect(res.status, `${r.method.toUpperCase()} ${r.path}`).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    }
  });

  it('admin routes answer 403 to a logged-in non-admin', async () => {
    await createUser(t, { email: 'user@example.com' });
    const agent = await loginAgent(t, 'user@example.com');
    for (const r of t.routes.filter((x) => x.access === 'admin')) {
      const res = await agent[r.method](concrete(r.path)).send({});
      expect(res.status, `${r.method.toUpperCase()} ${r.path}`).toBe(403);
    }
  });

  it('an unknown /api path answers 401 to anonymous callers and 404 to logged-in ones', async () => {
    expect((await request(t.app).get('/api/does-not-exist')).status).toBe(401);
    await createUser(t, { email: 'user@example.com' });
    const agent = await loginAgent(t, 'user@example.com');
    const res = await agent.get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('a public route is reachable without login', async () => {
    const res = await request(t.app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('refuses to start if the route table has a typo in "access"', () => {
    const bad = [{ method: 'get', path: '/x', access: 'pubic', handler: () => {} }];
    const deps = { requireAuth: makeRequireAuth(t.ctx), requireAdmin: makeRequireAdmin(), limiters: {} };
    expect(() => mountRoutes(t.app, bad, deps)).toThrow(/Unknown access/);
  });
});

describe('API.md stays honest', () => {
  it('lists every route in the route table', () => {
    const doc = fs.readFileSync(new URL('../../API.md', import.meta.url), 'utf8');
    for (const r of t.routes) {
      expect(doc, `API.md is missing ${r.method.toUpperCase()} /api${r.path}`).toContain(`${r.method.toUpperCase()} /api${r.path}`);
    }
  });
});

describe('CSRF / origin check', () => {
  const creds = { email: 'a@example.com', password: TEST_PASSWORD };

  it('blocks a state-changing request from a foreign origin even with valid credentials', async () => {
    await createUser(t, { email: 'a@example.com' });
    const res = await request(t.app).post('/api/auth/login').set('Origin', 'https://evil.example').send(creds);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('BAD_ORIGIN');
  });

  it('blocks the opaque "null" origin and browser-declared cross-site requests', async () => {
    await createUser(t, { email: 'a@example.com' });
    expect((await request(t.app).post('/api/auth/login').set('Origin', 'null').send(creds)).status).toBe(403);
    expect((await request(t.app).post('/api/auth/login').set('Sec-Fetch-Site', 'cross-site').send(creds)).status).toBe(403);
  });

  it('allows the site\'s own origin', async () => {
    await createUser(t, { email: 'a@example.com' });
    const res = await request(t.app).post('/api/auth/login').set('Host', 'vault.test').set('Origin', 'http://vault.test').send(creds);
    expect(res.status).toBe(200);
  });

  it('allows an origin listed in ALLOWED_ORIGINS', async () => {
    const t2 = makeContext(baseTestConfig({ ALLOWED_ORIGINS: 'http://localhost:5173' }), t.db);
    await createUser(t, { email: 'a@example.com' });
    const res = await request(t2.app).post('/api/auth/login').set('Origin', 'http://localhost:5173').send(creds);
    expect(res.status).toBe(200);
  });
});

describe('cookies, headers, limits, errors', () => {
  it('marks the session cookie Secure when running in production mode behind an HTTPS proxy', async () => {
    const t2 = makeContext({ ...baseTestConfig(), cookieSecure: true, trustProxy: 1 }, t.db);
    await createUser(t, { email: 'a@example.com' });
    const res = await request(t2.app)
      .post('/api/auth/login')
      .set('X-Forwarded-Proto', 'https')
      .send({ email: 'a@example.com', password: TEST_PASSWORD });
    expect(res.status).toBe(200);
    const line = res.headers['set-cookie'].find((c) => c.startsWith('tv.sid='));
    expect(line).toMatch(/Secure/i);
    expect(line).toMatch(/HttpOnly/i);
  });

  it('rate-limits login attempts per IP', async () => {
    const base = baseTestConfig();
    const t2 = makeContext({ ...base, rate: { ...base.rate, loginMax: 3 } }, t.db);
    const attempt = () => request(t2.app).post('/api/auth/login').send({ email: 'a@example.com', password: 'wrong-password-123' });
    expect((await attempt()).status).toBe(401);
    expect((await attempt()).status).toBe(401);
    expect((await attempt()).status).toBe(401);
    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });

  it('sends security headers and hides the framework', async () => {
    const res = await request(t.app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeTruthy();
  });

  it('answers malformed JSON with 400 and oversized bodies with 413, without stack traces', async () => {
    const bad = await request(t.app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email": ');
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('BAD_JSON');
    expect(JSON.stringify(bad.body)).not.toMatch(/at .*\.js|node_modules/);

    const big = await request(t.app).post('/api/auth/login').send({ email: 'a@example.com', password: 'x'.repeat(200_000) });
    expect(big.status).toBe(413);
  });

  it('turns unexpected failures into a generic 500 that leaks nothing', async () => {
    const failingDb = {
      prisma: {
        user: {
          findUnique: async () => {
            throw new Error('SECRET-DB-DETAIL postgresql://user:pass@host/db');
          },
        },
      },
      pool: t.db.pool,
    };
    const app = createApp({ config: t.config, db: failingDb });
    const res = await request(app).post('/api/auth/login').send({ email: 'a@example.com', password: TEST_PASSWORD });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { code: 'INTERNAL', message: 'Something went wrong' } });
  });
});
