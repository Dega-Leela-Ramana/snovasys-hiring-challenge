import { createHash } from 'node:crypto';

function canonicalEvent(event) {
  return JSON.stringify({
    id: event.id.toString(),
    createdAt: event.createdAt.toISOString(),
    actorId: event.actorId ?? null,
    actorEmail: event.actorEmail ?? null,
    action: event.action,
    outcome: event.outcome,
    documentId: event.documentId ?? null,
    targetUserId: event.targetUserId ?? null,
    ip: event.ip ?? null,
    userAgent: event.userAgent ?? null,
    details: event.details ?? null,
    prevHash: event.prevHash ?? null,
  });
}

export function calculateAuditHash(event) {
  return createHash('sha256')
    .update(canonicalEvent(event))
    .digest('hex');
}

export async function appendAudit(tx, data) {
  // Serialize audit appends within their surrounding transaction.
  await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(734219, 1)) AS lock_result`;

  const latest = await tx.auditLog.findFirst({
    orderBy: { id: 'desc' },
    select: { id: true, hash: true },
  });

  const hashedCount = await tx.auditLog.count({
    where: { hash: { not: null } },
  });

  // Legacy rows are allowed only before the new chain begins.
  if (latest && !latest.hash && hashedCount > 0) {
    throw new Error(
      'Audit history has an unhashed row after the chain began; refusing to append',
    );
  }

  const previous = latest?.hash
    ? latest
    : await tx.auditLog.findFirst({
        where: { hash: { not: null } },
        orderBy: { id: 'desc' },
        select: { id: true, hash: true },
      });

  const createdAt = new Date();
  const prevHash = previous?.hash ?? null;

  // Reserve the next database-generated ID so it can be included in the hash.
  const idResult = await tx.$queryRaw`
    SELECT nextval(pg_get_serial_sequence('"AuditLog"', 'id'))::bigint AS id
  `;
  const id = idResult[0].id;

  const event = {
    id,
    createdAt,
    actorId: data.actorId ?? null,
    actorEmail: data.actorEmail ?? null,
    action: data.action,
    outcome: data.outcome,
    documentId: data.documentId ?? null,
    targetUserId: data.targetUserId ?? null,
    ip: data.ip ?? null,
    userAgent: data.userAgent ?? null,
    details: data.details ?? null,
    prevHash,
  };

  const hash = calculateAuditHash(event);

  return tx.auditLog.create({
    data: { ...event, hash },
  });
}

export async function writeAudit(prisma, data) {
  return prisma.$transaction((tx) => appendAudit(tx, data));
}

export async function verifyAuditChain(prisma) {
  const rows = await prisma.auditLog.findMany({
    orderBy: { id: 'asc' },
  });

  let previousHash = null;
  let chainStarted = false;
  let legacyCount = 0;
  let checked = 0;

  for (const row of rows) {
    if (!row.hash) {
      if (chainStarted) {
        return {
          valid: false,
          checked,
          total: rows.length,
          legacyCount,
          firstInvalidId: row.id.toString(),
          reason: 'UNHASHED_ROW_AFTER_CHAIN_START',
        };
      }

      legacyCount++;
      continue;
    }

    chainStarted = true;

    if ((row.prevHash ?? null) !== previousHash) {
      return {
        valid: false,
        checked,
        total: rows.length,
        legacyCount,
        firstInvalidId: row.id.toString(),
        reason: 'PREVIOUS_HASH_MISMATCH',
      };
    }

    if (calculateAuditHash(row) !== row.hash) {
      return {
        valid: false,
        checked,
        total: rows.length,
        legacyCount,
        firstInvalidId: row.id.toString(),
        reason: 'EVENT_HASH_MISMATCH',
      };
    }

    previousHash = row.hash;
    checked++;
  }

  return {
    valid: true,
    checked,
    total: rows.length,
    legacyCount,
    firstInvalidId: null,
    reason: null,
  };
}
