'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { masterApi } from '@/lib/api';
import { mapPool } from '@/lib/concurrency';
import { pageBounds } from '@/lib/pagination';
import TablePagination from '@/components/TablePagination';
import {
  exportSellFlowErrorReport,
  exportSellFlowTemplateWorkbook,
  parseSellFlowFile,
  planSellFlowImport,
} from '@/lib/sellFlowExcel';
import { notifyError } from '@/lib/toast';

const WRITE_CONCURRENCY = 4;
const PREVIEW_PAGE_SIZES = [25, 50, 100, 200];

const COPY = {
  screeningQuestions: {
    title: 'Import screening questions from Excel',
    noun: 'question',
    match: 'Rows match by ID first, then by Category + Flow + Question.',
  },
  conditionCategories: {
    title: 'Import condition categories from Excel',
    noun: 'condition category',
    match: 'Rows match by Condition Category ID first, then Group Code, then Category + Flow + Condition Category.',
  },
  conditionGroups: {
    title: 'Import condition groups from Excel',
    noun: 'condition group',
    match: 'Groups match by Group ID, then Group Code, then Category + Flow + Condition Category. Options match by Option ID or group + label.',
  },
  functionalIssues: {
    title: 'Import functional issues from Excel',
    noun: 'functional issue',
    match: 'Rows match by ID first, then by Category + Issue.',
  },
  deviceConfiguration: {
    title: 'Import device configuration from Excel',
    noun: 'configuration field',
    match: 'Rows match by ID first, then by Category + Field.',
  },
};

const ACTION_STYLES = {
  create: 'bg-brand-100 text-brand-700',
  update: 'bg-blue-100 text-blue-700',
  error: 'bg-red-100 text-red-700',
};

const asList = (value) => (Array.isArray(value) ? value : value?.content ?? []);

function Stat({ label, value, tone = 'slate', active, onClick, hint }) {
  const tones = {
    slate: 'border-admin-border bg-admin-dark text-slate-700',
    green: 'border-brand-200 bg-brand-50 text-brand-800',
    blue: 'border-blue-200 bg-blue-50 text-blue-800',
    red: 'border-red-200 bg-red-50 text-red-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
  };
  const classes = `rounded-lg border px-3 py-2 text-left ${tones[tone] || tones.slate}`;
  if (!onClick) {
    return <div className={classes}><p className="text-lg font-semibold leading-tight">{value}</p><p className="text-xs">{label}</p></div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={hint}
      className={`${classes} transition-shadow hover:shadow-md ${active ? 'ring-2 ring-admin-accent ring-offset-1' : ''}`}
    >
      <p className="text-lg font-semibold leading-tight">{value}</p>
      <p className="text-xs">{label}{active ? <span className="ml-1 opacity-60">— showing</span> : null}</p>
    </button>
  );
}

function ClearWarning({ count, children }) {
  if (!count) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <AlertTriangle size={17} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

/**
 * A review-first Excel importer shared by the four Sell Flow master-data pages.
 * It fetches a full snapshot before planning so a filtered table cannot cause a
 * duplicate record to be created accidentally.
 */
export default function SellFlowImportModal({ kind, categories = [], onClose, onImported }) {
  const copy = COPY[kind] || COPY.screeningQuestions;
  const [step, setStep] = useState('pick'); // pick | review | running | done
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [rowFilter, setRowFilter] = useState(null);
  const [previewPage, setPreviewPage] = useState(0);
  const [previewSize, setPreviewSize] = useState(50);
  const [failurePage, setFailurePage] = useState(0);
  const [failureSize, setFailureSize] = useState(50);
  const cancelRef = useRef(false);

  const getPlanData = async () => {
    if (kind === 'conditionGroups') {
      const groups = asList(await masterApi.get('/master/condition-groups'));
      const pairs = await Promise.all(groups.map(async (group) => {
        const options = asList(await masterApi.get(`/master/condition-groups/${group.id}/options`));
        return [group.id, options];
      }));
      return { rows: groups, optionsByGroup: Object.fromEntries(pairs) };
    }
    const path = {
      screeningQuestions: '/master/screening-questions',
      conditionCategories: '/master/condition-groups',
      functionalIssues: '/master/functional-issues',
      deviceConfiguration: '/master/config-fields',
    }[kind];
    if (!path) throw new Error('Unsupported import type.');
    return { rows: asList(await masterApi.get(path)), optionsByGroup: {} };
  };

  const buildPlan = async (parsedFile) => {
    setBusy(true);
    try {
      const snapshot = await getPlanData();
      const next = planSellFlowImport({
        kind,
        parsed: parsedFile,
        rows: snapshot.rows,
        categories,
        optionsByGroup: snapshot.optionsByGroup,
      });
      setPlan(next);
      setStep('review');
    } catch (planError) {
      notifyError(planError?.body?.message || planError?.message || 'Could not read the current master-data records to compare against.');
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (nextFile) => {
    if (!nextFile) return;
    setFile(nextFile);
    setBusy(true);
    try {
      const parsedFile = await parseSellFlowFile(kind, nextFile);
      if (!parsedFile.rows.length) {
        notifyError('That sheet has no data rows below the header.');
        return;
      }
      setParsed(parsedFile);
      await buildPlan(parsedFile);
    } catch (parseError) {
      notifyError(parseError?.message || 'Could not read that file.');
    } finally {
      setBusy(false);
    }
  };

  const itemRows = useMemo(() => {
    if (Array.isArray(plan?.items)) return plan.items;
    return [...(plan?.groupItems || []), ...(plan?.optionItems || [])];
  }, [plan]);

  const applyScalarPlan = async (items, failures) => {
    const path = {
      screeningQuestions: '/master/screening-questions',
      conditionCategories: '/master/condition-groups',
      functionalIssues: '/master/functional-issues',
      deviceConfiguration: '/master/config-fields',
    }[kind];
    let created = 0;
    let updated = 0;
    await mapPool(items, WRITE_CONCURRENCY, async (item) => {
      if (cancelRef.current) return;
      try {
        if (item.action === 'create') {
          await masterApi.post(path, item.payload);
          created += 1;
        } else {
          await masterApi.put(`${path}/${item.existingId}`, item.payload);
          updated += 1;
        }
      } catch (writeError) {
        failures.push({ ...item, error: writeError?.body?.message || writeError?.message || 'Request failed' });
      } finally {
        setProgress((current) => ({ ...current, done: current.done + 1 }));
      }
    });
    return { created, updated };
  };

  const applyConditionPlan = async (failures) => {
    const groupItems = (plan?.groupItems || []).filter((item) => item.action !== 'error');
    const optionItems = (plan?.optionItems || []).filter((item) => item.action !== 'error');
    const groupIds = new Map();
    const failedGroups = new Set();
    let created = 0;
    let updated = 0;

    // A new option cannot be saved until its parent group has an ID. Keep the
    // phases serial: a partial group write must not turn into orphaned choices.
    for (const item of groupItems) {
      if (cancelRef.current) break;
      try {
        let saved;
        if (item.action === 'create') {
          saved = await masterApi.post('/master/condition-groups', item.payload);
          created += 1;
        } else {
          saved = await masterApi.put(`/master/condition-groups/${item.existingId}`, item.payload);
          updated += 1;
        }
        const id = saved?.id || item.existingId;
        if (!id) throw new Error('The condition-group API did not return an ID.');
        groupIds.set(item.groupKey, id);
      } catch (writeError) {
        failedGroups.add(item.groupKey);
        failures.push({ ...item, error: writeError?.body?.message || writeError?.message || 'Could not save condition group' });
      } finally {
        setProgress((current) => ({ ...current, done: current.done + 1 }));
      }
    }

    for (const item of optionItems) {
      if (cancelRef.current) break;
      const groupId = groupIds.get(item.groupKey) || item.groupExistingId;
      if (!groupId || failedGroups.has(item.groupKey)) {
        failures.push({ ...item, error: 'Skipped because its condition group could not be saved.' });
        setProgress((current) => ({ ...current, done: current.done + 1 }));
        continue;
      }
      try {
        const payload = { ...item.payload, groupId };
        if (item.action === 'create') {
          await masterApi.post('/master/condition-options', payload);
          created += 1;
        } else {
          await masterApi.put(`/master/condition-options/${item.existingId}`, payload);
          updated += 1;
        }
      } catch (writeError) {
        failures.push({ ...item, error: writeError?.body?.message || writeError?.message || 'Could not save condition option' });
      } finally {
        setProgress((current) => ({ ...current, done: current.done + 1 }));
      }
    }
    return { created, updated };
  };

  const applyPlan = async () => {
    if (!plan) return;
    cancelRef.current = false;
    const validItems = itemRows.filter((item) => item.action !== 'error');
    const failures = [...itemRows.filter((item) => item.action === 'error')];
    setStep('running');
    setProgress({ done: 0, total: validItems.length });

    const resultCounts = kind === 'conditionGroups'
      ? await applyConditionPlan(failures)
      : await applyScalarPlan(validItems, failures);
    setResult({ ...resultCounts, failures, cancelled: cancelRef.current });
    setStep('done');
    onImported?.();
  };

  const close = () => {
    cancelRef.current = true;
    onClose?.();
  };

  const counts = plan?.counts || {};
  const applyCount = itemRows.filter((item) => item.action !== 'error').length;
  const displayedRows = rowFilter ? itemRows.filter((item) => item.action === rowFilter) : itemRows;
  const previewBounds = pageBounds(displayedRows.length, previewPage, previewSize);
  const previewRows = displayedRows.slice(previewBounds.start, previewBounds.start + previewSize);
  const failures = result?.failures || [];
  const failureBounds = pageBounds(failures.length, failurePage, failureSize);
  const failureRows = failures.slice(failureBounds.start, failureBounds.start + failureSize);

  useEffect(() => { setPreviewPage(0); }, [rowFilter, previewSize, plan]);
  useEffect(() => { setFailurePage(0); }, [failureSize, result]);

  const toggleFilter = (action) => setRowFilter((current) => (current === action ? null : action));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90dvh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-admin-border bg-admin-card shadow-xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-admin-border px-4 py-4 sm:px-6">
          <h2 className="flex items-center gap-2 text-lg font-medium text-slate-900"><FileSpreadsheet size={18} className="text-brand-600" />{copy.title}</h2>
          <button type="button" onClick={close} aria-label="Close" className="text-2xl leading-none text-slate-400 hover:text-slate-700">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-4">
          {step === 'pick' && (
            <>
              <label
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => { event.preventDefault(); handleFile(event.dataTransfer.files?.[0]); }}
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-admin-border bg-admin-dark px-6 py-10 text-center hover:border-admin-accent"
              >
                <Upload size={26} className="text-slate-400" />
                <span className="text-sm font-medium text-slate-800">{busy ? 'Reading…' : 'Drop an .xlsx file here, or click to choose one'}</span>
                <span className="text-xs text-admin-muted">.xlsx, .xls and .csv are all accepted</span>
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => handleFile(event.target.files?.[0])} />
              </label>
              <div className="space-y-2 rounded-lg border border-admin-border bg-admin-dark px-4 py-3 text-sm text-slate-700">
                <p className="font-medium text-slate-900">How rows are matched</p>
                <ul className="list-disc space-y-1 pl-5 text-xs text-admin-muted">
                  <li>{copy.match}</li>
                  <li>A matching row updates; anything that matches nothing is created.</li>
                  <li>Categories are never created by import. Add them in Master Data first.</li>
                  <li>Nothing is changed until you review the plan and choose Import.</li>
                </ul>
                <button
                  type="button"
                  onClick={() => exportSellFlowTemplateWorkbook({ kind, categories }).catch((templateError) => notifyError(templateError?.message || 'Could not build the empty format.'))}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-admin-accent hover:underline"
                >
                  <Download size={14} /> Download the empty format
                </button>
              </div>
            </>
          )}

          {step === 'review' && plan && (
            <>
              <div className="flex items-center justify-between gap-3 text-sm">
                <p className="min-w-0 truncate text-admin-muted"><span className="font-medium text-slate-800">{file?.name}</span> · sheet “{parsed?.sheetName}” · {parsed?.rows.length || 0} data rows</p>
                <button type="button" onClick={() => { setStep('pick'); setPlan(null); }} className="shrink-0 text-xs font-medium text-admin-accent hover:underline">Choose a different file</button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="To create" value={counts.create || 0} tone="green" active={rowFilter === 'create'} onClick={() => toggleFilter('create')} hint="Show rows that will create records" />
                <Stat label="To update" value={counts.update || 0} tone="blue" active={rowFilter === 'update'} onClick={() => toggleFilter('update')} hint="Show rows that will update records" />
                <Stat label="Cannot import" value={counts.error || 0} tone="red" active={rowFilter === 'error'} onClick={() => toggleFilter('error')} hint="Show rows that need fixing" />
                <Stat label="New options" value={counts.optionCreate || 0} tone="slate" />
              </div>
              <ClearWarning count={counts.clearsDescription}><strong>{counts.clearsDescription}</strong> existing description{counts.clearsDescription === 1 ? '' : 's'} will be cleared by blank Description cells.</ClearWarning>
              <ClearWarning count={counts.clearsIcon}><strong>{counts.clearsIcon}</strong> existing icon URL{counts.clearsIcon === 1 ? '' : 's'} will be cleared by blank Icon URL cells.</ClearWarning>
              <ClearWarning count={counts.clearsOptions}><strong>{counts.clearsOptions}</strong> configuration field{counts.clearsOptions === 1 ? '' : 's'} will have all options removed by blank Options cells.</ClearWarning>
              <ClearWarning count={counts.replacesOptions}><strong>{counts.replacesOptions}</strong> configuration field{counts.replacesOptions === 1 ? '' : 's'} will replace its option list, which regenerates those option IDs.</ClearWarning>
              <ClearWarning count={counts.migratesCompositeOptions}><strong>{counts.migratesCompositeOptions}</strong> legacy condition option{counts.migratesCompositeOptions === 1 ? '' : 's'} will be split: the original record becomes the first label and new records are created for the remaining labels.</ClearWarning>
              {kind === 'conditionGroups' && (
                <p className="rounded-lg border border-admin-border bg-admin-dark px-3 py-2 text-xs text-admin-muted">Condition categories are saved first; their options are saved only after the parent group succeeds. Import adds or updates listed options—it never deletes options that are absent from the sheet.</p>
              )}
              <div className="overflow-hidden rounded-lg border border-admin-border">
                <div className="max-h-[38vh] overflow-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="sticky top-0 bg-admin-dark text-xs uppercase text-admin-muted"><tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Action</th><th className="px-3 py-2">Record / problem</th></tr></thead>
                    <tbody className="divide-y divide-admin-border">
                      {previewRows.map((item, index) => (
                        <tr key={`${item.rowNumber}-${item.kind || ''}-${item.label || index}`}>
                          <td className="whitespace-nowrap px-3 py-2 text-admin-muted">{item.rowNumber ?? '—'}</td>
                          <td className="px-3 py-2"><span className={`rounded px-2 py-1 text-xs font-medium ${ACTION_STYLES[item.action] || ACTION_STYLES.error}`}>{item.action}</span></td>
                          <td className={item.action === 'error' ? 'px-3 py-2 text-red-700' : 'px-3 py-2 text-slate-700'}>{item.error || item.label}</td>
                        </tr>
                      ))}
                      {!previewRows.length && <tr><td colSpan="3" className="px-3 py-6 text-center text-admin-muted">No rows in this view.</td></tr>}
                    </tbody>
                  </table>
                </div>
                <TablePagination total={displayedRows.length} page={previewBounds.safePage} pageSize={previewSize} onPageChange={setPreviewPage} onPageSizeChange={setPreviewSize} pageSizes={PREVIEW_PAGE_SIZES} />
              </div>
            </>
          )}

          {step === 'running' && (
            <div className="space-y-3 rounded-lg border border-admin-border bg-admin-dark px-4 py-6 text-center">
              <RefreshCw size={24} className="mx-auto animate-spin text-admin-accent" />
              <p className="font-medium text-slate-800">Importing {progress.done} of {progress.total} records…</p>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-admin-accent transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} /></div>
              <p className="text-xs text-admin-muted">Keep this window open until the import finishes.</p>
            </div>
          )}

          {step === 'done' && (
            <>
              <div className="flex items-start gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-brand-900"><CheckCircle2 size={20} className="mt-0.5 shrink-0" /><div><p className="font-medium">Import finished</p><p className="text-sm">Created {result?.created || 0}; updated {result?.updated || 0}{result?.cancelled ? ' before cancellation' : ''}.</p></div></div>
              {failures.length > 0 && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-red-700">{failures.length} row{failures.length === 1 ? '' : 's'} could not be imported.</p><button type="button" onClick={() => exportSellFlowErrorReport({ kind, failures }).catch((reportError) => notifyError(reportError?.message || 'Could not build the error report.'))} className="inline-flex items-center gap-1.5 text-sm font-medium text-admin-accent hover:underline"><Download size={15} /> Download error report</button></div>
                  <div className="overflow-hidden rounded-lg border border-red-200"><div className="max-h-64 overflow-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="sticky top-0 bg-red-50 text-xs uppercase text-red-700"><tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Record</th><th className="px-3 py-2">Problem</th></tr></thead><tbody className="divide-y divide-red-100">{failureRows.map((item, index) => <tr key={`${item.rowNumber}-${index}`}><td className="px-3 py-2 text-admin-muted">{item.rowNumber ?? '—'}</td><td className="px-3 py-2 text-slate-700">{item.label || copy.noun}</td><td className="px-3 py-2 text-red-700">{item.error}</td></tr>)}</tbody></table></div><TablePagination total={failures.length} page={failureBounds.safePage} pageSize={failureSize} onPageChange={setFailurePage} onPageSizeChange={setFailureSize} pageSizes={PREVIEW_PAGE_SIZES} /></div>
                </>
              )}
            </>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-admin-border px-4 py-4 sm:px-6">
          {step === 'review' && <button type="button" onClick={close} className="rounded-lg border border-admin-border px-4 py-2 text-sm text-slate-700 hover:bg-admin-dark">Cancel</button>}
          {step === 'review' && <button type="button" disabled={!applyCount || busy} onClick={applyPlan} className="rounded-lg bg-admin-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">Import {applyCount} {applyCount === 1 ? 'record' : 'records'}</button>}
          {step === 'done' && <button type="button" onClick={close} className="rounded-lg bg-admin-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Done</button>}
        </div>
      </div>
    </div>
  );
}
