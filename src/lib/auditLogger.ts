export type AuditAction = 
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'DOCUMENT_UPLOADED'
  | 'DOCUMENT_DELETED'
  | 'ROLE_CHANGED'
  | 'PII_DETECTED'
  | 'ROOM_JOINED'
  | 'PERFORMANCE_METRIC';

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

  log(action: AuditAction, userId: string, resourceId?: string, details?: Record<string, any>) {
    const event: AuditEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      userId,
      action,
      resourceId,
      details
    };
    
    const events = this.getEvents();
    events.push(event);
    localStorage.setItem('memora-audit-logs', JSON.stringify(events));
    
    // In a real app, this would also send to a secure backend endpoint
    console.log('[Audit Log]', event);
  }

  getRecentLogs(limit: number = 50): AuditEvent[] {
    return this.getEvents().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, limit);
  }
}

export const auditLogger = new AuditLogger();
