
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink, readFile } from 'node:fs/promises';
import path from 'node:path';
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

function getSupabase(config) {
  if (!config.supabaseUrl || !config.supabaseSecretKey) {
    throw new Error('Supabase Storage is not configured');
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
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError('Expected file contents as a Buffer');
  }

  const storageKey = randomUUID();
  const sha256 = createHash('sha256').update(buffer).digest('hex');

  if (config?.isProd) {
    if (!ALLOWED_TYPES.has(contentType)) {
      throw new Error('Unsupported file type');
    }

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
    await unlink(filePath).catch(() => {});
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

  await unlink(path.join(storageRoot, storageKey));
}
