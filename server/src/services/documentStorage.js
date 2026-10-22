
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink, readFile } from 'node:fs/promises';
import path from 'node:path';
import { TextDecoder } from 'node:util';
import { createClient } from '@supabase/supabase-js';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

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

function validateFileContents(buffer, contentType) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('A non-empty file is required');
  }

  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error('File exceeds the 10 MB limit');
  }

  if (!ALLOWED_TYPES.has(contentType)) {
    throw new Error('Unsupported file type');
  }

  if (contentType === 'application/pdf') {
    if (buffer.length < 5 || buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new Error('File contents do not match PDF type');
    }
  }

  if (contentType === 'image/jpeg') {
    if (
      buffer.length < 3 ||
      buffer[0] !== 0xff ||
      buffer[1] !== 0xd8 ||
      buffer[2] !== 0xff
    ) {
      throw new Error('File contents do not match JPEG type');
    }
  }

  if (contentType === 'image/png') {
    const pngSignature = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);

    if (
      buffer.length < pngSignature.length ||
      !buffer.subarray(0, pngSignature.length).equals(pngSignature)
    ) {
      throw new Error('File contents do not match PNG type');
    }
  }

  if (contentType === 'text/plain') {
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
      throw new Error('Text files must contain valid UTF-8 text');
    }

    if (buffer.includes(0)) {
      throw new Error('Text files cannot contain null bytes');
    }
  }
}

export function validateUpload(file) {
  if (!file || !Buffer.isBuffer(file.buffer)) {
    throw new Error('A file is required');
  }

  if (
    !Number.isSafeInteger(file.size) ||
    file.size !== file.buffer.length
  ) {
    throw new Error('Invalid file size');
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File exceeds the 10 MB limit');
  }

  validateFileContents(file.buffer, file.mimetype);

  return EXTENSIONS.get(file.mimetype);
}

function getSupabase(config) {
  if (!config?.supabaseUrl || !config?.supabaseSecretKey) {
    throw new Error('Supabase Storage is not configured');
  }

  if (!config.storageBucket) {
    throw new Error('Supabase Storage bucket is not configured');
  }

  return createClient(config.supabaseUrl, config.supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function storeDocument(
  buffer,
  storageRoot,
  config,
  contentType = 'application/octet-stream',
) {
  validateFileContents(buffer, contentType);

  const storageKey = randomUUID();
  const sha256 = createHash('sha256').update(buffer).digest('hex');

  if (config?.isProd) {
    const { error } = await getSupabase(config)
      .storage
      .from(config.storageBucket)
      .upload(storageKey, buffer, {
        contentType,
        upsert: false,
      });

    if (error) {
      throw new Error('Could not store document in private storage');
    }

    return { storageKey, sizeBytes: buffer.length, sha256 };
  }

  await mkdir(storageRoot, { recursive: true });

  const filePath = path.join(storageRoot, storageKey);

  try {
    await writeFile(filePath, buffer, {
      flag: 'wx',
      mode: 0o600,
    });

    return { storageKey, sizeBytes: buffer.length, sha256 };
  } catch (error) {
    try {
      await unlink(filePath);
    } catch (cleanupError) {
      if (cleanupError.code !== 'ENOENT') {
        // Preserve the original write error.
      }
    }

    throw error;
  }
}

export async function readStoredDocument(storageKey, storageRoot, config) {
  if (typeof storageKey !== 'string' || !/^[0-9a-f-]{36}$/i.test(storageKey)) {
    throw new Error('Invalid storage key');
  }

  if (config?.isProd) {
    const { data, error } = await getSupabase(config)
      .storage
      .from(config.storageBucket)
      .download(storageKey);

    if (error || !data) {
      const missing = new Error('Stored document not found');
      missing.code = 'ENOENT';
      throw missing;
    }

    return Buffer.from(await data.arrayBuffer());
  }

  return readFile(path.join(storageRoot, storageKey));
}

export async function deleteStoredDocument(storageKey, storageRoot, config) {
  if (typeof storageKey !== 'string' || !/^[0-9a-f-]{36}$/i.test(storageKey)) {
    throw new Error('Invalid storage key');
  }

  if (config?.isProd) {
    const { error } = await getSupabase(config)
      .storage
      .from(config.storageBucket)
      .remove([storageKey]);

    if (error) {
      throw new Error('Could not delete document from private storage');
    }

    return;
  }

  try {
    await unlink(path.join(storageRoot, storageKey));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}
