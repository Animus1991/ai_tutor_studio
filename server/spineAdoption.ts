/**
 * Machine-readable spine adoption cards per surface (0–17).
 * A surface is complete only when every stage is wired.
 */
export type SpineStage =
  | 'auth'
  | 'validate'
  | 'authorize'
  | 'moderate'
  | 'persist'
  | 'observe'
  | 'pedagogy'
  | 'privacy';

export type StageStatus = 'wired' | 'partial' | 'stub' | 'n/a';

export type AdoptionCard = {
  id: number | string;
  surface: string;
  stages: Record<SpineStage, StageStatus>;
  modules: string[];
  notes: string;
};

export const SPINE_ADOPTION: readonly AdoptionCard[] = [
  {
    id: 0,
    surface: 'Platform kernel',
    stages: {
      auth: 'wired',
      validate: 'wired',
      authorize: 'wired',
      moderate: 'wired',
      persist: 'partial',
      observe: 'partial',
      pedagogy: 'wired',
      privacy: 'partial',
    },
    modules: [
      'server/firebaseToken.ts',
      'server/requestSpine.ts',
      'server/authz.ts',
      'server/platformModeration.ts',
      'server/sessionTrust.ts',
      'server/appCheck.ts',
      'server/yjsSnapshotStore.ts',
    ],
    notes: 'App Check soft-by-default; durable Yjs + device trust Firestore-backed',
  },
  {
    id: 1,
    surface: 'Auth / Google',
    stages: {
      auth: 'wired',
      validate: 'wired',
      authorize: 'wired',
      moderate: 'n/a',
      persist: 'wired',
      observe: 'wired',
      pedagogy: 'n/a',
      privacy: 'wired',
    },
    modules: ['server/claims.ts', 'src/hooks/useGoogleOAuth.ts', 'server/googleWorkspaceAudit.ts'],
    notes: 'BREAK_GLASS_REQUIRED · Contacts opt-in · demo email ACL block',
  },
  {
    id: 2,
    surface: 'Dashboard',
    stages: {
      auth: 'wired',
      validate: 'n/a',
      authorize: 'wired',
      moderate: 'n/a',
      persist: 'partial',
      observe: 'partial',
      pedagogy: 'wired',
      privacy: 'partial',
    },
    modules: ['src/pages/Dashboard.tsx', 'src/lib/jointScheduler.ts', 'src/lib/evidencePrinciples.ts'],
    notes: 'Joint scheduler why-now · PAGE_CONTENT full-width',
  },
  {
    id: 3,
    surface: 'Tasks / Reviews',
    stages: {
      auth: 'wired',
      validate: 'wired',
      authorize: 'wired',
      moderate: 'n/a',
      persist: 'wired',
      observe: 'partial',
      pedagogy: 'wired',
      privacy: 'partial',
    },
    modules: ['src/pages/Tasks.tsx', 'src/lib/fsrs.ts', 'src/lib/googleTasksSync.ts', 'src/lib/calibration.ts'],
    notes: 'FSRS + Google Tasks LWW · calibration bins',
  },
  {
    id: 4,
    surface: 'Agent',
    stages: {
      auth: 'wired',
      validate: 'wired',
      authorize: 'wired',
      moderate: 'wired',
      persist: 'partial',
      observe: 'partial',
      pedagogy: 'wired',
      privacy: 'wired',
    },
    modules: ['server/agentModes.ts', 'src/lib/ragGrounding.ts', 'server/circuitBreaker.ts'],
    notes: 'Mode contracts · grounded RAG · PII redaction',
  },
  {
    id: 5,
    surface: 'Library / Ingest',
    stages: {
      auth: 'wired',
      validate: 'wired',
      authorize: 'wired',
      moderate: 'wired',
      persist: 'wired',
      observe: 'partial',
      pedagogy: 'partial',
      privacy: 'partial',
    },
    modules: [
      'server/contentGuard.ts',
      'server/resumableUpload.ts',
      'src/lib/libraryStorage.ts',
      'server/libraryRag.ts',
    ],
    notes: 'MIME sniff · libraryVersion · resumable + AV quarantine hook',
  },
  {
    id: 6,
    surface: 'Study Workspace',
    stages: {
      auth: 'wired',
      validate: 'wired',
      authorize: 'wired',
      moderate: 'partial',
      persist: 'wired',
      observe: 'partial',
      pedagogy: 'wired',
      privacy: 'partial',
    },
    modules: [
      'src/lib/workspaceToolRegistry.ts',
      'src/lib/workspaceConceptBus.ts',
      'src/lib/pedagogyWriteback.ts',
    ],
    notes: '13-tool contracts · Feynman/Debate mastery writeback',
  },
  {
    id: 7,
    surface: 'Voice Tutor',
    stages: {
      auth: 'wired',
      validate: 'wired',
      authorize: 'wired',
      moderate: 'partial',
      persist: 'partial',
      observe: 'wired',
      pedagogy: 'wired',
      privacy: 'wired',
    },
    modules: ['src/lib/voiceTutorSession.ts', 'src/pages/VoiceTutor.tsx'],
    notes: 'Barge-in · transcript TTL · offline prompt pack',
  },
  {
    id: 8,
    surface: 'Collab',
    stages: {
      auth: 'wired',
      validate: 'wired',
      authorize: 'wired',
      moderate: 'wired',
      persist: 'wired',
      observe: 'partial',
      pedagogy: 'partial',
      privacy: 'wired',
    },
    modules: ['yjsServer.ts', 'server/yjsSnapshotStore.ts', 'server/socialPolicy.ts'],
    notes: 'Auth’d Yjs · durable snapshots · Meet dual-consent',
  },
  {
    id: 9,
    surface: 'Study Circles',
    stages: {
      auth: 'wired',
      validate: 'wired',
      authorize: 'wired',
      moderate: 'wired',
      persist: 'wired',
      observe: 'partial',
      pedagogy: 'partial',
      privacy: 'wired',
    },
    modules: ['src/lib/safeSocial.ts', 'src/lib/socialPolicy.ts'],
    notes: 'Invite-only · guidelines gate · no public feed',
  },
  {
    id: 10,
    surface: 'Study Match',
    stages: {
      auth: 'wired',
      validate: 'wired',
      authorize: 'wired',
      moderate: 'wired',
      persist: 'wired',
      observe: 'wired',
      pedagogy: 'partial',
      privacy: 'wired',
    },
    modules: ['server/studyMatch.ts', 'server/matchAffinity.ts', 'server/matchModerator.ts'],
    notes: 'Sticky affinity · trust prior · chaos:match',
  },
  {
    id: 11,
    surface: 'Teacher / Institution',
    stages: {
      auth: 'wired',
      validate: 'wired',
      authorize: 'wired',
      moderate: 'n/a',
      persist: 'wired',
      observe: 'wired',
      pedagogy: 'wired',
      privacy: 'wired',
    },
    modules: ['server/teacher.ts', 'server/institutionCore.ts'],
    notes: 'DP aggregates · domain tenancy · FERPA minimization',
  },
  {
    id: 12,
    surface: 'Google Workspace',
    stages: {
      auth: 'wired',
      validate: 'wired',
      authorize: 'wired',
      moderate: 'n/a',
      persist: 'partial',
      observe: 'wired',
      pedagogy: 'n/a',
      privacy: 'wired',
    },
    modules: ['src/pages/Workspace.tsx', 'server/googleWorkspaceAudit.ts', 'src/lib/contactsConsent.ts'],
    notes: 'Scoped OAuth · Meet/Forms audit · demo stubs labeled',
  },
  {
    id: 13,
    surface: 'Admin / Ops',
    stages: {
      auth: 'wired',
      validate: 'wired',
      authorize: 'wired',
      moderate: 'wired',
      persist: 'wired',
      observe: 'wired',
      pedagogy: 'n/a',
      privacy: 'wired',
    },
    modules: ['src/pages/Admin.tsx', 'server/claims.ts', 'server/evidence.ts'],
    notes: 'Triage · break-glass · xAPI purge · tenant metrics',
  },
  {
    id: 14,
    surface: 'Offline / PWA',
    stages: {
      auth: 'partial',
      validate: 'wired',
      authorize: 'partial',
      moderate: 'n/a',
      persist: 'wired',
      observe: 'partial',
      pedagogy: 'partial',
      privacy: 'wired',
    },
    modules: ['src/lib/offlineStudyPack.ts', 'src/lib/offlineSyncQueue.ts'],
    notes: 'Signed packs · conflict UI · offline Agent = local RAG',
  },
  {
    id: 15,
    surface: 'Mastery / Evidence',
    stages: {
      auth: 'wired',
      validate: 'wired',
      authorize: 'wired',
      moderate: 'n/a',
      persist: 'wired',
      observe: 'wired',
      pedagogy: 'wired',
      privacy: 'wired',
    },
    modules: [
      'server/evidence.ts',
      'src/lib/evidenceEval.ts',
      'src/lib/pedagogyWriteback.ts',
      'src/lib/calibration.ts',
    ],
    notes: 'Golden questions · research export · no Bloom-2σ claims',
  },
  {
    id: 16,
    surface: 'i18n / A11y',
    stages: {
      auth: 'n/a',
      validate: 'n/a',
      authorize: 'n/a',
      moderate: 'n/a',
      persist: 'partial',
      observe: 'n/a',
      pedagogy: 'n/a',
      privacy: 'n/a',
    },
    modules: ['src/lib/i18n.tsx', 'src/locales/en.json', 'src/locales/el.json', 'src/components/SkipLink.tsx'],
    notes: 'EN/EL catalogs · dir/RTL · focus traps',
  },
  {
    id: 17,
    surface: 'Chaos / Deploy',
    stages: {
      auth: 'wired',
      validate: 'wired',
      authorize: 'wired',
      moderate: 'n/a',
      persist: 'n/a',
      observe: 'wired',
      pedagogy: 'n/a',
      privacy: 'n/a',
    },
    modules: ['e2e/spine-smoke.spec.ts', 'scripts/chaos-match-yjs.mjs', 'Dockerfile'],
    notes: 'REQUIRE_API_AUTH · APP_CHECK_ENFORCE prod · chaos harness',
  },
] as const;

export function incompleteStages(card: AdoptionCard): SpineStage[] {
  return (Object.entries(card.stages) as [SpineStage, StageStatus][])
    .filter(([, s]) => s === 'partial' || s === 'stub')
    .map(([k]) => k);
}

export function spineAdoptionSummary(): {
  pipeline: string;
  surfaces: number;
  incomplete: { id: number | string; surface: string; stages: SpineStage[] }[];
  cards: readonly AdoptionCard[];
} {
  return {
    pipeline:
      'Auth → Validate → Authorize → Moderate → Persist (versioned) → Observe → Pedagogy event → Privacy TTL',
    surfaces: SPINE_ADOPTION.length,
    incomplete: SPINE_ADOPTION.filter((c) => incompleteStages(c).length > 0).map((c) => ({
      id: c.id,
      surface: c.surface,
      stages: incompleteStages(c),
    })),
    cards: SPINE_ADOPTION,
  };
}
