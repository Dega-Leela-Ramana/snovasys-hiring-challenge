// Builds the Express app. server.js starts it; the tests import it directly (no network port needed).
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import rateLimit from 'express-rate-limit';
import { HttpError } from './errors.js';
import { createPasswordHasher } from './security/password.js';
import { originCheck } from './middleware/originCheck.js';
import { makeRequireAuth, makeRequireAdmin } from './middleware/auth.js';
import { notFound, makeErrorHandler } from './middleware/errorHandler.js';
import { buildRoutes, mountRoutes } from './routes/registry.js';

export const SESSION_COOKIE = 'tv.sid';

function makeLimiter(limit, windowMs) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res, next) => next(new HttpError(429, 'Too many requests, slow down', 'RATE_LIMITED')),
  });
}

export function createApp({ config, db }) {
  const hasher = createPasswordHasher(config.scrypt);
  const ctx = { config, prisma: db.prisma, pool: db.pool, hasher };

  const app = express();
  app.disable('x-powered-by');
  // How many proxies to trust for the client IP and for knowing the request was HTTPS.
  // Wrong values are dangerous: see DEPLOY.md.
  app.set('trust proxy', config.trustProxy);

  app.use(helmet()); // CSP, nosniff, frame protection, HSTS, ...
  app.use(express.json({ limit: '100kb' }));
  app.use(originCheck(config));

  const PgStore = connectPgSimple(session);
  app.use(
    session({
      name: SESSION_COOKIE,
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false, // anonymous visitors get no session row
      store: new PgStore({
        pool: db.pool,
        tableName: 'session',
        createTableIfMissing: false, // the table comes from the Prisma migration
        pruneSessionInterval: config.isTest ? false : 900, // delete expired sessions every 15 min
      }),
      cookie: {
        httpOnly: true, // JavaScript in the page cannot read the cookie
        sameSite: 'lax', // not sent on cross-site POSTs
        secure: config.cookieSecure, // HTTPS only in production
        maxAge: config.sessionMaxAgeMs, // fixed lifetime, not extended by activity
      },
    }),
  );

  const limiters = {
    login: makeLimiter(config.rate.loginMax, 15 * 60 * 1000),
    register: makeLimiter(config.rate.registerMax, 60 * 60 * 1000),
  };
  const apiLimiter = makeLimiter(config.rate.apiMax, 60 * 1000);

  const routes = buildRoutes(ctx);
  const api = express.Router();
  api.use(apiLimiter);
  mountRoutes(api, routes, {
    requireAuth: makeRequireAuth(ctx),
    requireAdmin: makeRequireAdmin(),
    limiters,
  });
  api.use(notFound); // only logged-in callers reach this; anonymous ones got 401 above
  app.use('/api', api);

  // Production: serve the built React app from the same origin as the API.
  if (config.clientDistDir) {
    const dist = path.resolve(config.clientDistDir);
    if (fs.existsSync(path.join(dist, 'index.html'))) {
      app.use(express.static(dist, { index: false, maxAge: '1h' }));
      app.get(/^\/(?!api(\/|$)).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
    }
  }

  app.use(notFound);
  app.use(makeErrorHandler(config));

  app.locals.ctx = ctx;
  app.locals.routes = routes;
  return app;
}
