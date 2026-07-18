/**
 * Client device trust — stable local device id + Settings registration.
 * When TRUST_DEVICES=true, apiClient sends X-Device-Id on every request.
 */
import { apiRequest } from './apiClient';

const STORAGE_KEY = 'memora-device-id';
const LABEL_KEY = 'memora-device-label';

export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing && existing.length >= 8) return existing.slice(0, 128);
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return `ephemeral-${Date.now().toString(36)}`;
  }
}

export function getDeviceLabel(): string {
  if (typeof window === 'undefined') return 'device';
  try {
    return window.localStorage.getItem(LABEL_KEY) || guessBrowserLabel();
  } catch {
    return 'device';
  }
}

export function setDeviceLabel(label: string): void {
  try {
    window.localStorage.setItem(LABEL_KEY, label.trim().slice(0, 80) || 'device');
  } catch {
    /* ignore */
  }
}

function guessBrowserLabel(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (/Edg\//.test(ua)) return 'Edge';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Browser';
}

export type TrustedDeviceRow = {
  deviceId: string;
  label: string;
  trustedAt: string;
};

export async function registerThisDevice(label?: string): Promise<{ ok: boolean; deviceId: string }> {
  const deviceId = getOrCreateDeviceId();
  const resolved = (label ?? getDeviceLabel()).slice(0, 80);
  setDeviceLabel(resolved);
  const res = await apiRequest('/api/auth/trusted-devices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, label: resolved }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || 'Device registration failed');
  }
  return { ok: true, deviceId };
}

export async function listTrustedDevices(): Promise<TrustedDeviceRow[]> {
  const res = await apiRequest('/api/auth/trusted-devices');
  if (!res.ok) return [];
  const data = (await res.json()) as { devices?: TrustedDeviceRow[] };
  return data.devices ?? [];
}

export async function revokeTrustedDevice(deviceId: string): Promise<void> {
  const res = await apiRequest(`/api/auth/trusted-devices/${encodeURIComponent(deviceId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || 'Revoke failed');
  }
}
