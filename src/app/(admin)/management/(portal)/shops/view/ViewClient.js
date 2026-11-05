'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authApi, subscriptionApi } from '@/lib/api';
import BusinessLocationsManager from '@/components/BusinessLocationsManager';
import SafeImage from '@/components/SafeImage';
import { notifyError } from '@/lib/toast';

function initialsOf(name) {
  if (!name) return '?';
  const p = String(name).trim().split(/\s+/);
  return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase();
}
function isImageUrl(u) {
  return !!u && (/\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(u) || u.startsWith('data:image'));
}

export default function ShopOwnerViewPage() {
  const params = useSearchParams();
  // Resolve the owner id from the ?id= query, falling back to the id persisted
  // when the shop was selected. S3 static hosting 302-redirects a
  // non-trailing-slash URL and DROPS the query string, so on a full load / paste
  // the query can arrive empty even though a shop was picked — recover it from
  // sessionStorage instead of hanging on "Loading…".
  const [id, setId] = useState(null);
  const [idResolved, setIdResolved] = useState(false);
  useEffect(() => {
    const q = params.get('id');
    if (q) { try { sessionStorage.setItem('ggfix.ownerId', q); } catch {} }
    let v = q;
    if (!v) { try { v = sessionStorage.getItem('ggfix.ownerId'); } catch {} }
    setId(v || null);
    setIdResolved(true);
  }, [params]);
  const [data, setData] = useState(null);
  const [sub, setSub] = useState(null);
  const [kycBusy, setKycBusy] = useState(false); // owner KYC review in flight
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showVerify, setShowVerify] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      // Subscription lives in a separate service — degrade gracefully if it's
      // unreachable / not yet deployed (the owner record still carries dates).
      const [res, subRes] = await Promise.all([
        authApi.get(`/auth/shop-owners/${id}`),
        subscriptionApi.get(`/subscriptions/owner/${id}`).catch(() => null),
      ]);
      setData(res);
      setSub(subRes || null);
      // Owner KYC now lives on the owner record itself (res.kycDocument) — no
      // per-shop fetch needed.
    } catch (e) {
      setError(e.body?.message || e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { if (id) load(); }, [id]);

  // Review the owner's KYC (users.kyc_document). Owner-level, so a single call
  // — the shop-view page's `data` IS the owner (ShopOwnerView).
  const reviewKyc = async (status, rejectReason) => {
    setKycBusy(true);
    try {
      const updated = await authApi.patch(`/auth/shop-owners/${id}/kyc-status`, { status, rejectReason });
      setData(updated);
    } catch (e) {
      notifyError(e.body?.message || e.message || 'Failed to update KYC');
    } finally {
      setKycBusy(false);
    }
  };

  if (!idResolved) return <div className="p-6 text-admin-muted">Loading…</div>;
  // No id anywhere (query stripped AND nothing persisted): don't hang forever.
  if (!id)     return (
    <div className="p-6 text-admin-muted">
      No shop owner selected. <Link href="/management/shops/" className="text-admin-accent hover:underline">← Back to shops</Link>
    </div>
  );
  if (loading) return <div className="p-6 text-admin-muted">Loading…</div>;
  if (error)   return <div className="p-6 text-red-600">{error}</div>;
  if (!data)   return <div className="p-6 text-admin-muted">Not found</div>;

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Shop Owner Details</h1>
          <p className="text-sm text-admin-muted">Review account information, documents, and business locations.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/management/shops" className="rounded-lg border border-admin-border bg-admin-dark px-4 py-2 text-sm text-slate-800 hover:bg-admin-card">← Back</Link>
          <Link href={`/management/shops/edit/?id=${id}`} className="rounded-lg bg-admin-accent px-4 py-2 text-sm text-white hover:bg-blue-700">Edit</Link>
        </div>
      </div>

      {/* Header card */}
      <div className="rounded-xl bg-admin-card border border-admin-border p-4 sm:p-5 flex items-center gap-4 sm:gap-5">
        <SafeImage
          src={data.avatarUrl}
          alt={data.name}
          className="h-16 w-16 shrink-0 rounded-full object-cover"
          fallback={
            <div className="h-16 w-16 shrink-0 rounded-full bg-admin-accent/20 text-admin-accent text-xl font-bold flex items-center justify-center">
              {initialsOf(data.name)}
            </div>
          }
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold text-slate-900 break-words">{data.name || '—'}</h2>
          <p className="text-sm text-admin-muted">View personal details, verification status, documents, and linked business locations.</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge tone={data.emailVerified ? 'success' : 'warn'}>
              {data.emailVerified ? '✓ Email Verified' : 'Email Pending'}
            </Badge>
            <Badge tone={data.isActive ? 'success' : 'muted'}>{data.isActive ? '● Active' : '○ Inactive'}</Badge>
            <Badge tone="info">{(data.locations?.length || 0)} Business Location{(data.locations?.length || 0) === 1 ? '' : 's'}</Badge>
            <Badge tone="info">{data.profileCompletePercent ?? 0}% Profile</Badge>
            {sub?.subscriptionType ? (
              <Badge tone={sub.subscriptionType === 'BASIC' ? 'success' : 'info'}>
                {sub.subscriptionType === 'BASIC' ? 'Basic Plan' : 'Free Trial'}
              </Badge>
            ) : null}
            {!data.emailVerified && (
              <button onClick={() => setShowVerify(true)} className="ml-2 rounded-md bg-admin-accent text-white text-xs px-2 py-1 hover:bg-blue-700">
                Verify Email
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3-col details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard title="Personal Details" subtitle="Owner identity, contact details, account status">
          <DetailRow label="Full Name" value={data.name} />
          <DetailRow label="Email ID" value={data.email} />
          <DetailRow label="Primary Mobile" value={data.phone} />
          <DetailRow label="Secondary Mobile" value={data.secondaryMobile} />
          <DetailRow label="Email Status" value={data.emailVerified ? 'Verified' : 'Pending'} />
          <DetailRow label="Status" value={data.isActive ? 'Active' : 'Inactive'} />
        </SectionCard>

        <SectionCard title="Personal Address" subtitle="Address stored for this shop owner">
          {(data.addrState || data.addrDistrict || data.addrTaluk || data.addrArea || data.addrStreet || data.addrPincode || data.personalAddress) ? (
            <>
              <DetailRow label="State" value={data.addrState} />
              <DetailRow label="District" value={data.addrDistrict} />
              <DetailRow label="Taluk" value={data.addrTaluk} />
              <DetailRow label="Area" value={data.addrArea} />
              <DetailRow label="Street" value={data.addrStreet} />
              <DetailRow label="Pincode" value={data.addrPincode} />
            </>
          ) : (
            <p className="text-sm text-admin-muted italic">No address on file.</p>
          )}
        </SectionCard>

        <SectionCard title="Profile & Documents" subtitle="Uploaded avatar and account timeline. KYC documents are below.">
          <DocPreview label="Avatar" url={data.avatarUrl} />
          <DetailRow label="Created On" value={data.createdAt ? new Date(data.createdAt).toLocaleDateString() : '—'} />
        </SectionCard>
      </div>

      {/* Subscription */}
      <div className="rounded-xl bg-admin-card border border-admin-border p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Subscription</h3>
            <p className="text-xs text-admin-muted">Current plan, status, and validity window.</p>
          </div>
          {sub ? <SubStatusBadge status={sub.status} /> : null}
        </div>
        {(sub || data.activeDate || data.inactiveDate) ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <MiniStat label="Plan" value={planLabel(sub?.subscriptionType)} />
            <MiniStat label="Active Date" value={fmtDate(sub?.activeDate ?? data.activeDate)} />
            <MiniStat label="Inactive Date" value={fmtDate(sub?.inactiveDate ?? data.inactiveDate)} />
            <MiniStat label="Days Left" value={sub?.daysRemaining != null ? String(sub.daysRemaining) : '—'} />
            <MiniStat label="Shops" value={sub?.shopCount != null ? String(sub.shopCount) : '—'} />
            <MiniStat label="Amount" value={sub?.priceAmount != null ? `₹${Number(sub.priceAmount).toLocaleString('en-IN')}` : '—'} />
            <MiniStat label="Shop Limit" value={limitLabel(!!sub, sub?.shopLimit)} />
            <MiniStat label="Employees" value={!sub ? '—' : (sub.employeeLimit == null ? 'Unlimited' : `${sub.employeeLimit}/shop`)} />
            <MiniStat label="Sell Limit" value={limitLabel(!!sub, sub?.sellLimit)} />
            <MiniStat label="Pickup" value={!sub ? '—' : (sub.pickupServiceEnabled ? 'Enabled' : 'Disabled')} />
          </div>
        ) : (
          <p className="text-sm text-admin-muted italic">No subscription on record. A 15-day free trial is created automatically at registration.</p>
        )}
      </div>

      {/* KYC Verification */}
      <div className="rounded-xl bg-admin-card border border-admin-border p-5">
        <div className="mb-3">
          <h3 className="text-base font-semibold text-slate-900">Owner KYC Verification</h3>
          <p className="text-xs text-admin-muted">Owner identity documents (Aadhar &amp; PAN). Shop documents (Front / Banner / GST / Udyam) are per Business Location below.</p>
        </div>
        {(() => {
          const kyc = data.kycDocument || {};
          const docs = [
            { key: 'aadharFront', label: 'Aadhar Card Front', url: kyc.aadharFrontUrl },
            { key: 'aadharBack',  label: 'Aadhar Card Back',  url: kyc.aadharBackUrl },
            { key: 'pan',         label: 'PAN Card',          url: kyc.panUrl },
          ].filter((d) => d.url);
          if (docs.length === 0) {
            return <p className="text-sm text-admin-muted italic">No owner KYC documents (Aadhar / PAN) uploaded yet.</p>;
          }
          const overall = kyc.status || 'PENDING_REVIEW';
          const approved = overall === 'APPROVED';
          return (
            <div className="rounded-lg border border-admin-border p-3">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">{data.name || 'Owner'}</span>
                  <KycBadge status={overall} />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] uppercase tracking-wider text-admin-muted">Verified</span>
                  <button
                    type="button"
                    title={approved ? 'Set back to Under Review' : 'Approve all KYC documents'}
                    disabled={kycBusy}
                    onClick={() => reviewKyc(approved ? 'PENDING_REVIEW' : 'APPROVED')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${approved ? 'bg-brand-500' : 'bg-slate-300'} ${kycBusy ? 'opacity-60' : ''}`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${approved ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                  <button
                    type="button"
                    disabled={kycBusy}
                    onClick={() => {
                      const reason = window.prompt('Reject reason (shown to the owner):', kyc.rejectReason || '');
                      if (reason !== null) reviewKyc('REJECTED', reason || 'Documents rejected');
                    }}
                    className="text-[12px] font-semibold text-red-600 hover:underline disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                {docs.map((d) => (
                  <a
                    key={d.key}
                    href={d.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block w-28"
                    title={d.label}
                  >
                    <div className="relative h-24 w-28 rounded-lg overflow-hidden border border-admin-border bg-admin-dark flex items-center justify-center">
                      {isImageUrl(d.url) ? (
                        <SafeImage
                          src={d.url}
                          alt={d.label}
                          className="h-full w-full object-cover"
                          placeholderClassName="text-[11px] text-admin-muted text-center px-1"
                          placeholderText="Image unavailable"
                        />
                      ) : (
                        <span className="text-[11px] text-admin-muted">Open file</span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-700 mt-1 truncate font-medium">{d.label}</div>
                  </a>
                ))}
              </div>
              {overall === 'REJECTED' && kyc.rejectReason ? (
                <p className="text-[12px] text-red-600 mt-2 italic">{kyc.rejectReason}</p>
              ) : null}
            </div>
          );
        })()}
      </div>

      <BusinessLocationsManager
        ownerId={id}
        locations={data.locations}
        kycDocument={data.kycDocument}
        onChanged={load}
      />

      {/* Modals */}
      {showVerify && (
        <VerifyEmailModal
          email={data.email}
          onClose={() => setShowVerify(false)}
          onVerified={() => { setShowVerify(false); load(); }}
        />
      )}
    </div>
  );
}

// ============================================================================
// Reusable building blocks
// ============================================================================

function SectionCard({ title, subtitle, children }) {
  return (
    <div className="rounded-xl bg-admin-card border border-admin-border p-5">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {subtitle && <p className="text-xs text-admin-muted mt-0.5 mb-3">{subtitle}</p>}
      <div className="space-y-2">{children}</div>
    </div>
  );
}
function DetailRow({ label, value }) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2 text-sm">
      <span className="text-[11px] uppercase tracking-wider text-admin-muted">{label}</span>
      <span className="text-slate-800 break-all">{value ?? '—'}</span>
    </div>
  );
}
function DocPreview({ label, url }) {
  return (
    <div className="rounded-lg border border-admin-border bg-admin-dark/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] uppercase tracking-wider text-admin-muted">{label}</span>
        {url && <a href={url} target="_blank" rel="noreferrer" className="text-[11px] text-sky-400 hover:underline">Open</a>}
      </div>
      {url ? (
        isImageUrl(url) ? (
          <SafeImage
            src={url}
            alt={label}
            className="max-h-32 w-full object-contain rounded bg-black/20"
            placeholderClassName="text-xs text-admin-muted italic h-32 flex items-center justify-center rounded bg-black/20"
            placeholderText="Image unavailable"
          />
        ) : (
          <div className="text-xs text-slate-600 truncate">{url.split('/').pop() || 'File'}</div>
        )
      ) : (
        <p className="text-xs text-admin-muted italic">No {label.toLowerCase()} uploaded.</p>
      )}
    </div>
  );
}
function Badge({ tone, children }) {
  const tones = {
    success: 'bg-brand-500/15 text-brand-300',
    warn:    'bg-amber-500/15 text-amber-300',
    muted:   'bg-slate-500/15 text-slate-500',
    info:    'bg-admin-accent/15 text-admin-accent',
  };
  return <span className={`inline-flex items-center rounded-full ${tones[tone] || tones.muted} px-2 py-0.5 text-[11px] font-medium`}>{children}</span>;
}
function KycBadge({ status }) {
  const map = {
    APPROVED: { tone: 'success', label: 'Verified' },
    REJECTED: { tone: 'warn', label: 'Rejected' },
    PENDING_REVIEW: { tone: 'info', label: 'Under Review' },
    NONE: { tone: 'muted', label: 'No documents' },
  };
  const m = map[status] || map.NONE;
  return <Badge tone={m.tone}>{m.label}</Badge>;
}
function fmtDate(d) { return d ? new Date(d).toLocaleDateString() : '—'; }
function planLabel(t) { return t === 'BASIC' ? 'Basic' : t === 'FREE_TRIAL' ? 'Free Trial' : '—'; }
function limitLabel(hasSub, v) { return !hasSub ? '—' : (v == null ? 'Unlimited' : String(v)); }
function MiniStat({ label, value }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-admin-muted">{label}</div>
      <div className="text-sm font-semibold text-slate-900 mt-0.5">{value}</div>
    </div>
  );
}
function SubStatusBadge({ status }) {
  const s = String(status || '').toUpperCase();
  const tone = s === 'ACTIVE' ? 'success' : s === 'FREE_TRIAL' ? 'info' : (s === 'EXPIRED' || s === 'CANCELLED') ? 'warn' : 'muted';
  const label = s === 'FREE_TRIAL' ? 'Free Trial' : s ? s.charAt(0) + s.slice(1).toLowerCase() : '—';
  return <Badge tone={tone}>{label}</Badge>;
}
function VerifyEmailModal({ email, onClose, onVerified }) {
  const [step, setStep] = useState('SEND'); // SEND | CONFIRM
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [busy, setBusy] = useState(false);

  const sendOtp = async () => {
    setBusy(true);
    try {
      const res = await authApi.post('/auth/email-verify/send', { email });
      // Dev returns the code so we can complete the loop without an email server.
      if (res?.devOtp) setDevOtp(res.devOtp);
      setStep('CONFIRM');
    } catch (e) {
      notifyError(e.body?.message || e.message || 'Failed to send OTP');
    } finally {
      setBusy(false);
    }
  };

  const confirmOtp = async () => {
    setBusy(true);
    try {
      await authApi.post('/auth/email-verify/confirm', { email, otp });
      onVerified();
    } catch (e) {
      notifyError(e.body?.message || e.message || 'Invalid OTP');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-admin-card border border-admin-border rounded-xl p-4 sm:p-6 max-w-md w-full max-h-[90dvh] overflow-y-auto space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Verify Email</h3>
          <p className="text-xs text-admin-muted">A one-time code will be sent to <span className="text-slate-800 break-all">{email}</span>. The code is never stored — it expires in 10 minutes.</p>
        </div>

        {step === 'SEND' ? (
          <button onClick={sendOtp} disabled={busy} className="w-full rounded-lg bg-admin-accent py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {busy ? 'Sending…' : 'Send OTP'}
          </button>
        ) : (
          <>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-admin-muted mb-1">Enter 6-digit code</label>
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                inputMode="numeric"
                maxLength={6}
                placeholder="••••••"
                className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900 tracking-widest text-center text-lg focus:outline-none focus:border-admin-accent"
              />
              {devOtp && (
                <p className="text-[11px] text-amber-300 mt-2">Dev OTP (no SMTP wired): <span className="font-mono">{devOtp}</span></p>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep('SEND')} className="flex-1 rounded-lg border border-admin-border py-2 text-sm text-slate-800 hover:bg-admin-dark">Resend</button>
              <button onClick={confirmOtp} disabled={busy || otp.length < 6} className="flex-1 rounded-lg bg-admin-accent py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {busy ? 'Verifying…' : 'Verify'}
              </button>
            </div>
          </>
        )}

        <button onClick={onClose} className="w-full text-xs text-admin-muted hover:text-slate-800">Cancel</button>
      </div>
    </div>
  );
}
