
import multer from 'multer';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { HttpError } from '../errors.js';
import {
  getDocumentAccess,
  canReadDocument,
  canEditDocument,
} from '../services/documentAccess.js';
import {
  validateUpload,
  storeDocument,
  deleteStoredDocument,
} from '../services/documentStorage.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const publicDocumentFields = {
  id: true,
  ownerId: true,
  title: true,
  description: true,
  category: true,
  originalFilename: true,
  mimeType: true,
  sizeBytes: true,
  version: true,
  createdAt: true,
  updatedAt: true,
};

const parseMultipart = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
    fields: 3,
    fieldSize: 10 * 1024,
  },
}).single('file');

function parseUpload(req, res) {
  return new Promise((resolve, reject) => {
    parseMultipart(req, res, (error) => {
      if (!error) return resolve();

      if (error instanceof multer.MulterError) {
        const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        return reject(
          new HttpError(status, 'Invalid or oversized upload', 'INVALID_UPLOAD'),
        );
      }

      reject(error);
    });
  });
}

export function createDocumentHandlers(ctx) {
  const { prisma, config } = ctx;

  return {
    list: async (req, res) => {
      const userId = req.user.id;

      const documents = await prisma.document.findMany({
        where: {
          OR: [
            { ownerId: userId },
            { permissions: { some: { userId } } },
          ],
        },
        select: publicDocumentFields,
        orderBy: { updatedAt: 'desc' },
      });

      res.json({ documents });
    },

    get: async (req, res) => {
      const access = await getDocumentAccess(
        prisma,
        req.params.id,
        req.user.id,
      );

      if (!access || !canReadDocument(access)) {
        throw new HttpError(404, 'Document not found', 'NOT_FOUND');
      }

      const document = await prisma.document.findUnique({
        where: { id: req.params.id },
        select: publicDocumentFields,
      });

      if (!document) {
        throw new HttpError(404, 'Document not found', 'NOT_FOUND');
      }

      res.json({
        document,
        access: { level: access.level },
      });
    },

    download: async (req, res) => {
      const access = await getDocumentAccess(
        prisma,
        req.params.id,
        req.user.id,
      );

      if (!access || !canReadDocument(access)) {
        throw new HttpError(404, 'Document not found', 'NOT_FOUND');
      }

      const document = await prisma.document.findUnique({
        where: { id: req.params.id },
        select: {
          id: true,
          storageKey: true,
          originalFilename: true,
          mimeType: true,
        },
      });

      if (!document) {
        throw new HttpError(404, 'Document not found', 'NOT_FOUND');
      }

      const filePath = path.join(config.storageDir, document.storageKey);

      try {
        await readFile(filePath);
      } catch (error) {
        if (error.code === 'ENOENT') {
          throw new HttpError(
            404,
            'Stored document not found',
            'NOT_FOUND',
          );
        }
        throw error;
      }

      await prisma.auditLog.create({
        data: {
          actorId: req.user.id,
          actorEmail: req.user.email,
          action: 'DOCUMENT_DOWNLOAD',
          outcome: 'ALLOWED',
          documentId: document.id,
          ip: req.ip,
          userAgent: req.get('user-agent') || null,
        },
      });

      res.set('X-Content-Type-Options', 'nosniff');
      res.type(document.mimeType);
      return res.download(filePath, document.originalFilename);
    },

    edit: async (req, res) => {
      const userId = req.user.id;

      const access = await getDocumentAccess(
        prisma,
        req.params.id,
        userId,
      );

      if (!access || !canEditDocument(access)) {
        throw new HttpError(404, 'Document not found', 'NOT_FOUND');
      }

      const { title, description, category } = req.body ?? {};
      const data = {};

      if (title !== undefined) {
        if (
          typeof title !== 'string' ||
          !title.trim() ||
          title.trim().length > 200
        ) {
          throw new HttpError(
            400,
            'Title must be 1-200 characters',
            'VALIDATION_ERROR',
          );
        }
        data.title = title.trim();
      }

      if (description !== undefined) {
        if (
          typeof description !== 'string' ||
          description.length > 2000
        ) {
          throw new HttpError(
            400,
            'Description must be at most 2000 characters',
            'VALIDATION_ERROR',
          );
        }
        data.description = description;
      }

      if (category !== undefined) {
        if (
          typeof category !== 'string' ||
          !category.trim() ||
          category.trim().length > 100
        ) {
          throw new HttpError(
            400,
            'Category must be 1-100 characters',
            'VALIDATION_ERROR',
          );
        }
        data.category = category.trim();
      }

      if (Object.keys(data).length === 0) {
        throw new HttpError(
          400,
          'Provide at least one field to update',
          'VALIDATION_ERROR',
        );
      }

      const document = await prisma.$transaction(async (tx) => {
        const updated = await tx.document.update({
          where: { id: req.params.id },
          data: { ...data, version: { increment: 1 } },
          select: publicDocumentFields,
        });

        await tx.auditLog.create({
          data: {
            actorId: userId,
            actorEmail: req.user.email,
            action: 'DOCUMENT_EDIT',
            outcome: 'ALLOWED',
            documentId: updated.id,
            ip: req.ip,
            userAgent: req.get('user-agent'),
            details: { fields: Object.keys(data) },
          },
        });

        return updated;
      });

      res.json({ document });
    },

    remove: async (req, res) => {
      const userId = req.user.id;

      const access = await getDocumentAccess(
        prisma,
        req.params.id,
        userId,
      );

      // Only the owner may delete a document.
      if (!access || access.level !== 'OWNER') {
        throw new HttpError(404, 'Document not found', 'NOT_FOUND');
      }

      const document = await prisma.document.findUnique({
        where: { id: req.params.id },
        select: { id: true, storageKey: true },
      });

      if (!document) {
        throw new HttpError(404, 'Document not found', 'NOT_FOUND');
      }

      await prisma.$transaction(async (tx) => {
        await tx.document.delete({
          where: { id: document.id },
        });

        await tx.auditLog.create({
          data: {
            actorId: userId,
            actorEmail: req.user.email,
            action: 'DOCUMENT_DELETE',
            outcome: 'ALLOWED',
            documentId: document.id,
            ip: req.ip,
            userAgent: req.get('user-agent'),
            details: {},
          },
        });
      });

      // Clean up the private file after the database operation succeeds.
      try {
        await deleteStoredDocument(document.storageKey, config.storageDir);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.error('Document storage cleanup failed:', error);
        }
      }

      res.status(204).end();
    },

    upload: async (req, res) => {
      await parseUpload(req, res);

      if (!req.file) {
        throw new HttpError(
          400,
          'A file is required in the file field',
          'INVALID_UPLOAD',
        );
      }

      try {
        validateUpload(req.file);
      } catch {
        throw new HttpError(400, 'Unsupported file type', 'INVALID_UPLOAD');
      }

      const title =
        typeof req.body.title === 'string' ? req.body.title.trim() : '';

      if (!title || title.length > 200) {
        throw new HttpError(
          400,
          'Title is required and must be at most 200 characters',
          'INVALID_TITLE',
        );
      }

      const description =
        typeof req.body.description === 'string'
          ? req.body.description.trim()
          : '';

      const category =
        typeof req.body.category === 'string' && req.body.category.trim()
          ? req.body.category.trim()
          : 'General';

      if (description.length > 2000 || category.length > 100) {
        throw new HttpError(
          400,
          'Description or category is too long',
          'INVALID_METADATA',
        );
      }

      const originalFilename = path
        .basename(req.file.originalname.replace(/\\/g, '/'))
        .slice(0, 255);

      if (!originalFilename) {
        throw new HttpError(400, 'Invalid filename', 'INVALID_UPLOAD');
      }

      const stored = await storeDocument(
        req.file.buffer,
        config.storageDir,
      );

      let document;

      try {
        document = await prisma.document.create({
          data: {
            ownerId: req.user.id,
            title,
            description: description || null,
            category,
            originalFilename,
            storageKey: stored.storageKey,
            mimeType: req.file.mimetype,
            sizeBytes: stored.sizeBytes,
            sha256: stored.sha256,
          },
          select: publicDocumentFields,
        });

        await prisma.auditLog.create({
          data: {
            actorId: req.user.id,
            actorEmail: req.user.email,
            action: 'DOCUMENT_UPLOAD',
            outcome: 'ALLOWED',
            documentId: document.id,
            ip: req.ip,
            userAgent: req.get('user-agent') || null,
            details: { filename: originalFilename },
          },
        });
      } catch (error) {
        if (document) {
          await prisma.document
            .delete({ where: { id: document.id } })
            .catch(() => {});
        }

        await deleteStoredDocument(
          stored.storageKey,
          config.storageDir,
        ).catch(() => {});

        throw error;
      }

      res.status(201).json({ document });
    },
  };
}
