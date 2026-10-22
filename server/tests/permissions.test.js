import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  baseTestConfig,
  makeContext,
  resetDb,
  createUser,
  loginAgent,
} from './helpers.js';

describe('Document permission API', () => {
  let t;
  let owner;
  let ownerAgent;
  let reader;
  let readerAgent;
  let editor;
  let editorAgent;
  let document;

  beforeEach(async () => {
    t = makeContext(baseTestConfig());
    await resetDb(t.db);

    owner = await createUser(t, {
      email: 'owner@example.com',
      name: 'Document Owner',
    });
    reader = await createUser(t, {
      email: 'reader@example.com',
      name: 'Reader',
    });
    editor = await createUser(t, {
      email: 'editor@example.com',
      name: 'Editor',
    });

    ownerAgent = await loginAgent(t, owner.email);
    readerAgent = await loginAgent(t, reader.email);
    editorAgent = await loginAgent(t, editor.email);

    document = await t.db.prisma.document.create({
      data: {
        ownerId: owner.id,
        title: 'Permission test document',
        description: 'Test document',
        category: 'General',
        originalFilename: 'example.txt',
        storageKey: '11111111-1111-4111-8111-111111111111',
        mimeType: 'text/plain',
        sizeBytes: 5,
        sha256: 'a'.repeat(64),
      },
    });
  });

  afterAll(async () => {
    if (t) await t.close();
  });

  it('allows the owner to grant READ access and records an audit event', async () => {
    const response = await ownerAgent
      .post(`/api/documents/${document.id}/permissions`)
      .send({ email: reader.email, level: 'READ' });

    expect(response.status).toBe(200);

    const grant = await t.db.prisma.documentPermission.findUnique({
      where: {
        documentId_userId: {
          documentId: document.id,
          userId: reader.id,
        },
      },
    });

    expect(grant).not.toBeNull();
    expect(grant.level).toBe('READ');

    const audit = await t.db.prisma.auditLog.findFirst({
      where: {
        documentId: document.id,
        action: 'PERMISSION_GRANT',
        outcome: 'ALLOWED',
        targetUserId: reader.id,
      },
    });

    expect(audit).not.toBeNull();
  });

  it('allows the owner to grant EDIT access', async () => {
    const response = await ownerAgent
      .post(`/api/documents/${document.id}/permissions`)
      .send({ email: editor.email, level: 'EDIT' });

    expect(response.status).toBe(200);

    const grant = await t.db.prisma.documentPermission.findUnique({
      where: {
        documentId_userId: {
          documentId: document.id,
          userId: editor.id,
        },
      },
    });

    expect(grant?.level).toBe('EDIT');
  });

  it('allows the owner to list document permissions', async () => {
    await t.db.prisma.documentPermission.create({
      data: {
        documentId: document.id,
        userId: reader.id,
        level: 'READ',
        grantedById: owner.id,
      },
    });

    const response = await ownerAgent
      .get(`/api/documents/${document.id}/permissions`);

    expect(response.status).toBe(200);
    expect(response.body.permissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: reader.id,
          level: 'READ',
        }),
      ]),
    );
  });

  it('prevents a non-owner from granting permissions', async () => {
    const response = await readerAgent
      .post(`/api/documents/${document.id}/permissions`)
      .send({ userId: editor.id, level: 'READ' });

    expect(response.status).toBe(404);

    const grant = await t.db.prisma.documentPermission.findUnique({
      where: {
        documentId_userId: {
          documentId: document.id,
          userId: editor.id,
        },
      },
    });

    expect(grant).toBeNull();
  });

  it('revokes READ access and denies the next document request', async () => {
    await t.db.prisma.documentPermission.create({
      data: {
        documentId: document.id,
        userId: reader.id,
        level: 'READ',
        grantedById: owner.id,
      },
    });

    const before = await readerAgent.get(`/api/documents/${document.id}`);
    expect(before.status).toBe(200);

    const revoke = await ownerAgent.delete(
      `/api/documents/${document.id}/permissions/${reader.id}`,
    );

    expect(revoke.status).toBe(204);

    const after = await readerAgent.get(`/api/documents/${document.id}`);
    expect(after.status).toBe(404);

    const audit = await t.db.prisma.auditLog.findFirst({
      where: {
        documentId: document.id,
        action: 'PERMISSION_REVOKE',
        outcome: 'ALLOWED',
        targetUserId: reader.id,
      },
    });

    expect(audit).not.toBeNull();
  });

  it('rejects unauthenticated permission changes', async () => {
    const request = (await import('supertest')).default;

    const response = await request(t.app)
      .post(`/api/documents/${document.id}/permissions`)
      .send({ email: reader.email, level: 'READ' });

    expect(response.status).toBe(401);
  });
});
