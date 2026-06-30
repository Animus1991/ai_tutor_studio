export const Logger = {
  log: (message: string, context?: any) => {
    console.log(`[INFO] ${message}`, context || "");
  },
  warn: (message: string, context?: any) => {
    console.warn(`[WARN] ${message}`, context || "");
  },
  error: (error: Error | string, context?: any) => {
    console.error(`[ERROR]`, error, context || "");
    const errorData = {
      message: typeof error === "string" ? error : error.message,
      stack: typeof error === "string" ? "" : error.stack,
      context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    };
    
    // Attempt to send to our custom backend if online
    if (navigator.onLine) {
      fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(errorData),
      }).catch(console.error); // Silently fail if endpoint doesn't exist
    } else {
      // Save locally if offline
      const stored = localStorage.getItem("offline_errors");
      const errors = stored ? JSON.parse(stored) : [];
      errors.push(errorData);
      localStorage.setItem("offline_errors", JSON.stringify(errors));
    }
  },
  syncOfflineErrors: () => {
    if (!navigator.onLine) return;
    const stored = localStorage.getItem("offline_errors");
    if (stored) {
      const errors = JSON.parse(stored);
      if (errors.length > 0) {
        fetch("/api/logs/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ errors }),
        })
          .then(() => {
            localStorage.removeItem("offline_errors");
          })
          .catch(console.error);
      }
    }
  }
};

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    Logger.syncOfflineErrors();
  });
}
