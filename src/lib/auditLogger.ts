import { apiRequest } from './apiClient';

export type AuditAction =
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'DOCUMENT_UPLOADED'
  | 'DOCUMENT_DELETED'
  | 'ROLE_CHANGED'
  | 'TASK_COMPLETED'
  | 'TASK_REVIEWED'
  | 'PII_DETECTED'
  | 'ROOM_JOINED'
  | 'PERFORMANCE_METRIC'
  | 'APP_ACCESSED'
  | 'OFFLINE_FLUSH'
  | 'CIRCLE_OPEN';

export interface AuditEvent {
  id: string;
  timestamp: string;
  userId: string;
  action: AuditAction;
  resourceId?: string;
  details?: Record<string, any>;
}

class AuditLogger {
  private getEvents(): AuditEvent[] {
    const events = localStorage.getItem('memora-audit-logs');
    return events ? JSON.parse(events) : [];
  }

  private sanitize(data: any): any {
    if (!data) return data;
    if (typeof data !== 'object') {
      if (typeof data === 'string') {
        return data.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[REDACTED_EMAIL]')
                   .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[REDACTED_PHONE]');
      }
      return data;
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.sanitize(item));
    }

    const sanitized: Record<string, any> = {};
    for (const key in data) {
      if (['email', 'password', 'phone', 'address', 'name', 'token', 'authorization'].includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = this.sanitize(data[key]);
      }
    }
    return sanitized;
  }

  log(action: AuditAction, userId: string, resourceId?: string, details?: Record<string, any>) {
    const sanitizedDetails = this.sanitize(details);
    const event: AuditEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      userId,
      action,
      resourceId,
      details: sanitizedDetails
    };
    
    const events = this.getEvents();
    events.push(event);
    localStorage.setItem('memora-audit-logs', JSON.stringify(events));

    const skipServerInDev =
      import.meta.env.DEV && action === 'PERFORMANCE_METRIC';

    if (!skipServerInDev) {
      void fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      }).catch(() => {
        /* server audit optional */
      });
    }

    if (import.meta.env.DEV && action !== 'PERFORMANCE_METRIC') {
      console.log('[Audit Log]', event);
    }
  }

  async fetchServerLogs(limit = 50): Promise<AuditEvent[]> {
    try {
      const res = await apiRequest(`/api/admin/audit?limit=${limit}`);
      if (!res.ok) return [];
      const data = (await res.json()) as { logs?: AuditEvent[] };
      return data.logs ?? [];
    } catch {
      return [];
    }
  }

  mergeLogs(local: AuditEvent[], server: AuditEvent[]): AuditEvent[] {
    const byId = new Map<string, AuditEvent>();
    for (const e of [...local, ...server]) byId.set(e.id, e);
    return [...byId.values()].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }

  filterLogs(
    logs: AuditEvent[],
    opts: { action?: string; query?: string; limit?: number },
  ): AuditEvent[] {
    const q = opts.query?.trim().toLowerCase();
    let filtered = logs;
    if (opts.action && opts.action !== 'all') {
      filtered = filtered.filter((l) => l.action === opts.action);
    }
    if (q) {
      filtered = filtered.filter(
        (l) =>
          l.action.toLowerCase().includes(q) ||
          l.userId.toLowerCase().includes(q) ||
          (l.resourceId ?? '').toLowerCase().includes(q),
      );
    }
    return filtered.slice(0, opts.limit ?? 100);
  }

  getRecentLogs(limit: number = 50): AuditEvent[] {
    return this.getEvents().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, limit);
  }
}

export const auditLogger = new AuditLogger();
