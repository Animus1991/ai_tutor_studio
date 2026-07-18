import { useEffect, useMemo, useRef, useState } from 'react';
import type * as Y from 'yjs';
import {
  Users,
  Copy,
  LogOut,
  Plus,
  X,
  ArrowRight,
  ClipboardList,
  StickyNote,
  Wand2,
  Target,
  Video,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { useFocusTrap } from '../../hooks/useFocusTrap';

type MemberRole = 'student' | 'mentor' | 'facilitator' | 'observer';

type SharedMember = {
  id: string;
  name: string;
  role: MemberRole;
  updatedAt: string;
};

export type StudyRoomSharedTool = {
  activeTab: 'chat' | 'tasks' | 'notes' | 'ai' | 'quizzes';
  mainView: 'video' | 'whiteboard' | 'graph';
};

export type StudyRoomPanelProps = {
  open: boolean;
  onClose: () => void;
  selfId: string;
  selfName: string;
  selfRole: MemberRole;
  onRoleChange: (role: MemberRole) => void;
  roomId: string;
  onJoinRoom: (roomId: string) => void;
  onLeaveRoom: () => void;
  awarenessUsers: Array<{ memberId?: string; name: string; color?: string; avatar?: string; role?: MemberRole }>;
  ydoc: Y.Doc;
  localTool: StudyRoomSharedTool;
  onFollowTool: (tool: StudyRoomSharedTool) => void;
};

function generateInviteCode(): string {
  // human-friendly: 8 chars, lowercase.
  return Math.random().toString(36).slice(2, 10);
}

function formatSeconds(total: number): string {
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, '0');
  const s = Math.floor(total % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${s}`;
}

function normalizeJitsiRoomName(input: string): string {
  // meet.jit.si room names are path segments; keep it readable + safe
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 64);
}

export default function StudyRoomPanel(props: StudyRoomPanelProps) {
  const {
    open,
    onClose,
    selfId,
    selfName,
    selfRole,
    onRoleChange,
    roomId,
    onJoinRoom,
    onLeaveRoom,
    awarenessUsers,
    ydoc,
    localTool,
    onFollowTool,
  } = props;

  const [displayName, setDisplayName] = useState(selfName);
  const [inviteInput, setInviteInput] = useState('');

  const meta = useMemo(() => ydoc.getMap('study-room:meta'), [ydoc]);
  const sharedTool = useMemo(() => ydoc.getMap('study-room:tool'), [ydoc]);
  const agenda = useMemo(() => ydoc.getArray<string>('study-room:agenda'), [ydoc]);
  const notes = useMemo(() => ydoc.getText('study-room:notes'), [ydoc]);
  const members = useMemo(() => ydoc.getMap('study-room:members'), [ydoc]);
  const leader = useMemo(() => ydoc.getMap('study-room:leader'), [ydoc]);

  const [remoteTool, setRemoteTool] = useState<StudyRoomSharedTool | null>(null);
  const [agendaItems, setAgendaItems] = useState<string[]>(agenda.toArray());
  const [agendaDraft, setAgendaDraft] = useState('');
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [notesValue, setNotesValue] = useState(notes.toString());
  const [focusConceptDraft, setFocusConceptDraft] = useState('');
  const [focusConcept, setFocusConcept] = useState<string>(
    (meta.get('focusConcept') as string | undefined) ?? '',
  );
  const [sharedMembers, setSharedMembers] = useState<SharedMember[]>([]);
  const [leadToolSync, setLeadToolSync] = useState(false);
  const [followLeader, setFollowLeader] = useState(true);
  const [videoOpen, setVideoOpen] = useState(false);
  const isApplyingRemoteNotes = useRef(false);
  const panelRef = useFocusTrap<HTMLDivElement>(open, onClose);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const inviteCode = (meta.get('inviteCode') as string | undefined) ?? roomId;
  const jitsiRoomName = useMemo(() => {
    const normalized = normalizeJitsiRoomName(`memora-${inviteCode || roomId}`);
    return normalized || 'memora-study-room';
  }, [inviteCode, roomId]);
  const jitsiUrl = useMemo(() => {
    const base = `https://meet.jit.si/${encodeURIComponent(jitsiRoomName)}`;
    // keep minimal config; we can later switch to the external API for richer control
    const hash =
      '#config.prejoinPageEnabled=false&config.disableDeepLinking=true&config.startWithAudioMuted=true&config.startWithVideoMuted=true';
    return `${base}${hash}`;
  }, [jitsiRoomName]);

  useEffect(() => {
    if (!open) return;
    // seed invite code once per room doc
    if (!meta.get('inviteCode')) meta.set('inviteCode', roomId);
    if (!meta.get('createdAt')) meta.set('createdAt', new Date().toISOString());
    if (!meta.get('focusConcept')) meta.set('focusConcept', '');
  }, [open, meta, roomId]);

  // Publish identity to shared map (stable id).
  useEffect(() => {
    if (!open) return;
    const entry: SharedMember = {
      id: selfId,
      name: displayName || selfName,
      role: selfRole,
      updatedAt: new Date().toISOString(),
    };
    members.set(selfId, entry);
  }, [open, members, selfId, displayName, selfName, selfRole]);

  useEffect(() => {
    const updateMembers = () => {
      const next: SharedMember[] = [];
      for (const [key, value] of members.entries()) {
        const v = value as Partial<SharedMember> | undefined;
        if (!v || typeof v !== 'object') continue;
        if (!v.id || !v.name || !v.role) continue;
        next.push({ id: v.id, name: v.name, role: v.role, updatedAt: v.updatedAt ?? '' });
      }
      setSharedMembers(next.sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1)));
    };
    updateMembers();
    members.observe(updateMembers);
    return () => members.unobserve(updateMembers);
  }, [members]);

  useEffect(() => {
    const currentLeader = leader.get('leaderId') as string | undefined;
    setLeadToolSync(currentLeader === selfId);
  }, [leader, selfId]);

  useEffect(() => {
    if (!open) return;
    // Prefer name field when present; useFocusTrap also focuses first control.
    nameInputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => setTimerSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [timerRunning]);

  useEffect(() => {
    const updateFocusConcept = () => {
      setFocusConcept((meta.get('focusConcept') as string | undefined) ?? '');
    };
    updateFocusConcept();
    meta.observe(updateFocusConcept);
    return () => meta.unobserve(updateFocusConcept);
  }, [meta]);

  useEffect(() => {
    const updateTool = () => {
      const activeTab = sharedTool.get('activeTab') as StudyRoomSharedTool['activeTab'] | undefined;
      const mainView = sharedTool.get('mainView') as StudyRoomSharedTool['mainView'] | undefined;
      if (!activeTab || !mainView) {
        setRemoteTool(null);
        return;
      }
      setRemoteTool({ activeTab, mainView });
    };
    updateTool();
    sharedTool.observe(updateTool);
    return () => sharedTool.unobserve(updateTool);
  }, [sharedTool]);

  useEffect(() => {
    const updateAgenda = () => setAgendaItems(agenda.toArray());
    agenda.observe(updateAgenda);
    return () => agenda.unobserve(updateAgenda);
  }, [agenda]);

  useEffect(() => {
    const updateNotes = () => {
      if (isApplyingRemoteNotes.current) return;
      setNotesValue(notes.toString());
    };
    notes.observe(updateNotes);
    return () => notes.unobserve(updateNotes);
  }, [notes]);

  // push local tool state only when you are the leader (opt-in)
  useEffect(() => {
    const currentLeader = leader.get('leaderId') as string | undefined;
    if (!currentLeader || currentLeader !== selfId) return;
    sharedTool.set('activeTab', localTool.activeTab);
    sharedTool.set('mainView', localTool.mainView);
  }, [sharedTool, leader, selfId, localTool.activeTab, localTool.mainView]);

  const followAvailable =
    remoteTool &&
    (remoteTool.activeTab !== localTool.activeTab || remoteTool.mainView !== localTool.mainView);

  const createRoom = () => {
    const code = generateInviteCode();
    onJoinRoom(code);
    toast.success('Study room created');
  };

  const joinRoom = () => {
    const trimmed = inviteInput.trim();
    if (!trimmed) return;
    onJoinRoom(trimmed);
    toast.success('Joining study room…');
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      toast.success('Invite code copied');
    } catch {
      toast.error('Copy failed');
    }
  };

  const copyJitsiLink = async () => {
    try {
      await navigator.clipboard.writeText(jitsiUrl);
      toast.success('Video link copied');
    } catch {
      toast.error('Copy failed');
    }
  };

  const addAgenda = () => {
    const item = agendaDraft.trim();
    if (!item) return;
    agenda.push([item]);
    setAgendaDraft('');
  };

  const removeAgenda = (idx: number) => {
    agenda.delete(idx, 1);
  };

  const updateNotesLocal = (next: string) => {
    setNotesValue(next);
    isApplyingRemoteNotes.current = true;
    try {
      notes.delete(0, notes.length);
      notes.insert(0, next);
    } finally {
      // release after microtask so Yjs observers settle
      queueMicrotask(() => {
        isApplyingRemoteNotes.current = false;
      });
    }
  };

  const setSharedFocusConcept = () => {
    const value = focusConceptDraft.trim();
    meta.set('focusConcept', value);
    setFocusConceptDraft('');
    toast.success(value ? 'Focus concept updated' : 'Focus concept cleared');
  };

  const toggleLeader = () => {
    const currentLeader = leader.get('leaderId') as string | undefined;
    if (currentLeader === selfId) {
      leader.set('leaderId', '');
      setLeadToolSync(false);
      toast.success('Leader mode off');
      return;
    }
    leader.set('leaderId', selfId);
    setLeadToolSync(true);
    toast.success('Leader mode on');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close study room"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Study room panel"
        className="relative z-[61] w-full max-w-3xl rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 shadow-xl overflow-hidden"
      >
        <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100/50 dark:border-slate-800/50">
          <div className="flex items-center gap-2 min-w-0">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200/60 dark:border-indigo-800/40 text-indigo-600 dark:text-indigo-400">
              <Users className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                Study Room
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Invite code: <span className="font-mono">{inviteCode}</span>
              </p>
              {focusConcept ? (
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 truncate flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5 text-indigo-500" aria-hidden="true" />
                  Focus: <span className="font-semibold">{focusConcept}</span>
                </p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <section className="lg:col-span-1 space-y-3">
            <div className="rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-slate-50/60 dark:bg-slate-800/30 p-4">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2">
                Identity
              </p>
              <label className="block">
                <span className="text-xs text-slate-500 dark:text-slate-400">Display name</span>
                <input
                  ref={nameInputRef}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="Your name"
                  autoComplete="nickname"
                />
              </label>
              <label className="block mt-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">Role</span>
                <select
                  value={selfRole}
                  onChange={(e) => onRoleChange(e.target.value as MemberRole)}
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="student">Student</option>
                  <option value="mentor">Mentor</option>
                  <option value="facilitator">Facilitator</option>
                  <option value="observer">Observer</option>
                </select>
              </label>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Role is used for collaboration context (no permissions yet).
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/60 dark:border-slate-800/60 p-4">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2">
                <Target className="h-4 w-4 text-indigo-500" aria-hidden="true" />
                Shared focus concept
              </p>
              <div className="flex items-center gap-2">
                <input
                  value={focusConceptDraft}
                  onChange={(e) => setFocusConceptDraft(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder={focusConcept ? focusConcept : 'e.g. IS-LM equilibrium shifts'}
                />
                <button
                  type="button"
                  onClick={setSharedFocusConcept}
                  className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  Set
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Keeps the room aligned on a single concept while switching tools.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/60 dark:border-slate-800/60 p-4">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2">
                Room control
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copyInvite}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  Copy invite
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onLeaveRoom();
                    toast.success('Left room');
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-950 dark:hover:bg-slate-700"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Leave
                </button>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={createRoom}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  New room
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-800/30 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">Leader tool sync</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    Only the leader broadcasts tool changes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={toggleLeader}
                  className={cn(
                    'shrink-0 rounded-xl px-3 py-2 text-xs font-semibold border',
                    leadToolSync
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-200'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200',
                  )}
                >
                  {leadToolSync ? 'Leading' : 'Lead'}
                </button>
              </div>

              <div className="mt-3">
                <label className="block">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Join with code</span>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      value={inviteInput}
                      onChange={(e) => setInviteInput(e.target.value)}
                      className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500/20"
                      placeholder="a1b2c3d4"
                    />
                    <button
                      type="button"
                      onClick={joinRoom}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      Join
                    </button>
                  </div>
                </label>
              </div>
            </div>

            {followAvailable && (
              <div className="rounded-xl border border-indigo-200/60 dark:border-indigo-800/40 bg-indigo-50/60 dark:bg-indigo-900/10 p-4">
                <p className="text-xs font-semibold text-indigo-900 dark:text-indigo-100 flex items-center gap-2">
                  <Wand2 className="h-4 w-4" aria-hidden="true" />
                  Someone switched tools
                </p>
                <p className="mt-1 text-xs text-indigo-700 dark:text-indigo-300">
                  Follow the shared tool to stay in sync with the room.
                </p>
                <label className="mt-2 flex items-center gap-2 text-xs text-indigo-700 dark:text-indigo-300">
                  <input
                    type="checkbox"
                    checked={followLeader}
                    onChange={(e) => setFollowLeader(e.target.checked)}
                    className="h-4 w-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Follow leader suggestions
                </label>
                <button
                  type="button"
                  onClick={() => remoteTool && followLeader && onFollowTool(remoteTool)}
                  className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  Follow shared tool
                </button>
              </div>
            )}
          </section>

          <section className="lg:col-span-2 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-200/60 dark:border-slate-800/60 p-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">Members online</p>
                <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                  {awarenessUsers.length}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200/60 dark:border-slate-800/60 p-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">Shared timer</p>
                <p className="mt-1 text-xl font-bold font-mono text-slate-900 dark:text-white">
                  {formatSeconds(timerSeconds)}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTimerRunning((v) => !v)}
                    className={cn(
                      'flex-1 rounded-xl px-3 py-2 text-xs font-semibold border',
                      timerRunning
                        ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-200'
                        : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-200',
                    )}
                  >
                    {timerRunning ? 'Pause' : 'Start'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTimerSeconds(0);
                      setTimerRunning(false);
                    }}
                    className="rounded-xl px-3 py-2 text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
                  >
                    Reset
                  </button>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200/60 dark:border-slate-800/60 p-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">You</p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {displayName || selfName}
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 capitalize">{selfRole}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Video className="h-4 w-4 text-indigo-500" aria-hidden="true" />
                    Video (Jitsi)
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">
                    Room: <span className="font-mono">{jitsiRoomName}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={copyJitsiLink}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Copy className="h-4 w-4" aria-hidden="true" />
                    Copy link
                  </button>
                  <a
                    href={jitsiUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    Open
                  </a>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Opt-in embed. Uses a third-party service (meet.jit.si).
                </p>
                <button
                  type="button"
                  onClick={() => setVideoOpen((v) => !v)}
                  className={cn(
                    'rounded-xl px-3 py-2 text-xs font-semibold border',
                    videoOpen
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-200'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200',
                  )}
                >
                  {videoOpen ? 'Hide' : 'Show'}
                </button>
              </div>

              {videoOpen ? (
                <div className="mt-3 rounded-2xl overflow-hidden border border-slate-200/60 dark:border-slate-800/60 bg-black">
                  <iframe
                    title="Study room video"
                    src={jitsiUrl}
                    className="w-full aspect-video"
                    allow="camera; microphone; fullscreen; display-capture"
                  />
                </div>
              ) : (
                <div className="mt-3 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/20 p-4">
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Click <span className="font-semibold">Show</span> to embed video here, or use{' '}
                    <span className="font-semibold">Open</span> to join in a new tab.
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-4">
              <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-indigo-500" aria-hidden="true" />
                Members
              </p>
              {awarenessUsers.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Nobody else is online yet. Share the invite code to start a group session.
                </p>
              ) : (
                <ul className="space-y-2">
                  {(sharedMembers.length > 0 ? sharedMembers : awarenessUsers.map((u) => ({
                    id: u.memberId ?? u.name,
                    name: u.name,
                    role: (u.role ?? 'student') as MemberRole,
                    updatedAt: '',
                  }))).map((u) => (
                    <li
                      key={`${u.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-800/30 px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: awarenessUsers.find((p) => p.name === u.name)?.color ?? '#6366f1' }}
                          aria-hidden="true"
                        />
                        <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {u.name}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                        {u.role}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-indigo-500" aria-hidden="true" />
                  Shared agenda
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={agendaDraft}
                  onChange={(e) => setAgendaDraft(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="Add an agenda item…"
                />
                <button
                  type="button"
                  onClick={addAgenda}
                  className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  Add
                </button>
              </div>
              <ul className="mt-3 space-y-2">
                {agendaItems.length === 0 ? (
                  <li className="text-xs text-slate-500 dark:text-slate-400">
                    No agenda yet. Add a goal for today’s session.
                  </li>
                ) : (
                  agendaItems.map((item, idx) => (
                    <li
                      key={`${idx}-${item}`}
                      className="flex items-start justify-between gap-3 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-800/30 px-3 py-2"
                    >
                      <span className="text-sm text-slate-800 dark:text-slate-100">{item}</span>
                      <button
                        type="button"
                        onClick={() => removeAgenda(idx)}
                        className="text-xs font-semibold text-slate-500 hover:text-rose-600"
                      >
                        Remove
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-4">
              <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                <StickyNote className="h-4 w-4 text-indigo-500" aria-hidden="true" />
                Shared notes
              </p>
              <textarea
                value={notesValue}
                onChange={(e) => updateNotesLocal(e.target.value)}
                rows={8}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-indigo-500/20 resize-y"
                placeholder="Collaborative notes… (syncs via Yjs)"
              />
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Tip: Use agenda + follow tool to keep everyone aligned.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

