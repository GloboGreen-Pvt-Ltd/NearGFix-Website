'use client';

/**
 * BookingsBoard — the booking list behind two pages:
 *   /shop-home/services/bookings/?stage=<all|active|reestimated|ready|invoice|cancelled|returned|delivered>
 *   /shop-home/services/invoice/  (fixedStage="invoice": invoiced
 *     bookings only, a single Invoice tile, each with an Invoice button —
 *     the Bookings page cards have no invoice button)
 *
 * All repair/service bookings, built like the Partner app's Jobs screen
 * (header, search toggle, left scope rail, job tiles — see
 * components/shop-dashboard/BookingTiles.js). Opened from the nav, and from
 * the dashboard's Business Overview:
 *   Service Orders -> all · Active Jobs -> active · Delivery Requests -> ready
 *   · Delivery Completed -> delivered
 * The selected stage drives the header ("READY FOR DELIVERY / 2 Bookings
 * Ready for Delivery"), the list and the empty state; it's kept in the URL.
 *
 * Rows, stages and counts come from lib/orderStages.js — the same functions
 * the dashboard cards count with, so both always agree. Data loading is
 * shared with the Pickups page (components/shop-dashboard/OrdersList.js).
 * Assign opens AssignTechnicianModal (PATCH /tickets/{id}) once a booking has
 * a repair ticket; History / Receipt / Barcode / Details open the
 * per-booking pages under ./view; ?q= prefills (and opens) the search.
 *
 * Tapping a card (bookings with a repair ticket) opens ServiceStatusSheet.
 * After a save only that booking's ticket is re-read (GET /tickets/{id}) and
 * merged in, so the badge and stage move without reloading the whole list.
 */

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CircleX, Clock, FileText, PackageCheck, Pencil, ReceiptIndianRupee, Undo2 } from 'lucide-react';

import ErrorBanner from '@/components/shop-dashboard/ErrorBanner';
import AssignTechnicianModal from '@/components/shop-dashboard/AssignTechnicianModal';
import ServiceStatusSheet from '@/components/shop-dashboard/ServiceStatusSheet';
import RescheduleModal from '@/components/shop-dashboard/RescheduleModal';
import { matchesQuery, orderBadgeText, useOrderRows, withHash } from '@/components/shop-dashboard/OrdersList';
import {
  BookingTile,
  BookingTilesGrid,
  BookingsEmpty,
  BookingsHeader,
  BookingsLoader,
  BookingsSearch,
  BookingsShell,
  StageRail,
} from '@/components/shop-dashboard/BookingTiles';
import { variantLabel } from '@/lib/deviceImage';
import { BOOKING_STAGE_TABS, bookingRef, buildOrderRows, countByStage, onBookingsList, readQueryParam, writeQueryParam } from '@/lib/orderStages';
import { fetchTicket } from '@/lib/shopDashboard';

/*
 * The app's Jobs rail (bookingScopes.js SCOPE_ORDER), in its order, with its
 * tile labels (chipLabel || label), icons and colours (JobsScreen SCOPE_TONE),
 * each mapped onto this page's stages (lib/orderStages.js bookingStage):
 *   All · Active · Re-Estimated · Ready · Invoice · Cancelled · Returned · Delivered
 * Re-Estimated (ticket QUOTED) has no stage here — it links to the Re-Quote
 * page's Re-Estimated tab, counted the same way. The app's Dispatched tile
 * (DELIVERED_PROCESSING) has no web stage or page — those bookings count
 * under Ready here — so it is left out. Returned is this page's 'returned'
 * stage (ticket CANCELLED, what the card's Return records); Cancelled is the
 * 'cancelled' stage (the booking itself cancelled).
 */
const RAIL = [
  { key: 'all', label: 'All', icon: FileText, tone: '#035C6C' },
  { key: 'active', label: 'Active', icon: Clock, tone: '#0788C9' },
  { key: 'reestimated', label: 'Re-Estimated', icon: Pencil, tone: '#7C3AED' },
  { key: 'ready', label: 'Ready', icon: CheckCircle2, tone: '#609138' },
  { key: 'invoice', label: 'Invoice', icon: ReceiptIndianRupee, tone: '#357D89' },
  { key: 'cancelled', label: 'Cancelled', icon: CircleX, tone: '#F32C26' },
  { key: 'returned', label: 'Returned', icon: Undo2, tone: '#1C3053' },
  { key: 'delivered', label: 'Delivered', icon: PackageCheck, tone: '#035C6C' },
];

// lib/orderStages has no tab copy for 'cancelled' (it's a stage, not a tab there).
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const CANCELLED_TAB = {
  key: 'cancelled',
  eyebrow: 'Cancelled',
  title: (n) => plural(n, 'Cancelled Job', 'Cancelled Jobs'),
  emptyTitle: 'No cancelled jobs',
  emptyText: 'Jobs that were called off will appear here.',
};
// App's RE_ESTIMATED scope: tickets in QUOTED.
const REESTIMATED_TAB = {
  key: 'reestimated',
  eyebrow: 'Re-Estimated',
  title: (n) => plural(n, 'Re-Estimated Job', 'Re-Estimated Jobs'),
  emptyTitle: 'No re-estimated jobs',
  emptyText: 'A job appears here once it has been re-estimated.',
};
const isReEstimated = (r) => r.ticketRef && String(r.ticketStatus || '').toUpperCase() === 'QUOTED';
const TAB_BY_KEY = Object.fromEntries([...BOOKING_STAGE_TABS, CANCELLED_TAB, REESTIMATED_TAB].map((t) => [t.key, t]));
const TABS = RAIL.filter((r) => !r.href).map((r) => TAB_BY_KEY[r.key]);
const STAGE_KEYS = TABS.map((t) => t.key);

// The Invoice page (fixedStage 'invoice'): invoiced bookings only, each
// with an Invoice button (the Bookings page has none). New invoices are raised
// from the Update Service Status sheet's Invoice Generated step. One tile, as
// the app's Home → Invoice list (INVOICE_SCOPE_LIST).
const INVOICE_TABS = [
  { key: 'invoice', eyebrow: 'Invoices', title: (n) => `${n} ${n === 1 ? 'Invoice' : 'Invoices'}`, emptyTitle: 'No invoices yet', emptyText: 'Jobs with an invoice generated will appear here.' },
];
const INVOICE_RAIL = [{ key: 'invoice', label: 'Invoice', icon: ReceiptIndianRupee, tone: '#357D89' }];

export default function BookingsBoard({ fixedStage = null }) {
  const { bookings, tickets, options, loading, error, reload, mergeTicket } = useOrderRows();
  const invoiceMode = fixedStage === 'invoice';
  const [stage, setStage] = useState(invoiceMode ? 'invoice' : fixedStage || 'all');
  const [query, setQuery] = useState('');
  // The search field is hidden until the header's Search opens it (as in the app).
  const [searchOpen, setSearchOpen] = useState(false);
  const [assigning, setAssigning] = useState(null);
  const [updating, setUpdating] = useState(null);
  const [rescheduling, setRescheduling] = useState(null);

  useEffect(() => {
    if (!fixedStage) setStage(readQueryParam('stage', STAGE_KEYS));
    if (invoiceMode) {
      const s = readQueryParam('stage', INVOICE_TABS.map((t) => t.key));
      if (s !== 'all') setStage(s);
    }
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) setQuery(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectStage(key) {
    setStage(key);
    writeQueryParam('stage', key);
  }

  // As in the app, closing the search also clears it.
  const searchShown = searchOpen || query !== '';
  function toggleSearch() {
    if (searchShown) {
      setQuery('');
      setSearchOpen(false);
    } else setSearchOpen(true);
  }

  // Re-read just the updated ticket; if that read fails, reload everything.
  async function refreshTicket(ticketId) {
    try {
      const ticket = await fetchTicket(ticketId);
      if (ticket?.id) mergeTicket(ticket);
      else reload();
    } catch {
      reload();
    }
  }

  // Pickup requests not yet at the shop (no repair ticket) stay on the Pickups
  // page, as in the app's Jobs list — see onBookingsList.
  const rows = useMemo(() => buildOrderRows(bookings, tickets).filter(onBookingsList), [bookings, tickets]);

  // Invoice page: every booking whose ticket has an invoice, whatever its status now.
  const invoiced = useMemo(() => rows.filter((r) => r.hasInvoice || r.stage === 'invoice'), [rows]);
  const railCounts = useMemo(() => {
    if (invoiceMode) return { invoice: invoiced.length };
    const reestimated = rows.filter(isReEstimated).length;
    return { ...countByStage(rows), reestimated };
  }, [invoiceMode, invoiced, rows]);
  const inStage = useMemo(
    () => (invoiceMode ? invoiced : stage === 'all' ? rows : stage === 'reestimated' ? rows.filter(isReEstimated) : rows.filter((r) => r.stage === stage)),
    [invoiceMode, invoiced, rows, stage],
  );

  const filtered = useMemo(() => inStage.filter((r) => matchesQuery(r, query)), [inStage, query]);

  const tab = (invoiceMode ? INVOICE_TABS : TABS).find((t) => t.key === stage) || TABS[0];
  const narrowed = query.trim() !== '';
  const count = narrowed ? filtered.length : inStage.length;
  // As the app: the full-page loader only before the first rows arrive; a
  // refresh keeps the list (the header's refresh icon spins).
  const firstLoad = loading && rows.length === 0;

  return (
    <BookingsShell
      header={
        <BookingsHeader
          eyebrow={tab.eyebrow}
          title={firstLoad ? tab.eyebrow : tab.title(count)}
          loading={loading}
          onRefresh={reload}
          searchOpen={searchShown}
          onToggleSearch={toggleSearch}
        />
      }
      search={searchShown ? <BookingsSearch value={query} onChange={setQuery} /> : null}
      rail={
        fixedStage && !invoiceMode ? null : (
          <StageRail
            items={invoiceMode ? INVOICE_RAIL : RAIL}
            value={stage}
            onChange={selectStage}
            counts={railCounts}
            loading={firstLoad}
            ariaLabel={invoiceMode ? 'Invoices' : 'Booking stages'}
          />
        )
      }
    >
      {error ? (
        <div className="mb-2.5">
          <ErrorBanner message={error} onRetry={reload} />
        </div>
      ) : null}

      {firstLoad ? (
        <BookingsLoader />
      ) : error ? null : filtered.length === 0 ? (
        narrowed && inStage.length ? (
          <BookingsEmpty
            title="No jobs found"
            text="Try a different search term."
            action={
              <button
                type="button"
                onClick={() => setQuery('')}
                className="rounded-[10px] border-[1.5px] border-[#035C6C] bg-white px-4 py-2 text-[13px] font-extrabold text-[#035C6C] transition hover:bg-[#E5F3F5]"
              >
                Clear search
              </button>
            }
          />
        ) : (
          <BookingsEmpty title={tab.emptyTitle} text={tab.emptyText} />
        )
      ) : (
        <BookingTilesGrid>
          {filtered.map((r) => (
            <BookingTile
              key={r.id}
              row={r}
              variant={variantLabel(r, options)}
              onOpenStatus={() => setUpdating(r)}
              invoiceView={invoiceMode}
            />
          ))}
        </BookingTilesGrid>
      )}

      <AssignTechnicianModal
        open={Boolean(assigning)}
        ticketId={assigning?.ticketRef}
        currentTechnicianId={assigning?.assignedTechnicianId}
        bookingLabel={assigning ? [withHash(bookingRef(assigning)), assigning.deviceDisplayName || assigning.modelName].filter(Boolean).join(' · ') : ''}
        onClose={() => setAssigning(null)}
        onAssigned={mergeTicket}
      />
      <RescheduleModal
        open={Boolean(rescheduling)}
        ticketId={rescheduling?.ticketRef}
        bookingLabel={rescheduling ? [withHash(bookingRef(rescheduling)), rescheduling.deviceDisplayName || rescheduling.modelName].filter(Boolean).join(' · ') : ''}
        bookedAt={rescheduling?.createdAt}
        durationHours={rescheduling?.estimatedDurationHours}
        onClose={() => setRescheduling(null)}
        onSaved={(ticket) => ticket?.id && mergeTicket(ticket)}
      />
      {/* Keyed per ticket so a newly opened booking never shows the previous one's steps. */}
      <ServiceStatusSheet
        key={updating?.ticketRef || 'closed'}
        open={Boolean(updating?.ticketRef)}
        ticketId={updating?.ticketRef}
        bookingRef={updating ? withHash(bookingRef(updating)) : ''}
        lifecycleStatus={updating?.ticketStatus}
        statusLabel={updating ? orderBadgeText(updating) : ''}
        onClose={() => setUpdating(null)}
        onUpdated={() => updating?.ticketRef && refreshTicket(updating.ticketRef)}
      />
    </BookingsShell>
  );
}
