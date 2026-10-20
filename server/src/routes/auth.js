// Register, login, me, logout.
import { z } from 'zod';
import { HttpError } from '../errors.js';
import { destroySession, regenerateSession, saveSession } from '../services/sessions.js';

// Emails are stored trimmed, NFKC-normalised and lowercase, so "A@x.com" and "a@x.com"
// are the same account.
const emailField = z
  .string()
  .trim()
  .transform((s) => s.normalize('NFKC').toLowerCase())
  .pipe(z.string().email().max(254));

// .strict() REJECTS unknown fields. A request that tries { "role": "ADMIN" } gets a 400
// instead of being silently ignored, which also makes mass-assignment attempts visible.
export const registerSchema = z
  .object({
    email: emailField,
    name: z.string().trim().min(1).max(100),
    password: z.string().min(12).max(128),
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailField,
    password: z.string().min(1).max(128),
  })
  .strict();

const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role });

export function createAuthHandlers({ config, prisma, hasher }) {
  // New session id on every login. This is what prevents session fixation.
  async function startSession(req, userId) {
    await regenerateSession(req);
    req.session.userId = userId;
    await saveSession(req);
  }

  async function register(req, res) {
    const { email, name, password } = registerSchema.parse(req.body ?? {});
    const passwordHash = await hasher.hash(password);
    let user;
    try {
      // The role is never read from the request. The database default (USER) applies.
      user = await prisma.user.create({ data: { email, name, passwordHash } });
    } catch (err) {
      if (err?.code === 'P2002') {
        throw new HttpError(409, 'An account with this email already exists', 'EMAIL_TAKEN');
      }
      throw err;
    }
    await startSession(req, user.id);
    res.status(201).json({ user: publicUser(user) });
  }

  async function login(req, res) {
    const { email, password } = loginSchema.parse(req.body ?? {});
    const user = await prisma.user.findUnique({ where: { email } });

    // Always run one password verification, even for unknown emails, so response time
    // does not reveal whether an account exists.
    const storedHash = user ? user.passwordHash : await hasher.dummyHash();
    const passwordOk = await hasher.verify(password, storedHash);

    // One message for: unknown email, wrong password, deactivated account.
    if (!user || !passwordOk || !user.isActive) {
      throw new HttpError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
    }
    await startSession(req, user.id);
    res.json({ user: publicUser(user) });
  }

  async function me(req, res) {
    res.json({ user: publicUser(req.user) });
  }

  async function logout(req, res) {
    await destroySession(req); // removes the session row: the old cookie is now useless
    res.clearCookie('tv.sid', {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.cookieSecure,
      path: '/',
    });
    res.status(204).end();
  }

  return { register, login, me, logout };
}
