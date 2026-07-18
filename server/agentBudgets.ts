/**
 * Agent cost/latency budgets — Observe + soft reject before runaway spend.
 * Env overrides: AGENT_MAX_LATENCY_MS, AGENT_MAX_MESSAGES, AGENT_MAX_CHARS
 */
import { recentCircuitAlerts } from './circuitBreaker.js';

export const AGENT_DEFAULT_MAX_LATENCY_MS = Number(process.env.AGENT_MAX_LATENCY_MS ?? 45_000);
export const AGENT_DEFAULT_MAX_MESSAGES = Number(process.env.AGENT_MAX_MESSAGES ?? 40);
export const AGENT_DEFAULT_MAX_CHARS = Number(process.env.AGENT_MAX_CHARS ?? 48_000);

export type AgentBudgetSnapshot = {
  maxLatencyMs: number;
  maxMessages: number;
  maxChars: number;
  breaches: number;
  lastBreach: { reason: string; at: string } | null;
};

let breaches = 0;
let lastBreach: AgentBudgetSnapshot['lastBreach'] = null;

export function __resetAgentBudgetsForTests(): void {
  breaches = 0;
  lastBreach = null;
}

export function agentBudgetSnapshot(): AgentBudgetSnapshot {
  return {
    maxLatencyMs: AGENT_DEFAULT_MAX_LATENCY_MS,
    maxMessages: AGENT_DEFAULT_MAX_MESSAGES,
    maxChars: AGENT_DEFAULT_MAX_CHARS,
    breaches,
    lastBreach,
  };
}

function noteBreach(reason: string): void {
  breaches += 1;
  lastBreach = { reason: reason.slice(0, 160), at: new Date().toISOString() };
}

/** Preflight: reject oversized histories before Gemini side-effects. */
export function assertAgentRequestBudget(messages: unknown[]): void {
  if (!Array.isArray(messages)) {
    noteBreach('messages_not_array');
    throw Object.assign(new Error('messages must be an array'), { status: 400 });
  }
  if (messages.length > AGENT_DEFAULT_MAX_MESSAGES) {
    noteBreach(`messages>${AGENT_DEFAULT_MAX_MESSAGES}`);
    throw Object.assign(
      new Error(`Agent history exceeds ${AGENT_DEFAULT_MAX_MESSAGES} messages`),
      { status: 413 },
    );
  }
  let chars = 0;
  for (const m of messages) {
    if (m && typeof m === 'object') {
      const content = (m as { content?: unknown; parts?: unknown }).content;
      if (typeof content === 'string') chars += content.length;
      else if (Array.isArray(content)) {
        for (const p of content) {
          if (typeof p === 'string') chars += p.length;
          else if (p && typeof p === 'object' && typeof (p as { text?: string }).text === 'string') {
            chars += (p as { text: string }).text.length;
          }
        }
      }
    }
  }
  if (chars > AGENT_DEFAULT_MAX_CHARS) {
    noteBreach(`chars>${AGENT_DEFAULT_MAX_CHARS}`);
    throw Object.assign(
      new Error(`Agent request exceeds ${AGENT_DEFAULT_MAX_CHARS} characters`),
      { status: 413 },
    );
  }
}

/** Postflight: record latency budget pressure (soft — response already generated). */
export function noteAgentLatency(ms: number, path: 'chat' | 'stream'): {
  withinBudget: boolean;
  maxMs: number;
} {
  const within = ms <= AGENT_DEFAULT_MAX_LATENCY_MS;
  if (!within) {
    noteBreach(`${path}_latency_${ms}ms`);
  }
  return { withinBudget: within, maxMs: AGENT_DEFAULT_MAX_LATENCY_MS };
}

/** Combine with Gemini circuit alerts for Admin/SLO strip. */
export function agentObserveBundle(): {
  budgets: AgentBudgetSnapshot;
  recentCircuitAlerts: number;
} {
  return {
    budgets: agentBudgetSnapshot(),
    recentCircuitAlerts: recentCircuitAlerts().length,
  };
}
