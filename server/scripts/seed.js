// Creates the first accounts. Passwords come from environment variables, never from the code.
//
//   SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD   -> one ADMIN account (required)
//   SEED_DEMO_PASSWORD                      -> also create owner@ / viewer@ / stranger@ demo users
//   SEED_RESET_PASSWORDS=true               -> overwrite passwords of accounts that already exist
//
// Safe to run many times: existing accounts are left alone unless SEED_RESET_PASSWORDS=true.
// Passwords are never printed.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createPasswordHasher, DEFAULT_SCRYPT } from '../src/security/password.js';

const {
  DATABASE_URL,
  SEED_ADMIN_EMAIL,
  SEED_ADMIN_PASSWORD,
  SEED_DEMO_PASSWORD,
  SEED_RESET_PASSWORDS,
} = process.env;

function fail(message) {
  console.error(`seed: ${message}`);
  process.exit(1);
}

if (!DATABASE_URL) fail('DATABASE_URL is not set');
if (!SEED_ADMIN_EMAIL || !SEED_ADMIN_PASSWORD) fail('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required');
if (SEED_ADMIN_PASSWORD.length < 12) fail('SEED_ADMIN_PASSWORD must be at least 12 characters');
if (SEED_DEMO_PASSWORD && SEED_DEMO_PASSWORD.length < 12) fail('SEED_DEMO_PASSWORD must be at least 12 characters');

const normalise = (email) => email.trim().normalize('NFKC').toLowerCase();
const reset = SEED_RESET_PASSWORDS === 'true';

const accounts = [
  { email: normalise(SEED_ADMIN_EMAIL), name: 'Demo Admin', role: 'ADMIN', password: SEED_ADMIN_PASSWORD },
];
if (SEED_DEMO_PASSWORD) {
  accounts.push(
    { email: 'owner@trustvault.example', name: 'Demo Owner', role: 'USER', password: SEED_DEMO_PASSWORD },
    { email: 'viewer@trustvault.example', name: 'Demo Viewer', role: 'USER', password: SEED_DEMO_PASSWORD },
    { email: 'stranger@trustvault.example', name: 'Demo Stranger', role: 'USER', password: SEED_DEMO_PASSWORD },
  );
}

const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });
const hasher = createPasswordHasher(DEFAULT_SCRYPT);

try {
  for (const a of accounts) {
    const existing = await prisma.user.findUnique({ where: { email: a.email } });
    if (existing && !reset) {
      console.log(`exists   ${a.email} (${existing.role})`);
      continue;
    }
    const passwordHash = await hasher.hash(a.password);
    if (existing) {
      await prisma.user.update({ where: { id: existing.id }, data: { passwordHash, isActive: true } });
      console.log(`reset    ${a.email}`);
    } else {
      await prisma.user.create({ data: { email: a.email, name: a.name, role: a.role, passwordHash } });
      console.log(`created  ${a.email} (${a.role})`);
    }
  }
} finally {
  await prisma.$disconnect();
}
