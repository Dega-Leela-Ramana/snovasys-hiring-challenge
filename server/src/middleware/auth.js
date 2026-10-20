// The two guards every protected route passes through.
//
// IMPORTANT DESIGN CHOICE: the session stores ONLY the user id. On every request we
// load the user from the database again. So deactivating a user, deleting a user or
// changing a role takes effect on the very next request. The price is one small
// database query per request, which we accept on purpose.
import { HttpError } from '../errors.js';
import { destroySession } from '../services/sessions.js';

export function makeRequireAuth({ prisma }) {
  return async function requireAuth(req, res, next) {
    try {
      const userId = req.session?.userId;
      if (!userId) throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED');

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, role: true, isActive: true },
      });
      if (!user || !user.isActive) {
        await destroySession(req); // the session is dead; remove it from the store too
        throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED');
      }
      req.user = user;
      next();
    } catch (err) {
      next(err);
    }
  };
}

// Must run AFTER requireAuth. Checks the role loaded from the database just now.
export function makeRequireAdmin() {
  return function requireAdmin(req, res, next) {
    if (req.user?.role !== 'ADMIN') {
      return next(new HttpError(403, 'Administrator access required', 'FORBIDDEN'));
    }
    next();
  };
}
