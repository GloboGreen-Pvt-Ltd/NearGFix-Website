'use client';

/**
 * next/navigation with portal-subdomain URLs (src/lib/portalUrl.js): router
 * calls take internal paths, usePathname returns the internal path.
 */
import { useMemo } from 'react';
import { useRouter as useNextRouter, usePathname as useNextPathname } from 'next/navigation';
import { toInternal, toPublic } from '@/lib/portalUrl';

export * from 'next/navigation';

export function usePathname() {
  return toInternal(useNextPathname());
}

export function useRouter() {
  const router = useNextRouter();
  return useMemo(() => {
    const go = (method) => (href, opts) => {
      const url = toPublic(href);
      if (/^https?:/.test(url)) return method === 'prefetch' ? undefined : window.location[method === 'replace' ? 'replace' : 'assign'](url);
      return router[method](url, opts);
    };
    return { ...router, push: go('push'), replace: go('replace'), prefetch: go('prefetch') };
  }, [router]);
}
