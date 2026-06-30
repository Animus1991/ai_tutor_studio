import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore';

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const location = useLocation();
  const { timerIsActive, setTimerIsActive } = useStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Ctrl/Cmd + L -> Library
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        navigate('/');
      }

      // Ctrl/Cmd + T -> Tasks (Note: some browsers may intercept this)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 't') {
        // We'll also support Alt+T as a fallback below
        e.preventDefault();
        navigate('/tasks');
      }

      // Ctrl/Cmd + S -> Save Notes
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        const event = new CustomEvent('saveNotes');
        window.dispatchEvent(event);
      }

      // Alt + Number/Letters for navigation and actions
      if (e.altKey) {
        switch (e.key.toLowerCase()) {
          case '1':
          case 'l':
            e.preventDefault();
            navigate('/');
            break;
          case '2':
          case 't':
            e.preventDefault();
            navigate('/tasks');
            break;
          case '3':
          case 'a':
            e.preventDefault();
            navigate('/agent');
            break;
          case '4':
          case 'c':
            e.preventDefault();
            navigate('/collab');
            break;
          case 'p': // Alt + P for Pomodoro toggle
            e.preventDefault();
            setTimerIsActive(!timerIsActive);
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, location, timerIsActive, setTimerIsActive]);
}
