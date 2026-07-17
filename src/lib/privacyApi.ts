import { apiRequest } from './apiClient';

export async function exportMyData(): Promise<Record<string, unknown>> {
  const res = await apiRequest('/api/privacy/export');
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || 'Export failed');
  }
  return (await res.json()) as Record<string, unknown>;
}

export async function requestAccountDeletion(reason?: string): Promise<void> {
  const res = await apiRequest('/api/privacy/delete-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: (reason ?? '').slice(0, 500) }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || 'Deletion request failed');
  }
}

/** Anonymized pedagogy telemetry for researchers (no peer PII). */
export async function exportResearchData(): Promise<Record<string, unknown>> {
  const res = await apiRequest('/api/research/export');
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || 'Research export failed');
  }
  return (await res.json()) as Record<string, unknown>;
}
