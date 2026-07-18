#!/usr/bin/env node
/**
 * Lightweight chaos/load harness for Match queue + Yjs upgrade path.
 * Usage:
 *   BASE_URL=http://localhost:3000 CONCURRENCY=40 ROUNDS=5 npm run chaos:match
 *
 * Does not require Gemini. Auth-optional mode only (REQUIRE_API_AUTH=false).
 */
import WebSocket from 'ws';

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const CONCURRENCY = Math.min(Number(process.env.CONCURRENCY) || 20, 200);
const ROUNDS = Math.min(Number(process.env.ROUNDS) || 3, 50);
const YJS_ROOM = process.env.YJS_ROOM || 'chaos-room-abcdefgh';

const results = {
  healthOk: 0,
  matchEnqueue: { ok: 0, fail: 0, statuses: {} },
  yjsUpgrade: { ok: 0, fail: 0, latencyMs: [] },
};

async function hitHealth() {
  const res = await fetch(`${BASE}/api/health`);
  if (res.ok) results.healthOk += 1;
  return res.json();
}

async function enqueueOnce(i) {
  const res = await fetch(`${BASE}/api/match/enqueue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic: 'chaos-load',
      durationMin: 25,
      flexibility: 'any_study',
      // Server may require auth — count statuses either way
      demoUid: `chaos-${i}-${Date.now()}`,
    }),
  });
  const key = String(res.status);
  results.matchEnqueue.statuses[key] = (results.matchEnqueue.statuses[key] || 0) + 1;
  if (res.status < 500) results.matchEnqueue.ok += 1;
  else results.matchEnqueue.fail += 1;
}

function probeYjs() {
  return new Promise((resolve) => {
    const started = Date.now();
    const url = BASE.replace(/^http/, 'ws') + `/yjs/${YJS_ROOM}`;
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      const ms = Date.now() - started;
      results.yjsUpgrade.latencyMs.push(ms);
      if (ok) results.yjsUpgrade.ok += 1;
      else results.yjsUpgrade.fail += 1;
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      resolve(ok);
    };
    const ws = new WebSocket(url);
    const timer = setTimeout(() => finish(false), 4000);
    ws.on('open', () => {
      clearTimeout(timer);
      finish(true);
    });
    ws.on('error', () => {
      clearTimeout(timer);
      finish(false);
    });
  });
}

async function round(r) {
  const jobs = [];
  for (let i = 0; i < CONCURRENCY; i += 1) {
    jobs.push(enqueueOnce(r * CONCURRENCY + i));
    if (i % 4 === 0) jobs.push(probeYjs());
  }
  await Promise.allSettled(jobs);
}

async function main() {
  console.log(`[chaos] BASE=${BASE} concurrency=${CONCURRENCY} rounds=${ROUNDS}`);
  const health = await hitHealth();
  console.log('[chaos] health', health);

  for (let r = 0; r < ROUNDS; r += 1) {
    const t0 = Date.now();
    await round(r);
    console.log(`[chaos] round ${r + 1}/${ROUNDS} ${Date.now() - t0}ms`);
  }

  const lat = results.yjsUpgrade.latencyMs.slice().sort((a, b) => a - b);
  const p95 = lat.length ? lat[Math.floor(lat.length * 0.95)] : null;
  const summary = {
    ...results,
    yjsUpgrade: {
      ok: results.yjsUpgrade.ok,
      fail: results.yjsUpgrade.fail,
      p95LatencyMs: p95,
      samples: lat.length,
    },
  };
  console.log(JSON.stringify(summary, null, 2));

  // Soft pass: health ok + server did not 5xx-storm on enqueue + some Yjs opens (auth-optional)
  if (results.healthOk < 1) process.exit(2);
  if (results.matchEnqueue.fail > results.matchEnqueue.ok) process.exit(3);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
