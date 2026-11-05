import { Suspense } from 'react';

// Static export: one pre-rendered page per screen. The record id comes from the
// ?id= query string (read client-side via useSearchParams), so a single static
// file serves every id on S3 — no per-id pre-render needed. useSearchParams()
// requires a Suspense boundary during static export.
export default function Layout({ children }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
