'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, FileSpreadsheet, RefreshCw, Upload } from 'lucide-react';
import {
  exportSellFlowTemplateWorkbook,
  exportSellFlowWorkbook,
} from '@/lib/sellFlowExcel';
import { notifyError } from '@/lib/toast';

const COPY = {
  screeningQuestions: {
    listed: 'Listed questions',
    empty: 'Empty format',
    emptyHelp: 'Headers and Category / Flow dropdowns. Fill it in, then Import.',
    prefix: 'ggfix-screening-questions',
  },
  conditionCategories: {
    listed: 'Listed condition categories',
    empty: 'Empty format',
    emptyHelp: 'Headers and Category / Flow dropdowns. Fill it in, then Import.',
    prefix: 'ggfix-condition-categories',
  },
  conditionGroups: {
    listed: 'Listed condition groups',
    empty: 'Empty format',
    emptyHelp: 'Headers and Category / Flow dropdowns. Fill it in, then Import.',
    prefix: 'ggfix-condition-groups',
  },
  functionalIssues: {
    listed: 'Listed functional issues',
    empty: 'Empty format',
    emptyHelp: 'Headers and Category dropdowns. Fill it in, then Import.',
    prefix: 'ggfix-functional-issues',
  },
  deviceConfiguration: {
    listed: 'Listed configuration fields',
    empty: 'Empty format',
    emptyHelp: 'Headers and Category dropdowns. Fill it in, then Import.',
    prefix: 'ggfix-device-configuration',
  },
};

const slugify = (value) => String(value || '')
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

/**
 * The shared action cluster for Sell Flow master-data pages. The page controls
 * filtering and the import modal; this component deliberately only exports the
 * rows the administrator is looking at, like the Models and Repair Services
 * tools do.
 */
export default function SellFlowBulkActions({
  kind,
  categories = [],
  rows = [],
  optionsByGroup,
  filterCategory,
  onRefresh,
  onImport,
}) {
  const copy = COPY[kind] || COPY.screeningQuestions;
  const [exportMenu, setExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!exportMenu) return undefined;
    const onMouseDown = (event) => {
      if (!menuRef.current?.contains(event.target)) setExportMenu(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setExportMenu(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [exportMenu]);

  const filename = () => {
    const category = categories.find((item) => item.id === filterCategory)?.name;
    return [copy.prefix, category && slugify(category), new Date().toISOString().slice(0, 10)]
      .filter(Boolean)
      .join('-');
  };

  const runExport = async (task) => {
    setExportMenu(false);
    setExporting(true);
    try {
      await task();
    } catch (exportError) {
      notifyError(exportError?.message || 'Could not build the Excel file.');
    } finally {
      setExporting(false);
    }
  };

  const refresh = async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="relative flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={refresh}
        disabled={refreshing}
        title="Reload master data"
        className="inline-flex items-center gap-1.5 rounded-lg border border-admin-border bg-admin-card px-3 py-2 text-sm font-medium text-slate-700 hover:bg-admin-dark disabled:opacity-50"
      >
        <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
        Refresh
      </button>
      <div className="sm:relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setExportMenu((open) => !open)}
          disabled={exporting}
          aria-haspopup="menu"
          aria-expanded={exportMenu}
          className="inline-flex items-center gap-1.5 rounded-lg border border-admin-border bg-admin-card px-3 py-2 text-sm font-medium text-slate-700 hover:bg-admin-dark disabled:opacity-50"
        >
          <Download size={16} />
          {exporting ? 'Exporting…' : 'Export'}
          <ChevronDown size={14} className={exportMenu ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </button>
        {exportMenu && (
          <div role="menu" className="absolute left-0 z-30 mt-1 w-72 max-w-[calc(100vw-2rem)] overflow-hidden sm:left-auto sm:right-0 rounded-lg border border-admin-border bg-admin-card shadow-lg">
            <button
              type="button"
              role="menuitem"
              disabled={!rows.length}
              onClick={() => runExport(() => exportSellFlowWorkbook({
                kind,
                rows,
                categories,
                optionsByGroup,
                filename: filename(),
              }))}
              className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-admin-dark disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
            >
              <Download size={16} className="mt-0.5 shrink-0 text-slate-500" />
              <span>
                <span className="block text-sm font-medium text-slate-900">{copy.listed}{rows.length ? ` (${rows.length})` : ''}</span>
                <span className="block text-xs text-admin-muted">
                  {rows.length ? 'The rows selected by the page filters, with their data.' : 'Nothing matches the current filter.'}
                </span>
              </span>
            </button>
            <div className="border-t border-admin-border" />
            <button
              type="button"
              role="menuitem"
              onClick={() => runExport(() => exportSellFlowTemplateWorkbook({ kind, categories }))}
              className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-admin-dark"
            >
              <FileSpreadsheet size={16} className="mt-0.5 shrink-0 text-slate-500" />
              <span>
                <span className="block text-sm font-medium text-slate-900">{copy.empty}</span>
                <span className="block text-xs text-admin-muted">{copy.emptyHelp}</span>
              </span>
            </button>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onImport}
        disabled={!categories.length}
        title="Upload a filled-in Excel file to create or update records in bulk"
        className="inline-flex items-center gap-1.5 rounded-lg border border-admin-border bg-admin-card px-3 py-2 text-sm font-medium text-slate-700 hover:bg-admin-dark disabled:opacity-50"
      >
        <Upload size={16} />
        Import
      </button>
    </div>
  );
}
