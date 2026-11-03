'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Eye, Pencil, Power, Trash2 } from 'lucide-react';
import TablePagination from './TablePagination';
import { pageBounds } from '@/lib/pagination';

/** Green/red status pill matching the reference table. */
export function StatusPill({ active, activeLabel = 'Active', inactiveLabel = 'Inactive' }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        active ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'
      }`}
    >
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}

function IconAction({ title, onClick, tone, children }) {
  const tones = {
    view: 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
    edit: 'text-admin-accent hover:bg-blue-50',
    toggle: 'text-amber-600 hover:bg-amber-50',
    delete: 'text-red-600 hover:bg-red-50',
  };
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors md:h-8 md:w-8 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

export default function DataTable({
  columns,
  rows,
  keyExtractor = (row) => row.id,
  onView,
  onEdit,
  onToggle,
  onDelete,
  emptyMessage = 'No data',
  paginate = true,
  showSerial = true,
  searchable = true,
}) {
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const list = rows || [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    const hit = (v) => v != null && String(v).toLowerCase().includes(q);
    return list.filter((r) => {
      // Raw string/number fields stored directly on the row.
      const rawMatch = Object.values(r)
        .filter((v) => typeof v === 'string' || typeof v === 'number')
        .some(hit);
      if (rawMatch) return true;
      // Derived/looked-up columns (e.g. a name resolved from an id, or values
      // pulled from another dataset) expose their text via col.search(row).
      return columns.some((col) => typeof col.search === 'function' && hit(col.search(r)));
    });
  }, [rows, query, columns]);

  const total = filtered.length;

  // Reset to first page when the dataset size or page size changes
  // (e.g. a search filter was applied or rows-per-page switched).
  useEffect(() => { setPage(0); }, [total, pageSize]);

  const hasActions = onView || onEdit || onToggle || onDelete;
  const { safePage, start } = pageBounds(total, page, pageSize);
  const visible = paginate ? filtered.slice(start, start + pageSize) : filtered;

  return (
    <div className="rounded-xl border border-admin-border bg-admin-card shadow-sm">
      {searchable && (
        <div className="p-3 sm:p-4 border-b border-admin-border">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full rounded-lg border border-admin-border bg-white py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-admin-accent focus:outline-none focus:ring-2 focus:ring-admin-accent/20"
            />
          </div>
        </div>
      )}

      {!total ? (
        <div className="p-10 text-center text-admin-muted">{query ? 'No matches.' : emptyMessage}</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="bg-slate-50 border-b border-admin-border text-xs uppercase tracking-wide text-admin-muted">
                <tr>
                  {showSerial && <th className="px-4 py-3 font-semibold w-16">S.No</th>}
                  {columns.map((col) => (
                    <th key={col.key} className="px-4 py-3 font-semibold">{col.label}</th>
                  ))}
                  {hasActions && <th className="px-4 py-3 font-semibold text-right w-32">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-border">
                {visible.map((row, i) => (
                  <tr key={keyExtractor(row)} className="hover:bg-slate-50/70">
                    {showSerial && (
                      <td className="px-4 py-3 text-admin-muted tabular-nums">{start + i + 1}</td>
                    )}
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3 text-slate-700">
                        {col.render ? col.render(row) : row[col.key]}
                      </td>
                    ))}
                    {hasActions && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                          {onView && (
                            <IconAction tone="view" title="View" onClick={() => onView(row)}>
                              <Eye className="h-4 w-4" />
                            </IconAction>
                          )}
                          {onEdit && (
                            <IconAction tone="edit" title="Edit" onClick={() => onEdit(row)}>
                              <Pencil className="h-4 w-4" />
                            </IconAction>
                          )}
                          {onToggle && (
                            <IconAction tone="toggle" title="Toggle status" onClick={() => onToggle(row)}>
                              <Power className="h-4 w-4" />
                            </IconAction>
                          )}
                          {onDelete && (
                            <IconAction tone="delete" title="Delete" onClick={() => onDelete(row)}>
                              <Trash2 className="h-4 w-4" />
                            </IconAction>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {paginate && (
            <TablePagination
              total={total}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          )}
        </>
      )}
    </div>
  );
}
