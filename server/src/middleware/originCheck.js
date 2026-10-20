// CSRF defence-in-depth. The session cookie is already SameSite=Lax (browsers do not
// attach it to cross-site POSTs). This adds a second wall: any state-changing request
// that declares an Origin must come from our own site or an explicitly allowed origin.
//
// Requests with NO Origin header (curl, tests, server-to-server) are not a CSRF risk,
// because CSRF needs a victim's browser, and browsers always send Origin on cross-site
// POST/PUT/PATCH/DELETE. Browsers that say "cross-site" via Sec-Fetch-Site are refused.
import { HttpError } from '../errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function originCheck(config) {
  const allowed = new Set(config.allowedOrigins);

  return function checkOrigin(req, res, next) {
    if (SAFE_METHODS.has(req.method)) return next();

    const origin = req.get('origin');
    if (origin) {
      let ok = allowed.has(origin);
      if (!ok) {
        try {
          ok = new URL(origin).host === req.get('host'); // same-origin request
        } catch {
          ok = false; // "null" or garbage
        }
      }
      if (!ok) return next(new HttpError(403, 'Cross-origin request blocked', 'BAD_ORIGIN'));
    } else if (req.get('sec-fetch-site') === 'cross-site') {
      return next(new HttpError(403, 'Cross-origin request blocked', 'BAD_ORIGIN'));
    }
    next();
  };
}
