/** Shared horizontal rhythm for main content (sidebar-adjacent area). */
export const CONTENT_GUTTER = 'px-3 sm:px-4 md:px-5 lg:px-6';
export const CONTENT_GUTTER_NEG = '-mx-3 sm:-mx-4 md:-mx-5 lg:-mx-6';

/** Bottom clearance so content clears mobile tab bar + home indicator. */
export const MOBILE_TAB_CLEARANCE =
  'pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:pb-6';

/**
 * Standard page content width: fill the main pane next to the sidebar
 * (no artificial max-w-* column). Keep gutters via Layout CONTENT_GUTTER.
 */
export const PAGE_CONTENT = 'w-full min-w-0 max-w-none';

/** Full-height chat/voice surfaces that should fill the main pane. */
export const VIEW_SHELL =
  'flex flex-col w-full min-h-0 h-[calc(100dvh-4rem-env(safe-area-inset-top,0px))] md:h-[calc(100dvh-4rem)] max-md:rounded-none max-md:border-x-0 max-md:border-b-0';

export function isFullBleedRoute(pathname: string): boolean {
  return /^\/(study|collab|voice|agent|match\/.+)$/.test(pathname);
}
