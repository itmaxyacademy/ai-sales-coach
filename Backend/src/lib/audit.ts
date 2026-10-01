import { prisma } from "./prisma.js";
import { logger } from "./logger.js";

type LogAuditParams = {
  actorId: string;
  actorRole: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: any;
  ipAddress?: string;
};

export function logAudit(params: LogAuditParams): void {
  prisma.auditLog.create({
    data: {
      actorId: params.actorId,
      actorRole: params.actorRole,
      action: params.action,
      targetType: params.targetType || null,
      targetId: params.targetId || null,
      metadata: params.metadata || null,
      ipAddress: params.ipAddress || null,
    }
  }).catch((err: unknown) => {
    logger.error({ err }, "Failed to save audit log");
  });
}
