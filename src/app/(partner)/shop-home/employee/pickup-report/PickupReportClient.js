'use client';

/**
 * Pickup Report — web port of the Partner App's OwnerEmployeePickupReportScreen.
 *
 * No param lists every repair booking with a pickup person on it;
 * `?employeeId=&name=` lists only that pickup person's bookings. Same
 * buckets, rail, search and tile as the app. No month filter — all pickups
 * are shown (same as the web Job Report).
 *
 * Data: GET {ORDER_BASE}/repair-bookings/shop (fetchShopBookings), device
 * names / images from the master catalog (enrichWithCatalog).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from '@/components/PortalLink';
import { useRouter, useSearchParams } from '@/lib/portalNavigation';
import {
  ArrowLeft, Bike, CalendarClock, ChartColumn, CircleCheck, Clock, MapPin,
  RefreshCw, Search, Truck, WifiOff, X,
} from 'lucide-react';

import { fetchShopBookings } from '@/lib/shopDashboard';
import { enrichWithCatalog, resolveMediaUrl } from '@/lib/deviceImage';

const C = { teal: '#035C6C', blue: '#0788C9', green: '#609138', orange: '#FAA700', red: '#F32C26' };

// Same buckets as the app.
function bucketize(status) {
  const s = (status || '').toUpperCase();
  if (s === 'PICKUP_COMPLETED' || s === 'DELIVERED' || s === 'COMPLETED' || s === 'CLOSED' || s.includes('REPAIR_COMPLETED')) return 'COMPLETED';
  if (
    ['PICKED_UP', 'DEVICE_PICKED_UP', 'REPAIR_ESTIMATE_PROCESSING', 'REACHED_SHOP', 'RECEIVED_AT_SHOP', 'IN_TRANSIT', 'AT_SHOP', 'IN_SERVICE', 'PICKUP_IN_PROGRESS'].includes(s)
    || s.includes('STARTED') || s.includes('IN_PROCESS')
  ) return 'IN_PROGRESS';
  return 'ASSIGNED';
}

const RAIL = [
  { key: 'All', label: 'All', tone: C.teal, Icon: ChartColumn },
  { key: 'ASSIGNED', label: 'Assigned', tone: C.blue, Icon: CalendarClock },
  { key: 'IN_PROGRESS', label: 'In Progress', tone: C.orange, Icon: Truck },
  { key: 'COMPLETED', label: 'Completed', tone: C.green, Icon: CircleCheck },
];

const BUCKET_META = {
  ASSIGNED: { label: 'Assigned', tone: C.blue, step: 'Pickup Scheduled — awaiting collection' },
  IN_PROGRESS: { label: 'In Progress', tone: C.orange, step: 'In Transit — heading to shop' },
  COMPLETED: { label: 'Completed', tone: C.green, step: 'Pickup Completed — delivered to shop' },
};

const formatDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const timeOf = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getHours();
  return `${String(h % 12 || 12).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
const trackingId = (b) => b.bookingNumber || b.trackingId || b.ticketCode || `CSPEN${String(b.id || '').replace(/[^0-9]/g, '').slice(0, 8) || '--'}`;
const addressLine = (b) => b.pickupAddressText || b.pickupAddressLabel || b.address || '—';
const customerLine = (b) => `${b.customerName || '—'}${b.customerMobile ? ` • ${b.customerMobile}` : ''}`;
const personName = (b) => String(b.pickupPersonName || b.assignedPickupPersonName || '').trim() || 'Unassigned';
const deviceLabel = (b) => String(b.deviceDisplayName || b.deviceModelName || b.modelName || '').split(/[·•|]/)[0].trim();
const pickupTime = (b) => new Date(b.pickupDate || b.updatedAt || b.createdAt || 0).getTime();

export default function PickupReportClient() {
  const router = useRouter();
  const params = useSearchParams();
  const employeeId = params.get('employeeId') || params.get('employee') || '';
  const employeeName = params.get('name') || '';
  const allMode = !employeeId && !employeeName;

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await fetchShopBookings();
      const mine = all.filter((b) => (allMode
        ? !!b.assignedPickupPersonId
        : (employeeId && b.assignedPickupPersonId === employeeId) || (employeeName && personName(b) === employeeName)));
      setList(mine);
      setError(false);
      enrichWithCatalog(mine).then(setList).catch(() => {});
    } catch {
      setList([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [allMode, employeeId, employeeName]);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c = { All: list.length, ASSIGNED: 0, IN_PROGRESS: 0, COMPLETED: 0 };
    list.forEach((b) => { c[bucketize(b.status)] += 1; });
    return c;
  }, [list]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...list].sort((a, b) => pickupTime(b) - pickupTime(a))
      .filter((b) => filter === 'All' || bucketize(b.status) === filter)
      .filter((b) => !q || [trackingId(b), b.customerName, b.customerMobile, deviceLabel(b), b.pickupPersonName]
        .some((v) => v && String(v).toLowerCase().includes(q)));
  }, [list, filter, query]);

  const filterLabel = RAIL.find((r) => r.key === filter)?.label || 'All';
  const subtitle = allMode ? 'All pickup persons' : (employeeName || 'Pickup person');

  return (
    <div className="min-h-screen bg-[#F3F4F6]">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-3">
          <button type="button" onClick={() => router.back()} aria-label="Back" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F3F4F6] hover:bg-gray-200">
            <ArrowLeft size={19} />
          </button>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h1 className="truncate text-[17px] font-extrabold text-[#111]">{allMode ? 'Pickup Report' : 'Pickup Record'}</h1>
            <p className="truncate text-[11px] font-bold text-gray-500">{subtitle} · {shown.length} {shown.length === 1 ? 'pickup' : 'pickups'}</p>
          </div>
          <div className="hidden w-80 md:block">
            <SearchInput value={query} onChange={setQuery} allMode={allMode} />
          </div>
          <button
            type="button"
            onClick={() => { if (searchOpen) setQuery(''); setSearchOpen((v) => !v); }}
            aria-label={searchOpen ? 'Close search' : 'Search pickups'}
            className={`flex h-9 w-9 items-center justify-center rounded-full md:hidden ${searchOpen ? 'bg-[#035C6C] text-white' : 'bg-[#E5F3F5] text-[#035C6C]'}`}
          >
            <Search size={16} />
          </button>
          <button
            type="button"
            onClick={() => { if (!loading) load(); }}
            aria-label="Refresh pickups"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E5F3F5] text-[#035C6C]"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        {searchOpen || query ? (
          <div className="px-4 pb-3 md:hidden"><SearchInput value={query} onChange={setQuery} allMode={allMode} autoFocus /></div>
        ) : null}
      </header>

      <div className="mx-auto flex max-w-[1440px]">
        <nav className="sticky top-[61px] h-[calc(100vh-61px)] w-[78px] shrink-0 overflow-y-auto border-r border-gray-200 bg-white px-1.5 py-1.5 sm:w-[104px] lg:w-[120px]" aria-label="Pickup status">
          {RAIL.map(({ key, label, tone, Icon }) => {
            const active = filter === key;
            const n = counts[key] ?? 0;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(key)}
                className="my-1 flex w-full flex-col items-center rounded-[14px] px-1 py-2.5 transition hover:shadow"
                style={{ background: `linear-gradient(#fff, ${tone}${active ? '24' : '10'})`, border: `${active ? 1.5 : 1}px solid ${active ? tone : `${tone}22`}` }}
              >
                <span className="relative">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full text-white" style={{ background: tone }}>
                    <Icon size={18} strokeWidth={2.2} />
                  </span>
                  <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border bg-white px-1 text-[10px] font-extrabold" style={{ borderColor: tone, color: tone }}>
                    {n > 99 ? '99+' : n}
                  </span>
                </span>
                <span className={`mt-1.5 text-center text-[11px] leading-tight ${active ? 'font-extrabold' : 'font-bold'}`} style={{ color: tone }}>{label}</span>
              </button>
            );
          })}
        </nav>

        <main className="min-w-0 flex-1 p-2.5 sm:p-4">
          {loading && list.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-xs text-gray-500">
              <RefreshCw size={18} className="animate-spin text-[#035C6C]" /> Loading pickups…
            </div>
          ) : error && list.length === 0 ? (
            <div className="mx-auto flex max-w-md flex-col items-center gap-1.5 rounded-2xl border border-gray-200 bg-white px-4 py-6 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F32C26] text-white"><WifiOff size={20} /></span>
              <p className="text-sm font-extrabold">Couldn&apos;t load pickups</p>
              <p className="text-xs text-gray-500">Check your connection and try again.</p>
              <button type="button" onClick={load} className="mt-1.5 rounded-full bg-[#035C6C] px-5 py-2 text-xs font-bold text-white">Retry</button>
            </div>
          ) : shown.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center text-xs text-gray-500">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#035C6C] text-white"><Truck size={20} /></span>
              {query.trim() ? `No pickups match "${query.trim()}".` : filter === 'All' ? 'No pickups yet.' : `No ${filterLabel.toLowerCase()} pickups.`}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
              {shown.map((b) => <PickupTile key={b.id} booking={b} showAssignee={allMode} />)}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function SearchInput({ value, onChange, allMode, autoFocus }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-[#F3F4F6] px-3 py-2">
      <Search size={15} className="text-gray-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        placeholder={allMode ? 'Search pickup, customer, device, person' : 'Search pickup, customer, device'}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none"
      />
      {value ? <button type="button" aria-label="Clear search" onClick={() => onChange('')}><X size={15} className="text-gray-500" /></button> : null}
    </div>
  );
}

// Catalogue / booking device image; else a white truck on a teal disc.
function PickupPanel({ booking }) {
  const src = resolveMediaUrl(booking.deviceImageUrl || booking.modelImageUrl);
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className="h-[76%] w-[76%] object-contain" onError={() => setFailed(true)} />;
  }
  return (
    <span className="flex h-14 w-14 items-center justify-center rounded-full text-white" style={{ background: C.teal }}>
      <Truck size={26} strokeWidth={2.1} />
    </span>
  );
}

function PickupTile({ booking, showAssignee }) {
  const bk = bucketize(booking.status);
  const meta = BUCKET_META[bk];
  const device = deviceLabel(booking);
  const slot = booking.pickupSlotStart && booking.pickupSlotEnd
    ? `${String(booking.pickupSlotStart).slice(0, 5)} – ${String(booking.pickupSlotEnd).slice(0, 5)}`
    : null;
  const when = bk === 'ASSIGNED' ? (booking.pickupDate || booking.createdAt) : (booking.updatedAt || booking.createdAt);
  const time = bk === 'ASSIGNED' ? (slot || '') : timeOf(when);
  const ref = `#${trackingId(booking)}`;
  const title = device || booking.customerName || 'Pickup';
  const sub = device ? customerLine(booking) : (booking.customerMobile || null);
  const href = `/shop-home/services/bookings/view/details/?id=${encodeURIComponent(booking.id)}`;
  return (
    <Link href={href} className="flex overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:shadow-md" aria-label={`${title}, ${ref}, ${meta.label}`}>
      <span className="relative flex w-[116px] shrink-0 items-center justify-center border-r border-gray-200 sm:w-[140px]">
        <PickupPanel booking={booking} />
        <span className="absolute left-0 top-0 max-w-[78%] truncate rounded-br-xl px-2 py-1 text-[10px] font-extrabold text-white" style={{ background: meta.tone }}>{meta.label}</span>
        <span className="absolute bottom-1.5 right-1.5 rounded-[10px] border-[1.5px] border-[#035C6C] bg-white px-2.5 py-0.5 text-[11px] font-extrabold text-[#035C6C]">VIEW</span>
      </span>
      <span className="block min-w-0 flex-1 px-3 pb-2.5">
        <span className="mt-2 block truncate text-[11px] font-extrabold text-[#035C6C]">{ref}</span>
        <span className="mt-1 line-clamp-2 text-xs font-extrabold leading-4 text-[#111]">{title}</span>
        {sub ? <span className="mt-0.5 block truncate text-xs text-gray-500">{sub}</span> : null}
        <span className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-500"><MapPin size={11} className="shrink-0" /><span className="truncate">{addressLine(booking)}</span></span>
        {showAssignee ? (
          <span className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-[#035C6C]"><Bike size={11} className="shrink-0" /><span className="truncate">{personName(booking)}</span></span>
        ) : null}
        <span className="mt-0.5 block truncate text-[11px] text-gray-500">{formatDate(when)}{time ? `  ${time}` : ''}</span>
        <span className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-lg bg-[#E5F3F5] px-1.5 py-0.5 text-[11px] font-bold text-[#035C6C]">
          <Clock size={11} className="shrink-0" /><span className="truncate">{meta.step}</span>
        </span>
      </span>
    </Link>
  );
}
