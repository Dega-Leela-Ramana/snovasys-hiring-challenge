
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';

import {
  baseTestConfig,
  makeContext,
  resetDb,
  createUser,
  loginAgent,
} from './helpers.js';

describe('Document upload API', () => {
  let t;
  let storageDir;
  let user;
  let agent;

  beforeAll(async () => {
    storageDir = await mkdtemp(
      path.join(os.tmpdir(), 'trustvault-upload-test-'),
    );

    t = makeContext(
      baseTestConfig({ STORAGE_DIR: storageDir }),
    );
  });

  beforeEach(async () => {
    await resetDb(t.db);

    user = await createUser(t, {
      email: 'upload-owner@example.test',
    });

    agent = await loginAgent(t, user.email);
  });

  afterAll(async () => {
    if (t) await t.close();

    if (storageDir) {
      await rm(storageDir, { recursive: true, force: true });
    }
  });

  it('uploads a document to private storage and records an audit event', async () => {
    const contents = Buffer.from('TrustVault upload test');

    const response = await agent
      .post('/api/documents')
      .field('title', 'Plant care notes')
      .field('description', 'Test document')
      .field('category', 'Gardening')
      .attach('file', contents, {
        filename: 'notes.txt',
        contentType: 'text/plain',
      });

    expect(response.status).toBe(201);
    expect(response.body.document.title).toBe('Plant care notes');
    expect(response.body.document.originalFilename).toBe('notes.txt');
    expect(response.body.document.ownerId).toBe(user.id);

    // Private storage details must not be exposed by the API.
    expect(response.body.document).not.toHaveProperty('storageKey');
    expect(response.body.document).not.toHaveProperty('sha256');

    const saved = await t.db.prisma.document.findUnique({
      where: { id: response.body.document.id },
    });

    expect(saved).not.toBeNull();
    expect(saved.sha256).toMatch(/^[a-f0-9]{64}$/);

    const storedContents = await readFile(
      path.join(storageDir, saved.storageKey),
    );

    expect(storedContents.equals(contents)).toBe(true);

    const audit = await t.db.prisma.auditLog.findFirst({
      where: {
        documentId: saved.id,
        action: 'DOCUMENT_UPLOAD',
      },
    });

    expect(audit).not.toBeNull();
    expect(audit.outcome).toBe('ALLOWED');
  });

  it('rejects requests without a file', async () => {
    const response = await agent
      .post('/api/documents')
      .field('title', 'Missing file');

    expect(response.status).toBe(400);
  });

  it('rejects unsupported declared file types', async () => {
    const response = await agent
      .post('/api/documents')
      .field('title', 'Unsupported file')
      .attach('file', Buffer.from('test'), {
        filename: 'archive.zip',
        contentType: 'application/zip',
      });

    expect(response.status).toBe(400);
  });

  it('requires authentication to upload documents', async () => {
    const response = await request(t.app)
      .post('/api/documents')
      .field('title', 'Unauthenticated upload')
      .attach('file', Buffer.from('test'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      });

    expect(response.status).toBe(401);
  });
});
