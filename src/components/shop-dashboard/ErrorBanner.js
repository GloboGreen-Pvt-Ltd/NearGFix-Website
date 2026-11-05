import { AlertTriangle, RefreshCw } from 'lucide-react';

import { cx } from '@/components/site/ui';
import { FOCUS_RING } from './SearchField';

export default function ErrorBanner({ message, onRetry }) {
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="flex-1">{message}</span>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className={cx(
            'inline-flex shrink-0 items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-red-700 ring-1 ring-red-200 transition hover:bg-red-100',
            FOCUS_RING,
          )}
        >
          <RefreshCw className="h-3 w-3" aria-hidden="true" />
          Retry
        </button>
      ) : null}
    </div>
  );
}
