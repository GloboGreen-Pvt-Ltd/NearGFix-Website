'use client';

/**
 * /shop-home/services/pickups/?tab=<all|requested|accepted|ready>
 *
 * Doorstep pickups (repair bookings with serviceMode === 'PICKUP'), built
 * like the Partner app's Pickup list — its Jobs screen opened with the pickup
 * tile set (bookingScopes.js PICKUP_SCOPE_ORDER): header with search toggle,
 * left rail All · Request · Accepted · Ready, pickup cards (JobsScreen
 * renderPickup) whose tap opens the pickup action sheet; the Ready tile lists
 * repair-ticket cards, as the app's does. Chrome and cards come from
 * components/shop-dashboard/BookingTiles.js (shared with the Bookings page).
 * Opened from the nav, and from the dashboard's Business Overview:
 *   Pickup Queue -> all · Pickup Requests -> requested · Pickup Confirmed -> accepted
 * The selected tab drives the header ("ACCEPTED PICKUPS / 3 Accepted
 * Pickups"), the list and the empty state; it's kept in the URL.
 *
 * Rows, tab membership and counts come from lib/orderStages.js — the same
 * functions the dashboard cards count with. Data loading is shared with the
 * Bookings page (components/shop-dashboard/OrdersList.js useOrderRows).
 *
 * Filters (header) opens the two filters this page has always had: the display
 * status chips (Created reads as "Pending"; Pickup + In Progress read as "In
 * Progress" — display-only regrouping of friendlyBookingStatus) and the
 * pickup-date picker. src/lib/pickupWorkflow.js's accept/start/complete
 * calls stay unused here: those endpoints aren't confirmed to exist, so the
 * app sheet's Accepted / pickup-person Assign tiles aren't offered.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCheck, Truck } from 'lucide-react';

import FilterChips from '@/components/shop-dashboard/FilterChips';
import ErrorBanner from '@/components/shop-dashboard/ErrorBanner';
import AssignTechnicianModal from '@/components/shop-dashboard/AssignTechnicianModal';
import { matchesQuery, useOrderRows, withHash } from '@/components/shop-dashboard/OrdersList';
import {
  BookingTile,
  BookingTilesGrid,
  BookingsEmpty,
  BookingsHeader,
  BookingsLoader,
  BookingsSearch,
  BookingsShell,
  PickupActionSheet,
  PickupTile,
  StageRail,
} from '@/components/shop-dashboard/BookingTiles';
import { variantLabel } from '@/lib/deviceImage';
import { PICKUP_TABS, bookingRef, buildOrderRows, countPickups, readQueryParam, writeQueryParam } from '@/lib/orderStages';

const TABS = PICKUP_TABS;
const TAB_KEYS = TABS.map((t) => t.key);

// The app's pickup rail (PICKUP_SCOPE_ORDER): tile labels (chipLabel), icons
// and colours (JobsScreen SCOPE_TONE), on this page's tab keys.
const RAIL = [
  { key: 'all', label: 'All', icon: Truck, tone: '#035C6C' },
  { key: 'requested', label: 'Request', icon: Truck, tone: '#FAA700' },
  { key: 'accepted', label: 'Accepted', icon: ClipboardCheck, tone: '#0788C9' },
  { key: 'ready', label: 'Ready', icon: CheckCircle2, tone: '#609138' },
];

const DISPLAY_FILTERS = ['All', 'Pending', 'In Progress', 'Completed', 'Cancelled'];
function displayBucket(statusLabel) {
  if (statusLabel === 'Created') return 'Pending';
  if (statusLabel === 'Pickup' || statusLabel === 'In Progress') return 'In Progress';
  return statusLabel;
}

export default function PickupsPage() {
  const { bookings, tickets, options, loading, error, reload, mergeTicket } = useOrderRows();
  const [tab, setTab] = useState('all');
  const [filter, setFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [query, setQuery] = useState('');
  // The search field is hidden until the header's Search opens it (as in the app).
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuFor, setMenuFor] = useState(null);
  const [assigning, setAssigning] = useState(null);
  const closeMenu = useCallback(() => setMenuFor(null), []);

  useEffect(() => {
    setTab(readQueryParam('tab', TAB_KEYS));
  }, []);

  function selectTab(key) {
    setTab(key);
    writeQueryParam('tab', key);
  }

  // As in the app, closing the search also clears it.
  const searchShown = searchOpen || query !== '';
  function toggleSearch() {
    if (searchShown) {
      setQuery('');
      setSearchOpen(false);
    } else setSearchOpen(true);
  }

  const rows = useMemo(() => buildOrderRows(bookings, tickets), [bookings, tickets]);
  const counts = useMemo(() => countPickups(rows), [rows]);

  const inTab = useMemo(() => rows.filter((r) => r.isPickup && (tab === 'all' || r.pickupTabs.includes(tab))), [rows, tab]);

  const statusCounts = useMemo(() => {
    const c = { All: inTab.length, Pending: 0, 'In Progress': 0, Completed: 0, Cancelled: 0 };
    inTab.forEach((r) => {
      const k = displayBucket(r.statusLabel);
      c[k] = (c[k] || 0) + 1;
    });
    return c;
  }, [inTab]);

  const filtered = useMemo(
    () =>
      inTab.filter(
        (r) =>
          (filter === 'All' || displayBucket(r.statusLabel) === filter) &&
          (!dateFilter || r.pickupDate === dateFilter) &&
          matchesQuery(r, query),
      ),
    [inTab, filter, dateFilter, query],
  );

  const current = TABS.find((t) => t.key === tab) || TABS[0];
  const filtersActive = filter !== 'All' || dateFilter !== '';
  const narrowed = filtersActive || query.trim() !== '';
  const count = narrowed ? filtered.length : inTab.length;
  // As the app: the full-page loader only before the first rows arrive.
  const firstLoad = loading && rows.length === 0;

  function clearAll() {
    setFilter('All');
    setDateFilter('');
    setQuery('');
  }

  return (
    <BookingsShell
      header={
        <BookingsHeader
          eyebrow={current.eyebrow}
          title={firstLoad ? current.eyebrow : current.title(count)}
          loading={loading}
          onRefresh={reload}
          searchOpen={searchShown}
          onToggleSearch={toggleSearch}
          filtersOpen={filtersOpen}
          filtersActive={filtersActive}
          onToggleFilters={() => setFiltersOpen((v) => !v)}
        />
      }
      search={searchShown ? <BookingsSearch value={query} onChange={setQuery} /> : null}
      rail={<StageRail items={RAIL} value={tab} onChange={selectTab} counts={counts} loading={firstLoad} ariaLabel="Pickup stages" />}
    >
      {filtersOpen ? (
        <div className="mb-3 flex flex-wrap items-end gap-4 rounded-2xl border border-[#E5E7EB] bg-white p-3.5 sm:p-4">
          <div className="min-w-0 flex-1 basis-full sm:basis-0">
            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-widest text-[#6B7280]">Status</p>
            <FilterChips options={DISPLAY_FILTERS} value={filter} onChange={setFilter} counts={statusCounts} />
          </div>
          <label className="flex flex-col gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[#6B7280]">
            Pickup date
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="h-10 rounded-xl border border-[#E5E7EB] bg-white px-3 text-[13.5px] font-semibold normal-case tracking-normal text-[#111111] focus:border-[#035C6C] focus:outline-none"
            />
          </label>
          {filtersActive ? (
            <button
              type="button"
              onClick={() => {
                setFilter('All');
                setDateFilter('');
              }}
              className="h-10 rounded-xl px-3 text-[13.5px] font-bold text-[#035C6C] hover:bg-[#E5F3F5]"
            >
              Clear
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="mb-2.5">
          <ErrorBanner message={error} onRetry={reload} />
        </div>
      ) : null}

      {firstLoad ? (
        <BookingsLoader />
      ) : error ? null : filtered.length === 0 ? (
        narrowed && inTab.length ? (
          <BookingsEmpty
            title="No pickups match"
            text="Try a different search term, status or date."
            action={
              <button
                type="button"
                onClick={clearAll}
                className="rounded-[10px] border-[1.5px] border-[#035C6C] bg-white px-4 py-2 text-[13px] font-extrabold text-[#035C6C] transition hover:bg-[#E5F3F5]"
              >
                Clear search &amp; filters
              </button>
            }
          />
        ) : (
          <BookingsEmpty title={current.emptyTitle} text={current.emptyText} />
        )
      ) : (
        <BookingTilesGrid>
          {/* Ready lists repair tickets, so it gets the job card (as the app's Ready tile). */}
          {filtered.map((r) =>
            tab === 'ready' ? (
              <BookingTile
                key={r.id}
                row={r}
                variant={variantLabel(r, options)}
                onAssign={() => setAssigning(r)}
                reEstimateHref="/shop-home/services/bookings/"
              />
            ) : (
              <PickupTile key={r.id} row={r} onOpenMenu={() => setMenuFor(r)} />
            ),
          )}
        </BookingTilesGrid>
      )}

      <PickupActionSheet
        row={menuFor}
        onClose={closeMenu}
        onAssign={(r) => {
          setMenuFor(null);
          setAssigning(r);
        }}
      />
      <AssignTechnicianModal
        open={Boolean(assigning)}
        ticketId={assigning?.ticketRef}
        currentTechnicianId={assigning?.assignedTechnicianId}
        bookingLabel={assigning ? [withHash(bookingRef(assigning)), assigning.deviceDisplayName || assigning.modelName].filter(Boolean).join(' · ') : ''}
        onClose={() => setAssigning(null)}
        onAssigned={mergeTicket}
      />
    </BookingsShell>
  );
}
