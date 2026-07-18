#!/usr/bin/env node
/**
 * Release gate — code spine checks before production trust enforce.
 * Ops items (DPA / WCAG sign-off / APP_CHECK_ENFORCE) remain in docs/INSTITUTIONAL_GATES.md.
 *
 * Usage: npm run release-gate
 */
import { spawnSync } from 'node:child_process';

const steps = [
  { name: 'lint+types', cmd: 'npm', args: ['run', 'lint'] },
  { name: 'unit', cmd: 'npm', args: ['test'] },
  { name: 'audit', cmd: 'npm', args: ['run', 'audit'] },
];

let failed = false;
for (const step of steps) {
  console.log(`\n==> release-gate: ${step.name}`);
  const r = spawnSync(step.cmd, step.args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) {
    console.error(`release-gate FAILED at ${step.name}`);
    failed = true;
    break;
  }
}

if (failed) process.exit(1);

console.log(`
release-gate OK (code)

Ops still required before production marketing / institutional deploy:
  - APP_CHECK_ENFORCE=true + referrer-restricted keys
  - Live MATCH_PUBSUB_SUBSCRIPTION (+ @google-cloud/pubsub)
  - DPA / WCAG / efficacy checkboxes in docs/INSTITUTIONAL_GATES.md
  - Optional: npm run chaos:spine against staging BASE_URL
`);
