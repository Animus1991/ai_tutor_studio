import fs from 'fs';
import path from 'path';

const MAX_EVENTS = 5000;

export function auditStorePath(): string {
  return process.env.AUDIT_STORE_PATH ?? path.join(process.cwd(), 'data', 'audit-log.jsonl');
}

export function loadPersistedAudit(): Record<string, unknown>[] {
  const filePath = auditStorePath();
  try {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf8').trim();
    if (!content) return [];
    return content
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  } catch (err) {
    console.warn('[Memora] Failed to load audit store:', err);
    return [];
  }
}

export function appendPersistedAudit(event: Record<string, unknown>): void {
  const filePath = auditStorePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(event)}\n`, 'utf8');
  trimAuditFile(filePath);
}

function trimAuditFile(filePath: string): void {
  try {
    const lines = fs.readFileSync(filePath, 'utf8').trim().split('\n').filter(Boolean);
    if (lines.length <= MAX_EVENTS) return;
    fs.writeFileSync(filePath, `${lines.slice(-MAX_EVENTS).join('\n')}\n`, 'utf8');
  } catch {
    /* best effort */
  }
}
