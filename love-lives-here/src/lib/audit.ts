import { getDb, schema, type Tx } from "./db";

export async function audit(
  e: { actorId?: string | null; actorEmail?: string | null; action: string; entity: string; entityId?: string | null; meta?: Record<string, unknown>; ip?: string | null },
  tx: Tx = getDb(),
) {
  await tx.insert(schema.auditLogs).values({
    actorId: e.actorId ?? null, actorEmail: e.actorEmail ?? null, action: e.action, entity: e.entity,
    entityId: e.entityId ?? null, meta: e.meta ?? {}, ip: e.ip ?? null,
  });
}
