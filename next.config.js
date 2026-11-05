/** @type {import('next').NextConfig} */
// GitHub Pages project sites are served from https://<user>.github.io/<repo>/, so the
// app must know its sub-path or every _next/* asset 404s. The deploy workflow passes
// NEXT_PUBLIC_BASE_PATH (e.g. "/repair-shop-admin"); local dev and HTTP/root hosting
// leave it unset, giving an empty base path.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const nextConfig = {
  reactStrictMode: true,
  // Static export ONLY for production builds (S3 / GitHub Pages). In `next dev`
  // we leave output undefined so dynamic [id] routes (shop view/edit/settings)
  // render on-demand — `output: export` otherwise 500s any id that isn't in
  // generateStaticParams(), which can't include runtime shop UUIDs.
  output: process.env.NODE_ENV === 'production' ? 'export' : undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  basePath,
  assetPrefix: basePath || undefined,
};

module.exports = nextConfig;
