import { useState, useEffect } from "react";
import { CloudOff, Cloud, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function SyncIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setIsSyncing(true);
      setTimeout(() => setIsSyncing(false), 2000); // Simulate sync delay
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {!isOnline || isSyncing ? (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full shadow-sm text-xs font-semibold backdrop-blur-md"
          style={{
            backgroundColor: !isOnline ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)",
            color: !isOnline ? "#ef4444" : "#10b981",
            border: !isOnline ? "1px solid rgba(239, 68, 68, 0.2)" : "1px solid rgba(16, 185, 129, 0.2)"
          }}
        >
          {!isOnline ? (
            <>
              <CloudOff className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Offline</span>
            </>
          ) : (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span className="hidden sm:inline">Syncing</span>
            </>
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
