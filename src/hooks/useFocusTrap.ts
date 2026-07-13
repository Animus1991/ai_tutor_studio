import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Accessibility focus trap for modal dialogs.
 *
 * - Traps Tab / Shift+Tab within the container while `active`.
 * - Moves initial focus into the dialog on open.
 * - Restores focus to the previously focused element on close/unmount.
 * - Optionally calls `onEscape` when Escape is pressed.
 *
 * Returns a ref to attach to the dialog container element.
 */
export function useFocusTrap<T extends HTMLElement = HTMLElement>(
  active: boolean,
  onEscape?: () => void,
) {
  const containerRef = useRef<T | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    const container = containerRef.current;
    if (!container) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const focusFirst = () => {
      const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      const first = focusable[0];
      if (first) {
        first.focus();
      } else {
        // Ensure the dialog itself can receive focus for screen readers.
        container.setAttribute('tabindex', '-1');
        container.focus();
      }
    };

    // Defer to allow the dialog to mount/animate in.
    const raf = requestAnimationFrame(focusFirst);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onEscape?.();
        return;
      }
      if (e.key !== 'Tab') return;

      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (activeEl === first || !container.contains(activeEl)) {
          e.preventDefault();
          last.focus();
        }
      } else if (activeEl === last || !container.contains(activeEl)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', handleKeyDown, true);
      const toRestore = previousFocusRef.current;
      if (toRestore && typeof toRestore.focus === 'function') {
        toRestore.focus();
      }
    };
  }, [active, onEscape]);

  return containerRef;
}

export default useFocusTrap;
