'use client';

/**
 * next/link with portal-subdomain URLs (src/lib/portalUrl.js). The first render
 * keeps the internal href so the static HTML hydrates without a mismatch.
 */
import { forwardRef, useEffect, useState } from 'react';
import Link from 'next/link';
import { toPublic } from '@/lib/portalUrl';

const PortalLink = forwardRef(function PortalLink({ href, ...props }, ref) {
  const [mapped, setMapped] = useState(href);
  useEffect(() => { setMapped(toPublic(href)); }, [href]);
  return <Link ref={ref} href={mapped} {...props} />;
});

export default PortalLink;
