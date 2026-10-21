
import { HttpError } from '../errors.js';
import { getDocumentAccess } from '../services/documentAccess.js';

export function createPermissionHandlers(ctx) {
  const { prisma } = ctx;

  return {
    list: async (req, res) => {
      const access = await getDocumentAccess(
        prisma,
        req.params.id,
        req.user.id,
      );

      if (!access || access.level !== 'OWNER') {
        throw new HttpError(404, 'Document not found', 'NOT_FOUND');
      }

      const permissions = await prisma.documentPermission.findMany({
        where: { documentId: req.params.id },
        select: {
          userId: true,
          level: true,
          grantedById: true,
          createdAt: true,
          user: { select: { email: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      });

      res.json({ permissions });
    },

    grant: async (req, res) => {
      const ownerAccess = await getDocumentAccess(
        prisma,
        req.params.id,
        req.user.id,
      );

      if (!ownerAccess || ownerAccess.level !== 'OWNER') {
        throw new HttpError(404, 'Document not found', 'NOT_FOUND');
      }

      const { userId, level } = req.body ?? {};

      if (
        typeof userId !== 'string' ||
        !userId ||
        !['READ', 'EDIT'].includes(level)
      ) {
        throw new HttpError(
          400,
          'Provide a valid userId and access level READ or EDIT',
          'VALIDATION_ERROR',
        );
      }

      const target = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, isActive: true },
      });

      if (!target || !target.isActive) {
        throw new HttpError(404, 'User not found', 'USER_NOT_FOUND');
      }

      if (target.id === req.user.id) {
        throw new HttpError(
          400,
          'The owner already has full access',
          'INVALID_PERMISSION',
        );
      }

      const permission = await prisma.$transaction(async (tx) => {
        const saved = await tx.documentPermission.upsert({
          where: {
            documentId_userId: {
              documentId: req.params.id,
              userId,
            },
          },
          create: {
            documentId: req.params.id,
            userId,
            level,
            grantedById: req.user.id,
          },
          update: {
            level,
            grantedById: req.user.id,
          },
          select: {
            documentId: true,
            userId: true,
            level: true,
            grantedById: true,
            createdAt: true,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: req.user.id,
            actorEmail: req.user.email,
            action: 'PERMISSION_GRANT',
            outcome: 'ALLOWED',
            documentId: req.params.id,
            targetUserId: userId,
            ip: req.ip,
            userAgent: req.get('user-agent') || null,
            details: { level },
          },
        });

        return saved;
      });

      res.status(200).json({ permission });
    },

    revoke: async (req, res) => {
      const ownerAccess = await getDocumentAccess(
        prisma,
        req.params.id,
        req.user.id,
      );

      if (!ownerAccess || ownerAccess.level !== 'OWNER') {
        throw new HttpError(404, 'Document not found', 'NOT_FOUND');
      }

      const userId = req.params.userId;

      if (!userId || userId === req.user.id) {
        throw new HttpError(
          400,
          'A valid recipient userId is required',
          'VALIDATION_ERROR',
        );
      }

      await prisma.$transaction(async (tx) => {
        const existing = await tx.documentPermission.findUnique({
          where: {
            documentId_userId: {
              documentId: req.params.id,
              userId,
            },
          },
          select: { level: true },
        });

        if (!existing) {
          throw new HttpError(
            404,
            'Permission not found',
            'PERMISSION_NOT_FOUND',
          );
        }

        await tx.documentPermission.delete({
          where: {
            documentId_userId: {
              documentId: req.params.id,
              userId,
            },
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: req.user.id,
            actorEmail: req.user.email,
            action: 'PERMISSION_REVOKE',
            outcome: 'ALLOWED',
            documentId: req.params.id,
            targetUserId: userId,
            ip: req.ip,
            userAgent: req.get('user-agent') || null,
            details: { previousLevel: existing.level },
          },
        });
      });

      res.status(204).end();
    },
  };
}
