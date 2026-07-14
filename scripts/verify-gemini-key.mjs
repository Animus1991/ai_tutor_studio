#!/usr/bin/env node
/**
 * Cross-project Gemini key verifier.
 * Usage (from any repo root):
 *   node path/to/verify-gemini-key.mjs
 *   GEMINI_API_KEY=... node path/to/verify-gemini-key.mjs
 *
 * Loads .env.local then .env from cwd.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

function loadEnvFile(name) {
  const path = join(process.cwd(), name);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile('.env');
loadEnvFile('.env.local');

const key =
  process.env.GEMINI_API_KEY?.trim() ||
  process.env.GOOGLE_API_KEY?.trim() ||
  process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();

const model = process.env.GEMINI_CHAT_MODEL?.trim() || 'gemini-2.0-flash';

if (!key) {
  console.error('No GEMINI_API_KEY / GOOGLE_API_KEY in env or .env.local');
  process.exit(1);
}

const fingerprint = key.startsWith('AIza')
  ? `AIza…${key.slice(-4)}`
  : key.startsWith('AQ.')
    ? `AQ.…${key.slice(-4)}`
    : `${key.slice(0, 4)}…${key.slice(-4)}`;

console.log(`Key: ${fingerprint}`);
console.log(`Model: ${model}`);

const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
const body = JSON.stringify({
  contents: [{ parts: [{ text: 'Reply with exactly: OK' }] }],
});

const res = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body,
});

const text = await res.text();
let json;
try {
  json = JSON.parse(text);
} catch {
  json = { raw: text };
}

if (res.ok) {
  const reply =
    json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '(empty reply)';
  console.log('Status: OK');
  console.log('Reply:', reply.trim());
  process.exit(0);
}

console.error(`Status: HTTP ${res.status}`);
console.error(JSON.stringify(json?.error ?? json, null, 2));

if (res.status === 429) {
  console.error(`
Note: New API keys in the SAME Google Cloud / AI Studio project share billing quota.
Creating another key does not reset credits. Use a new project with billing, or top up:
  https://aistudio.google.com/projects
  https://ai.google.dev/gemini-api/docs/billing
`);
}

process.exit(1);
