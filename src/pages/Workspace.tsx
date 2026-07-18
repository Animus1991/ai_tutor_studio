import { useState, useEffect } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { Calendar, Users, GraduationCap, Clock, ExternalLink, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { contactsService } from "../lib/services/DemoContactsService";
import { fetchUpcomingCalendarEvents } from "../lib/services/GoogleCalendarService";
import VoiceNotesWidget from "../components/VoiceNotesWidget";
import FocusModeOverlay from "../components/FocusModeOverlay";
import { useStore } from "../store/useStore";
import { useLibraryStore } from "../store/useLibraryStore";
import {
  grantContactsOptIn,
  hasContactsOptIn,
  revokeContactsOptIn,
} from "../lib/contactsConsent";
import { toast } from "sonner";
import { useGoogleOAuth } from "../hooks/useGoogleOAuth";
import GoogleOAuthConsentModal from "../components/GoogleOAuthConsentModal";

export default function Workspace() {
  const { accessToken, isDemoMode } = useAuthStore();
  const { courses: libraryCourses } = useLibraryStore();
  const { toggleFocusMode } = useStore();
  const googleOAuth = useGoogleOAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [calendarSource, setCalendarSource] = useState<'google' | 'demo'>('demo');
  const [courses, setCourses] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [contactsOptIn, setContactsOptIn] = useState(() => hasContactsOptIn());
  const [showCalendarConsent, setShowCalendarConsent] = useState(false);

  useEffect(() => {
    if (!accessToken && !isDemoMode) {
      setLoading(false);
      return;
    }

    const fetchWorkspaceData = async () => {
      setLoading(true);
      try {
        // Prefer scoped OAuth / sign-in token for real Calendar; demo is labeled.
        const calToken = googleOAuth.token || accessToken;
        const cal = await fetchUpcomingCalendarEvents(calToken, {
          preferDemo: isDemoMode && !googleOAuth.token,
        });
        setEvents(cal.events);
        setCalendarSource(cal.source);
        if (cal.error && cal.source === 'demo') {
          console.warn('[Workspace] Calendar fell back to demo:', cal.error);
        }

        if (isDemoMode && libraryCourses.length > 0) {
          setCourses(
            libraryCourses.map((c) => ({
              name: c.title,
              section: `${c.topics.length} modules · ${c.glossary.length} terms`,
              studyLink: `/study/${c.id}`,
            })),
          );
        } else {
          setCourses([
            { name: "Advanced Mathematics", section: "Spring 2024 · demo stub", alternateLink: "#" },
            { name: "Computer Science 101", section: "Fall 2024 · demo stub", alternateLink: "#" },
          ]);
        }

        // Contacts require explicit opt-in; demo mocks never mix into room ACL emails.
        if (contactsOptIn) {
          const fetchedContacts = await contactsService.getContacts();
          setContacts(
            fetchedContacts.map((c) => ({
              names: [{ displayName: c.name }],
              emails: [{ value: c.email }],
              _demo: true,
            })),
          );
        } else {
          setContacts([]);
        }
      } catch (err) {
        console.error("Failed to fetch workspace data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkspaceData();
  }, [accessToken, isDemoMode, libraryCourses, contactsOptIn, googleOAuth.token]);

  return (
    <div className="flex-1 overflow-y-auto">
      <FocusModeOverlay />
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800/60 sticky top-0 z-40 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-white tracking-tight">
            Workspace Sync
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Google Workspace sync — demo mocks are labeled and never written to room ACL emails.
          </p>
        </div>
        <button 
          onClick={toggleFocusMode}
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 px-4 py-2 rounded-xl font-medium transition-colors shadow-sm"
        >
          <Target className="w-4 h-4" />
          Enter Focus Mode
        </button>
      </header>

      <div className="w-full space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <VoiceNotesWidget />

            {/* Calendar Widget */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-5 shadow-sm col-span-1 lg:col-span-2">
              <div className="flex items-center gap-3 mb-6 flex-wrap">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Calendar className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Upcoming Schedule</h2>
                  <p
                    className={
                      calendarSource === 'google'
                        ? 'text-[11px] text-emerald-600 dark:text-emerald-400 font-medium'
                        : 'text-[11px] text-amber-600 dark:text-amber-400 font-medium'
                    }
                  >
                    {calendarSource === 'google'
                      ? 'Live Google Calendar (readonly scope)'
                      : 'Demo mock calendar · not live Google Calendar'}
                  </p>
                </div>
                {calendarSource !== 'google' && (
                  <button
                    type="button"
                    className="text-xs font-semibold px-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 min-h-10"
                    onClick={() => setShowCalendarConsent(true)}
                  >
                    Connect Calendar
                  </button>
                )}
              </div>
              
              {events.length > 0 ? (
                <div className="space-y-4">
                  {events.map((ev, i) => (
                    <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                      <div className="flex flex-col items-center justify-center px-3 py-1 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 min-w-16">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                          {ev.start.dateTime ? new Date(ev.start.dateTime).toLocaleDateString('en-US', { month: 'short' }) : 'All'}
                        </span>
                        <span className="text-lg font-bold text-slate-900 dark:text-white">
                          {ev.start.dateTime ? new Date(ev.start.dateTime).getDate() : 'Day'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-900 dark:text-white">{ev.summary || "Busy"}</h3>
                        {ev.start.dateTime && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(ev.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-slate-500 dark:text-slate-400">No upcoming events.</p>
                </div>
              )}
            </div>

            <div className="space-y-6 col-span-1">
              {/* Classroom Widget */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Classroom</h2>
                </div>
                
                {courses.length > 0 ? (
                  <div className="space-y-3">
                    {courses.map((course, i) => {
                      const href = course.studyLink ?? course.alternateLink ?? '#';
                      const isInternal = href.startsWith('/');
                      const inner = (
                        <>
                          <div className="truncate pr-4">
                            <h3 className="font-medium text-sm text-slate-900 dark:text-white truncate">{course.name}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{course.section || "Active Course"}</p>
                          </div>
                          <ExternalLink className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </>
                      );
                      return isInternal ? (
                        <Link
                          key={i}
                          to={href}
                          className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
                        >
                          {inner}
                        </Link>
                      ) : (
                        <a
                          key={i}
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
                        >
                          {inner}
                        </a>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-slate-500 dark:text-slate-400">No active courses.</p>
                  </div>
                )}
              </div>

              {/* Contacts Widget — explicit opt-in */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-sky-50 dark:bg-sky-900/30 flex items-center justify-center text-sky-600 dark:text-sky-400">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Contacts</h2>
                    <p className="text-[11px] text-slate-500">Opt-in required · demo mocks never enter room ACL</p>
                  </div>
                </div>

                {!contactsOptIn ? (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Contacts stay off until you consent. Demo emails are labeled and blocked from Collab invites.
                    </p>
                    <button
                      type="button"
                      className="min-h-11 px-4 rounded-xl bg-sky-600 text-white text-sm font-semibold"
                      onClick={() => {
                        grantContactsOptIn();
                        setContactsOptIn(true);
                        toast.success('Contacts opt-in saved (demo mocks labeled)');
                      }}
                    >
                      Allow contact suggestions
                    </button>
                  </div>
                ) : contacts.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-3">
                      {contacts.slice(0, 8).map((contact, i) => {
                        const name = contact.names?.[0]?.displayName || "Unknown";
                        const photoUrl = contact.photos?.[0]?.url;
                        return (
                          <div key={i} className="flex flex-col items-center gap-2" title={`${name} (demo)`}>
                            {photoUrl ? (
                              <img src={photoUrl} alt={name} className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm font-medium text-slate-600 dark:text-slate-300">
                                {name.charAt(0)}
                              </div>
                            )}
                            <span className="text-xs text-slate-600 dark:text-slate-400 max-w-[4.5rem] truncate">{name.split(' ')[0]}</span>
                            <span className="text-[9px] uppercase tracking-wide text-amber-600">demo</span>
                          </div>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      className="text-xs text-slate-500 underline"
                      onClick={() => {
                        revokeContactsOptIn();
                        setContactsOptIn(false);
                        setContacts([]);
                      }}
                    >
                      Revoke contacts opt-in
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400">No contacts synced.</p>
                )}
              </div>
            </div>

          </div>
        )}
      </div>

      <GoogleOAuthConsentModal
        open={showCalendarConsent}
        scopes={['calendar']}
        isPending={googleOAuth.isPending}
        isConnected={googleOAuth.isConnected}
        onConnect={() => googleOAuth.request(['calendar'])}
        onRevoke={() => {
          googleOAuth.revoke();
          toast.message('Calendar token cleared — demo schedule will show');
        }}
        onClose={() => setShowCalendarConsent(false)}
      />
    </div>
  );
}
