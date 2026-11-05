'use client';

/**
 * /shop-home/account/business-profile — "Business Profile".
 *
 * Card-grid view of every business location on the signed-in owner's
 * account (mirrors the admin's Business Locations table at
 * Client/src/components/BusinessLocationsManager.js, same backend
 * endpoints, same fields — just a card layout instead of a table, and
 * signed with the owner's own token instead of admin_token).
 *
 * Data comes from GET /auth/me (ShopOwnerView.locations[]) via
 * fetchMyProfile() — the same call the "My Profile" page already makes —
 * refetched after every add/edit/delete so the grid never goes stale.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from '@/lib/portalNavigation';
import { AlertTriangle, Plus, Store } from 'lucide-react';

import { cx } from '@/components/site/ui';
import PageHeader from '@/components/shop-dashboard/PageHeader';
import BusinessLocationCard from '@/components/shop-dashboard/BusinessLocationCard';
import LocationFormModal from '@/components/shop-dashboard/LocationFormModal';
import LocationDetailModal from '@/components/shop-dashboard/LocationDetailModal';
import { fetchMyProfile } from '@/lib/shopProfile';
import { readShopOwner } from '@/lib/shopAuth';
import { isOwnerSession } from '@/lib/shopAccess';
import { getShopPublic } from '@/lib/repairBooking';
import { addShopLocation, deleteShopLocation, updateShopLocation } from '@/lib/shopLocations';
import { notifyError } from '@/lib/toast';

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#024A57] focus-visible:ring-offset-2';

function ConfirmDeleteDialog({ location, busy, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#101828]/60 p-4">
      <div className="max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-3xl bg-white p-5 shadow-[0_20px_60px_rgba(16,24,40,0.25)] sm:p-6">
        <h3 className="text-lg font-bold text-[#111111]">Delete this business location?</h3>
        <p className="mt-2 break-words text-sm text-[#666666]">
          Permanently remove &ldquo;{location.name}&rdquo;. This cannot be undone.
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onCancel} className={cx('rounded-xl border border-[#D0D5DD] bg-white px-4 py-2.5 text-sm font-semibold text-[#344054] transition hover:bg-[#F8F8F8]', FOCUS_RING)}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={cx('rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60', FOCUS_RING)}
          >
            {busy ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BusinessProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [formState, setFormState] = useState(null); // { mode: 'add'|'edit', initial }
  const router = useRouter();
  // ?add=1&returnTo=… (subscription checkout "Add new shop") goes back there after the shop is saved.
  const returnTo = useRef('');
  const [viewingLoc, setViewingLoc] = useState(null);
  const [deletingLoc, setDeletingLoc] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // OWNER: every location from GET /auth/me, with Add / Edit / Delete.
  // SHOP login: only its own shop's public record (GET /auth/shops/{shopId}/public,
  // shopId from the JWT session) — no owner profile, no other shops, view only.
  const [session, setSession] = useState(undefined);
  useEffect(() => setSession(readShopOwner()), []);
  const owner = isOwnerSession(session);
  const [ownShop, setOwnShop] = useState(null);

  const load = useCallback(() => {
    setLoadError('');
    if (session === undefined) return Promise.resolve();
    if (!owner) {
      if (!session?.shopId) {
        setLoadError('Could not identify your shop. Please sign in again.');
        return Promise.resolve();
      }
      return getShopPublic(session.shopId).then((data) => {
        if (data) setOwnShop({ ...data, id: data.id || session.shopId });
        else setLoadError('Could not load your shop details.');
      });
    }
    return fetchMyProfile()
      .then((data) => setProfile(data))
      .catch((err) => setLoadError(err.message || 'Could not load your business profile.'));
  }, [session, owner]);

  useEffect(() => {
    if (session === undefined) return;
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load, session]);

  const locations = owner ? profile?.locations || [] : ownShop ? [ownShop] : [];
  const ownerId = owner ? profile?.id : null;

  // ?add=1 (Switch Account → Add Shop) opens the add form once the owner is known.
  useEffect(() => {
    if (!ownerId) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('add') !== '1') return;
    setFormState({ mode: 'add', initial: {} });
    const back = url.searchParams.get('returnTo') || '';
    if (back.startsWith('/shop-home/settings/subscription/')) returnTo.current = back;
    url.searchParams.delete('add');
    url.searchParams.delete('returnTo');
    window.history.replaceState(null, '', url);
  }, [ownerId]);

  const handleDelete = async () => {
    if (!deletingLoc) return;
    setDeleting(true);
    try {
      await deleteShopLocation(ownerId, deletingLoc.id);
      setDeletingLoc(null);
      await load();
    } catch (err) {
      notifyError(err.body?.message || err.message || 'Delete failed.');
    } finally {
      setDeleting(false);
    }
  };

  const submitLocation = async (payload, { isEdit, ownerId: oid, locationId }) => {
    if (isEdit) await updateShopLocation(oid, locationId, payload);
    else await addShopLocation(oid, payload);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business Profile"
        subtitle="Your shop/business information"
        action={
          !owner ? null : (
          <button
            type="button"
            onClick={() => setFormState({ mode: 'add', initial: {} })}
            disabled={!ownerId}
            className={cx(
              'inline-flex items-center gap-1.5 rounded-xl bg-[#F3BF23] px-4 py-2.5 text-sm font-semibold text-[#1E1E1E] transition hover:bg-[#E5B11A] disabled:cursor-not-allowed disabled:opacity-60',
              FOCUS_RING,
            )}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Business Location
          </button>
          )
        }
      />

      {loadError ? (
        <div role="alert" className="flex items-start gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{loadError}</span>
        </div>
      ) : null}

      {loading || session === undefined ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[320px] animate-pulse rounded-3xl border border-[#ECECEC] bg-[#F8F8F8]" />
          ))}
        </div>
      ) : locations.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#ECECEC] bg-[#F8F8F8] py-16 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#F8F8F8] text-[#024A57]">
            <Store className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="mt-3 text-sm font-semibold text-[#111111]">No business locations yet</p>
          <p className="mt-1 max-w-xs text-xs text-[#666666]">Add your first shop location to start taking bookings and pickups from customers nearby.</p>
          {owner ? (
          <button
            type="button"
            onClick={() => setFormState({ mode: 'add', initial: {} })}
            disabled={!ownerId}
            className={cx('mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#F3BF23] px-4 py-2.5 text-sm font-semibold text-[#1E1E1E] transition hover:bg-[#E5B11A] disabled:opacity-60', FOCUS_RING)}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Business Location
          </button>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map((loc, i) => (
            <BusinessLocationCard
              key={loc.id}
              location={loc}
              isMain={i === 0}
              onView={() => setViewingLoc(loc)}
              onEdit={owner ? () => setFormState({ mode: 'edit', initial: loc }) : undefined}
              onDelete={owner ? () => setDeletingLoc(loc) : undefined}
            />
          ))}
        </div>
      )}

      {owner && formState ? (
        <LocationFormModal
          ownerId={ownerId}
          mode={formState.mode}
          initial={formState.initial}
          submit={submitLocation}
          onClose={() => setFormState(null)}
          onSaved={async () => {
            const back = formState.mode === 'add' ? returnTo.current : '';
            returnTo.current = '';
            setFormState(null);
            if (back) {
              router.push(back);
              return;
            }
            await load();
          }}
        />
      ) : null}

      {viewingLoc ? <LocationDetailModal loc={viewingLoc} onClose={() => setViewingLoc(null)} /> : null}

      {owner && deletingLoc ? (
        <ConfirmDeleteDialog
          location={deletingLoc}
          busy={deleting}
          onCancel={() => setDeletingLoc(null)}
          onConfirm={handleDelete}
        />
      ) : null}
    </div>
  );
}
