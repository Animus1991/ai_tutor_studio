/** Dispatch a screen-reader announcement via the global LiveRegion component. */
export function announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('live-announce', { detail: { message, priority } })
  );
}
