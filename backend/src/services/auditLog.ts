import { promises as fs } from "node:fs";
import path from "node:path";

const auditLogPath = path.resolve(process.cwd(), "data/audit-log.jsonl");

export interface AuditEvent {
  actor: string;
  action: string;
  target?: string;
  details?: Record<string, unknown>;
}

export async function logAuditEvent(event: AuditEvent) {
  const entry = {
    ...event,
    createdAt: new Date().toISOString()
  };

  await fs.mkdir(path.dirname(auditLogPath), { recursive: true });
  await fs.appendFile(auditLogPath, `${JSON.stringify(entry)}\n`, "utf-8");
}
