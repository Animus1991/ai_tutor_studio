#!/usr/bin/env node
/**
 * Expanded chaos/SLO probes: health, match, yjs, gemini, spine adoption,
 * Agent / Voice / Teacher / Offline / Evidence soft probes.
 * Usage: BASE_URL=http://localhost:3000 npm run chaos:spine
 */
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const CONCURRENCY = Math.min(Number(process.env.CONCURRENCY) || 12, 80);
const ROUNDS = Math.min(Number(process.env.ROUNDS) || 2, 20);

const results = {
  probes: {},
  failures: [],
};

const SOFT_401 = new Set([
  'agent.soft',
  'teacher.soft',
  'evidence.transfer.soft',
  'voice.tts.soft',
  'voice.transcribe.soft',
  'offline.learning.soft',
]);

async function probe(name, path, opts = {}) {
  const started = Date.now();
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const ms = Date.now() - started;
    // Gemini without key returns 503 — treat as probe-ok in demo/preview
    let softOk = res.status < 500;
    if (!softOk && name === 'health.gemini' && res.status === 503) softOk = true;
    if (!softOk && SOFT_401.has(name) && res.status === 401) softOk = true;
    // TTS/transcribe may 400 without audio payload — still SLO-reachable
    if (
      !softOk &&
      (name === 'voice.tts.soft' || name === 'voice.transcribe.soft') &&
      (res.status === 400 || res.status === 415)
    ) {
      softOk = true;
    }
    if (!results.probes[name]) results.probes[name] = { ok: 0, fail: 0, latency: [] };
    if (softOk) results.probes[name].ok += 1;
    else {
      results.probes[name].fail += 1;
      results.failures.push({ name, status: res.status });
    }
    results.probes[name].latency.push(ms);
    return res.status;
  } catch (e) {
    if (!results.probes[name]) results.probes[name] = { ok: 0, fail: 0, latency: [] };
    results.probes[name].fail += 1;
    results.failures.push({ name, error: String(e.message || e) });
    return 0;
  }
}

async function round(r) {
  const jobs = [];
  for (let i = 0; i < CONCURRENCY; i += 1) {
    jobs.push(probe('health', '/api/health'));
    jobs.push(probe('health.match', '/api/health/match'));
    jobs.push(probe('health.yjs', '/api/health/yjs'));
    jobs.push(probe('spine.adoption', '/api/spine/adoption'));
    jobs.push(probe('health.gemini', '/api/health/gemini'));
    jobs.push(
      probe('agent.soft', '/api/agent/chat', {
        method: 'POST',
        body: { messages: [{ role: 'user', content: 'chaos ping' }] },
      }),
    );
    jobs.push(probe('teacher.soft', '/api/classes', { method: 'GET' }));
    jobs.push(
      probe('evidence.transfer.soft', '/api/evidence/transfer', {
        method: 'POST',
        body: { attempts: [] },
      }),
    );
    jobs.push(
      probe('voice.tts.soft', '/api/tts', {
        method: 'POST',
        body: { text: 'chaos' },
      }),
    );
    jobs.push(
      probe('voice.transcribe.soft', '/api/transcribe', {
        method: 'POST',
        body: {},
      }),
    );
    // Offline pedagogy path — learning summary (auth soft)
    jobs.push(probe('offline.learning.soft', '/api/learning/summary', { method: 'GET' }));
  }
  await Promise.all(jobs);
  console.log(`round ${r + 1}/${ROUNDS} complete`);
}

for (let r = 0; r < ROUNDS; r += 1) {
  await round(r);
}

const summary = Object.fromEntries(
  Object.entries(results.probes).map(([k, v]) => {
    const lat = v.latency.sort((a, b) => a - b);
    const p95 = lat[Math.floor(lat.length * 0.95)] ?? null;
    return [k, { ok: v.ok, fail: v.fail, p95Ms: p95 }];
  }),
);

console.log(JSON.stringify({ base: BASE, summary, failureSample: results.failures.slice(0, 10) }, null, 2));

const hardFail = Object.values(results.probes).some((p) => p.fail > p.ok);
process.exit(hardFail ? 1 : 0);
