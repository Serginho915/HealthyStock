import { query } from "./db.js";

export interface AuditEvent {
  actor: string;
  action: string;
  target?: string;
  details?: Record<string, unknown>;
}

export async function logAuditEvent(event: AuditEvent) {
  await query(
    `INSERT INTO audit_events (actor, action, target, details, created_at)
     VALUES ($1, $2, $3, $4::jsonb, NOW())`,
    [event.actor, event.action, event.target ?? null, JSON.stringify(event.details ?? {})]
  );
}
