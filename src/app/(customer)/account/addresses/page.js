'use client';

/**
 * Manage Address — /account/addresses. Mirrors the app's ManageAddress +
 * AddressForm screens: list of address cards (label icon, one-line address,
 * phone, default badge) with Set default / Edit / Delete, plus an inline
 * create/edit form.
 *
 * Data (all user-service, customer Bearer):
 *   GET/POST   /customer/addresses
 *   PUT/DELETE /customer/addresses/{id}
 *   POST       /customer/addresses/{id}/default
 * `area`/`district`/`taluk` are canonical; `locality`/`city` are dual-written
 * mirrors handled in customerAccount.createAddress/updateAddress.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Briefcase,
  Check,
  CheckCircle2,
  Home,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Tag,
  Trash2,
  X,
} from 'lucide-react';

import { Button, cx } from '@/components/site/ui';
import {
  createAddress,
  deleteAddress,
  formatAddress,
  listAddresses,
  setDefaultAddress,
  updateAddress,
} from '@/lib/customerAccount';
import {
  AccountEmpty,
  AccountError,
  AccountLoader,
  AccountPageHeader,
  Panel,
} from '@/components/site/account/ui';
import { exactDigits, required, validateForm } from '@/lib/formValidation';
import { focusField, registerField } from '@/lib/formFocus';
import { notifyError } from '@/lib/toast';

const LABELS = ['Home', 'Office', 'Other'];
const LABEL_ICON = { Home, Office: Briefcase, Other: Tag };

const EMPTY_FORM = {
  label: 'Home',
  fullName: '',
  mobile: '',
  addressLine: '',
  area: '',
  taluk: '',
  district: '',
  state: '',
  pincode: '',
  isDefault: false,
};

/* -------------------------------------------------------------------------- */
/* Add / edit form                                                             */
/* -------------------------------------------------------------------------- */

function Field({ label, required, children, error }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-brand-ink">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      {children}
      {error ? <p className="mt-1.5 text-xs text-red-600">{error}</p> : null}
    </label>
  );
}

const inputCls =
  'w-full rounded-xl border border-brand-strong bg-white px-3 py-2.5 text-sm text-brand-ink outline-none transition placeholder:text-brand-subtle focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20';

function AddressForm({ initial, onCancel, onSaved }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...(initial || {}) });
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const fieldRefs = useRef({});

  const set = (k) => (e) => {
    const v = e && e.target ? e.target.value : e;
    setForm((f) => ({ ...f, [k]: v }));
    if (fieldErrors[k]) setFieldErrors((prev) => ({ ...prev, [k]: undefined }));
  };

  const editing = Boolean(initial && initial.id);

  const submit = async (e) => {
    e.preventDefault();
    const { errors, firstErrorField, isValid } = validateForm(
      {
        fullName: required('Full name is required.'),
        mobile: [required('Mobile number is required.'), exactDigits(10, 'Enter a valid 10-digit mobile number.')],
        addressLine: required('Address is required.'),
        pincode: [required('Pincode is required.'), exactDigits(6, 'Enter a valid 6-digit pincode.')],
      },
      form,
    );
    if (!isValid) {
      setFieldErrors(errors);
      focusField(fieldRefs, firstErrorField);
      return;
    }
    setFieldErrors({});
    setBusy(true);
    try {
      if (editing) await updateAddress(initial.id, form);
      else await createAddress(form);
      onSaved();
    } catch (err) {
      notifyError(err, "Couldn't save the address. Please try again.");
      setBusy(false);
    }
  };

  return (
    <Panel className="p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-brand-ink">
          {editing ? 'Edit address' : 'Add a new address'}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close form"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-brand-muted transition hover:bg-brand-soften [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <form onSubmit={submit} className="mt-4 space-y-4">
        {/* Label segmented control */}
        <div>
          <span className="mb-1.5 block text-xs font-semibold text-brand-ink">Label</span>
          <div className="flex flex-wrap gap-2">
            {LABELS.map((l) => {
              const Icon = LABEL_ICON[l];
              const active = form.label === l;
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, label: l }))}
                  className={cx(
                    'inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition',
                    active
                      ? 'bg-brand-600 text-white'
                      : 'border border-brand-line bg-white text-brand-muted hover:text-brand-ink',
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {l}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Full name" required error={fieldErrors.fullName}>
            <input
              ref={registerField(fieldRefs, 'fullName')}
              className={inputCls}
              value={form.fullName}
              onChange={set('fullName')}
              placeholder="Your name"
              aria-invalid={Boolean(fieldErrors.fullName)}
            />
          </Field>
          <Field label="Mobile" required error={fieldErrors.mobile}>
            <input
              ref={registerField(fieldRefs, 'mobile')}
              className={inputCls}
              value={form.mobile}
              onChange={set('mobile')}
              inputMode="tel"
              placeholder="10-digit mobile"
              aria-invalid={Boolean(fieldErrors.mobile)}
            />
          </Field>
        </div>

        <Field label="Address (house / street / area line)" required error={fieldErrors.addressLine}>
          <input
            ref={registerField(fieldRefs, 'addressLine')}
            className={inputCls}
            value={form.addressLine}
            onChange={set('addressLine')}
            placeholder="Flat, building, street"
            aria-invalid={Boolean(fieldErrors.addressLine)}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Area / locality">
            <input className={inputCls} value={form.area} onChange={set('area')} placeholder="Area" />
          </Field>
          <Field label="Taluk">
            <input className={inputCls} value={form.taluk} onChange={set('taluk')} placeholder="Taluk" />
          </Field>
          <Field label="District / city">
            <input className={inputCls} value={form.district} onChange={set('district')} placeholder="District" />
          </Field>
          <Field label="State">
            <input className={inputCls} value={form.state} onChange={set('state')} placeholder="State" />
          </Field>
          <Field label="Pincode" required error={fieldErrors.pincode}>
            <input
              ref={registerField(fieldRefs, 'pincode')}
              className={inputCls}
              value={form.pincode}
              onChange={set('pincode')}
              inputMode="numeric"
              placeholder="6-digit pincode"
              aria-invalid={Boolean(fieldErrors.pincode)}
            />
          </Field>
        </div>

        <label className="flex items-center gap-2.5 text-sm font-medium text-brand-ink">
          <input
            type="checkbox"
            checked={Boolean(form.isDefault)}
            onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
            className="h-4 w-4 rounded border-brand-strong text-brand-600 focus:ring-brand-600"
          />
          Set as default address
        </label>

        <div className="flex flex-wrap gap-3 pt-1">
          <Button type="submit" variant="primary" size="md" disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Save address'}
          </Button>
          <Button type="button" variant="outline" size="md" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        </div>
      </form>
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */
/* Address card                                                                */
/* -------------------------------------------------------------------------- */

// Same look as the Saved devices cards: tinted icon tile, label + name,
// address and phone, a Default ribbon, outlined actions and a bin icon.
function AddressCard({ address, onEdit, onDelete, onSetDefault, busy }) {
  const Icon = LABEL_ICON[address.label] || MapPin;
  return (
    <Panel className="relative overflow-hidden p-4" highlight={address.isDefault}>
      {address.isDefault ? (
        <span className="absolute right-0 top-0 inline-flex items-center gap-1 rounded-bl-2xl bg-brand-600 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-white">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          Default
        </span>
      ) : null}
      <div className="flex items-start gap-4">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-soft text-brand-700">
          <Icon className="h-7 w-7" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.68rem] font-bold uppercase tracking-wider text-brand-600">{address.label || 'Address'}</p>
          <p className="mt-0.5 truncate text-[1.02rem] font-extrabold text-brand-ink">{address.fullName || 'Saved address'}</p>
          <p className="mt-1.5 flex items-start gap-1.5 text-sm text-brand-ink">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
            <span className="line-clamp-2">{formatAddress(address)}</span>
          </p>
          {address.mobile ? (
            <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-brand-line bg-white px-2.5 py-1 text-[0.72rem] font-semibold text-brand-ink">
              <Phone className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
              +91 {address.mobile}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-brand-line pt-3">
        <button
          type="button"
          onClick={() => onEdit(address)}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full border border-brand-line px-3 py-1.5 text-xs font-bold [@media(pointer:coarse)]:min-h-10 text-brand-ink transition hover:border-brand-600 hover:text-brand-700 disabled:opacity-50"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          Edit
        </button>
        {!address.isDefault ? (
          <button
            type="button"
            onClick={() => onSetDefault(address)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand-line px-3 py-1.5 text-xs font-bold [@media(pointer:coarse)]:min-h-10 text-brand-700 transition hover:border-brand-600 hover:bg-brand-soft disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            Set default
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onDelete(address)}
          disabled={busy}
          aria-label={`Delete ${address.label || 'address'}`}
          title="Delete"
          className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full text-red-600 [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10 transition hover:bg-red-50 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export default function ManageAddressPage() {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mutating, setMutating] = useState(false);
  const [form, setForm] = useState(null); // null = closed, {} = add, {..address} = edit

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setAddresses(await listAddresses());
    } catch (e) {
      setError(e?.message || '');
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onSetDefault = async (a) => {
    setMutating(true);
    try {
      await setDefaultAddress(a.id);
      await load();
    } catch (e) {
      notifyError(e, "Couldn't set the default address. Please try again.");
    } finally {
      setMutating(false);
    }
  };

  const onDelete = async (a) => {
    if (typeof window !== 'undefined' && !window.confirm('Delete this address?')) return;
    setMutating(true);
    try {
      await deleteAddress(a.id);
      await load();
    } catch (e) {
      notifyError(e, "Couldn't delete the address. Please try again.");
    } finally {
      setMutating(false);
    }
  };

  const onSaved = async () => {
    setForm(null);
    await load();
  };

  return (
    <div>
      <AccountPageHeader
        eyebrow="Manage Addresses"
        title="Your delivery locations"
        subtitle={addresses.length ? `${addresses.length} saved` : undefined}
        right={
          !form ? (
            <Button variant="primary" size="sm" icon={Plus} iconPosition="left" onClick={() => setForm({})}>
              Add address
            </Button>
          ) : null
        }
      />

      <div className="mt-5 space-y-4">
        {form ? (
          // key remounts the form when the edit target changes, so its useState
          // initializer re-seeds with the new address (otherwise editing B while
          // A's form is open would keep A's values and save them over B).
          <AddressForm
            key={form.id || 'new'}
            initial={form.id ? form : null}
            onCancel={() => setForm(null)}
            onSaved={onSaved}
          />
        ) : null}

        {loading ? (
          <AccountLoader label="Loading addresses…" />
        ) : error ? (
          <AccountError message={error} onRetry={load} />
        ) : addresses.length === 0 && !form ? (
          <AccountEmpty
            icon={MapPin}
            title="No addresses yet"
            description="Add one to get started with pickup and delivery."
            action={
              <Button variant="primary" size="md" icon={Plus} iconPosition="left" onClick={() => setForm({})}>
                Add a new address
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[...addresses].sort((x, y) => Number(Boolean(y.isDefault)) - Number(Boolean(x.isDefault))).map((a) => (
              <AddressCard
                key={a.id}
                address={a}
                busy={mutating}
                onEdit={(addr) => setForm(addr)}
                onDelete={onDelete}
                onSetDefault={onSetDefault}
              />
            ))}
            {!form ? (
              <button
                type="button"
                onClick={() => setForm({})}
                className="group flex min-h-[176px] flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-brand-strong bg-brand-50/40 p-5 text-center transition hover:border-brand-600 hover:bg-brand-50"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-soft transition group-hover:scale-105">
                  <Plus className="h-6 w-6" aria-hidden="true" />
                </span>
                <span className="text-sm font-extrabold text-brand-ink">Add a new address</span>
                <span className="text-xs text-brand-muted">Home, work or any pickup / delivery location.</span>
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
