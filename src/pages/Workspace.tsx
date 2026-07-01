import { useState, useEffect } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { Calendar, Users, GraduationCap, Clock, ExternalLink } from "lucide-react";
import { contactsService } from "../lib/services/DemoContactsService";
import { calendarService } from "../lib/services/DemoCalendarService";

export default function Workspace() {
  const { accessToken } = useAuthStore();
  const [events, setEvents] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;

    const fetchWorkspaceData = async () => {
      setLoading(true);
      try {
        const [fetchedEvents, fetchedContacts] = await Promise.all([
          calendarService.getUpcomingEvents(),
          contactsService.getContacts()
        ]);
        
        setEvents(fetchedEvents);

        // Mock Classroom Courses
        const mockCourses = [
          {
            name: "Advanced Mathematics",
            section: "Spring 2024",
            alternateLink: "#"
          },
          {
            name: "Computer Science 101",
            section: "Fall 2024",
            alternateLink: "#"
          }
        ];
        setCourses(mockCourses);

        // Map contacts to the expected format
        setContacts(fetchedContacts.map(c => ({ names: [{ displayName: c.name }] })));

      } catch (err) {
        console.error("Failed to fetch workspace data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkspaceData();
  }, [accessToken]);

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800/60 sticky top-0 z-40 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-white tracking-tight">
            Workspace Sync
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Your connected Google services and autonomous scheduling.
          </p>
        </div>
      </header>

      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Calendar Widget */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-5 shadow-sm col-span-1 lg:col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Calendar className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Upcoming Schedule</h2>
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
                    {courses.map((course, i) => (
                      <a 
                        key={i} 
                        href={course.alternateLink} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
                      >
                        <div className="truncate pr-4">
                          <h3 className="font-medium text-sm text-slate-900 dark:text-white truncate">{course.name}</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{course.section || "Active Course"}</p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-slate-500 dark:text-slate-400">No active courses.</p>
                  </div>
                )}
              </div>

              {/* Contacts Widget */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-sky-50 dark:bg-sky-900/30 flex items-center justify-center text-sky-600 dark:text-sky-400">
                    <Users className="w-5 h-5" />
                  </div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Study Group</h2>
                </div>
                
                {contacts.length > 0 ? (
                  <div className="flex flex-wrap gap-3">
                    {contacts.slice(0, 8).map((contact, i) => {
                      const name = contact.names?.[0]?.displayName || "Unknown";
                      const photoUrl = contact.photos?.[0]?.url;
                      return (
                        <div key={i} className="flex flex-col items-center gap-2" title={name}>
                          {photoUrl ? (
                            <img src={photoUrl} alt={name} className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm font-medium text-slate-600 dark:text-slate-300">
                              {name.charAt(0)}
                            </div>
                          )}
                          <span className="text-[10px] text-slate-600 dark:text-slate-400 max-w-[60px] truncate">{name.split(' ')[0]}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-slate-500 dark:text-slate-400">No contacts synced.</p>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
