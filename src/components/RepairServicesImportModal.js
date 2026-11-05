'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { masterApi } from '@/lib/api';
import { mapPool } from '@/lib/concurrency';
import { pageBounds } from '@/lib/pagination';
import TablePagination from '@/components/TablePagination';
import {
  exportRepairServiceErrorReport,
  exportRepairServicesTemplateWorkbook,
  parseRepairServicesFile,
  planRepairServicesImport,
} from '@/lib/repairServicesExcel';
import { notifyError } from '@/lib/toast';

// Master-data runs in a constrained environment. A small write pool keeps a large
// upload responsive without letting an accidental spreadsheet spike the service.
const WRITE_CONCURRENCY = 4;
const PREVIEW_PAGE_SIZES = [25, 50, 100, 200];

const FILTER_LABELS = {
  create: 'rows to create',
  update: 'rows to update',
  error: 'rows that cannot be imported',
};

const ACTION_STYLES = {
  create: 'bg-brand-100 text-brand-700',
  update: 'bg-blue-100 text-blue-700',
  error: 'bg-red-100 text-red-700',
};

const STAT_TONES = {
  slate: 'border-admin-border bg-admin-dark text-slate-700',
  green: 'border-brand-200 bg-brand-50 text-brand-800',
  blue: 'border-blue-200 bg-blue-50 text-blue-800',
  red: 'border-red-200 bg-red-50 text-red-800',
};

function Stat({ label, value, tone = 'slate', onClick, active, hint }) {
  const base = 'rounded-lg border px-3 py-2 text-left ' + STAT_TONES[tone];
  if (!onClick) {
    return (
      <div className={base}>
        <p className="text-lg font-semibold leading-tight">{value}</p>
        <p className="text-xs">{label}</p>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={hint}
      className={base + ' transition-shadow hover:shadow-md focus:outline-none ' + (active ? 'ring-2 ring-admin-accent ring-offset-1' : '')}
    >
      <p className="text-lg font-semibold leading-tight">{value}</p>
      <p className="text-xs">
        {label}
        <span className="ml-1 opacity-60">{active ? '- showing' : ''}</span>
      </p>
    </button>
  );
}

/**
 * Import Repair Services through a review-first workflow:
 * choose a file -> review every create/update/error -> apply the approved plan.
 *
 * The plan always compares against the full service list, rather than the filtered
 * table behind the modal. That makes a filtered export/import round trip safe.
 */
export default function RepairServicesImportModal({
  categories,
  mainCategories,
  onClose,
  onImported,
}) {
  const [step, setStep] = useState('pick');
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState(null);
  const [rowFilter, setRowFilter] = useState(null);
  const [previewPage, setPreviewPage] = useState(0);
  const [previewSize, setPreviewSize] = useState(50);
  const [failPage, setFailPage] = useState(0);
  const [failSize, setFailSize] = useState(50);
  const cancelRef = useRef(false);

  const templateLists = () => {
    const categoryNameById = new Map((categories || []).map((category) => [category.id, category.name]));
    return {
      categories: (categories || []).map((category) => category.name),
      mainCategories: (mainCategories || []).map((category) => ({
        name: category.name,
        category: categoryNameById.get(category.deviceCategoryId) || '',
      })),
    };
  };

  const buildPlan = (parsedFile) => {
    setBusy(true);
    return masterApi
      .get('/master/repair-services')
      .then((services) => {
        const next = planRepairServicesImport({
          parsed: parsedFile,
          services: Array.isArray(services) ? services : services?.content || [],
          categories,
          mainCategories,
        });
        setPlan(next);
        setStep('review');
      })
      .catch((requestError) => {
        notifyError(
          requestError.body?.message ||
          requestError.message ||
          'Could not read the current Repair Services list to compare against.',
        );
      })
      .finally(() => setBusy(false));
  };

  const handleFile = async (nextFile) => {
    if (!nextFile) return;
    setFile(nextFile);
    setBusy(true);
    try {
      const parsedFile = await parseRepairServicesFile(nextFile);
      if (!parsedFile.rows.length) {
        notifyError('That sheet has no data rows below the header.');
        setBusy(false);
        return;
      }
      setParsed(parsedFile);
      setBusy(false);
      await buildPlan(parsedFile);
    } catch (parseError) {
      notifyError(parseError.message || 'Could not read that file.');
      setBusy(false);
    }
  };

  const applyPlan = async () => {
    if (!plan) return;
    cancelRef.current = false;
    const items = plan.items.filter((item) => item.action !== 'error');
    const failures = [...plan.items.filter((item) => item.action === 'error')];
    let created = 0;
    let updated = 0;

    setStep('running');
    setProgress({ done: 0, total: items.length });
    await mapPool(items, WRITE_CONCURRENCY, async (item) => {
      if (cancelRef.current) return;
      try {
        if (item.action === 'create') {
          await masterApi.post('/master/repair-services', item.payload);
          created += 1;
        } else {
          await masterApi.put('/master/repair-services/' + item.existingId, item.payload);
          updated += 1;
        }
      } catch (requestError) {
        failures.push({
          ...item,
          error: requestError.body?.message || requestError.message || 'Request failed',
        });
      } finally {
        setProgress((current) => ({ ...current, done: current.done + 1 }));
      }
    });

    setResult({ created, updated, failures, cancelled: cancelRef.current });
    setStep('done');
    if (created || updated) onImported?.();
  };

  const close = () => {
    cancelRef.current = true;
    onClose?.();
  };

  const counts = plan?.counts;
  const applyCount = counts ? counts.create + counts.update : 0;
  const filteredRows = useMemo(() => {
    const rows = plan?.items || [];
    return rowFilter ? rows.filter((item) => item.action === rowFilter) : rows;
  }, [plan, rowFilter]);
  const previewBounds = pageBounds(filteredRows.length, previewPage, previewSize);
  const previewRows = filteredRows.slice(previewBounds.start, previewBounds.start + previewSize);
  const failures = result?.failures || [];
  const failBounds = pageBounds(failures.length, failPage, failSize);
  const failRows = failures.slice(failBounds.start, failBounds.start + failSize);

  useEffect(() => {
    setPreviewPage(0);
  }, [rowFilter, previewSize]);
  useEffect(() => {
    setPreviewPage(0);
    setRowFilter(null);
  }, [plan]);
  useEffect(() => {
    setFailPage(0);
  }, [failSize, result]);

  const toggleFilter = (key) => {
    setRowFilter((current) => (current === key ? null : key));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90dvh] w-full max-w-4xl flex-col rounded-xl border border-admin-border bg-admin-card shadow-xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-admin-border px-4 py-4 sm:px-6">
          <h2 className="flex items-center gap-2 text-lg font-medium text-slate-900">
            <FileSpreadsheet size={18} className="text-brand-600" />
            Import Repair Services from Excel
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="text-2xl leading-none text-slate-400 hover:text-slate-700"
          >
            ×
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
          {step === 'pick' && (
            <>
              <label
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  handleFile(event.dataTransfer.files?.[0]);
                }}
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-admin-border bg-admin-dark px-6 py-10 text-center hover:border-admin-accent"
              >
                <Upload size={26} className="text-slate-400" />
                <span className="text-sm font-medium text-slate-800">
                  {busy ? 'Reading...' : 'Drop an .xlsx file here, or click to choose one'}
                </span>
                <span className="text-xs text-admin-muted">.xlsx, .xls and .csv are all accepted</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(event) => handleFile(event.target.files?.[0])}
                />
              </label>
              <div className="space-y-2 rounded-lg border border-admin-border bg-admin-dark px-4 py-3 text-sm text-slate-700">
                <p className="font-medium text-slate-900">How rows are matched</p>
                <ul className="list-disc space-y-1 pl-5 text-xs text-admin-muted">
                  <li>A row with an <span className="font-medium text-slate-700">ID</span> updates that repair service. The empty format has no ID column, so every row in it is new.</li>
                  <li>Without an ID, a row matching an existing <span className="font-medium text-slate-700">Category + Main Category + Issue</span> updates it.</li>
                  <li>Anything that matches nothing is created as a new repair service.</li>
                  <li>A blank Description or Icon URL cell clears that field. Delete the whole column to leave it untouched.</li>
                </ul>
                <button
                  type="button"
                  onClick={() => {
                    exportRepairServicesTemplateWorkbook(templateLists()).catch((exportError) => {
                      notifyError(exportError.message || 'Could not build the empty format.');
                    });
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-admin-accent hover:underline"
                >
                  <Download size={14} />
                  Download the empty format
                </button>
              </div>
            </>
          )}

          {step === 'review' && plan && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-700">
                  <span className="break-all font-medium text-slate-900">{file?.name}</span>
                  <span className="text-admin-muted"> · sheet &quot;{parsed?.sheetName}&quot; · {plan.items.length} data rows</span>
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setStep('pick');
                    setPlan(null);
                    setParsed(null);
                    setFile(null);
                  }}
                  className="text-xs font-medium text-admin-accent hover:underline"
                >
                  Choose a different file
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Stat
                  label="To create"
                  value={counts.create}
                  tone={counts.create ? 'green' : 'slate'}
                  active={rowFilter === 'create'}
                  hint="Show only the rows that will be created"
                  onClick={counts.create ? () => toggleFilter('create') : undefined}
                />
                <Stat
                  label="To update"
                  value={counts.update}
                  tone={counts.update ? 'blue' : 'slate'}
                  active={rowFilter === 'update'}
                  hint="Show only the rows that will be updated"
                  onClick={counts.update ? () => toggleFilter('update') : undefined}
                />
                <Stat
                  label="Cannot import"
                  value={counts.error}
                  tone={counts.error ? 'red' : 'slate'}
                  active={rowFilter === 'error'}
                  hint="Show only invalid rows and their reason"
                  onClick={counts.error ? () => toggleFilter('error') : undefined}
                />
              </div>

              {(counts.clearsDescription > 0 || counts.clearsIcon > 0) && (
                <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span>
                    {counts.clearsDescription > 0 && (
                      <span>
                        {counts.clearsDescription} {counts.clearsDescription === 1 ? 'issue has' : 'issues have'} a description today but a blank Description cell, so importing will clear {counts.clearsDescription === 1 ? 'it' : 'them'}.
                      </span>
                    )}
                    {counts.clearsDescription > 0 && counts.clearsIcon > 0 && ' '}
                    {counts.clearsIcon > 0 && (
                      <span>
                        {counts.clearsIcon} {counts.clearsIcon === 1 ? 'issue has' : 'issues have'} an Icon URL today but a blank Icon URL cell, so importing will clear {counts.clearsIcon === 1 ? 'it' : 'them'}.
                      </span>
                    )}
                  </span>
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-slate-700">
                  {rowFilter ? (
                    <>Showing <span className="font-medium text-slate-900">{filteredRows.length}</span> {FILTER_LABELS[rowFilter]} of {plan.items.length} rows</>
                  ) : (
                    <>All <span className="font-medium text-slate-900">{plan.items.length}</span> rows</>
                  )}
                </p>
                {rowFilter && (
                  <button
                    type="button"
                    onClick={() => setRowFilter(null)}
                    className="text-xs font-medium text-admin-accent hover:underline"
                  >
                    Show all rows
                  </button>
                )}
              </div>

              <div className="overflow-x-auto rounded-lg border border-admin-border">
                <table className="w-full text-sm">
                  <thead className="bg-admin-dark text-xs uppercase text-admin-muted">
                    <tr>
                      <th className="w-16 px-3 py-2 text-left font-medium">Row</th>
                      <th className="w-24 px-3 py-2 text-left font-medium">Action</th>
                      <th className="px-3 py-2 text-left font-medium">Repair service / problem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-admin-border">
                    {previewRows.map((item) => (
                      <tr key={item.rowNumber} className={item.action === 'error' ? 'bg-red-50/40' : ''}>
                        <td className="px-3 py-1.5 tabular-nums text-admin-muted">{item.rowNumber}</td>
                        <td className="px-3 py-1.5">
                          <span className={'inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ' + ACTION_STYLES[item.action]}>
                            {item.action}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-slate-700">
                          {item.action === 'error' ? (
                            <span className="text-red-700">{item.error}</span>
                          ) : (
                            <>
                              {item.label}
                              {item.clearsDescription && <span className="ml-2 text-[11px] text-amber-700">clears description</span>}
                              {item.clearsIcon && <span className="ml-2 text-[11px] text-amber-700">clears icon URL</span>}
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <TablePagination
                  total={filteredRows.length}
                  page={previewBounds.safePage}
                  pageSize={previewSize}
                  onPageChange={setPreviewPage}
                  onPageSizeChange={setPreviewSize}
                  pageSizes={PREVIEW_PAGE_SIZES}
                />
              </div>
            </>
          )}

          {step === 'running' && (
            <div className="space-y-3 py-10 text-center">
              <RefreshCw size={28} className="mx-auto animate-spin text-admin-accent" />
              <p className="text-sm font-medium text-slate-900">Saving {progress.done} of {progress.total}...</p>
              <div className="mx-auto h-2 w-2/3 overflow-hidden rounded-full bg-admin-dark">
                <div
                  className="h-full bg-admin-accent transition-[width]"
                  style={{ width: String(progress.total ? (progress.done / progress.total) * 100 : 0) + '%' }}
                />
              </div>
              <p className="text-xs text-admin-muted">Leave this window open until it finishes.</p>
            </div>
          )}

          {step === 'done' && result && (
            <>
              <div className="flex items-center gap-2">
                {result.failures.length === 0 ? (
                  <CheckCircle2 size={20} className="text-brand-600" />
                ) : (
                  <AlertTriangle size={20} className="text-amber-600" />
                )}
                <p className="text-sm font-medium text-slate-900">
                  {result.cancelled ? 'Import stopped early.' : 'Import finished.'}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Stat label="Created" value={result.created} tone={result.created ? 'green' : 'slate'} />
                <Stat label="Updated" value={result.updated} tone={result.updated ? 'blue' : 'slate'} />
                <Stat label="Failed" value={result.failures.length} tone={result.failures.length ? 'red' : 'slate'} />
              </div>
              {result.failures.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-admin-border">
                  <table className="w-full text-sm">
                    <thead className="bg-admin-dark text-xs uppercase text-admin-muted">
                      <tr>
                        <th className="w-16 px-3 py-2 text-left font-medium">Row</th>
                        <th className="px-3 py-2 text-left font-medium">Problem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-admin-border">
                      {failRows.map((failure, index) => (
                        <tr key={String(failure.rowNumber) + '-' + index}>
                          <td className="px-3 py-1.5 tabular-nums text-admin-muted">{failure.rowNumber}</td>
                          <td className="px-3 py-1.5 text-red-700">{failure.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <TablePagination
                    total={failures.length}
                    page={failBounds.safePage}
                    pageSize={failSize}
                    onPageChange={setFailPage}
                    onPageSizeChange={setFailSize}
                    pageSizes={PREVIEW_PAGE_SIZES}
                  />
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-admin-border px-4 py-4 sm:px-6">
          <div>
            {step === 'done' && result?.failures.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  exportRepairServiceErrorReport(result.failures).catch((exportError) => {
                    notifyError(exportError.message || 'Could not build the failed-row report.');
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-admin-border bg-admin-card px-3 py-2 text-sm font-medium text-slate-700 hover:bg-admin-dark"
              >
                <Download size={16} />
                Download failed rows
              </button>
            )}
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
            {step === 'running' ? (
              <button
                type="button"
                onClick={() => {
                  cancelRef.current = true;
                }}
                className="rounded-lg border border-admin-border bg-admin-card px-4 py-2 text-sm font-medium text-slate-700 hover:bg-admin-dark"
              >
                Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={close}
                className="rounded-lg border border-admin-border bg-admin-card px-4 py-2 text-sm font-medium text-slate-700 hover:bg-admin-dark"
              >
                {step === 'done' ? 'Close' : 'Cancel'}
              </button>
            )}
            {step === 'review' && (
              <button
                type="button"
                onClick={applyPlan}
                disabled={busy || !applyCount}
                className="inline-flex items-center gap-1.5 rounded-lg bg-admin-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Plus size={16} />
                {busy ? 'Re-checking...' : 'Import ' + applyCount + ' ' + (applyCount === 1 ? 'row' : 'rows')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
