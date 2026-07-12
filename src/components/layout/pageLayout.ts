/** Shared horizontal rhythm for main content (sidebar-adjacent area). */
export const CONTENT_GUTTER = 'px-3 sm:px-4 lg:px-5 xl:px-6';
export const CONTENT_GUTTER_NEG = '-mx-3 sm:-mx-4 lg:-mx-5 xl:-mx-6';

export function isFullBleedRoute(pathname: string): boolean {
  return /^\/(study|collab)/.test(pathname);
}
