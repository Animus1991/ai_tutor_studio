import { useCallback, useEffect, useState } from "react";
import { WifiOff, Wifi, AlertTriangle } from "lucide-react";
import { Logger } from "../utils/logger";
import {
  flushOfflineMutationQueue,
  getOfflineQueueSize,
  OFFLINE_CONFLICTS_UPDATED_EVENT,
  OFFLINE_QUEUE_UPDATED_EVENT,
  readConflicts,
  registerBackgroundSync,
  resolveConflict,
  type SyncConflict,
} from "../lib/offlineSyncQueue";

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);
  const [queueSize, setQueueSize] = useState(0);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [showConflicts, setShowConflicts] = useState(false);

  const refreshMeta = useCallback(async () => {
    setQueueSize(await getOfflineQueueSize());
    setConflicts(await readConflicts());
  }, []);

  useEffect(() => {
    void refreshMeta();
    const onQueue = () => void refreshMeta();
    window.addEventListener(OFFLINE_QUEUE_UPDATED_EVENT, onQueue);
    window.addEventListener(OFFLINE_CONFLICTS_UPDATED_EVENT, onQueue);
    return () => {
      window.removeEventListener(OFFLINE_QUEUE_UPDATED_EVENT, onQueue);
      window.removeEventListener(OFFLINE_CONFLICTS_UPDATED_EVENT, onQueue);
    };
  }, [refreshMeta]);

  useEffect(() => {
    const handleOffline = () => {
      setIsOffline(true);
      setShowReconnected(false);
      Logger.warn("App went offline");
      void registerBackgroundSync();
    };

    const handleOnline = () => {
      setIsOffline(false);
      setShowReconnected(true);
      Logger.log("App reconnected");
      void Logger.syncOfflineErrors();
      void flushOfflineMutationQueue().then(() => refreshMeta());
      void registerBackgroundSync();
      setTimeout(() => setShowReconnected(false), 3000);
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [refreshMeta]);

  const conflictCount = conflicts.length;
  const showBanner = isOffline || showReconnected || queueSize > 0 || conflictCount > 0;

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end max-w-sm">
      {(isOffline || showReconnected || queueSize > 0) && (
        <div
          role="alert"
          aria-live="assertive"
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg font-medium transition-all duration-300 ${
            isOffline
              ? "bg-rose-500 text-white dark:bg-rose-600"
              : showReconnected
                ? "bg-emerald-500 text-white dark:bg-emerald-600"
                : "bg-slate-800 text-white"
          }`}
        >
          {isOffline ? (
            <>
              <WifiOff className="w-5 h-5" aria-hidden="true" />
              <span>
                Offline — actions queued locally
                {queueSize > 0 ? ` (${queueSize})` : ""}.
              </span>
            </>
          ) : showReconnected ? (
            <>
              <Wifi className="w-5 h-5" aria-hidden="true" />
              <span>Connection restored. Syncing…</span>
            </>
          ) : (
            <>
              <Wifi className="w-5 h-5" aria-hidden="true" />
              <span>{queueSize} pending sync mutation{queueSize === 1 ? "" : "s"}</span>
            </>
          )}
        </div>
      )}

      {conflictCount > 0 && (
        <div
          role="alertdialog"
          aria-label="Sync conflicts"
          className="w-full rounded-xl shadow-lg border border-amber-300 bg-amber-50 text-amber-950 dark:bg-amber-950/90 dark:text-amber-100 dark:border-amber-800 p-3"
        >
          <button
            type="button"
            className="flex items-center gap-2 w-full text-left text-sm font-semibold"
            onClick={() => setShowConflicts((v) => !v)}
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {conflictCount} sync conflict{conflictCount === 1 ? "" : "s"} — choose keep local or remote
          </button>
          {showConflicts && (
            <ul className="mt-2 space-y-2 max-h-48 overflow-y-auto">
              {conflicts.slice(0, 5).map((c) => (
                <li key={c.id} className="text-xs border-t border-amber-200/80 dark:border-amber-800 pt-2">
                  <p className="font-medium mb-1">{c.reason}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      className="px-2 py-1 rounded-md bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 font-semibold"
                      onClick={() => void resolveConflict(c.id, "local").then(refreshMeta)}
                    >
                      Keep local
                    </button>
                    <button
                      type="button"
                      className="px-2 py-1 rounded-md bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 font-semibold"
                      onClick={() => void resolveConflict(c.id, "remote").then(refreshMeta)}
                    >
                      Keep remote
                    </button>
                    <button
                      type="button"
                      className="px-2 py-1 rounded-md border border-transparent text-amber-700 dark:text-amber-300"
                      onClick={() => void resolveConflict(c.id, "dismiss").then(refreshMeta)}
                    >
                      Dismiss
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
