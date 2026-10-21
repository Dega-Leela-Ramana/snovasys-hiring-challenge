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
import { createDocumentHandlers } from './documents.js';
import { asyncHandler } from '../errors.js';
import { createAuthHandlers } from './auth.js';
import { createPermissionHandlers } from './permissions.js';

const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);
const ACCESS_LEVELS = new Set(['public', 'user', 'admin']);

export function buildRoutes(ctx) {
  const auth = createAuthHandlers(ctx);
const documents = createDocumentHandlers(ctx);
  const permissions = createPermissionHandlers(ctx);

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
  {
  method: 'get',
  path: '/documents',
  access: 'user',
  summary: 'List documents owned by or shared with the current user',
  handler: documents.list,
},
  {
    method: 'get',
    path: '/documents/:id/permissions',
    access: 'user',
    summary: 'List document permissions (owner only)',
    handler: permissions.list,
  },
  {
    method: 'post',
    path: '/documents/:id/permissions',
    access: 'user',
    summary: 'Grant or update document permission (owner only)',
    handler: permissions.grant,
  },
  {
    method: 'delete',
    path: '/documents/:id/permissions/:userId',
    access: 'user',
    summary: 'Revoke document permission (owner only)',
    handler: permissions.revoke,
  },
{
  method: 'get',
  path: '/documents/:id',
  access: 'user',
  summary: 'Get document metadata when the current user has read access',
  handler: documents.get,
},
{
  method: 'get',
  path: '/documents/:id/download',
  access: 'user',
  summary: 'Download a document when the current user has read access',
  handler: documents.download,
},
{
  method: 'patch',
  path: '/documents/:id',
  access: 'user',
  handler: documents.edit,
},
{
  method: 'delete',
  path: '/documents/:id',
  access: 'user',
  handler: documents.remove,
},
{
  method: 'post',
  path: '/documents',
  access: 'user',
  summary: 'Upload a document to private storage',
  handler: documents.upload,
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
