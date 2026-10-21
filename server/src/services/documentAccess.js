/**
 * Centralized document authorization.
 *
 * OWNER: may read and edit their document.
 * READ: may read only.
 * EDIT: may read and edit.
 * NONE: no access.
 *
 * ADMIN does not automatically bypass document permissions.
 */
export async function getDocumentAccess(prisma, documentId, userId) {
  if (
    typeof documentId !== 'string' ||
    !documentId ||
    typeof userId !== 'string' ||
    !userId
  ) {
    return null;
  }

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      ownerId: true,
      permissions: {
        where: { userId },
        select: { level: true },
        take: 1,
      },
    },
  });

  if (!document) return null;

  if (document.ownerId === userId) {
    return { document, level: 'OWNER' };
  }

  const grant = document.permissions[0];

  if (grant?.level === 'READ' || grant?.level === 'EDIT') {
    return { document, level: grant.level };
  }

  return { document, level: 'NONE' };
}

export function canReadDocument(access) {
  return Boolean(
    access &&
    ['OWNER', 'READ', 'EDIT'].includes(access.level),
  );
}

export function canEditDocument(access) {
  return Boolean(
    access &&
    ['OWNER', 'EDIT'].includes(access.level),
  );
}