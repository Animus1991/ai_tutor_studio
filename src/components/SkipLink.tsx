/** WCAG 2.4.1 — bypass block: skip to main content. */
export default function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-indigo-600 focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
    >
      Skip to main content
    </a>
  );
}
