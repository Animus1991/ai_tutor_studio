import { describe, expect, it } from 'vitest';
import { auditLogger, type AuditEvent } from '../auditLogger';

const sample: AuditEvent[] = [
  {
    id: '1',
    timestamp: new Date().toISOString(),
    userId: 'alice',
    action: 'APP_ACCESSED',
    resourceId: '/library',
  },
  {
    id: '2',
    timestamp: new Date().toISOString(),
    userId: 'bob',
    action: 'DOCUMENT_UPLOADED',
    resourceId: 'notes.pdf',
  },
];

describe('auditLogger filters', () => {
  it('filters audit logs by action', () => {
    const filtered = auditLogger.filterLogs(sample, { action: 'DOCUMENT_UPLOADED' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].action).toBe('DOCUMENT_UPLOADED');
  });

  it('filters audit logs by search query', () => {
    const filtered = auditLogger.filterLogs(sample, { query: 'alice' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].userId).toBe('alice');
  });
});
