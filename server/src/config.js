
 // Reads and validates environment variables ONCE, at startup.
 // If something is missing or unsafe the app refuses to start (fail closed).
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1, 'is required'),
  SESSION_SECRET: z
    .string()
    .min(32, 'must be at least 32 characters')
    .refine((s) => !/change[-_ ]?me/i.test(s), 'looks like a placeholder, generate a real one'),
  SESSION_MAX_AGE_HOURS: z.coerce.number().positive().max(24 * 30).default(8),
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
  ALLOWED_ORIGINS: z.string().default(''),
  CLIENT_DIST_DIR: z.string().optional(),
  STORAGE_DIR: z.string().default('./storage'),

  // Private Supabase Storage configuration.
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SECRET_KEY: z.string().min(1).optional(),

  LOGIN_RATE_MAX: z.coerce.number().int().positive().default(10),
  REGISTER_RATE_MAX: z.coerce.number().int().positive().default(10),
  API_RATE_MAX: z.coerce.number().int().positive().default(600),
  SCRYPT_N: z.coerce
    .number()
    .int()
    .refine((n) => n >= 1024 && (n & (n - 1)) === 0, 'must be a power of two >= 1024')
    .default(32768),
});

export class ConfigError extends Error {}

export function loadConfig(env = process.env) {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    // Only variable NAMES and rules are printed, never values.
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new ConfigError(`Invalid configuration:\n${lines.join('\n')}`);
  }

  const e = parsed.data;
  const isProd = e.NODE_ENV === 'production';

  if (isProd && e.SCRYPT_N < 32768) {
    throw new ConfigError('Invalid configuration:\n  - SCRYPT_N: must be >= 32768 in production');
  }

  if (isProd && (!e.SUPABASE_URL || !e.SUPABASE_SECRET_KEY)) {
    throw new ConfigError(
      'Invalid configuration:\n  - SUPABASE_URL and SUPABASE_SECRET_KEY are required in production',
    );
  }

  return {
    env: e.NODE_ENV,
    isProd,
    isTest: e.NODE_ENV === 'test',
    port: e.PORT,
    databaseUrl: e.DATABASE_URL,
    sessionSecret: e.SESSION_SECRET,
    sessionMaxAgeMs: Math.round(e.SESSION_MAX_AGE_HOURS * 60 * 60 * 1000),
    trustProxy: e.TRUST_PROXY,
    cookieSecure: isProd,
    allowedOrigins: e.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
    clientDistDir:
      e.CLIENT_DIST_DIR ||
      (isProd ? fileURLToPath(new URL('../../client/dist', import.meta.url)) : undefined),
    storageDir: e.STORAGE_DIR,
    supabaseUrl: e.SUPABASE_URL,
    supabaseSecretKey: e.SUPABASE_SECRET_KEY,
    storageBucket: 'trustvault-documents',
    rate: {
      loginMax: e.LOGIN_RATE_MAX,
      registerMax: e.REGISTER_RATE_MAX,
      apiMax: e.API_RATE_MAX,
    },
    scrypt: { N: e.SCRYPT_N, r: 8, p: 3 },
  };
}
