/**
 * Shared layout for the Partner Website: /sell-with-us, /shop-home/*, /shopmanagement.
 * Route group only — URLs unchanged. Each section keeps its own layout for
 * metadata, fonts and (shop-home) the DashboardShell auth guard.
 */
export default function PartnerLayout({ children }) {
  return (
    <>
      {/* Google Material Symbols (Outlined), used by MaterialIcon across partner pages. */}
      {/* display=block (not swap): an icon font must never flash its ligature names as text while loading. */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font, @next/next/google-font-display -- icon font scoped to partner routes. */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
      />
      {children}
    </>
  );
}
