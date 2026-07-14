/** Accessible loading placeholder for lazy-loaded routes. */
export default function RouteFallback() {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-[40vh] gap-3"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      <span className="text-sm text-slate-500 dark:text-slate-400">Loading page…</span>
    </div>
  );
}
