import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useLearningProfileStore } from '../store/useLearningProfileStore';

export function usePageEngagement() {
  const location = useLocation();
  const trackEvent = useLearningProfileStore((state) => state.trackEvent);
  const profilingEnabled = useLearningProfileStore(
    (state) => state.profilingEnabled,
  );
  const enteredAtRef = useRef(Date.now());
  const pathRef = useRef(location.pathname);

  useEffect(() => {
    enteredAtRef.current = Date.now();
    pathRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    if (!profilingEnabled) return;

    const emitAbandonment = (abandoned: boolean) => {
      const dwellMs = Date.now() - enteredAtRef.current;
      if (dwellMs < 5_000) return;
      trackEvent({
        kind: 'focus_session',
        surface: 'dashboard',
        channel: 'visual',
        durationSeconds: Math.round(dwellMs / 1000),
        abandoned,
        success: !abandoned,
      });
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        emitAbandonment(true);
      }
    };

    const handlePageHide = () => emitAbandonment(true);

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
      emitAbandonment(false);
    };
  }, [location.pathname, profilingEnabled, trackEvent]);
}
