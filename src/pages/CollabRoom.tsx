import { toast } from 'sonner';
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Video,
  Mic,
  MicOff,
  VideoOff,
  MessageSquare,
  CheckSquare,
  FileText,
  Users,
  PhoneOff,
  Send,
  Plus,
  Maximize2,
  MoreHorizontal,
  FileImage,
  Search,
  BrainCircuit,
  ExternalLink,
  Calendar,
  Network,
  Clock,
  Timer,
  ScreenShare,
  StickyNote,
  Flag,
  HandHeart,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import { useStore } from "../store/useStore";
import { useLanguage } from "../lib/i18n";
import { cn } from "../lib/utils";
import { chatWithAgent } from "../lib/api";
import { apiRequest } from "../lib/apiClient";
import { auth, db } from "../lib/firebase";
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getAccessToken } from "../lib/auth";

import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { IndexeddbPersistence } from "y-indexeddb";

import Room from "../components/Room";
import Whiteboard from "../components/Whiteboard";
import KnowledgeGraph from "../components/KnowledgeGraph";
import { FireProvider } from "y-fire";
import { app } from "../lib/firebase";
import { getCollabWebSocketUrl, getCollabWsParams } from "../lib/collabProvider";
import { moderatePlatformText } from "../lib/platformModeration";
import { isDemoModeActive, DEMO_USER } from "../lib/demoStorage";
import {
  loadCollabMessages,
  loadCollabQuizzes,
  saveCollabMessage,
  saveCollabQuiz,
  type CollabMessage,
} from "../lib/collabDemoStorage";

import PresenceIndicator, { type ActivityStatus } from "../components/PresenceIndicator";
import { useGoogleOAuth, type GoogleOAuthScopes } from '../hooks/useGoogleOAuth';
import GoogleOAuthConsentModal from '../components/GoogleOAuthConsentModal';
import StudyRoomPanel, { type StudyRoomSharedTool } from '../components/collab/StudyRoomPanel';
import CollabOverlay from '../components/collab/CollabOverlay';
import CommunityGuidelinesModal from '../components/CommunityGuidelinesModal';
import {
  hasAcceptedCommunityGuidelines,
  isValidInviteEmail,
  normalizeEmail,
  reportRoomMessage,
  sendKudos,
  type KudosKind,
  type ReportReason,
  REPORT_REASONS,
} from '../lib/safeSocial';
import {
  countMeetConsents,
  meetDualConsentSatisfied,
} from '../lib/socialPolicy';

const ROOM_STORAGE_KEY = "memora-collab-room-id";
const ROOM_ID_PATTERN = /^[a-zA-Z0-9_-]{8,128}$/;

const initialRoomId = () => {
  const queryRoom = new URLSearchParams(window.location.search).get("room");
  if (queryRoom && ROOM_ID_PATTERN.test(queryRoom)) return queryRoom;

  const storedRoom = window.localStorage.getItem(ROOM_STORAGE_KEY);
  if (storedRoom && ROOM_ID_PATTERN.test(storedRoom)) return storedRoom;

  const roomId = crypto.randomUUID();
  window.localStorage.setItem(ROOM_STORAGE_KEY, roomId);
  return roomId;
};

export default function CollabRoom() {
  const { t } = useLanguage();
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "chat" | "tasks" | "notes" | "ai" | "quizzes"
  >("chat");
  const [mainView, setMainView] = useState<"video" | "whiteboard" | "graph">("video");
  const [sharedTimerSeconds, setSharedTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const googleOAuth = useGoogleOAuth();
  const [oauthModalOpen, setOauthModalOpen] = useState(false);
  const [pendingOauthScopes, setPendingOauthScopes] = useState<GoogleOAuthScopes[]>([]);
  const [pendingOauthAction, setPendingOauthAction] = useState<(() => void) | null>(null);

  const [user, setUser] = useState<any>(null);
  const [roomId, setRoomId] = useState(initialRoomId);
  const [studyRoomOpen, setStudyRoomOpen] = useState(false);
  const [selfRole, setSelfRole] = useState<'student' | 'mentor' | 'facilitator' | 'observer'>('student');

  const [messages, setMessages] = useState<any[]>([]);
  const [invitedContacts, setInvitedContacts] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  
  // Yjs State (re-created per room)
  const [ydoc, setYdoc] = useState(() => new Y.Doc());
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [awarenessUsers, setAwarenessUsers] = useState<any[]>([]);
  const [showGuidelines, setShowGuidelines] = useState(() => !hasAcceptedCommunityGuidelines());
  const [reportTarget, setReportTarget] = useState<{ id: string; preview: string } | null>(null);
  const [reportReason, setReportReason] = useState<ReportReason>('off_topic');
  const [roomOwnerId, setRoomOwnerId] = useState<string | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);

  useEffect(() => {
    window.localStorage.setItem(ROOM_STORAGE_KEY, roomId);
    const url = new URL(window.location.href);
    url.searchParams.set("room", roomId);
    window.history.replaceState({}, "", url);
  }, [roomId]);

  useEffect(() => {
    const yCollabDoc = new Y.Doc();
    setYdoc(yCollabDoc);

    const roomDocName = `memora-collab-${roomId}`;
    let cancelled = false;
    let wsProvider: WebsocketProvider | null = null;
    let indexeddbProvider: IndexeddbPersistence | null = null;
    let unsubscribeAuth: (() => void) | null = null;
    let roomDataCleanup: (() => void) | null = null;

    void (async () => {
      const params = await getCollabWsParams();
      if (cancelled) return;

      wsProvider = new WebsocketProvider(getCollabWebSocketUrl(), roomDocName, yCollabDoc, {
        params,
      });
      setProvider(wsProvider);
      providerRef.current = wsProvider;
      indexeddbProvider = new IndexeddbPersistence(roomDocName, yCollabDoc);

      const awareness = wsProvider.awareness;

      const getLocalMemberId = (userObj: any) => {
        const base = userObj?.uid ? `uid:${userObj.uid}` : userObj?.email ? `email:${userObj.email}` : 'guest';
        if (typeof window === 'undefined') return base;
        const key = `memora-member-id:${base}`;
        const existing = window.localStorage.getItem(key);
        if (existing) return existing;
        const created = `${base}:${crypto.randomUUID()}`;
        window.localStorage.setItem(key, created);
        return created;
      };

      const updateAwareness = (userObj: any, activity: ActivityStatus = 'online') => {
        const memberId = getLocalMemberId(userObj);
        awareness.setLocalStateField("user", {
          memberId,
          name: userObj?.email?.split('@')[0] || "Guest",
          role: selfRole,
          activity,
          color: "#" + Math.floor(Math.random() * 16777215).toString(16),
          avatar: `https://ui-avatars.com/api/?name=${userObj?.email || 'G'}`
        });
      };

      awareness.on('change', () => {
        const users = Array.from(awareness.getStates().values())
          .filter((state: any) => state.user)
          .map((state: any) => state.user);
        setAwarenessUsers(users);
      });

      unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
        roomDataCleanup?.();
        roomDataCleanup = null;

        if (isDemoModeActive()) {
          setUser(DEMO_USER);
          updateAwareness(DEMO_USER);
          const [msgs, qzs] = await Promise.all([
            loadCollabMessages(roomId),
            loadCollabQuizzes(roomId),
          ]);
          setMessages(msgs);
          setQuizzes(qzs);
          return;
        }

        setUser(currentUser);
        updateAwareness(currentUser);

        if (currentUser && !isDemoModeActive()) {
          const roomRef = doc(db, "rooms", roomId);
          try {
            const roomSnapshot = await getDoc(roomRef);
            if (!roomSnapshot.exists()) {
              const creatorEmail = currentUser.email ? normalizeEmail(currentUser.email) : '';
              await setDoc(roomRef, {
                ownerId: currentUser.uid,
                memberEmails: creatorEmail ? [creatorEmail] : [],
                createdAt: serverTimestamp(),
              });
              setRoomOwnerId(currentUser.uid);
            } else {
              const rd = roomSnapshot.data() as {
                ownerId?: string;
                meetConsent?: Record<string, boolean>;
                meetUrl?: string;
              };
              setRoomOwnerId(String(rd?.ownerId ?? ''));
              if (rd?.meetConsent) setMeetConsent(rd.meetConsent);
              if (rd?.meetUrl) setMeetUrl(rd.meetUrl);
            }
          } catch (error) {
            console.error("Unable to access collaboration room:", error);
            toast.error("You do not have access to this collaboration room.");
            return;
          }

          const unsubRoomMeta = onSnapshot(roomRef, (snap) => {
            if (!snap.exists()) return;
            const rd = snap.data() as {
              meetConsent?: Record<string, boolean>;
              meetUrl?: string;
            };
            if (rd.meetConsent) setMeetConsent(rd.meetConsent);
            if (typeof rd.meetUrl === 'string') setMeetUrl(rd.meetUrl);
          });

          const fireProvider = new FireProvider({
            firebaseApp: app,
            ydoc: yCollabDoc,
            path: `yjs_state/${roomId}`,
          });

          const qMessages = query(
            collection(db, "rooms", roomId, "messages"),
            orderBy("createdAt", "asc"),
          );
          const unsubMessages = onSnapshot(qMessages, (snapshot) => {
            const msgs = snapshot.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            }));
            setMessages(msgs);
          });

          const qParticipants = query(
            collection(db, "rooms", roomId, "participants"),
          );
          const unsubParticipants = onSnapshot(qParticipants, (snapshot) => {
            const parts = snapshot.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            }));
            setInvitedContacts(parts);
          });

          const qQuizzes = query(collection(db, "rooms", roomId, "quizzes"));
          const unsubQuizzes = onSnapshot(qQuizzes, (snapshot) => {
            const qzs = snapshot.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            }));
            setQuizzes(qzs);
          });

          roomDataCleanup = () => {
            unsubRoomMeta();
            unsubMessages();
            unsubParticipants();
            unsubQuizzes();
            fireProvider.destroy();
          };
        }
      });
    })();

    return () => {
      cancelled = true;
      roomDataCleanup?.();
      unsubscribeAuth?.();
      wsProvider?.disconnect();
      void indexeddbProvider?.destroy();
      yCollabDoc.destroy();
    };
  }, [roomId, selfRole]);

  const localSharedTool: StudyRoomSharedTool = { activeTab, mainView };

  const joinRoom = async (nextRoomId: string) => {
    const trimmed = nextRoomId.trim();
    if (!trimmed) return;
    setRoomId(trimmed);
    setStudyRoomOpen(false);
    if (isDemoModeActive()) {
      const [msgs, qzs] = await Promise.all([loadCollabMessages(trimmed), loadCollabQuizzes(trimmed)]);
      setMessages(msgs);
      setQuizzes(qzs);
    }
  };

  const leaveRoom = async () => {
    setRoomId('default_room');
    setStudyRoomOpen(false);
    if (isDemoModeActive()) {
      const [msgs, qzs] = await Promise.all([loadCollabMessages('default_room'), loadCollabQuizzes('default_room')]);
      setMessages(msgs);
      setQuizzes(qzs);
    }
  };

  const [tasks, setTasks] = useState([
    {
      id: 1,
      title: "Review IS-LM Model",
      completed: false,
      assignees: ["Alex"],
    },
    {
      id: 2,
      title: "Prepare Quiz (Google Forms)",
      completed: true,
      assignees: ["Maria"],
    },
  ]);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [googleContacts, setGoogleContacts] = useState<
    { name: string; email: string }[]
  >([]);
  const [showContactSuggestions, setShowContactSuggestions] = useState(false);

  const [isAiTyping, setIsAiTyping] = useState(false);
  const [meetUrl, setMeetUrl] = useState<string | null>(null);
  const [isCreatingMeet, setIsCreatingMeet] = useState(false);
  const [meetConsent, setMeetConsent] = useState<Record<string, boolean>>({});
  const [meetConsentBusy, setMeetConsentBusy] = useState(false);

  // Shared study timer interval
  useEffect(() => {
    if (!isTimerRunning) return;
    const id = setInterval(() => setSharedTimerSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isTimerRunning]);

  useEffect(() => {
    if (isInviteModalOpen) {
      fetchGoogleContacts();
    }
  }, [isInviteModalOpen]);

  const fetchGoogleContacts = async () => {
    try {
      const { contactsService } = await import("../lib/services/DemoContactsService");
      const fetchedContacts = await contactsService.getContacts();
      setGoogleContacts(fetchedContacts.map(c => ({ name: c.name, email: c.email })));
    } catch (e) {
      console.error("Failed to fetch contacts", e);
    }
  };

  const [isCreatingQuiz, setIsCreatingQuiz] = useState(false);

  const appendLocalMessage = async (msg: Omit<CollabMessage, 'id'>) => {
    const full: CollabMessage = { ...msg, id: Date.now().toString() };
    await saveCollabMessage(full);
    setMessages((prev) => [...prev, full]);
  };

  const handleCreateGoogleForm = async () => {
    try {
      setIsCreatingQuiz(true);
      const quizId = crypto.randomUUID();
      const title = `Study Quiz - ${new Date().toLocaleDateString()}`;
      const studyUrl = `/study/demo-course-1`;

      if (isDemoModeActive()) {
        const quiz = {
          id: quizId,
          roomId,
          formId: quizId,
          formUrl: studyUrl,
          title,
          userId: DEMO_USER.uid,
          createdAt: new Date().toISOString(),
        };
        await saveCollabQuiz(quiz);
        setQuizzes((prev) => [...prev, quiz]);
        await appendLocalMessage({
          roomId,
          user: 'System',
          text: `A new study quiz is ready: open Study Workspace to practice.`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          userId: DEMO_USER.uid,
        });
        window.open(studyUrl, '_blank');
        toast.success('Demo quiz created — opening Study Workspace');
        return;
      }

      if (user) {
        // Create a real Google Form when server credentials are configured;
        // otherwise fall back to the "create new form" URL.
        let formUrl = 'https://docs.google.com/forms/create';
        let realFormId: string = quizId;
        try {
          const token = googleOAuth.token ?? (await getAccessToken());
          const res = await apiRequest('/api/google/forms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, accessToken: token ?? undefined }),
          });
          if (res.ok) {
            const data = (await res.json()) as { editUrl?: string; formId?: string };
            if (data.editUrl) formUrl = data.editUrl;
            if (data.formId) realFormId = data.formId;
          }
        } catch {
          /* keep fallback URL */
        }

        await setDoc(doc(db, "rooms", roomId, "quizzes", quizId), {
          roomId,
          formId: realFormId,
          formUrl,
          title,
          userId: user.uid,
          createdAt: serverTimestamp(),
        });

        await setDoc(
          doc(db, "rooms", roomId, "messages", Date.now().toString()),
          {
            roomId,
            user: "System",
            text: `A new group quiz has been created: ${formUrl}`,
            time: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            userId: user.uid,
            createdAt: serverTimestamp(),
          },
        );
        window.open(formUrl, "_blank");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to create Demo Form");
    } finally {
      setIsCreatingQuiz(false);
    }
  };

  const selfMeetKey = user?.uid || (isDemoModeActive() ? DEMO_USER.uid : '');
  const selfMeetConsent = Boolean(selfMeetKey && meetConsent[selfMeetKey]);
  const dualMeetOk = meetDualConsentSatisfied(meetConsent);
  const meetConsentCount = countMeetConsents(meetConsent);

  const handleToggleMeetConsent = async () => {
    if (!selfMeetKey) {
      toast.error(t('Sign in to opt into Meet', 'Συνδέσου για συναίνεση Meet'));
      return;
    }
    const next = !selfMeetConsent;
    setMeetConsentBusy(true);
    try {
      if (isDemoModeActive()) {
        // Demo: need a second peer consent to unlock Start Meet — simulate peer after self opts in.
        const nextMap = {
          ...meetConsent,
          [DEMO_USER.uid]: next,
          ...(next ? { 'demo-peer': true } : { 'demo-peer': false }),
        };
        setMeetConsent(nextMap);
        toast.success(
          next
            ? t('Meet opt-in recorded (demo peer also ready)', 'Συναίνεση Meet (demo peer έτοιμος)')
            : t('Meet opt-in withdrawn', 'Ανακλήθηκε η συναίνεση Meet'),
        );
        return;
      }

      const res = await apiRequest(`/api/social/rooms/${encodeURIComponent(roomId)}/meet-consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent: next }),
      });
      if (res.ok) {
        const data = (await res.json()) as { meetConsent?: Record<string, boolean> };
        if (data.meetConsent) setMeetConsent(data.meetConsent);
        else setMeetConsent((prev) => ({ ...prev, [selfMeetKey]: next }));
      } else {
        // Fallback: direct room field update when Admin SDK path unavailable
        await updateDoc(doc(db, 'rooms', roomId), {
          [`meetConsent.${selfMeetKey}`]: next,
        });
        setMeetConsent((prev) => ({ ...prev, [selfMeetKey]: next }));
      }
      toast.success(
        next
          ? t('You opted into Meet — waiting for another member', 'Συμφώνησες για Meet — περιμένουμε άλλο μέλος')
          : t('Meet opt-in withdrawn', 'Ανακλήθηκε η συναίνεση Meet'),
      );
    } catch {
      toast.error(t('Could not update Meet consent', 'Αδυναμία ενημέρωσης συναίνεσης Meet'));
    } finally {
      setMeetConsentBusy(false);
    }
  };

  const handleCreateMeet = async () => {
    try {
      setIsCreatingMeet(true);

      if (!dualMeetOk) {
        toast.error(
          t(
            'At least two members must opt in before starting Meet',
            'Χρειάζονται τουλάχιστον δύο συναινέσεις πριν το Meet',
          ),
        );
        return;
      }

      let meetUri = "https://meet.google.com/new";
      try {
        const token = googleOAuth.token ?? (await getAccessToken());
        const res = await apiRequest(`/api/social/rooms/${encodeURIComponent(roomId)}/meet`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accessToken: token ?? undefined,
            meetConsent,
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as { meetUrl?: string };
          if (data.meetUrl) meetUri = data.meetUrl;
        } else if (res.status === 403) {
          toast.error(
            t(
              'At least two members must opt in before starting Meet',
              'Χρειάζονται τουλάχιστον δύο συναινέσεις πριν το Meet',
            ),
          );
          return;
        } else {
          // Legacy google meet endpoint as last resort after dual check passed locally
          const legacy = await apiRequest('/api/google/meet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken: token ?? undefined }),
          });
          if (legacy.ok) {
            const data = (await legacy.json()) as { meetUrl?: string };
            if (data.meetUrl) meetUri = data.meetUrl;
          }
        }
      } catch {
        /* keep fallback URL */
      }
      setMeetUrl(meetUri);

      if (isDemoModeActive()) {
        await appendLocalMessage({
          roomId,
          user: 'System',
          text: `Meet link (dual consent): ${meetUri}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          userId: DEMO_USER.uid,
        });
        window.open(meetUri, '_blank');
        return;
      }
      
      if (user) {
        try {
          await updateDoc(doc(db, 'rooms', roomId), { meetUrl: meetUri });
        } catch {
          /* non-fatal */
        }
        await setDoc(
          doc(db, "rooms", roomId, "messages", Date.now().toString()),
          {
            roomId,
            user: "System",
            text: `A Google Meet has been created for this room (dual consent): ${meetUri}`,
            time: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            userId: user.uid,
            createdAt: serverTimestamp(),
          },
        );
        window.open(meetUri, '_blank');
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to create Meet space.");
    } finally {
      setIsCreatingMeet(false);
    }
  };

  const handleScheduleSession = async () => {
    try {
      const demoLink = "https://calendar.google.com/calendar/r/eventedit";
      if (isDemoModeActive()) {
        await appendLocalMessage({
          roomId,
          user: 'System',
          text: 'Study session scheduled! Demo calendar event added.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          userId: DEMO_USER.uid,
        });
        window.open(demoLink, '_blank');
        return;
      }
      if (user) {
        await setDoc(
          doc(db, "rooms", roomId, "messages", Date.now().toString()),
          {
            roomId,
            user: "System",
            text: `Study session scheduled! Demo event added.`,
            time: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            userId: user.uid,
            createdAt: serverTimestamp(),
          },
        );
      }
      window.open(demoLink, "_blank");
    } catch (err) {
      console.error(err);
      toast.error("Failed to schedule session.");
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = normalizeEmail(inviteEmail);
    if (!email || !user) return;
    if (roomOwnerId && roomOwnerId !== user.uid) {
      toast.error(t('Only the room owner can invite classmates.', 'Μόνο ο ιδιοκτήτης του δωματίου μπορεί να προσκαλεί.'));
      return;
    }
    if (!isValidInviteEmail(email)) {
      toast.error(t('Enter a valid email address', 'Βάλε έγκυρο email'));
      return;
    }
    if (invitedContacts.find((c) => normalizeEmail(String(c.email ?? '')) === email)) {
      toast.info(t('Already invited', 'Ήδη προσκεκλημένος/η'));
      return;
    }
    try {
      // Grant room ACL immediately (invite-only via email allow-list) so peers can join the link.
      await updateDoc(doc(db, "rooms", roomId), { memberEmails: arrayUnion(email) });
      await setDoc(
        doc(db, "rooms", roomId, "participants", Date.now().toString()),
        {
          roomId,
          email,
          status: "accepted",
          userId: user.uid,
          createdAt: serverTimestamp(),
        },
      );
      setInviteEmail("");
      setShowContactSuggestions(false);
      toast.success(t('Invite sent — they can join with the room link.', 'Η πρόσκληση στάλθηκε — μπαίνουν με τον σύνδεσμο.'));
    } catch (err) {
      console.error(err);
      toast.error(t('Failed to invite. Only the owner can expand the allow-list.', 'Αποτυχία πρόσκλησης. Μόνο ο ιδιοκτήτης επεκτείνει τη λίστα.'));
    }
  };

  // Broadcast typing / reading presence for peer safety cues (not a public status feed)
  useEffect(() => {
    const awareness = providerRef.current?.awareness;
    if (!awareness) return;
    const current = awareness.getLocalState()?.user as Record<string, unknown> | undefined;
    if (!current) return;
    const activity: ActivityStatus = chatMessage.trim() ? 'typing' : activeTab === 'notes' ? 'reading' : 'online';
    if (current.activity === activity) return;
    awareness.setLocalStateField('user', { ...current, activity });
  }, [chatMessage, activeTab]);

  const handleReportMessage = async () => {
    if (!reportTarget || !user || isDemoModeActive()) {
      toast.info(t('Reporting requires a signed-in verified account.', 'Η αναφορά απαιτεί επαληθευμένο λογαριασμό.'));
      setReportTarget(null);
      return;
    }
    try {
      await reportRoomMessage(db, roomId, {
        reporterId: user.uid,
        messageId: reportTarget.id,
        reason: reportReason,
      });
      // Unified social spine intake (admin triage queue)
      void apiRequest('/api/social/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surface: 'collab',
          targetId: reportTarget.id,
          reason: reportReason,
          roomId,
        }),
      }).catch(() => undefined);
      toast.success(t('Report submitted. Thank you for keeping study spaces safe.', 'Η αναφορά καταχωρήθηκε. Ευχαριστούμε.'));
      setReportTarget(null);
    } catch {
      toast.error(t('Could not submit report.', 'Αδυναμία υποβολής αναφοράς.'));
    }
  };

  const handleKudos = async (toUserId: string, kind: KudosKind) => {
    if (!user || isDemoModeActive()) {
      toast.info(t('Kudos require a signed-in account.', 'Τα kudos χρειάζονται σύνδεση.'));
      return;
    }
    if (!toUserId || toUserId === user.uid) return;
    try {
      await sendKudos(db, roomId, { fromUserId: user.uid, toUserId, kind });
      toast.success(t('Encouragement sent', 'Στάλθηκε ενθάρρυνση'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Could not send kudos', 'Αδυναμία αποστολής'));
    }
  };

  const handleParticipantStatus = async (
    contact: { id: string; email: string },
    status: "accepted" | "removed",
  ) => {
    if (!user || isDemoModeActive()) return;
    try {
      const participantRef = doc(
        db,
        "rooms",
        roomId,
        "participants",
        contact.id,
      );
      const roomRef = doc(db, "rooms", roomId);
      if (status === "accepted") {
        await updateDoc(participantRef, { status: "accepted" });
        await updateDoc(roomRef, { memberEmails: arrayUnion(contact.email) });
        setInvitedContacts((prev) =>
          prev.map((c) =>
            c.id === contact.id ? { ...c, status: "accepted" } : c,
          ),
        );
      } else {
        await deleteDoc(participantRef);
        await updateDoc(roomRef, { memberEmails: arrayRemove(contact.email) });
        setInvitedContacts((prev) => prev.filter((c) => c.id !== contact.id));
      }
    } catch (error) {
      console.error("Failed to update room access:", error);
      toast.error("Failed to update room access.");
    }
  };

  const copyRoomLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Private room link copied.");
    } catch {
      toast.error("Unable to copy. Copy the current URL from your browser.");
    }
  };
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    const messageText = chatMessage;
    const moderation = await moderatePlatformText(messageText, 'collab');
    if (!moderation.allowed) {
      toast.error(moderation.reason || 'Message blocked by safety moderator');
      return;
    }
    setChatMessage("");

    if (isDemoModeActive()) {
      await appendLocalMessage({
        roomId,
        user: DEMO_USER.email?.split('@')[0] || 'Demo',
        text: messageText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        userId: DEMO_USER.uid,
      });
    } else if (user) {
      try {
        await setDoc(
          doc(db, "rooms", roomId, "messages", Date.now().toString()),
          {
            roomId,
            user: user.email?.split("@")[0] || "User",
            text: messageText,
            time: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            userId: user.uid,
            createdAt: serverTimestamp(),
          },
        );
      } catch (e) {
        console.error("Failed to send", e);
      }
    }

    if (activeTab === "ai") {
      setIsAiTyping(true);
      try {
        const res = await chatWithAgent(
          [{ role: "user", parts: [{ text: messageText }] }],
          "You are a highly intelligent tutor in a collaborative study room. Provide concise, grounded answers.",
        );
        if (isDemoModeActive()) {
          await appendLocalMessage({
            roomId,
            user: 'Synapse AI',
            text: res.text,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            userId: DEMO_USER.uid,
          });
        } else if (user) {
          await setDoc(
            doc(db, "rooms", roomId, "messages", Date.now().toString()),
            {
              roomId,
              user: "Synapse AI",
              text: res.text,
              time: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
              userId: user.uid,
              isAi: true,
              createdAt: serverTimestamp(),
            },
          );
        }
      } catch (error) {
        console.error(error);
      } finally {
        setIsAiTyping(false);
      }
    }
  };

  return (
    <div className="min-h-[calc(100dvh-4rem)] max-md:pb-[calc(var(--mobile-tab-h)+env(safe-area-inset-bottom,0px))] flex flex-col xl:flex-row gap-3 sm:gap-4 xl:gap-6 p-2 sm:p-3 md:p-4 xl:p-0 w-full">
      <GoogleOAuthConsentModal
        open={oauthModalOpen}
        scopes={pendingOauthScopes}
        isPending={googleOAuth.isPending}
        isConnected={googleOAuth.isConnected}
        onConnect={() => googleOAuth.request(pendingOauthScopes)}
        onRevoke={googleOAuth.revoke}
        onClose={() => setOauthModalOpen(false)}
      />
      {/* Main Video / Content Area */}
      <div className="flex-1 flex flex-col gap-5 min-h-[60vh] xl:min-h-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="section-eyebrow mb-0.5">{t('Collaboration Space', 'Συνεργατικός Χώρος')}</p>
            <h1 className="text-xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-500" />
              Macroeconomics Study Group
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              {t('Real-time collaboration & peer-to-peer learning', 'Συνεργασία σε πραγματικό χρόνο & μάθηση μεταξύ συνομηλίκων')}
              {awarenessUsers.length > 0 && (
                <span className="ml-2 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {awarenessUsers.length} {t('online', 'συνδεδεμένοι')}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 justify-end">
            {/* Presence Indicator */}
            <PresenceIndicator users={awarenessUsers} />
            <button
              type="button"
              onClick={() => setStudyRoomOpen(true)}
              className="px-3 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold hover:shadow-md transition-all flex items-center gap-2 shadow-sm"
              aria-label="Open study room panel"
            >
              <Users className="w-3.5 h-3.5" aria-hidden="true" />
              {t('Study Room', 'Αίθουσα Μελέτης')}
            </button>
            <button
              onClick={() => { setPendingOauthScopes(['forms', 'meet']); setOauthModalOpen(true); }}
              title={googleOAuth.isConnected ? 'Google Connected' : 'Connect Google for real Forms & Meet'}
              className={`px-3 py-2 border rounded-xl text-sm font-semibold transition-all flex items-center gap-2 shadow-sm ${
                googleOAuth.isConnected
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:shadow-md'
              }`}
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              {googleOAuth.isConnected ? 'Google Connected' : 'Connect Google'}
            </button>
            
            <button
              onClick={handleScheduleSession}
              className="px-3 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold hover:shadow-md transition-all flex items-center gap-2 shadow-sm"
            >
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg"
                className="w-3.5 h-3.5"
                alt="Calendar"
              />{" "}
              {t('Schedule', 'Προγραμματισμός')}
            </button>
            <button
              type="button"
              onClick={() => void handleToggleMeetConsent()}
              disabled={meetConsentBusy || !selfMeetKey}
              title={t(
                'Meet requires dual consent — same rule as Study Match',
                'Το Meet χρειάζεται διπλή συναίνεση — ίδιος κανόνας με Study Match',
              )}
              className={`px-3 py-2 border rounded-xl text-sm font-semibold transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 ${
                selfMeetConsent
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:shadow-md'
              }`}
            >
              {selfMeetConsent
                ? t(`Meet OK (${meetConsentCount})`, `Meet OK (${meetConsentCount})`)
                : t('Opt into Meet', 'Συμφωνώ για Meet')}
            </button>
            {meetUrl ? (
              <a
                href={meetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold hover:shadow-md transition-all flex items-center gap-2 shadow-sm"
              >
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/9/9b/Google_Meet_icon_%282020%29.svg"
                  className="w-3.5 h-3.5"
                  alt="Meet"
                />{" "}
                {t('Join Meet', 'Σύνδεση Meet')}
              </a>
            ) : (
              <button
                onClick={() => void handleCreateMeet()}
                disabled={isCreatingMeet || !dualMeetOk}
                title={
                  dualMeetOk
                    ? t('Start Meet', 'Έναρξη Meet')
                    : t('Needs 2 opt-ins', 'Χρειάζονται 2 συναινέσεις')
                }
                className="px-3 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold hover:shadow-md transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/9/9b/Google_Meet_icon_%282020%29.svg"
                  className="w-3.5 h-3.5"
                  alt="Meet"
                />{" "}
                {isCreatingMeet
                  ? t('Creating...', 'Δημιουργία...')
                  : dualMeetOk
                    ? t('Start Meet', 'Έναρξη Meet')
                    : t('Meet locked', 'Meet κλειδωμένο')}
              </button>
            )}
            <button
              onClick={async () => {
                try {
                  await new Promise(r => setTimeout(r, 500));
                  const mockId = Math.random().toString(36).substring(7);
                  setMessages((prev) => [
                    ...prev,
                    {
                      user: "System",
                      text: `Demo Chat space created! ID: ${mockId}`,
                      time: new Date().toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      }),
                    },
                  ]);
                } catch (e) {
                  console.error(e);
                  toast.error("Failed to create chat space.");
                }
              }}
              className="px-3 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold hover:shadow-md transition-all flex items-center gap-2 shadow-sm"
            >
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/0/07/Google_Chat_icon_%282020%29.svg"
                className="w-3.5 h-3.5"
                alt="Chat"
              />{" "}
              {t('Google Chat', 'Google Chat')}
            </button>
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
            >
              <Users className="w-3.5 h-3.5" /> {t('Manage Access', 'Διαχείριση Πρόσβασης')}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {isInviteModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 w-full max-w-md relative"
              >
                <button
                  onClick={() => setIsInviteModalOpen(false)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <Plus className="w-5 h-5 rotate-45" />
                </button>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                  {t('Manage Access', 'Διαχείριση Πρόσβασης')}
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                  {t('Invite people by email to join this secure study room.', 'Προσκάλεσε άτομα με email να συμμετέχουν σε αυτό το ασφαλές δωμάτιο μελέτης.')}
                </p>
                <button
                  type="button"
                  onClick={copyRoomLink}
                  className="mb-4 w-full text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  {t('Copy private room link', 'Αντιγραφή ιδιωτικού συνδέσμου')}
                </button>
                <form
                  onSubmit={handleInvite}
                  className="flex gap-2 mb-6 relative"
                >
                  <div className="flex-1 relative">
                    <input
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={(e) => {
                        setInviteEmail(e.target.value);
                        setShowContactSuggestions(e.target.value.length > 0);
                      }}
                      onFocus={() =>
                        setShowContactSuggestions(inviteEmail.length > 0)
                      }
                      placeholder="Email address..."
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                    />
                    {showContactSuggestions && googleContacts.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                        {googleContacts
                          .filter(
                            (c) =>
                              c.name
                                .toLowerCase()
                                .includes(inviteEmail.toLowerCase()) ||
                              c.email
                                .toLowerCase()
                                .includes(inviteEmail.toLowerCase()),
                          )
                          .map((contact, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => {
                                setInviteEmail(contact.email);
                                setShowContactSuggestions(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex flex-col transition-colors border-b border-slate-100 dark:border-slate-700 last:border-0"
                            >
                              <span className="text-sm font-medium text-slate-900 dark:text-white">
                                {contact.name}
                              </span>
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                {contact.email}
                              </span>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="submit"
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 h-fit"
                  >
                    Invite
                  </button>
                </form>
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Pending Approvals
                  </h4>
                  <div className="space-y-2 mb-4">
                    {invitedContacts
                      .filter((c) => c.status === "pending")
                      .map((contact) => (
                        <div
                          key={contact.email}
                          className="flex items-center justify-between bg-amber-50 dark:bg-amber-500/10 p-2 rounded-lg border border-amber-100 dark:border-amber-500/20"
                        >
                          <span className="text-sm text-amber-800 dark:text-amber-200">
                            {contact.email}
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                handleParticipantStatus(contact, "accepted")
                              }
                              className="text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 px-2 py-1 rounded transition-colors text-xs font-semibold"
                            >
                              Admit
                            </button>
                            <button
                              onClick={() =>
                                handleParticipantStatus(contact, "removed")
                              }
                              className="text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 px-2 py-1 rounded transition-colors text-xs font-semibold"
                            >
                              Deny
                            </button>
                          </div>
                        </div>
                      ))}
                    {invitedContacts.filter((c) => c.status === "pending")
                      .length === 0 && (
                      <p className="text-xs text-slate-500 italic">
                        No pending requests.
                      </p>
                    )}
                  </div>

                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Authorized Members
                  </h4>
                  <div className="space-y-2">
                    {invitedContacts
                      .filter((c) => c.status === "accepted")
                      .map((contact) => (
                        <div
                          key={contact.email}
                          className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-2 rounded-lg"
                        >
                          <span className="text-sm text-slate-700 dark:text-slate-300">
                            {contact.email}
                          </span>
                          <button
                            onClick={() =>
                              handleParticipantStatus(contact, "removed")
                            }
                            className="text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 p-1 rounded transition-colors text-xs font-semibold"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Video Grid / Whiteboard / Graph */}
        <div className="flex-1 bg-slate-900 rounded-3xl overflow-hidden relative border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-center">
          {mainView === "video" ? (
            <div className="p-4 w-full h-full">
              <Room roomId={roomId} isVideoOn={isVideoOn} isMicOn={isMicOn} />
            </div>
          ) : mainView === "whiteboard" ? (
            <div className="w-full h-full bg-white relative">
              <Whiteboard ydoc={ydoc} />

              {/* Overlay small videos */}
              <div className="absolute top-4 right-4 flex flex-col gap-2 z-50">
                <div className="w-32 h-24 bg-slate-800 rounded-xl relative overflow-hidden shadow-lg border border-slate-700/50">
                  {isVideoOn ? (
                    <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 animate-pulse" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-white">
                      Y
                    </div>
                  )}
                </div>
                <div className="w-32 h-24 bg-slate-800 rounded-xl relative overflow-hidden shadow-lg border border-slate-700/50">
                  <img
                    src="https://i.pravatar.cc/300?img=47"
                    className="w-full h-full object-cover opacity-80"
                    alt="Peer"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full h-full bg-white dark:bg-slate-900 relative">
              <KnowledgeGraph />
            </div>
          )}

          <CollabOverlay
            ydoc={ydoc}
            provider={provider}
            selfName={(user?.email?.split?.('@')?.[0] ?? 'Guest') as string}
            selfColor={'#' + ((Math.abs([...(user?.email ?? 'guest')].reduce((a, c) => a + c.charCodeAt(0), 0)) * 2654435761) % 0xffffff).toString(16).padStart(6, '0')}
          />

          {/* Meeting Controls */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/40 backdrop-blur-xl p-1.5 rounded-2xl border border-white/10 shadow-2xl z-50">
            <button
              onClick={() =>
                setMainView(mainView === "video" ? "whiteboard" : "video")
              }
              aria-label={mainView === "video" ? "Switch to whiteboard" : "Switch to video"}
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                mainView === "whiteboard"
                  ? "bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                  : "bg-white/20 text-white hover:bg-white/30",
              )}
            >
              <FileImage className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              onClick={() =>
                setMainView(mainView === "graph" ? "video" : "graph")
              }
              aria-label="Toggle Knowledge Graph"
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                mainView === "graph"
                  ? "bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                  : "bg-white/20 text-white hover:bg-white/30",
              )}
            >
              <Network className="w-4 h-4" aria-hidden="true" />
            </button>
            <div className="w-px h-6 bg-white/20 mx-0.5" />
            {/* Shared Study Timer */}
            <button
              onClick={() => setIsTimerRunning(!isTimerRunning)}
              aria-label={isTimerRunning ? t('Pause timer', 'Παύση χρονόμετρου') : t('Start timer', 'Έναρξη χρονόμετρου')}
              className={cn(
                "h-10 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs font-mono font-bold transition-colors",
                isTimerRunning
                  ? "bg-emerald-500/80 text-white shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                  : "bg-white/20 text-white hover:bg-white/30",
              )}
            >
              <Clock className="w-3.5 h-3.5" />
              {Math.floor(sharedTimerSeconds / 60).toString().padStart(2, '0')}:{(sharedTimerSeconds % 60).toString().padStart(2, '0')}
            </button>
            <div className="w-px h-6 bg-white/20 mx-0.5" />
            <button
              onClick={() => setIsMicOn(!isMicOn)}
              aria-label={isMicOn ? t('Mute microphone', 'Σίγαση μικροφώνου') : t('Unmute microphone', 'Ενεργοποίηση μικροφώνου')}
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                isMicOn
                  ? "bg-white/20 text-white hover:bg-white/30"
                  : "bg-red-500 text-white hover:bg-red-600",
              )}
            >
              {isMicOn ? (
                <Mic className="w-4 h-4" aria-hidden="true" />
              ) : (
                <MicOff className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
            <button
              onClick={() => setIsVideoOn(!isVideoOn)}
              aria-label={isVideoOn ? t('Turn off camera', 'Απενεργοποίηση κάμερας') : t('Turn on camera', 'Ενεργοποίηση κάμερας')}
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                isVideoOn
                  ? "bg-white/20 text-white hover:bg-white/30"
                  : "bg-red-500 text-white hover:bg-red-600",
              )}
            >
              {isVideoOn ? (
                <Video className="w-4 h-4" aria-hidden="true" />
              ) : (
                <VideoOff className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
            <button 
              aria-label={t('Share screen', 'Κοινοποίηση οθόνης')}
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/20 text-white hover:bg-white/30 transition-colors"
            >
              <ScreenShare className="w-4 h-4" aria-hidden="true" />
            </button>
            <button 
              aria-label={t('Maximize view', 'Μεγιστοποίηση προβολής')}
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/20 text-white hover:bg-white/30 transition-colors"
            >
              <Maximize2 className="w-4 h-4" aria-hidden="true" />
            </button>
            <button 
              aria-label={t('Leave meeting', 'Αποχώρηση από σύσκεψη')}
              className="w-12 h-10 rounded-xl flex items-center justify-center bg-red-500 text-white hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
            >
              <PhoneOff className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Right Side Panel */}
      <div className="w-full xl:w-[26rem] h-[500px] xl:h-auto bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl flex flex-col overflow-hidden shadow-sm">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 p-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 overflow-x-auto scrollbar-hover">
          <button
            onClick={() => setActiveTab("chat")}
            className={cn(
              "shrink-0 px-3 py-2.5 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors whitespace-nowrap",
              activeTab === "chat"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
            )}
          >
            <MessageSquare className="w-4 h-4 shrink-0" /> {t('Chat', 'Συνομιλία')}
          </button>
          <button
            onClick={() => setActiveTab("ai")}
            className={cn(
              "shrink-0 px-3 py-2.5 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors whitespace-nowrap",
              activeTab === "ai"
                ? "bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
            )}
          >
            <BrainCircuit className="w-4 h-4 shrink-0" /> {t('AI Tutor', 'AI Βοηθός')}
          </button>
          <button
            onClick={() => setActiveTab("tasks")}
            className={cn(
              "shrink-0 px-3 py-2.5 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors whitespace-nowrap",
              activeTab === "tasks"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
            )}
          >
            <CheckSquare className="w-4 h-4 shrink-0" /> {t('Tasks', 'Εργασίες')}
          </button>
          <button
            onClick={() => setActiveTab("notes")}
            className={cn(
              "shrink-0 px-3 py-2.5 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors whitespace-nowrap",
              activeTab === "notes"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
            )}
          >
            <StickyNote className="w-4 h-4 shrink-0" /> {t('Notes', 'Σημειώσεις')}
          </button>
          <button
            onClick={() => setActiveTab("quizzes")}
            className={cn(
              "shrink-0 px-3 py-2.5 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors whitespace-nowrap",
              activeTab === "quizzes"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
            )}
          >
            <FileText className="w-4 h-4 shrink-0" /> {t('Quizzes', 'Κουίζ')}
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50 dark:bg-slate-900/50 scrollbar-hover">
          {(activeTab === "chat" || activeTab === "ai") && (
            <div className="space-y-4">
              {messages
                .filter((m) =>
                  activeTab === "ai" ? m.isAi || m.user === "You" : !m.isAi,
                )
                .map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex flex-col",
                      msg.user === "You" || msg.userId === user?.uid ? "items-end" : "items-start",
                    )}
                  >
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {msg.user}
                      </span>
                      <span className="text-xs text-slate-400">
                        {msg.time}
                      </span>
                    </div>
                    <div className="group/msg relative max-w-[90%] sm:max-w-[85%]">
                      <div
                        className={cn(
                          "px-4 py-2 rounded-2xl text-sm",
                          msg.user === "You" || msg.userId === user?.uid
                            ? "bg-indigo-600 text-white rounded-tr-sm"
                            : (msg as { isAi?: boolean }).isAi
                              ? "bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 text-slate-800 dark:text-slate-200 rounded-tl-sm"
                              : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-sm",
                        )}
                      >
                        {msg.text}
                      </div>
                      {/* Safe social: kudos + report (no public emoji farming) */}
                      {!(msg as { isAi?: boolean }).isAi && msg.userId && msg.userId !== user?.uid && (
                        <div className="absolute -bottom-3 right-2 opacity-100 sm:opacity-0 sm:group-hover/msg:opacity-100 flex items-center gap-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-1 py-0.5 shadow-lg z-10">
                          <button
                            type="button"
                            title={t('Helpful', 'Βοηθητικό')}
                            onClick={() => void handleKudos(String(msg.userId), 'helpful')}
                            className="p-1.5 rounded-full hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-emerald-600"
                            aria-label={t('Mark helpful', 'Σήμανση ως βοηθητικό')}
                          >
                            <HandHeart className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            title={t('Clear explanation', 'Καθαρή εξήγηση')}
                            onClick={() => void handleKudos(String(msg.userId), 'clarify')}
                            className="p-1.5 rounded-full hover:bg-sky-50 dark:hover:bg-sky-900/30 text-sky-600"
                            aria-label={t('Clear explanation', 'Καθαρή εξήγηση')}
                          >
                            <HelpCircle className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            title={t('Encourage', 'Ενθάρρυνση')}
                            onClick={() => void handleKudos(String(msg.userId), 'encourage')}
                            className="p-1.5 rounded-full hover:bg-amber-50 dark:hover:bg-amber-900/30 text-amber-600"
                            aria-label={t('Encourage', 'Ενθάρρυνση')}
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            title={t('Report', 'Αναφορά')}
                            onClick={() => setReportTarget({ id: String(msg.id), preview: String(msg.text ?? '').slice(0, 80) })}
                            className="p-1.5 rounded-full hover:bg-rose-50 dark:hover:bg-rose-900/30 text-rose-600"
                            aria-label={t('Report message', 'Αναφορά μηνύματος')}
                          >
                            <Flag className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              {isAiTyping && (
                <div className="flex items-start">
                  <div className="px-4 py-3 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-2xl rounded-tl-sm flex gap-1">
                    <div
                      className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    />
                    <div
                      className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    />
                    <div
                      className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}

          {activeTab === "tasks" && (
            <div className="space-y-3">
              <button className="w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-slate-500 font-medium hover:border-indigo-500 hover:text-indigo-500 transition-colors flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> {t('Add Google Task', 'Προσθήκη Google Task')}
              </button>
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-start gap-3 shadow-sm"
                >
                  <button
                    onClick={() =>
                      setTasks(
                        tasks.map((t) =>
                          t.id === task.id
                            ? { ...t, completed: !t.completed }
                            : t,
                        ),
                      )
                    }
                    className={cn(
                      "mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-colors",
                      task.completed
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : "border-slate-300 dark:border-slate-600",
                    )}
                  >
                    {task.completed && <CheckSquare className="w-3 h-3" />}
                  </button>
                  <div className="flex-1">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        task.completed
                          ? "text-slate-400 line-through"
                          : "text-slate-700 dark:text-slate-300",
                      )}
                    >
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs font-bold bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full text-slate-500">
                        {task.assignees.join(", ")}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {activeTab === "notes" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {t('Shared Notes', 'Κοινές Σημειώσεις')}
                </h4>
                <span className="text-xs text-slate-400">{t('Synced via Yjs', 'Συγχρονισμένο μέσω Yjs')}</span>
              </div>
              <textarea
                className="w-full min-h-[200px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-sm text-slate-700 dark:text-slate-200 resize-y focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-slate-400"
                placeholder={t('Type shared notes here... everyone in the room can see them.', 'Γράψε σημειώσεις εδώ... όλοι στο δωμάτιο τις βλέπουν.')}
              />
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <StickyNote className="w-3 h-3" />
                <span>{t('Collaborative editing — changes sync in real-time', 'Συνεργατική επεξεργασία — οι αλλαγές συγχρονίζονται σε πραγματικό χρόνο')}</span>
              </div>
            </div>
          )}
          {activeTab === "quizzes" && (
            <div className="space-y-4">
              <button
                onClick={handleCreateGoogleForm}
                disabled={isCreatingQuiz}
                className="w-full py-4 border-2 border-dashed border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl text-indigo-600 dark:text-indigo-400 font-medium hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all flex items-center justify-center gap-2"
              >
                {isCreatingQuiz ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    {t('Creating Quiz...', 'Δημιουργία Quiz...')}
                  </span>
                ) : (
                  <>
                    <FileText className="w-5 h-5" />
                    {t('Create Google Form Quiz', 'Δημιουργία Google Form Quiz')}
                  </>
                )}
              </button>

              <div className="space-y-2 mt-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
                  {t('Room Quizzes', 'Quiz Δωματίου')}
                </h4>
                {quizzes.length === 0 ? (
                  <div className="text-center py-8 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                      {t('No quizzes created yet', 'Δεν έχουν δημιουργηθεί quiz ακόμα')}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                      {t('Create your first quiz above', 'Δημιούργησε το πρώτο σου quiz παραπάνω')}
                    </p>
                  </div>
                ) : (
                  quizzes.map((q) => (
                    <div
                      key={q.id}
                      className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col gap-2 shadow-sm group hover:border-indigo-300 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                              {q.title}
                            </p>
                            <p className="text-xs text-slate-500">
                              {t('Google Forms Quiz', 'Google Forms Quiz')}
                            </p>
                          </div>
                        </div>
                        <a
                          href={q.formUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        {(activeTab === "chat" || activeTab === "ai") && (
          <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
            <form onSubmit={handleSendMessage} className="relative">
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder={
                  activeTab === "ai"
                    ? t('Ask the AI tutor...', 'Ρώτησε τον AI βοηθό...')
                    : t('Message group...', 'Γράψε μήνυμα...')
                }
                className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl pl-4 pr-12 py-3 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white"
              />
              <button
                type="submit"
                disabled={!chatMessage.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            </form>
          </div>
        )}
      </div>

      <StudyRoomPanel
        open={studyRoomOpen}
        onClose={() => setStudyRoomOpen(false)}
        selfId={(user?.uid ? `uid:${user.uid}` : (user?.email ? `email:${user.email}` : 'guest')) as string}
        selfName={(user?.email?.split?.('@')?.[0] ?? 'Guest') as string}
        selfRole={selfRole}
        onRoleChange={setSelfRole}
        roomId={roomId}
        onJoinRoom={joinRoom}
        onLeaveRoom={leaveRoom}
        awarenessUsers={awarenessUsers}
        ydoc={ydoc}
        localTool={localSharedTool}
        onFollowTool={(tool) => {
          setActiveTab(tool.activeTab);
          setMainView(tool.mainView);
          toast.success(t('Following shared tool', 'Ακολούθησες το κοινό εργαλείο'));
        }}
      />

      <CommunityGuidelinesModal
        open={showGuidelines}
        onAccept={() => setShowGuidelines(false)}
      />

      <AnimatePresence>
        {reportTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-900/40 p-0 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-label={t('Report message', 'Αναφορά μηνύματος')}
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl"
            >
              <h3 className="text-base font-display font-bold text-slate-900 dark:text-white mb-1">
                {t('Report message', 'Αναφορά μηνύματος')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 line-clamp-2">
                “{reportTarget.preview}”
              </p>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                {t('Reason', 'Λόγος')}
              </label>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value as ReportReason)}
                className="w-full min-h-11 mb-4 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
              >
                {REPORT_REASONS.map((r) => (
                  <option key={r} value={r}>{r.replace('_', ' ')}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setReportTarget(null)}
                  className="flex-1 min-h-11 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium"
                >
                  {t('Cancel', 'Άκυρο')}
                </button>
                <button
                  type="button"
                  onClick={() => void handleReportMessage()}
                  className="flex-1 min-h-11 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold"
                >
                  {t('Submit report', 'Υποβολή')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
