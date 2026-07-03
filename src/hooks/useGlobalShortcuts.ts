import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMicrophone } from './useMicrophone';
import { useSearch } from './useSearch';

export function useGlobalShortcuts() {
  const navigate = useNavigate();
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

      // Ignore if user is typing in an input or textarea
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement ||
        document.activeElement?.getAttribute('contenteditable') === 'true'
      ) {
        return;
      }

      // Global Command Palette toggle (Ctrl+K or Cmd+K)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          closeSearch();
        } else {
          openSearch();
        }
      }

      // Toggle Timer Manager (Ctrl+T or Cmd+T)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('toggleTimerVisibility'));
      }

      // Toggle Audio Controller visibility (Ctrl+M or Cmd+M)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('toggleAudioVisibility'));
      }

      // Check for modifier keys (e.g., Alt/Option + Key)
      if (e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'd':
            e.preventDefault();
            navigate('/');
            break;
          case 'l':
            e.preventDefault();
            navigate('/library');
            break;
          case 'w':
            e.preventDefault();
            navigate('/workspace');
            break;
          case 'p':
            e.preventDefault();
            navigate('/progress');
            break;
          case 'c':
            e.preventDefault();
            navigate('/calendar');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, isOpen, openSearch, closeSearch]);
}
