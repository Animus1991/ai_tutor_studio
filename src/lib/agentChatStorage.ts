import localforage from 'localforage';
import type { Citation } from './rag';

export type AgentMessage = {
  id: string;
  role: 'user' | 'model';
  content: string;
  urls?: string[];
  citations?: Citation[];
};

export type AgentModeId = 'socratic' | 'direct' | 'quiz' | 'feynman' | 'exam-coach' | 'summariser' | 'debate' | 'explorer';

const MODE_KEY = 'memora-agent-active-mode';
const LEGACY_KEY = 'memora-ai-logs';

function chatKey(modeId: AgentModeId, isDemo: boolean): string {
  const scope = isDemo ? 'demo' : 'auth';
  return `memora-agent-chat-${modeId}-${scope}`;
}

export async function loadAgentMode(): Promise<AgentModeId | null> {
  const stored = await localforage.getItem<string>(MODE_KEY);
  const VALID: AgentModeId[] = ['socratic', 'direct', 'quiz', 'feynman', 'exam-coach', 'summariser', 'debate', 'explorer'];
  if (stored && VALID.includes(stored as AgentModeId)) {
    return stored as AgentModeId;
  }
  return null;
}

export async function saveAgentMode(modeId: AgentModeId): Promise<void> {
  await localforage.setItem(MODE_KEY, modeId);
}

export async function loadAgentMessages(
  modeId: AgentModeId,
  isDemo: boolean,
): Promise<AgentMessage[]> {
  const key = chatKey(modeId, isDemo);
  const stored = await localforage.getItem<AgentMessage[]>(key);
  if (stored && stored.length > 0) return stored;

  // One-time migration from legacy single-thread storage
  if (modeId === 'socratic') {
    const legacy = await localforage.getItem<AgentMessage[]>(LEGACY_KEY);
    if (legacy && legacy.length > 0) {
      await localforage.setItem(key, legacy);
      return legacy;
    }
  }

  return [];
}

export async function saveAgentMessages(
  modeId: AgentModeId,
  isDemo: boolean,
  messages: AgentMessage[],
): Promise<void> {
  const key = chatKey(modeId, isDemo);
  if (messages.length === 0) {
    await localforage.removeItem(key);
    return;
  }
  await localforage.setItem(key, messages);
}

export async function clearAgentMessages(modeId: AgentModeId, isDemo: boolean): Promise<void> {
  await localforage.removeItem(chatKey(modeId, isDemo));
}

export async function clearAllAgentMessages(isDemo: boolean): Promise<void> {
  const modes: AgentModeId[] = ['socratic', 'direct', 'quiz', 'feynman', 'exam-coach', 'summariser', 'debate', 'explorer'];
  await Promise.all(modes.map((m) => clearAgentMessages(m, isDemo)));
}
