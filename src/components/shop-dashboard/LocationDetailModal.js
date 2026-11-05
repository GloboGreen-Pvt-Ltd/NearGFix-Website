'use client';

import { Calendar, Clock, CreditCard, MapPin, Phone, X } from 'lucide-react';

import { cx } from '@/components/site/ui';
import SafeImage from '@/components/SafeImage';

/**
 * Read-only detail view for one business location — ported from the admin's
 * LocationViewModal (Client/src/components/BusinessLocationsManager.js),
 * restyled to the shop-dashboard palette. Owner KYC (Aadhar/PAN) is
 * per-owner, not per-location, so it isn't shown here.
 */

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#024A57] focus-visible:ring-offset-2';

function isImageUrl(u) {
  return !!u && (/\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(u) || u.startsWith('data:image'));
}

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2.5">
      {Icon ? <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#98A2B3]" aria-hidden="true" /> : null}
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">{label}</p>
        <p className="break-words text-sm font-medium text-[#111111]">{value ?? '—'}</p>
      </div>
    </div>
  );
}

function DocPreview({ label, url }) {
  return (
    <div className="rounded-xl border border-[#ECECEC] bg-[#F8F8F8] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#666666]">{label}</span>
        {url && <a href={url} target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-[#024A57] hover:underline">Open</a>}
      </div>
      {url ? (
        isImageUrl(url) ? (
          <SafeImage
            src={url}
            alt={label}
            className="max-h-32 w-full rounded-lg bg-[#101828]/5 object-contain"
            placeholderClassName="flex h-32 items-center justify-center rounded-lg bg-[#101828]/5 text-xs italic text-[#98A2B3]"
            placeholderText="Image unavailable"
          />
        ) : (
          <div className="truncate text-xs text-[#475467]">{url.split('/').pop() || 'File'}</div>
        )
      ) : (
        <p className="text-xs italic text-[#98A2B3]">No {label.toLowerCase()} uploaded.</p>
      )}
    </div>
  );
}

export default function LocationDetailModal({ loc, onClose }) {
  const addr = [loc.street, loc.area, loc.taluk, loc.district, loc.state, loc.pincode].filter(Boolean).join(', ') || loc.address || '—';
  const hours = (loc.openingTime || loc.closingTime) ? `${loc.openingTime || '—'} – ${loc.closingTime || '—'}` : '—';
  const coords = (loc.latitude != null && loc.longitude != null) ? `${loc.latitude}, ${loc.longitude}` : '—';
  const shopDocs = [
    { label: 'Shop Front', url: loc.frontImageUrl },
    { label: 'Banner / Visiting Card', url: loc.bannerImageUrl },
    { label: 'GST Certificate', url: loc.gstCertificateUrl },
    { label: 'Udyam Certificate', url: loc.udyamCertificateUrl },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#101828]/60 p-4">
      <div className="my-auto w-full max-w-2xl rounded-3xl sm:my-8 bg-white shadow-[0_20px_60px_rgba(16,24,40,0.25)]">
        <div className="flex items-center justify-between border-b border-[#ECECEC] px-5 py-4 sm:px-6">
          <div>
            <h3 className="text-lg font-bold text-[#111111]">{loc.name}</h3>
            <p className="text-xs text-[#666666]">Business location details and documents.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={cx('rounded-full p-1.5 text-[#666666] transition hover:bg-[#F8F8F8] hover:text-[#111111]', FOCUS_RING)}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[70dvh] space-y-5 overflow-y-auto p-5 sm:p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DetailRow icon={Phone} label="Mobile" value={loc.mobile} />
            <DetailRow icon={CreditCard} label="GST Number" value={loc.gstNumber} />
            <DetailRow icon={MapPin} label="Address" value={addr} />
            <DetailRow icon={Calendar} label="Working Days" value={loc.workingDays} />
            <DetailRow icon={Clock} label="Hours" value={hours} />
            <DetailRow icon={MapPin} label="Coordinates" value={coords} />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-bold text-[#111111]">Shop Documents</h4>
              <span className="text-xs font-semibold text-[#024A57]">{loc.progressPercent ?? 0}% complete</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {shopDocs.map((d) => <DocPreview key={d.label} label={d.label} url={d.url} />)}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#ECECEC] px-5 py-4 sm:px-6">
          <button type="button" onClick={onClose} className={cx('rounded-xl border border-[#D0D5DD] bg-white px-4 py-2.5 text-sm font-semibold text-[#344054] transition hover:bg-[#F8F8F8]', FOCUS_RING)}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
