// THE ROUTE TABLE. Every API endpoint is declared here, with who may call it.
//
//   access: 'public' -> anyone, no login
//   access: 'user'   -> any logged-in, active user
//   access: 'admin'  -> logged-in administrator only
//
// How "default deny" works: mountRoutes() registers the public routes first, then installs
// requireAuth, THEN registers everything else. So a route cannot be reached without a
// login unless it is explicitly marked 'public' in this table. Unknown /api paths also
// answer 401 to anonymous callers (they cannot even probe which paths exist).
//
// Per-DOCUMENT permissions (read / edit / owner) are decided inside the handlers by one
// function, getDocumentAccess(), added in Milestone 2. This table only decides who may
// reach the handler at all.
import { asyncHandler } from '../errors.js';
import { createAuthHandlers } from './auth.js';

const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);
const ACCESS_LEVELS = new Set(['public', 'user', 'admin']);

export function buildRoutes(ctx) {
  const auth = createAuthHandlers(ctx);

  return [
    {
      method: 'get', path: '/health', access: 'public',
      summary: 'Liveness and database check',
      handler: async (req, res) => {
        await ctx.prisma.$queryRaw`SELECT 1`;
        res.json({ status: 'ok' });
      },
    },
    {
      method: 'post', path: '/auth/register', access: 'public', limiter: 'register',
      summary: 'Create a USER account and log in',
      handler: auth.register,
    },
    {
      method: 'post', path: '/auth/login', access: 'public', limiter: 'login',
      summary: 'Log in',
      handler: auth.login,
    },
    {
      method: 'get', path: '/auth/me', access: 'user',
      summary: 'Current user',
      handler: auth.me,
    },
    {
      method: 'post', path: '/auth/logout', access: 'user',
      summary: 'Log out (destroys the server-side session)',
      handler: auth.logout,
    },
  ];
}

export function mountRoutes(router, routes, { requireAuth, requireAdmin, limiters }) {
  // A typo in this table must crash at startup, never silently weaken a route.
  for (const r of routes) {
    if (!METHODS.has(r.method)) throw new Error(`Unknown method "${r.method}" for ${r.path}`);
    if (!ACCESS_LEVELS.has(r.access)) throw new Error(`Unknown access "${r.access}" for ${r.path}`);
    if (r.limiter && !limiters[r.limiter]) throw new Error(`Unknown limiter "${r.limiter}" for ${r.path}`);
  }

  const chain = (r) => [...(r.limiter ? [limiters[r.limiter]] : []), asyncHandler(r.handler)];

  for (const r of routes.filter((x) => x.access === 'public')) {
    router[r.method](r.path, ...chain(r));
  }

  router.use(requireAuth); // everything registered below is login-protected

  for (const r of routes.filter((x) => x.access !== 'public')) {
    const guards = r.access === 'admin' ? [requireAdmin] : [];
    router[r.method](r.path, ...guards, ...chain(r));
  }
}
