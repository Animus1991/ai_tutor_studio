import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMicrophone } from './useMicrophone';

export function useGlobalShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement ||
        document.activeElement?.getAttribute('contenteditable') === 'true'
      ) {
        return;
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
  }, [navigate]);
}
