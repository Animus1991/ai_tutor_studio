import { Link } from 'react-router-dom';
import { BookOpen, ArrowRight } from 'lucide-react';
import { useLibraryStore } from '../store/useLibraryStore';
import { useEffect } from 'react';

export default function ContinueStudyingCard() {
  const { courses, hydrate } = useLibraryStore();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const recent = courses.slice(0, 4);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-4 sm:p-5 shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <BookOpen className="w-4 h-4" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight">
            Continue Studying
          </h3>
        </div>
        <Link to="/library" className="text-indigo-600 dark:text-indigo-400 text-xs font-medium hover:underline">
          Library
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {recent.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">
            Upload a course in the Library to start studying.
          </p>
        ) : (
          recent.map((course) => (
            <Link
              key={course.id}
              to={`/study/${course.id}`}
              className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-colors group"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{course.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{course.topics.length} topics</p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 shrink-0 ml-2" />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
