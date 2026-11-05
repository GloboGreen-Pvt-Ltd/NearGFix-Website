'use client';

/**
 * /shop-home/employee/team — "Employees" list screen (Employee Management
 * module). 2026-09: rebuilt to match a compact mobile-style reference —
 * back/title/Add Employee header, one "All Employees" summary card with a
 * real active/total circular indicator, a flat list of tappable employee
 * cards, and a bottom info card. Per that reference, this screen contains
 * ONLY: the summary, the list, Add Employee, and the (honestly disabled)
 * active/inactive toggle — it deliberately does NOT also show Employee
 * Details content (profile/check-in-out/quick access/this month/salary
 * advance/leave request/employee info): that's `/team/[id]`'s job alone,
 * reached by tapping a card. This also means the previous hero banner,
 * 4-KPI-card row, role/status filter chips, search field, and per-row
 * expand-to-inline-details panel are gone — this list is intentionally
 * simpler than what this page had before, to match the reference exactly.
 *
 * Real data: GET {TICKET_BASE}/technicians via fetchTechnicians()
 * (src/lib/shopDashboard.js) for the roster, plus fetchSubscriptionMe()
 * (src/lib/shopSubscription.js, per-shop entitlements.employeeLimit) for the seat limit used by the summary
 * card's ring. No new API client, no mock data.
 *
 * "+ Add Employee" now navigates to the real Add Staff flow
 * (/team/new -> /team/new/create, matching the real NearGFix Staff mobile
 * app screens) — a live probe confirmed `TECHNICIAN_BASE`
 * (src/lib/api.js, https://api.neargfix.com/technician) is a real,
 * auth-protected service never called anywhere in this web app, so a real
 * create-employee endpoint almost certainly exists there; it just isn't
 * confirmed/wired for this web app yet, so that flow's own Create action
 * stays honestly disabled until it is. The per-card Active/Inactive toggle
 * is a plain, non-interactive visual indicator, not a fake control — there
 * is no confirmed activate/deactivate-technician endpoint either.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Info, Phone, PlusCircle, ShieldCheck, Users } from 'lucide-react';

import { cx } from '@/components/site/ui';
import PageHeader from '@/components/shop-dashboard/PageHeader';
import Icon3D from '@/components/shop-dashboard/Icon3D';
import EmptyState from '@/components/shop-dashboard/EmptyState';
import { fetchTechnicians } from '@/lib/shopDashboard';
import { readShopOwner } from '@/lib/shopAuth';
import { isOwnerSession } from '@/lib/shopAccess';
import { fetchSubscriptionMe } from '@/lib/shopSubscription';

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#024A57] focus-visible:ring-offset-2';

// Best-guess pastel badge tone for a role label — derives a visual from
// real text rather than a fixed per-role table, so it works for whatever
// roleLabel a technician record actually carries.
function roleBadgeTone(roleLabel) {
  const r = String(roleLabel || '').toLowerCase();
  if (r === 'pickup person') return 'bg-[#FFF1E0] text-[#B45A00]';
  if (r === 'technician') return 'bg-[#F3F3F3] text-[#024A57]';
  return 'bg-[#F3F3F3] text-[#0F766E]';
}

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

// Real profile photo when the technician record has one (same field-name
// priority and onError-falls-back-to-initials pattern as the Employee
// Details page's own Avatar component) — falls back to the plain initials
// circle when there's no photo or the URL fails to load.
function Avatar({ name, url, active }) {
  const [broken, setBroken] = useState(false);
  if (url && !broken) {
    return (
      <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-[#ECECEC]">
        {/* eslint-disable-next-line @next/next/no-img-element -- employee profile photos are arbitrary shop-catalog URLs, not app assets Next can optimize. */}
        <img src={url} alt="" onError={() => setBroken(true)} className="h-full w-full object-cover" />
        <span className={cx('absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white', active ? 'bg-[#024A57]' : 'bg-[#98A2B3]')} aria-hidden="true" />
      </span>
    );
  }
  return (
    <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#F3F3F3] text-sm font-bold text-[#024A57]">
      {initials(name)}
      <span className={cx('absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white', active ? 'bg-[#024A57]' : 'bg-[#98A2B3]')} aria-hidden="true" />
    </span>
  );
}

function normalize(tech) {
  return {
    id: tech.id,
    name: tech.name || 'Unnamed',
    roleLabel: tech.roleLabel || 'Technician',
    phone: tech.phone || tech.mobile || '',
    email: tech.email || '',
    active: tech.isAvailable !== false,
    avatarUrl: tech.avatarUrl || tech.photoUrl || tech.profileImageUrl || tech.imageUrl || '',
  };
}

// Small ring showing `value`/`total` (real employee counts, or seat usage
// when a seat limit is known) — plain SVG stroke-dasharray, no library.
function CircularProgress({ value, total }) {
  const size = 56;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(1, value / total) : 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E4F8EC" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#035C6C"
        strokeWidth={stroke}
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct)}
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function EmployeeManagementPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [seats, setSeats] = useState(null); // { used, limit } | null while unknown

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    fetchTechnicians()
      .then((rows) => {
        if (alive) setList(rows.map(normalize));
      })
      .catch((err) => {
        if (alive) setError(err.message || 'Could not load your team.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    // The seat limit lives on the OWNER's subscription (owner profile + plan) —
    // a shop login never fetches either; its ring just counts its own team.
    if (!isOwnerSession(readShopOwner())) return undefined;
    let alive = true;
    // Subscription v2: employeeLimit is per shop and lives in /subscriptions/me entitlements.
    fetchSubscriptionMe()
      .then((me) => {
        if (alive && me?.entitlements) setSeats({ used: list.length, limit: me.entitlements.employeeLimit ?? null });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [list.length]);

  const counts = useMemo(() => {
    const c = { total: list.length, active: 0, inactive: 0 };
    list.forEach((e) => {
      if (e.active) c.active += 1;
      else c.inactive += 1;
    });
    return c;
  }, [list]);

  // Ring denominator prefers the real seat limit (the same real seat-usage
  // signal this page already tracked) and falls back to total employees
  // when no seat limit is known yet.
  const ringTotal = seats?.limit ?? counts.total;

  return (
    <div className="flex w-full flex-col gap-5">
      {/* Add Employee: real navigation to the new "Add Staff" flow
          (/team/new -> /team/new/create), matching the real NearGFix Staff
          mobile app screens of the same name. Those screens' own
          Create/upload actions stay honestly disabled pending a confirmed
          create-employee endpoint (TECHNICIAN_BASE is defined in
          src/lib/api.js but never called anywhere in this web app yet) —
          this button itself is real, working navigation, not a dead end. */}
      <PageHeader
        title="Employees"
        subtitle="View, add, edit, activate and deactivate employees."
        action={
          <Link
            href="/shop-home/employee/team/new"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#F3BF23] px-4 py-2.5 text-sm font-semibold text-[#1E1E1E] transition hover:bg-[#E5B11A]"
          >
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            Add Employee
          </Link>
        }
      />

      {error ? (
        <div role="alert" className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      {/* All Employees summary card */}
      <div className="flex items-center justify-between gap-4 rounded-[22px] border border-[#ECECEC] bg-[#F8F8F8] p-4 sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <Icon3D icon={Users} tone="green" size="md" />
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-[#1C3053]">All Employees</p>
            <p className="mt-0.5 truncate text-xs text-[#666666]">
              {loading ? 'Loading…' : `${counts.active} active · ${counts.total} total`}
            </p>
          </div>
        </div>
        <div className="relative flex shrink-0 items-center justify-center">
          <CircularProgress value={counts.active} total={ringTotal} />
          <div className="absolute flex flex-col items-center">
            <span className="text-xs font-extrabold text-[#1C3053]">{loading ? '—' : `${counts.active}/${ringTotal || counts.active || 0}`}</span>
            <span className="text-[0.6rem] font-bold uppercase tracking-wide text-[#98A2B3]">Active</span>
          </div>
        </div>
      </div>

      {/* Employee list */}
      {loading ? (
        <div className="space-y-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[76px] animate-pulse rounded-2xl border border-[#ECECEC] bg-[#F8F8F8]" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-[22px] border border-[#ECECEC] bg-[#F8F8F8] py-6">
          <EmptyState
            icon={Users}
            title="No employees yet"
            description="Employees will appear here once they are added to your business."
            action={
              <Link
                href="/shop-home/employee/team/new"
                className="inline-flex items-center gap-1.5 rounded-full bg-[#F3BF23] px-4 py-2.5 text-sm font-semibold text-[#1E1E1E] transition hover:bg-[#E5B11A]"
              >
                <PlusCircle className="h-4 w-4" aria-hidden="true" />
                Add Employee
              </Link>
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {list.map((employee) => (
            <EmployeeCard key={employee.id} employee={employee} />
          ))}
        </div>
      )}

      {/* Bottom info card */}
      <div className="flex items-center gap-3 rounded-2xl border border-[#ECECEC] bg-[#F8F8F8] px-4 py-3.5">
        <Info className="h-4.5 w-4.5 shrink-0 text-[#035C6C]" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-[#345245]">
          You can add, edit or deactivate employees. Only active employees can access the shop.
        </p>
        <ShieldCheck className="h-4.5 w-4.5 shrink-0 text-[#035C6C]" aria-hidden="true" />
      </div>
    </div>
  );
}

// Each card is a real navigation link to the full Employee Details page
// (`/team/[id]`) — nothing about that page's content is duplicated here.
// The Active/Inactive toggle is a plain, non-interactive visual indicator
// (not a `<button>`), since there is no activate/deactivate-technician
// endpoint anywhere in this backend to wire it to — a real control that
// silently did nothing would be worse than an honest static one.
function EmployeeCard({ employee }) {
  return (
    <Link
      href={`/shop-home/employee/team/view/?id=${encodeURIComponent(employee.id)}`}
      className={cx(
        'flex items-center gap-3.5 rounded-2xl border border-[#ECECEC] bg-[#F8F8F8] p-4 transition hover:border-[#035C6C]',
        FOCUS_RING,
      )}
    >
      <Avatar name={employee.name} url={employee.avatarUrl} active={employee.active} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-[#1C3053]">{employee.name}</p>
        {employee.phone ? (
          <span className="mt-0.5 flex items-center gap-1 text-xs text-[#666666]">
            <Phone className="h-3 w-3 shrink-0" aria-hidden="true" />
            {employee.phone}
          </span>
        ) : null}
        <span className={cx('mt-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide', roleBadgeTone(employee.roleLabel))}>
          {employee.roleLabel}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        <div className="flex flex-col items-end gap-1">
          <span className={cx('text-xs font-bold', employee.active ? 'text-[#024A57]' : 'text-[#98A2B3]')}>{employee.active ? 'Active' : 'Inactive'}</span>
          <span
            title="Changing employee status isn't available yet — there's no activate/deactivate endpoint."
            aria-hidden="true"
            className={cx('flex h-[18px] w-8 shrink-0 items-center rounded-full p-0.5 transition', employee.active ? 'justify-end bg-[#024A57]/70' : 'justify-start bg-[#D0D5DD]')}
          >
            <span className="h-[14px] w-[14px] rounded-full bg-white" />
          </span>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-[#98A2B3]" aria-hidden="true" />
      </div>
    </Link>
  );
}
