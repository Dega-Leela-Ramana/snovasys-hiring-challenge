// Password hashing with scrypt from Node's standard library (no native add-on to build).
// Parameters follow the OWASP Password Storage Cheat Sheet: N=2^15, r=8, p=3.
// Stored format:  scrypt$N$r$p$salt$hash   (salt and hash are base64url)
// The cost parameters live inside the stored string, so they can be raised later
// without breaking existing users.
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

export const DEFAULT_SCRYPT = Object.freeze({ N: 32768, r: 8, p: 3 });

// Upper limits for parameters read back from the database (defence in depth).
const MAX_N = 2 ** 17;
const MAX_R = 16;
const MAX_P = 8;

function derive(password, salt, { N, r, p }) {
  return scryptAsync(password.normalize('NFKC'), salt, KEY_LENGTH, { N, r, p, maxmem: 256 * N * r });
}

export function createPasswordHasher(params = DEFAULT_SCRYPT) {
  const { N, r, p } = params;

  async function hash(password) {
    const salt = randomBytes(SALT_LENGTH);
    const key = await derive(password, salt, { N, r, p });
    return ['scrypt', N, r, p, salt.toString('base64url'), key.toString('base64url')].join('$');
  }

  async function verify(password, stored) {
    const parts = String(stored).split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const cost = { N: Number(parts[1]), r: Number(parts[2]), p: Number(parts[3]) };
    const valid =
      Number.isSafeInteger(cost.N) && cost.N >= 2 && cost.N <= MAX_N && (cost.N & (cost.N - 1)) === 0 &&
      Number.isSafeInteger(cost.r) && cost.r >= 1 && cost.r <= MAX_R &&
      Number.isSafeInteger(cost.p) && cost.p >= 1 && cost.p <= MAX_P;
    if (!valid) return false;
    const salt = Buffer.from(parts[4], 'base64url');
    const expected = Buffer.from(parts[5], 'base64url');
    if (expected.length !== KEY_LENGTH) return false;
    const actual = await derive(password, salt, cost);
    return timingSafeEqual(actual, expected); // constant-time comparison
  }

  // A hash of a random password, made with the SAME cost as real hashes.
  // Login verifies against it when the email does not exist, so "unknown email"
  // and "wrong password" take about the same time.
  let dummy;
  const dummyHash = () => (dummy ??= hash(randomBytes(12).toString('hex')));

  return { hash, verify, dummyHash };
}
