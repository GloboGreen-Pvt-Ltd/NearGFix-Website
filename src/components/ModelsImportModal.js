'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Plus, RefreshCw, Upload } from 'lucide-react';
import { masterApi } from '@/lib/api';
import { mapPool } from '@/lib/concurrency';
import TablePagination from '@/components/TablePagination';
import { pageBounds } from '@/lib/pagination';
import {
  exportErrorReport,
  exportTemplateWorkbook,
  parseModelsFile,
  planModelImport,
  slugify,
} from '@/lib/modelsExcel';
import { notifyError } from '@/lib/toast';

// master-data runs with -Xmx384m on a t3.micro; four writes in flight keeps a
// thousand-row import moving without putting the service back into an OOM.
const WRITE_CONCURRENCY = 4;

// Page sizes for the preview. Capped well below the table default of 1000: these
// rows live inside a modal, and mounting a thousand of them to be scrolled past is
// what the paging is here to avoid.
const PREVIEW_PAGE_SIZES = [25, 50, 100, 200];

// Reads as "Showing 100 rows that cannot be imported of 3142 rows".
const FILTER_LABELS = {
  create: 'rows to create',
  update: 'rows to update',
  error: 'rows that cannot be imported',
  newSeries: 'rows needing a new series',
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
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
};

/**
 * A count tile. With `onClick` it becomes a filter for the row list below — the
 * only practical way to see which 100 of 3142 rows cannot be imported, since they
 * are scattered through the sheet.
 */
function Stat({ label, value, tone = 'slate', onClick, active, hint }) {
  const base = `rounded-lg border px-3 py-2 text-left ${STAT_TONES[tone]}`;
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
      className={`${base} transition-shadow hover:shadow-md focus:outline-none ${
        active ? 'ring-2 ring-admin-accent ring-offset-1' : ''
      }`}
    >
      <p className="text-lg font-semibold leading-tight">{value}</p>
      <p className="text-xs">
        {label}
        <span className="ml-1 opacity-60">{active ? '— showing' : ''}</span>
      </p>
    </button>
  );
}

/**
 * Excel import for the Models catalogue.
 *
 * Three steps, so a bulk write is never a surprise: pick a file → review a plan of
 * exactly what will be created, updated and rejected → apply. The plan is computed
 * from the FULL catalogue (not the filtered table), otherwise importing while the
 * table is filtered to one brand would fail to match — and therefore duplicate —
 * every model outside that filter.
 */
export default function ModelsImportModal({
  categories,
  brands,
  mappings,
  allSeries,
  onSyncPalette,
  onClose,
  onImported,
}) {
  const [step, setStep] = useState('pick'); // pick | review | running | done
  const [file, setFile] = useState(null);
  const [allowCreateSeries, setAllowCreateSeries] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState(null);
  // Which slice of the plan the row list is showing: null = everything.
  const [rowFilter, setRowFilter] = useState(null); // null | create | update | error | newSeries
  const [previewPage, setPreviewPage] = useState(0);
  const [previewSize, setPreviewSize] = useState(50);
  const [failPage, setFailPage] = useState(0);
  const [failSize, setFailSize] = useState(50);
  const cancelRef = useRef(false);

  const buildPlan = (parsedFile, createSeries) => {
    // The catalogue the plan matches against has to be everything, so fetch it here
    // rather than reusing the page's filtered list.
    setBusy(true);
    return masterApi
      .get('/master/models')
      .then((models) => {
        const next = planModelImport({
          parsed: parsedFile,
          models: Array.isArray(models) ? models : [],
          categories,
          brands,
          mappings,
          series: allSeries,
          allowCreateSeries: createSeries,
        });
        setPlan(next);
        setStep('review');
      })
      .catch((e) => notifyError(e.body?.message || e.message || 'Could not read the current model list to compare against.'))
      .finally(() => setBusy(false));
  };

  const handleFile = async (f) => {
    if (!f) return;
    setFile(f);
    setBusy(true);
    try {
      const p = await parseModelsFile(f);
      if (!p.rows.length) {
        notifyError('That sheet has no data rows below the header.');
        setBusy(false);
        return;
      }
      setParsed(p);
      setBusy(false);
      await buildPlan(p, allowCreateSeries);
    } catch (e) {
      notifyError(e.message || 'Could not read that file.');
      setBusy(false);
    }
  };

  // Re-planning is cheap and keeps the preview honest: flipping the checkbox turns
  // "series does not exist" errors into creates and vice versa.
  const toggleCreateSeries = async (checked) => {
    setAllowCreateSeries(checked);
    if (parsed) await buildPlan(parsed, checked);
  };

  const applyPlan = async () => {
    if (!plan) return;
    cancelRef.current = false;
    const items = plan.items.filter((i) => i.action !== 'error');
    setStep('running');
    setProgress({ done: 0, total: items.length });

    const failures = [...plan.items.filter((i) => i.action === 'error')];
    let created = 0;
    let updated = 0;
    let seriesCreated = 0;

    // 1. Missing series first — the model rows beneath them need real ids. Serial:
    // there are only a handful, and a failure here should stop before it cascades
    // into hundreds of orphaned models.
    const seriesIdByKey = new Map();
    for (const s of plan.newSeries) {
      if (cancelRef.current) break;
      try {
        const row = await masterApi.post('/master/series', {
          categoryBrandId: s.categoryBrandId,
          name: s.name,
          slug: slugify(s.name),
        });
        if (row?.id) {
          seriesIdByKey.set(s.key, row.id);
          seriesCreated += 1;
        }
      } catch (e) {
        // Rows under a series that could not be created are reported below rather
        // than being written without one, which would silently misfile them.
        failures.push({
          rowNumber: '—',
          values: { seriesName: s.name, brandName: s.brandName, categoryName: s.categoryName },
          error: `Could not create series "${s.name}": ${e.body?.message || e.message}`,
        });
      }
    }

    // 2. The models themselves.
    await mapPool(items, WRITE_CONCURRENCY, async (item) => {
      if (cancelRef.current) return;
      const payload = { ...item.payload };
      if (item.pendingSeriesKey) {
        const sid = seriesIdByKey.get(item.pendingSeriesKey);
        if (!sid) {
          failures.push({ ...item, error: `Skipped — its series "${item.values.seriesName}" could not be created.` });
          setProgress((p) => ({ ...p, done: p.done + 1 }));
          return;
        }
        payload.seriesId = sid;
      }
      try {
        if (item.action === 'create') {
          await masterApi.post('/master/models', payload);
          created += 1;
        } else {
          await masterApi.put(`/master/models/${item.existingId}`, payload);
          updated += 1;
        }
      } catch (e) {
        failures.push({ ...item, error: e.body?.message || e.message || 'Request failed' });
      } finally {
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    });

    // 3. Register any colour / RAM / storage value the sheet introduced, so swatches
    // resolve and the mobile pickers can map a label back to its option row —
    // exactly what saving one model through the edit form does.
    try {
      const colors = new Set();
      const specs = new Set();
      for (const i of items) {
        (i.payload.colors || []).forEach((c) => colors.add(c));
        (i.payload.ramStorage || []).forEach((s) => specs.add(s));
      }
      await onSyncPalette?.([...colors], [...specs]);
    } catch { /* the models are already saved; a palette hiccup must not read as a failed import */ }

    setResult({ created, updated, seriesCreated, failures, cancelled: cancelRef.current });
    setStep('done');
    onImported?.();
  };

  const close = () => {
    cancelRef.current = true;
    onClose?.();
  };

  const counts = plan?.counts;
  const applyCount = counts ? counts.create + counts.update : 0;

  const filteredRows = useMemo(() => {
    const items = plan?.items || [];
    if (!rowFilter) return items;
    if (rowFilter === 'newSeries') return items.filter((i) => i.pendingSeriesKey);
    return items.filter((i) => i.action === rowFilter);
  }, [plan, rowFilter]);

  const previewBounds = pageBounds(filteredRows.length, previewPage, previewSize);
  const previewRows = filteredRows.slice(previewBounds.start, previewBounds.start + previewSize);

  // Changing the filter or the page size can leave the current page past the end
  // of what is now being shown.
  useEffect(() => { setPreviewPage(0); }, [rowFilter, previewSize]);
  // A re-plan (different file, or the create-series checkbox flipped) invalidates
  // both — the row that was on screen may not even exist any more.
  useEffect(() => { setPreviewPage(0); setRowFilter(null); }, [plan]);

  // Toggle: clicking the tile that is already showing clears the filter.
  const toggleFilter = (key) => setRowFilter((cur) => (cur === key ? null : key));

  const failures = result?.failures || [];
  const failBounds = pageBounds(failures.length, failPage, failSize);
  const failRows = failures.slice(failBounds.start, failBounds.start + failSize);
  useEffect(() => { setFailPage(0); }, [failSize, result]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-4xl flex flex-col max-h-[90dvh] rounded-xl bg-admin-card border border-admin-border shadow-xl">
        <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6 border-b border-admin-border shrink-0">
          <h2 className="text-lg font-medium text-slate-900 flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-brand-600" />
            Import models from Excel
          </h2>
          <button type="button" onClick={close} aria-label="Close" className="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-4">
          {/* ---------- Step 1: pick a file ---------- */}
          {step === 'pick' && (
            <>
              <label
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-admin-border bg-admin-dark px-6 py-10 text-center cursor-pointer hover:border-admin-accent"
              >
                <Upload size={26} className="text-slate-400" />
                <span className="text-sm font-medium text-slate-800">
                  {busy ? 'Reading…' : 'Drop an .xlsx file here, or click to choose one'}
                </span>
                <span className="text-xs text-admin-muted">.xlsx, .xls and .csv are all accepted</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
              </label>
              <div className="rounded-lg border border-admin-border bg-admin-dark px-4 py-3 text-sm text-slate-700 space-y-2">
                <p className="font-medium text-slate-900">How rows are matched</p>
                <ul className="list-disc pl-5 space-y-1 text-xs text-admin-muted">
                  <li>A row with an <span className="text-slate-700 font-medium">ID</span> updates that model. The empty format has no ID column, so every row in it is new.</li>
                  <li>Without an ID, a row matching an existing <span className="text-slate-700 font-medium">Series + Model</span> updates it — or <span className="text-slate-700 font-medium">Brand + Model</span> when the sheet has no Series column.</li>
                  <li>Anything that matches nothing is created as a new model.</li>
                  <li>A blank cell clears that field. Delete the whole column to leave a field untouched.</li>
                </ul>
                <button
                  type="button"
                  onClick={() => exportTemplateWorkbook({
                    categories: categories.map((c) => c.name),
                    brands: brands.map((b) => b.name),
                    series: allSeries.map((x) => x.name),
                  }).catch((e) => notifyError(e))}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-admin-accent hover:underline"
                >
                  <Download size={14} />
                  Download the empty format
                </button>
              </div>
            </>
          )}

          {/* ---------- Step 2: review the plan ---------- */}
          {step === 'review' && plan && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="min-w-0 break-words text-sm text-slate-700">
                  <span className="break-all font-medium text-slate-900">{file?.name}</span>
                  <span className="text-admin-muted"> · sheet “{parsed?.sheetName}” · {plan.items.length} data rows</span>
                </p>
                <button
                  type="button"
                  onClick={() => { setStep('pick'); setPlan(null); setParsed(null); setFile(null); }}
                  className="text-xs font-medium text-admin-accent hover:underline"
                >
                  Choose a different file
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Stat
                  label="To create" value={counts.create} tone={counts.create ? 'green' : 'slate'}
                  active={rowFilter === 'create'} hint="Show only the rows that will be created"
                  onClick={counts.create ? () => toggleFilter('create') : undefined}
                />
                <Stat
                  label="To update" value={counts.update} tone={counts.update ? 'blue' : 'slate'}
                  active={rowFilter === 'update'} hint="Show only the rows that will be updated"
                  onClick={counts.update ? () => toggleFilter('update') : undefined}
                />
                <Stat
                  label="Cannot import" value={counts.error} tone={counts.error ? 'red' : 'slate'}
                  active={rowFilter === 'error'} hint="Show only the rows that cannot be imported, with the reason for each"
                  onClick={counts.error ? () => toggleFilter('error') : undefined}
                />
                <Stat
                  label="New series" value={counts.newSeries} tone={counts.newSeries ? 'amber' : 'slate'}
                  active={rowFilter === 'newSeries'} hint="Show only the rows that need a new series"
                  onClick={counts.newSeries ? () => toggleFilter('newSeries') : undefined}
                />
              </div>

              <label className="flex items-start gap-2 rounded-lg border border-admin-border bg-admin-dark px-3 py-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowCreateSeries}
                  disabled={busy}
                  onChange={(e) => toggleCreateSeries(e.target.checked)}
                  className="mt-0.5"
                />
                <span className="text-sm">
                  <span className="font-medium text-slate-900">Create missing series automatically</span>
                  <span className="block text-xs text-admin-muted">
                    Categories and brands are never created — a typo would put junk in the taxonomy every app reads.
                    Add those on their own pages first.
                  </span>
                </span>
              </label>

              {counts.clearsImage > 0 && (
                <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  {counts.clearsImage} {counts.clearsImage === 1 ? 'model has' : 'models have'} an image today but a blank
                  Image URL cell — importing will clear {counts.clearsImage === 1 ? 'it' : 'them'}.
                </p>
              )}

              {plan.newSeries.length > 0 && allowCreateSeries && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <p className="font-medium">These series will be created first:</p>
                  <p className="text-xs mt-1">
                    {plan.newSeries.map((s) => `${s.brandName} → ${s.name}`).join(' · ')}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 break-words text-sm text-slate-700">
                  {rowFilter
                    ? <>Showing <span className="font-medium text-slate-900">{filteredRows.length}</span> {FILTER_LABELS[rowFilter]} of {plan.items.length} rows</>
                    : <>All <span className="font-medium text-slate-900">{plan.items.length}</span> rows</>}
                </p>
                {rowFilter && (
                  <button type="button" onClick={() => setRowFilter(null)}
                    className="text-xs font-medium text-admin-accent hover:underline">
                    Show all rows
                  </button>
                )}
              </div>

              <div className="rounded-lg border border-admin-border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-admin-dark text-xs uppercase text-admin-muted">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium w-16">Row</th>
                      <th className="px-3 py-2 text-left font-medium w-24">Action</th>
                      <th className="px-3 py-2 text-left font-medium">Model / problem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-admin-border">
                    {previewRows.map((i) => (
                      <tr key={i.rowNumber} className={i.action === 'error' ? 'bg-red-50/40' : ''}>
                        <td className="px-3 py-1.5 text-admin-muted tabular-nums">{i.rowNumber}</td>
                        <td className="px-3 py-1.5">
                          <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${ACTION_STYLES[i.action]}`}>
                            {i.action}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-slate-700">
                          {i.action === 'error'
                            ? <span className="text-red-700">{i.error}</span>
                            : <>{i.label}{i.clearsImage && <span className="ml-2 text-[11px] text-amber-700">clears image</span>}</>}
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

          {/* ---------- Step 3: applying ---------- */}
          {step === 'running' && (
            <div className="py-10 text-center space-y-3">
              <RefreshCw size={28} className="mx-auto animate-spin text-admin-accent" />
              <p className="text-sm font-medium text-slate-900">
                Saving {progress.done} of {progress.total}…
              </p>
              <div className="mx-auto h-2 w-2/3 overflow-hidden rounded-full bg-admin-dark">
                <div
                  className="h-full bg-admin-accent transition-[width]"
                  style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-admin-muted">Leave this window open until it finishes.</p>
            </div>
          )}

          {/* ---------- Step 4: result ---------- */}
          {step === 'done' && result && (
            <>
              <div className="flex items-center gap-2">
                {result.failures.length === 0
                  ? <CheckCircle2 size={20} className="text-brand-600" />
                  : <AlertTriangle size={20} className="text-amber-600" />}
                <p className="text-sm font-medium text-slate-900">
                  {result.cancelled ? 'Import stopped early.' : 'Import finished.'}
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Stat label="Created" value={result.created} tone={result.created ? 'green' : 'slate'} />
                <Stat label="Updated" value={result.updated} tone={result.updated ? 'blue' : 'slate'} />
                <Stat label="New series" value={result.seriesCreated} tone={result.seriesCreated ? 'amber' : 'slate'} />
                <Stat label="Failed" value={result.failures.length} tone={result.failures.length ? 'red' : 'slate'} />
              </div>
              {result.failures.length > 0 && (
                <div className="rounded-lg border border-admin-border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-admin-dark text-xs uppercase text-admin-muted">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium w-16">Row</th>
                        <th className="px-3 py-2 text-left font-medium">Problem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-admin-border">
                      {failRows.map((f, idx) => (
                        <tr key={`${f.rowNumber}-${idx}`}>
                          <td className="px-3 py-1.5 text-admin-muted tabular-nums">{f.rowNumber}</td>
                          <td className="px-3 py-1.5 text-red-700">{f.error}</td>
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

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 border-t border-admin-border shrink-0">
          <div>
            {step === 'done' && result?.failures.length > 0 && (
              <button
                type="button"
                onClick={() => exportErrorReport(result.failures).catch((e) => notifyError(e))}
                className="inline-flex items-center gap-1.5 rounded-lg bg-admin-card border border-admin-border px-3 py-2 text-sm font-medium text-slate-700 hover:bg-admin-dark"
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
                onClick={() => { cancelRef.current = true; }}
                className="rounded-lg bg-admin-card border border-admin-border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-admin-dark"
              >
                Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={close}
                className="rounded-lg bg-admin-card border border-admin-border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-admin-dark"
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
                {busy ? 'Re-checking…' : `Import ${applyCount} ${applyCount === 1 ? 'row' : 'rows'}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
