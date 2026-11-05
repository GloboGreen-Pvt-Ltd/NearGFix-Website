'use client';

/**
 * /shop-home/employee/team/pickups/?id=<employeeId> — one pickup person's
 * "Pickup report", opened from Employee Details → Quick Access → Pickup
 * Report (the Pickup Report menu page stays the shop-wide report). Laid out
 * like the Partner app's Pickup report screen:
 *
 *   - This Month: month switcher + Assigned (Scheduled) / In Progress
 *     (On route) / Completed (Delivered) / Total (Overall).
 *   - Recent Assigned and In Progress lists, then Previous Pickups with
 *     All / Completed / In Progress / Assigned chips.
 *
 * Data: GET {ORDER_BASE}/repair-bookings/shop (fetchShopBookings) — pickup
 * bookings (serviceMode PICKUP) assigned to this person by id or name,
 * created in the chosen month. Buckets are the same as the Pickup Report
 * menu page: Created = Assigned, Pickup / In Progress = In Progress,
 * Completed; cancelled pickups are left out.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from '@/lib/portalNavigation';
import { ArrowLeft, BarChart3, Bookmark, Car, CheckCheck, ChevronLeft, ChevronRight, Clock, MapPin, Phone, RefreshCw } from 'lucide-react';

import { cx } from '@/components/site/ui';
import { MONTHS, shiftMonth } from '@/components/shop-dashboard/MonthSwitcher';
import { fetchShopBookings, fetchTechnician, friendlyBookingStatus } from '@/lib/shopDashboard';
import { formatBookingDate, formatPickupAddress, formatSlotTime } from '@/lib/bookingFormat';

const GREEN = '#035C6C';
const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#035C6C] focus-visible:ring-offset-2';
const FILTERS = [
  { key: 'All', label: 'All' },
  { key: 'Completed', label: 'Completed' },
  { key: 'In Progress', label: 'In Progress' },
  { key: 'Assigned', label: 'Assigned' },
];

function bucketOf(statusLabel) {
  if (statusLabel === 'Created') return 'Assigned';
  if (statusLabel === 'Pickup' || statusLabel === 'In Progress') return 'In Progress';
  return statusLabel; // Completed / Cancelled
}
const humanize = (v) =>
  String(v || '')
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
const assigneeName = (b) => b.assignedPickupPersonName || b.pickupPersonName || '';
const withHash = (v) => (v ? `#${String(v).replace(/^#+/, '')}` : '');

function Tile({ icon: Icon, label, value, sub, head }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-[#E5F3F5]">
      <p className={cx('flex items-center justify-center gap-1.5 px-2 py-2 text-[14px] font-bold text-white', head)}>
        <Icon className="h-4 w-4" aria-hidden="true" />
        {label}
      </p>
      <div className="px-2 py-3 text-center">
        <p className="text-[28px] font-extrabold leading-none text-[#111111]">{value}</p>
        <p className="mt-1.5 text-[13px] text-[#98A2B3]">{sub}</p>
      </div>
    </div>
  );
}

function PickupCard({ b }) {
  const slot = b.pickupSlotStart ? [formatSlotTime(b.pickupSlotStart), formatSlotTime(b.pickupSlotEnd)].filter(Boolean).join(' – ') : '';
  const address = b.pickupAddress || b.pickupAddressText ? formatPickupAddress(b) : '';
  const tone = b.bucket === 'Completed' ? GREEN : b.bucket === 'In Progress' ? '#D97706' : '#2563EB';
  return (
    <li className="relative overflow-hidden rounded-2xl border border-[#ECECEC] bg-white py-3.5 pl-5 pr-4 shadow-[0_2px_10px_rgba(16,24,40,0.05)]">
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: tone }} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <p className="truncate text-[15.5px] font-extrabold text-[#111111]">{b.customerName || 'Customer'}</p>
        <span className="max-w-[45%] shrink-0 truncate text-[13px] font-bold text-[#98A2B3]">{withHash(b.bookingNumber || b.id)}</span>
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-[#475467]">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          {formatBookingDate(b.pickupDate || b.createdAt) || '—'}
          {slot ? ` · ${slot}` : ''}
        </span>
        {b.customerMobile ? (
          <a href={`tel:${b.customerMobile}`} className="inline-flex items-center gap-1 font-semibold text-[#035C6C] hover:underline">
            <Phone className="h-3.5 w-3.5" aria-hidden="true" />
            {b.customerMobile}
          </a>
        ) : null}
      </p>
      {address ? (
        <p className="mt-1 flex items-start gap-1 text-[13px] text-[#667085]">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="line-clamp-2">{address}</span>
        </p>
      ) : null}
      <p className="mt-1.5 text-[14.5px] font-extrabold" style={{ color: tone }}>
        {humanize(b.status) || b.bucket}
      </p>
    </li>
  );
}

function SectionHead({ title, onViewAll }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[19px] font-extrabold text-[#111111]">{title}</h2>
      {onViewAll ? (
        <button type="button" onClick={onViewAll} className={cx('text-[15px] font-extrabold text-[#035C6C] hover:underline', FOCUS_RING)}>
          View all
        </button>
      ) : null}
    </div>
  );
}

const EmptyLine = ({ text }) => <p className="py-6 text-center text-[15px] text-[#667085]">{text}</p>;

export default function PickupPersonReportPage() {
  const id = useSearchParams().get('id');
  const router = useRouter();
  const [name, setName] = useState('');
  const [bookings, setBookings] = useState(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [filter, setFilter] = useState('All');
  const previousRef = useRef(null);
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    fetchTechnician(id)
      .then((t) => alive && setName(t?.name || ''))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    let alive = true;
    setError('');
    setBookings(null);
    fetchShopBookings()
      .then((list) => alive && setBookings(list))
      .catch((err) => {
        if (!alive) return;
        setBookings([]);
        setError(err.message || 'Could not load pickups.');
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const rows = useMemo(() => {
    const y = viewDate.getFullYear();
    const m = viewDate.getMonth();
    return (bookings || [])
      .filter((b) => b.serviceMode === 'PICKUP')
      .filter((b) => (id && String(b.assignedPickupPersonId || '') === String(id)) || (name && assigneeName(b) === name))
      .filter((b) => {
        const d = b.createdAt ? new Date(b.createdAt) : null;
        return d && d.getFullYear() === y && d.getMonth() === m;
      })
      .map((b) => ({ ...b, bucket: bucketOf(friendlyBookingStatus(b.status).statusLabel) }))
      .filter((b) => b.bucket !== 'Cancelled')
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [bookings, id, name, viewDate]);

  const by = (k) => rows.filter((r) => r.bucket === k);
  const assigned = by('Assigned');
  const inProgress = by('In Progress');
  const completed = by('Completed');
  const previous = filter === 'All' ? rows : by(filter);
  const loading = bookings === null;
  const n = (list, w = 2) => (loading ? '…' : String(list.length).padStart(w, '0'));

  const showAll = (f) => {
    setFilter(f);
    previousRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-6">
      <div className="relative flex items-center justify-center border-b border-[#ECECEC] pb-4">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className={cx('absolute left-0 flex h-11 w-11 items-center justify-center rounded-full bg-[#E5F3F5] text-[#111111] transition hover:bg-[#E5F3F5]', FOCUS_RING)}
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="min-w-0 px-12 text-center">
          <h1 className="text-[20px] font-extrabold text-[#111111]">Pickup report</h1>
          {name ? <p className="break-words text-[12.5px] font-semibold text-[#666666]">{name}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          aria-label="Refresh"
          className={cx('absolute right-0 flex h-10 w-10 items-center justify-center rounded-full border border-[#ECECEC] bg-white text-[#035C6C] transition hover:border-[#035C6C]', FOCUS_RING)}
        >
          <RefreshCw className={cx('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
        </button>
      </div>

      <section className="rounded-[24px] border border-[#ECECEC] bg-white p-5 shadow-[0_4px_14px_rgba(16,24,40,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[19px] font-extrabold text-[#111111]">This Month</h2>
          <div className="flex items-center gap-1 rounded-full px-4 py-1.5 text-white" style={{ backgroundColor: GREEN }}>
            <span className="pr-2 text-[15px] font-bold">
              {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
            </span>
            <button type="button" onClick={() => shiftMonth(setViewDate, -1)} aria-label="Previous month" className="rounded-full p-1 hover:bg-white/15">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="h-4 w-px bg-white/30" aria-hidden="true" />
            <button type="button" onClick={() => shiftMonth(setViewDate, 1)} aria-label="Next month" className="rounded-full p-1 hover:bg-white/15">
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile icon={Bookmark} label="Assigned" value={n(assigned)} sub="Scheduled" head="bg-[#035C6C]" />
          <Tile icon={Car} label="In Progress" value={n(inProgress)} sub="On route" head="bg-[#F59E0B]" />
          <Tile icon={CheckCheck} label="Completed" value={n(completed, 3)} sub="Delivered" head="bg-[#035C6C]" />
          <Tile icon={BarChart3} label="Total" value={n(rows, 3)} sub="Overall" head="bg-[#035C6C]" />
        </div>
      </section>

      {error ? <p className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-[13.5px] font-semibold text-[#B42318]">{error}</p> : null}

      <section>
        <SectionHead title="Recent Assigned" onViewAll={assigned.length ? () => showAll('Assigned') : null} />
        {loading ? (
          <div className="h-24 animate-pulse rounded-2xl bg-[#F3F3F3]" />
        ) : assigned.length ? (
          <ul className="space-y-2.5">
            {assigned.slice(0, 3).map((b) => (
              <PickupCard key={b.id} b={b} />
            ))}
          </ul>
        ) : (
          <EmptyLine text="No new pickup assignments." />
        )}
      </section>

      <section>
        <SectionHead title="In Progress" onViewAll={inProgress.length ? () => showAll('In Progress') : null} />
        {loading ? (
          <div className="h-24 animate-pulse rounded-2xl bg-[#F3F3F3]" />
        ) : inProgress.length ? (
          <ul className="space-y-2.5">
            {inProgress.slice(0, 3).map((b) => (
              <PickupCard key={b.id} b={b} />
            ))}
          </ul>
        ) : (
          <EmptyLine text="No pickups in progress." />
        )}
      </section>

      <section ref={previousRef} className="scroll-mt-4">
        <SectionHead title="Previous Pickups" />
        <div className="mb-3 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cx(
                'rounded-full border px-5 py-2 text-[15px] font-bold transition',
                FOCUS_RING,
                filter === f.key ? 'border-transparent bg-[#035C6C] text-white' : 'border-[#ECECEC] bg-white text-[#475467] hover:border-[#035C6C]',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {loading ? (
          <div className="h-24 animate-pulse rounded-2xl bg-[#F3F3F3]" />
        ) : previous.length ? (
          <ul className="space-y-2.5">
            {previous.map((b) => (
              <PickupCard key={b.id} b={b} />
            ))}
          </ul>
        ) : (
          <EmptyLine text="No pickups found." />
        )}
      </section>
    </div>
  );
}
