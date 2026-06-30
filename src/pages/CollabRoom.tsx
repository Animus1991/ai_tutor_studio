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
} from "lucide-react";
import { useStore } from "../store/useStore";
import { cn } from "../lib/utils";
import { chatWithAgent } from "../lib/api";
import { getAccessToken } from "../lib/auth";
import { auth, db } from "../lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  setDoc,
  doc,
  serverTimestamp,
  orderBy,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

import { Tldraw } from "tldraw";
import "tldraw/tldraw.css";
import Room from "../components/Room";
import Whiteboard from "../components/Whiteboard";

export default function CollabRoom() {
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "chat" | "tasks" | "notes" | "ai" | "quizzes"
  >("chat");
  const [mainView, setMainView] = useState<"video" | "whiteboard">("video");
  const [chatMessage, setChatMessage] = useState("");

  const [user, setUser] = useState<any>(null);
  const roomId = "default_room";

  const [messages, setMessages] = useState<any[]>([]);
  const [invitedContacts, setInvitedContacts] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const qMessages = query(
          collection(db, "rooms", roomId, "messages"),
          orderBy("createdAt", "asc"),
        );
        const unsubMessages = onSnapshot(qMessages, (snapshot) => {
          const msgs = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setMessages(msgs);
        });

        const qParticipants = query(
          collection(db, "rooms", roomId, "participants"),
        );
        const unsubParticipants = onSnapshot(qParticipants, (snapshot) => {
          const parts = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setInvitedContacts(parts);
        });

        const qQuizzes = query(collection(db, "rooms", roomId, "quizzes"));
        const unsubQuizzes = onSnapshot(qQuizzes, (snapshot) => {
          const qzs = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setQuizzes(qzs);
        });

        return () => {
          unsubMessages();
          unsubParticipants();
          unsubQuizzes();
        };
      }
    });
    return () => unsubscribeAuth();
  }, []);

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

  useEffect(() => {
    if (isInviteModalOpen) {
      fetchGoogleContacts();
    }
  }, [isInviteModalOpen]);

  const fetchGoogleContacts = async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch(
        "https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses",
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json();
      if (data.connections) {
        const contacts = data.connections
          .map((c: any) => ({
            name: c.names?.[0]?.displayName || "",
            email: c.emailAddresses?.[0]?.value || "",
          }))
          .filter((c: any) => c.email);
        setGoogleContacts(contacts);
      }
    } catch (e) {
      console.error("Failed to fetch contacts", e);
    }
  };

  const [isCreatingQuiz, setIsCreatingQuiz] = useState(false);

  const handleCreateGoogleForm = async () => {
    try {
      setIsCreatingQuiz(true);
      const token = await getAccessToken();
      if (!token) {
        alert("Please sign in to Google to create a Quiz.");
        return;
      }

      const res = await fetch("https://forms.googleapis.com/v1/forms", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          info: {
            title: `Synapse Study Quiz - ${new Date().toLocaleDateString()}`,
            documentTitle: `Synapse Study Quiz - ${new Date().toLocaleDateString()}`,
          },
        }),
      });
      const data = await res.json();
      if (data.formId && user) {
        // Add some default questions via batchUpdate
        await fetch(
          `https://forms.googleapis.com/v1/forms/${data.formId}:batchUpdate`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              requests: [
                {
                  createItem: {
                    item: {
                      title:
                        "What is the primary topic of our current study session?",
                      questionItem: {
                        question: {
                          required: true,
                          choiceQuestion: {
                            type: "RADIO",
                            options: [
                              { value: "Macroeconomics" },
                              { value: "IS-LM Model" },
                              { value: "Psychology 101" },
                              { value: "Other" },
                            ],
                          },
                        },
                      },
                    },
                    location: { index: 0 },
                  },
                },
                {
                  createItem: {
                    item: {
                      title: "How well do you understand the material?",
                      questionItem: {
                        question: {
                          required: true,
                          scaleQuestion: {
                            low: 1,
                            high: 5,
                            lowLabel: "Not at all",
                            highLabel: "Perfectly",
                          },
                        },
                      },
                    },
                    location: { index: 1 },
                  },
                },
              ],
            }),
          },
        );

        // Save to Firebase
        const formUrl = `https://docs.google.com/forms/d/${data.formId}/edit`;
        await setDoc(doc(db, "rooms", roomId, "quizzes", data.formId), {
          roomId,
          formId: data.formId,
          formUrl,
          title: data.info.title,
          userId: user.uid,
          createdAt: serverTimestamp(),
        });

        await setDoc(
          doc(db, "rooms", roomId, "messages", Date.now().toString()),
          {
            roomId,
            user: "System",
            text: `A new Quiz has been created for the group: ${formUrl}`,
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
      alert("Failed to create Google Form");
    } finally {
      setIsCreatingQuiz(false);
    }
  };

  const handleCreateMeet = async () => {
    try {
      setIsCreatingMeet(true);
      const token = await getAccessToken();
      if (!token) {
        alert("Please sign in to Google to create a Meet.");
        return;
      }

      const res = await fetch("https://meet.googleapis.com/v2/spaces", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.meetingUri) {
        setMeetUrl(data.meetingUri);
        if (user) {
          await setDoc(
            doc(db, "rooms", roomId, "messages", Date.now().toString()),
            {
              roomId,
              user: "System",
              text: `A new Google Meet has been created for this room: ${data.meetingUri}`,
              time: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
              userId: user.uid,
              createdAt: serverTimestamp(),
            },
          );
        }
      }
    } catch (err) {
      console.error(err);
      alert("Failed to create Google Meet space.");
    } finally {
      setIsCreatingMeet(false);
    }
  };

  const handleScheduleSession = async () => {
    try {
      const token = await getAccessToken();
      if (!token)
        return alert("Please sign in to Google to schedule a session.");

      const startDate = new Date();
      startDate.setHours(startDate.getHours() + 1);
      const endDate = new Date(startDate);
      endDate.setHours(endDate.getHours() + 1);

      const res = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            summary: "Synapse Study Session",
            description: "Collaborative study session scheduled from Synapse.",
            start: { dateTime: startDate.toISOString() },
            end: { dateTime: endDate.toISOString() },
            conferenceData: {
              createRequest: {
                requestId: Math.random().toString(36).substring(7),
                conferenceSolutionKey: { type: "hangoutsMeet" },
              },
            },
          }),
        },
      );

      const data = await res.json();
      if (data.htmlLink) {
        if (user) {
          await setDoc(
            doc(db, "rooms", roomId, "messages", Date.now().toString()),
            {
              roomId,
              user: "System",
              text: `Study session scheduled! Event added to your calendar.`,
              time: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
              userId: user.uid,
              createdAt: serverTimestamp(),
            },
          );
        }
        window.open(data.htmlLink, "_blank");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to schedule session.");
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (email && !invitedContacts.find((c) => c.email === email) && user) {
      try {
        await setDoc(
          doc(db, "rooms", roomId, "participants", Date.now().toString()),
          {
            roomId,
            email,
            status: "pending",
            userId: user.uid,
            createdAt: serverTimestamp(),
          },
        );
        setInviteEmail("");
        setShowContactSuggestions(false);
      } catch (err) {
        console.error(err);
        alert("Failed to invite.");
      }
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
    setChatMessage("");

    if (user) {
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
          [{ role: "user", content: messageText }],
          "You are a highly intelligent tutor in a collaborative study room. Provide concise, grounded answers.",
        );
        if (user) {
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
    <div className="min-h-[calc(100vh-8rem)] flex flex-col xl:flex-row gap-6 pb-6">
      {/* Main Video / Content Area */}
      <div className="flex-1 flex flex-col gap-5 min-h-[60vh] xl:min-h-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-500" />
              Macroeconomics Study Group
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
              Real-time collaboration & peer-to-peer learning
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleScheduleSession}
              className="px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold hover:shadow-md transition-all flex items-center gap-1.5 shadow-sm"
            >
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg"
                className="w-3.5 h-3.5"
                alt="Calendar"
              />{" "}
              Schedule
            </button>
            {meetUrl ? (
              <a
                href={meetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold hover:shadow-md transition-all flex items-center gap-1.5 shadow-sm"
              >
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/9/9b/Google_Meet_icon_%282020%29.svg"
                  className="w-3.5 h-3.5"
                  alt="Meet"
                />{" "}
                Join Meet
              </a>
            ) : (
              <button
                onClick={handleCreateMeet}
                disabled={isCreatingMeet}
                className="px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold hover:shadow-md transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/9/9b/Google_Meet_icon_%282020%29.svg"
                  className="w-3.5 h-3.5"
                  alt="Meet"
                />{" "}
                {isCreatingMeet ? "Creating..." : "Start Meet"}
              </button>
            )}
            <button
              onClick={async () => {
                try {
                  const token = await getAccessToken();
                  if (!token) return alert("Please sign in to Google");
                  const res = await fetch(
                    "https://chat.googleapis.com/v1/spaces",
                    {
                      method: "POST",
                      headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        displayName: "Memora Study Group",
                        spaceType: "SPACE",
                      }),
                    },
                  );
                  const data = await res.json();
                  if (data.name) {
                    setMessages((prev) => [
                      ...prev,
                      {
                        user: "System",
                        text: `Google Chat space created! ID: ${data.name}`,
                        time: new Date().toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        }),
                      },
                    ]);
                  }
                } catch (e) {
                  console.error(e);
                  alert("Failed to create chat space.");
                }
              }}
              className="px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold hover:shadow-md transition-all flex items-center gap-1.5 shadow-sm"
            >
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/0/07/Google_Chat_icon_%282020%29.svg"
                className="w-3.5 h-3.5"
                alt="Chat"
              />{" "}
              Google Chat
            </button>
            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />
            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
            >
              <Users className="w-3.5 h-3.5" /> Manage Access
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
                  Manage Access
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                  Invite people by email to join this secure study room.
                </p>
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
                                setInvitedContacts((prev) =>
                                  prev.map((c) =>
                                    c.email === contact.email
                                      ? { ...c, status: "accepted" }
                                      : c,
                                  ),
                                )
                              }
                              className="text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 px-2 py-1 rounded transition-colors text-xs font-semibold"
                            >
                              Admit
                            </button>
                            <button
                              onClick={() =>
                                setInvitedContacts((prev) =>
                                  prev.filter((c) => c.email !== contact.email),
                                )
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
                              setInvitedContacts((prev) =>
                                prev.filter((c) => c.email !== contact.email),
                              )
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

        {/* Video Grid / Whiteboard */}
        <div className="flex-1 bg-slate-900 rounded-3xl overflow-hidden relative border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-center">
          {mainView === "video" ? (
            <div className="p-4 w-full h-full">
              <Room roomId="demo-room" isVideoOn={isVideoOn} isMicOn={isMicOn} />
            </div>
          ) : (
            <div className="w-full h-full bg-white relative">
              <Whiteboard />

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
          )}

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
            <div className="w-px h-6 bg-white/20 mx-0.5" />
            <button
              onClick={() => setIsMicOn(!isMicOn)}
              aria-label={isMicOn ? "Mute microphone" : "Unmute microphone"}
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
              aria-label={isVideoOn ? "Turn off camera" : "Turn on camera"}
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
              aria-label="Maximize view"
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/20 text-white hover:bg-white/30 transition-colors"
            >
              <Maximize2 className="w-4 h-4" aria-hidden="true" />
            </button>
            <button 
              aria-label="Leave meeting"
              className="w-12 h-10 rounded-xl flex items-center justify-center bg-red-500 text-white hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
            >
              <PhoneOff className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Right Side Panel */}
      <div className="w-full xl:w-96 h-[500px] xl:h-auto bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl flex flex-col overflow-hidden shadow-sm">
        {/* Tabs */}
        <div className="flex items-center p-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
          <button
            onClick={() => setActiveTab("chat")}
            className={cn(
              "flex-1 py-2 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors",
              activeTab === "chat"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
            )}
          >
            <MessageSquare className="w-4 h-4" /> Chat
          </button>
          <button
            onClick={() => setActiveTab("ai")}
            className={cn(
              "flex-1 py-2 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors",
              activeTab === "ai"
                ? "bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
            )}
          >
            <BrainCircuit className="w-4 h-4" /> AI Tutor
          </button>
          <button
            onClick={() => setActiveTab("tasks")}
            className={cn(
              "flex-1 py-2 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors",
              activeTab === "tasks"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
            )}
          >
            <CheckSquare className="w-4 h-4" /> Tasks
          </button>
          <button
            onClick={() => setActiveTab("quizzes")}
            className={cn(
              "flex-1 py-2 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors",
              activeTab === "quizzes"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
            )}
          >
            <FileText className="w-4 h-4" /> Quizzes
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50 dark:bg-slate-900/50">
          {(activeTab === "chat" || activeTab === "ai") && (
            <div className="space-y-4">
              {messages
                .filter((m) =>
                  activeTab === "ai" ? m.isAi || m.user === "You" : !m.isAi,
                )
                .map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex flex-col",
                      msg.user === "You" ? "items-end" : "items-start",
                    )}
                  >
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {msg.user}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {msg.time}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "px-4 py-2 rounded-2xl max-w-[85%] text-sm",
                        msg.user === "You"
                          ? "bg-indigo-600 text-white rounded-tr-sm"
                          : msg.isAi
                            ? "bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 text-slate-800 dark:text-slate-200 rounded-tl-sm"
                            : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-sm",
                      )}
                    >
                      {msg.text}
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
                <Plus className="w-4 h-4" /> Add Google Task
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
                      <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full text-slate-500">
                        {task.assignees.join(", ")}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
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
                    Creating Quiz...
                  </span>
                ) : (
                  <>
                    <FileText className="w-5 h-5" />
                    Create Google Form Quiz
                  </>
                )}
              </button>

              <div className="space-y-2 mt-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
                  Room Quizzes
                </h4>
                {quizzes.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    No quizzes created yet.
                  </p>
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
                            <p className="text-[10px] text-slate-500">
                              Google Forms Quiz
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
                    ? "Ask the AI tutor... (Search enabled)"
                    : "Message group..."
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
    </div>
  );
}
