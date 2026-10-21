
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  baseTestConfig,
  makeContext,
  resetDb,
  createUser,
  loginAgent,
  TEST_PASSWORD,
} from './helpers.js';

describe('Document edit and delete API', () => {
  let t;
  let storageDir;
  let owner;
  let ownerAgent;
  let document;

  beforeEach(async () => {
    storageDir = await mkdtemp(path.join(tmpdir(), 'trustvault-edit-delete-'));
    t = makeContext(baseTestConfig({ STORAGE_DIR: storageDir }));
    await resetDb(t.db);

    owner = await createUser(t, {
      email: 'owner@example.com',
      name: 'Document Owner',
    });
    ownerAgent = await loginAgent(t, owner.email);

    document = await t.db.prisma.document.create({
      data: {
        ownerId: owner.id,
        title: 'Original title',
        description: 'Original description',
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
    if (storageDir) await rm(storageDir, { recursive: true, force: true });
  });

  it('allows the owner to edit document metadata and records an audit event', async () => {
    const response = await ownerAgent
      .patch(`/api/documents/${document.id}`)
      .send({ title: 'Updated title' });
    expect(response.status).toBe(200);
    expect(response.body.document.title).toBe('Updated title');

    const audit = await t.db.prisma.auditLog.findFirst({
      where: {
        documentId: document.id,
        action: 'DOCUMENT_EDIT',
        outcome: 'ALLOWED',
      },
    });
    expect(audit).not.toBeNull();
  });

  it('rejects an edit by a user without document access', async () => {
    const other = await createUser(t, {
      email: 'other@example.com',
      name: 'Other User',
    });
    const otherAgent = await loginAgent(t, other.email);

    const response = await otherAgent
      .patch(`/api/documents/${document.id}`)
      .send({ title: 'Unauthorized change' });

    expect(response.status).toBe(404);

    const unchanged = await t.db.prisma.document.findUnique({
      where: { id: document.id },
    });
    expect(unchanged.title).toBe('Original title');
  });

  it('allows the owner to delete a document and records an audit event', async () => {
    const response = await ownerAgent.delete(`/api/documents/${document.id}`);

    expect(response.status).toBe(204);

    const deleted = await t.db.prisma.document.findUnique({
      where: { id: document.id },
    });
    expect(deleted).toBeNull();

    const audit = await t.db.prisma.auditLog.findFirst({
      where: {
        documentId: document.id,
        action: 'DOCUMENT_DELETE',
        outcome: 'ALLOWED',
      },
    });
    expect(audit).not.toBeNull();
  });

  it('rejects deletion by a different user', async () => {
    const other = await createUser(t, {
      email: 'other@example.com',
      name: 'Other User',
    });
    const otherAgent = await loginAgent(t, other.email);

    const response = await otherAgent.delete(`/api/documents/${document.id}`);

    expect(response.status).toBe(404);

    const stillExists = await t.db.prisma.document.findUnique({
      where: { id: document.id },
    });
    expect(stillExists).not.toBeNull();
  });

  it('rejects unauthenticated edits', async () => {
    const response = await (await import('supertest')).default(t.app)
      .patch(`/api/documents/${document.id}`)
      .send({ title: 'Unauthenticated change' });

    expect(response.status).toBe(401);
  });
});
