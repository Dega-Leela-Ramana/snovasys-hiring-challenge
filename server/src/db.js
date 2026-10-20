// One place that opens database connections.
// - prisma: used for all normal queries (parameterised, so no SQL injection).
// - pool:   a plain pg pool, used ONLY by the session store and the session cleanup helper.
import { PrismaClient } from '@prisma/client';
import pg from 'pg';

export function createDb(databaseUrl) {
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 10 });
  return {
    prisma,
    pool,
    async close() {
      await prisma.$disconnect();
      await pool.end();
    },
  };
}
