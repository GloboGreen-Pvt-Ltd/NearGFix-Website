'use client';

import { ChevronRight } from 'lucide-react';

/**
 * Reusable button matching the reference admin.
 *  - variant="primary"   solid blue (e.g. "+ Add New")
 *  - variant="secondary" outlined white (e.g. "Refresh")
 */
export function Button({ variant = 'secondary', icon: Icon, children, className = '', ...props }) {
  const base =
    'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-admin-accent text-white hover:bg-blue-700',
    secondary: 'border border-admin-border bg-admin-card text-slate-700 hover:bg-admin-dark',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}

/**
 * Page header: breadcrumb + title + subtitle on the left, actions on the right.
 *  - breadcrumb: array of strings (last is the current page)
 *  - actions: JSX (usually <Button>s)
 */
export default function PageHeader({ breadcrumb, title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {breadcrumb?.length > 0 && (
          <nav className="mb-1 flex flex-wrap items-center gap-1 text-sm text-admin-muted">
            {breadcrumb.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5" />}
                <span className={i === breadcrumb.length - 1 ? 'text-slate-700 font-medium' : ''}>{crumb}</span>
              </span>
            ))}
          </nav>
        )}
        <h1 className="break-words text-xl font-semibold text-slate-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-admin-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
