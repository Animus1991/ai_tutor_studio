import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useSearch } from './useSearch';

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const location = useLocation();
  const { timerIsActive, setTimerIsActive } = useStore();
  const { openSearch, closeSearch, isOpen } = useSearch();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow Escape to close search even if input is focused
      if (e.key === 'Escape') {
        if (isOpen) {
          closeSearch();
          return;
        }
      }

      // Don't trigger shortcuts if user is typing in an input or textarea
      if (
        document.activeElement instanceof HTMLInputElement || 
        document.activeElement instanceof HTMLTextAreaElement ||
        document.activeElement?.getAttribute('contenteditable') === 'true'
      ) {
        return;
      }

      // Ctrl/Cmd + K -> Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          closeSearch();
        } else {
          openSearch();
        }
      }

      // Ctrl/Cmd + L -> Library
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        navigate('/');
      }

      // Ctrl/Cmd + T -> Toggle Timer Manager
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 't') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('toggleTimerVisibility'));
      }

      // Ctrl/Cmd + M -> Toggle Audio Controller
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('toggleAudioVisibility'));
      }

      // Single letter shortcuts (no modifiers)
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'a':
            if (e.shiftKey) {
              window.dispatchEvent(new CustomEvent('toggleAudioVisibility'));
            } else {
              window.dispatchEvent(new CustomEvent('toggleAudioPlay'));
            }
            break;
          case 't':
            if (e.shiftKey) {
              window.dispatchEvent(new CustomEvent('toggleTimerVisibility'));
            } else {
              setTimerIsActive(!timerIsActive);
            }
            break;
        }
      }
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
          case 'm': // Alt + M for Microphone toggle
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('toggleMicrophone'));
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, location, timerIsActive, setTimerIsActive, isOpen, openSearch, closeSearch]);
}
