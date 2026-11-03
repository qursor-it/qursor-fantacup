import "server-only";

import { db } from "@/lib/db";

export async function logAdminAction(
  adminUserId: number,
  action: string,
  entityType: string,
  entityId?: string | number | null,
  before?: object | null,
  after?: object | null
) {
  await db.adminAuditLog.create({
    data: {
      adminUserId,
      action,
      entityType,
      entityId: entityId != null ? String(entityId) : null,
      before: before ?? undefined,
      after: after ?? undefined,
    },
  });
}
