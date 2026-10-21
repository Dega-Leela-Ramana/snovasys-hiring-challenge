
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'text/plain',
]);

const EXTENSIONS = new Map([
  ['application/pdf', '.pdf'],
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['text/plain', '.txt'],
]);

export function validateUpload(file) {
  if (!file || !Buffer.isBuffer(file.buffer)) {
    throw new Error('A file is required');
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File exceeds the 10 MB limit');
  }

  if (!ALLOWED_TYPES.has(file.mimetype)) {
    throw new Error('Unsupported file type');
  }

  return EXTENSIONS.get(file.mimetype);
}

export async function storeDocument(buffer, storageRoot) {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError('Expected file contents as a Buffer');
  }

  const storageKey = randomUUID();
  const filePath = path.join(storageRoot, storageKey);
  await mkdir(storageRoot, { recursive: true });

  try {
    await writeFile(filePath, buffer, { flag: 'wx', mode: 0o600 });

    return {
      storageKey,
      sizeBytes: buffer.length,
      sha256: createHash('sha256').update(buffer).digest('hex'),
    };
  } catch (error) {
    await unlink(filePath).catch(() => {});
    throw error;
  }
}

export async function deleteStoredDocument(storageKey, storageRoot) {
  if (
    typeof storageKey !== 'string' ||
    !/^[0-9a-f-]{36}$/i.test(storageKey)
  ) {
    throw new Error('Invalid storage key');
  }

  await unlink(path.join(storageRoot, storageKey));
}
