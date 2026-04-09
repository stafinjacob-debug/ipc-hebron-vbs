import { prisma } from "@/lib/prisma";

export async function logStaffAccess(
  action: string,
  opts: {
    actorUserId?: string | null;
    targetUserId?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  await prisma.staffAccessAuditLog.create({
    data: {
      action,
      actorUserId: opts.actorUserId ?? undefined,
      targetUserId: opts.targetUserId ?? undefined,
      metadata: opts.metadata ? (opts.metadata as object) : undefined,
    },
  });
}
