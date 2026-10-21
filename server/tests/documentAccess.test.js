import { describe, expect, it, vi } from 'vitest';
import {
  getDocumentAccess,
  canReadDocument,
  canEditDocument,
} from '../src/services/documentAccess.js';

function mockPrisma(document) {
  return {
    document: {
      findUnique: vi.fn().mockResolvedValue(document),
    },
  };
}

describe('document access control', () => {
  it('returns null when the document does not exist', async () => {
    const prisma = mockPrisma(null);

    await expect(
      getDocumentAccess(prisma, 'doc-1', 'user-1'),
    ).resolves.toBeNull();
  });

  it('allows the owner to read and edit', async () => {
    const prisma = mockPrisma({
      id: 'doc-1',
      ownerId: 'user-1',
      permissions: [],
    });

    const access = await getDocumentAccess(prisma, 'doc-1', 'user-1');

    expect(access.level).toBe('OWNER');
    expect(canReadDocument(access)).toBe(true);
    expect(canEditDocument(access)).toBe(true);
  });

  it('allows a READ grantee to read but not edit', async () => {
    const prisma = mockPrisma({
      id: 'doc-1',
      ownerId: 'owner-1',
      permissions: [{ level: 'READ' }],
    });

    const access = await getDocumentAccess(prisma, 'doc-1', 'reader-1');

    expect(access.level).toBe('READ');
    expect(canReadDocument(access)).toBe(true);
    expect(canEditDocument(access)).toBe(false);
  });

  it('allows an EDIT grantee to read and edit', async () => {
    const prisma = mockPrisma({
      id: 'doc-1',
      ownerId: 'owner-1',
      permissions: [{ level: 'EDIT' }],
    });

    const access = await getDocumentAccess(prisma, 'doc-1', 'editor-1');

    expect(access.level).toBe('EDIT');
    expect(canReadDocument(access)).toBe(true);
    expect(canEditDocument(access)).toBe(true);
  });

  it('denies a user without a grant', async () => {
    const prisma = mockPrisma({
      id: 'doc-1',
      ownerId: 'owner-1',
      permissions: [],
    });

    const access = await getDocumentAccess(prisma, 'doc-1', 'stranger-1');

    expect(access.level).toBe('NONE');
    expect(canReadDocument(access)).toBe(false);
    expect(canEditDocument(access)).toBe(false);
  });

  it('rejects missing identifiers without querying the database', async () => {
    const prisma = mockPrisma(null);

    await expect(
      getDocumentAccess(prisma, '', 'user-1'),
    ).resolves.toBeNull();

    expect(prisma.document.findUnique).not.toHaveBeenCalled();
  });

  it('scopes permission lookup to the requesting user', async () => {
    const prisma = mockPrisma({
      id: 'doc-1',
      ownerId: 'owner-1',
      permissions: [],
    });

    await getDocumentAccess(prisma, 'doc-1', 'user-2');

    expect(prisma.document.findUnique).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      select: {
        id: true,
        ownerId: true,
        permissions: {
          where: { userId: 'user-2' },
          select: { level: true },
          take: 1,
        },
      },
    });
  });
});