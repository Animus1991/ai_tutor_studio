import { useEffect, useRef, useState } from 'react';

export default function LiveRegion() {
  const [politeMsg, setPoliteMsg] = useState('');
  const [assertiveMsg, setAssertiveMsg] = useState('');
  const politeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assertiveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const { message, priority } = (e as CustomEvent<{ message: string; priority: 'polite' | 'assertive' }>).detail;
      if (priority === 'assertive') {
        setAssertiveMsg(message);
        if (assertiveTimer.current) clearTimeout(assertiveTimer.current);
        assertiveTimer.current = setTimeout(() => setAssertiveMsg(''), 3000);
      } else {
        setPoliteMsg(message);
        if (politeTimer.current) clearTimeout(politeTimer.current);
        politeTimer.current = setTimeout(() => setPoliteMsg(''), 3000);
      }
    };
    window.addEventListener('live-announce', handler);
    return () => window.removeEventListener('live-announce', handler);
  }, []);

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {politeMsg}
      </div>
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {assertiveMsg}
      </div>
    </>
  );
}
