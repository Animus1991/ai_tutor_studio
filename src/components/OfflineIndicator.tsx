import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";
import { Logger } from "../utils/logger";

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOffline = () => {
      setIsOffline(true);
      setShowReconnected(false);
      Logger.warn("App went offline");
    };

    const handleOnline = () => {
      setIsOffline(false);
      setShowReconnected(true);
      Logger.log("App reconnected");
      // Trigger sync logic here
      Logger.syncOfflineErrors();
      setTimeout(() => setShowReconnected(false), 3000);
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (!isOffline && !showReconnected) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg font-medium transition-all duration-300 transform translate-y-0 opacity-100 ${
        isOffline
          ? "bg-rose-500 text-white dark:bg-rose-600"
          : "bg-emerald-500 text-white dark:bg-emerald-600"
      }`}
    >
      {isOffline ? (
        <>
          <WifiOff className="w-5 h-5" aria-hidden="true" />
          <span>You are offline. Actions will be saved locally.</span>
        </>
      ) : (
        <>
          <Wifi className="w-5 h-5" aria-hidden="true" />
          <span>Connection restored. Syncing data...</span>
        </>
      )}
    </div>
  );
}
