'use client';

/**
 * Customer saved devices. Add and edit share the customer app's data path:
 * master-data supplies the category/brand/model hierarchy and user-service
 * owns the saved-device record, so both client surfaces stay in sync.
 *
 * Cards show the model's catalogue photo (GET /master/brands/{id}/models,
 * matched by modelId; the category icon when there is none), the name without
 * a repeated brand, colour / RAM-storage / IMEI chips and a Default ribbon.
 * "Add a new device" is a dashed tile at the end of the grid.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Hash,
  HardDrive,
  Headphones,
  Laptop,
  Pencil,
  Plus,
  Smartphone,
  Star,
  Tablet,
  Trash2,
  Watch,
} from 'lucide-react';

import { Button } from '@/components/site/ui';
import DeviceWizard from '@/components/site/account/DeviceWizard';
import { deleteDevice, listDevices, setDefaultDevice } from '@/lib/customerAccount';
import {
  AccountEmpty,
  AccountError,
  AccountLoader,
  AccountPageHeader,
  Chip,
  Panel,
} from '@/components/site/account/ui';
import { notifyError } from '@/lib/toast';
import { masterApi } from '@/lib/api';
import { resolveMediaUrl } from '@/lib/deviceImage';

const CATEGORIES = [
  { code: 'ALL', label: 'All' },
  { code: 'MOBILE', label: 'Phones' },
  { code: 'LAPTOP', label: 'Laptops' },
  { code: 'SMARTWATCH', label: 'Watches' },
  { code: 'TABLET', label: 'Tablets' },
  { code: 'AUDIO', label: 'Audio' },
  { code: 'SPEAKER', label: 'Speakers' },
];

const CAT_ICON = {
  MOBILE: Smartphone,
  LAPTOP: Laptop,
  SMARTWATCH: Watch,
  TABLET: Tablet,
  AUDIO: Headphones,
  SPEAKER: Headphones,
};

const CODE_ALIASES = {
  MOBILE: 'MOBILE', SMARTPHONE: 'MOBILE', SMARTPHONES: 'MOBILE',
  LAPTOP: 'LAPTOP', LAPTOPS: 'LAPTOP',
  SMARTWATCH: 'SMARTWATCH', SMARTWATCHES: 'SMARTWATCH', WATCH: 'SMARTWATCH', WATCHES: 'SMARTWATCH',
  TABLET: 'TABLET', TABLETS: 'TABLET',
  AUDIO: 'AUDIO', AUDIO_DEVICE: 'AUDIO', AUDIO_DEVICES: 'AUDIO',
  SPEAKER: 'SPEAKER', SPEAKERS: 'SPEAKER',
};

const canonicalCode = (code) => {
  const normalized = String(code || '').toUpperCase();
  return CODE_ALIASES[normalized] || normalized || 'OTHER';
};

/** "Apple iPhone 11" — the brand only when the model name doesn't already start with it. */
function deviceName(device) {
  const brand = String(device.brandName || '').trim();
  const model = String(device.modelName || '').trim();
  if (!model) return brand || 'Saved device';
  return brand && !model.toLowerCase().startsWith(brand.toLowerCase()) ? `${brand} ${model}` : model;
}

const CAT_LABEL = Object.fromEntries(CATEGORIES.filter((c) => c.code !== 'ALL').map((c) => [c.code, c.label.replace(/s$/, '')]));

function SpecChip({ icon: Icon, children }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-brand-line bg-white px-2.5 py-1 text-[0.72rem] font-semibold text-brand-ink">
      {Icon ? <Icon className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

function DevicePhoto({ url, icon: Icon }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-brand-50 to-brand-soft">
      {url && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element -- master-data model photo.
        <img src={url} alt="" onError={() => setBroken(true)} className="h-full w-full object-contain p-2" />
      ) : (
        <Icon className="h-9 w-9 text-brand-700" aria-hidden="true" />
      )}
    </span>
  );
}

function DeviceCard({ device, image, onSetDefault, onEdit, onDelete, busy }) {
  const code = canonicalCode(device.categoryCode);
  const Icon = CAT_ICON[code] || Smartphone;
  const spec = [device.ramLabel, device.storageLabel].filter(Boolean).join(' / ');

  return (
    <Panel className="relative overflow-hidden p-4" highlight={device.isDefault}>
      {device.isDefault ? (
        <span className="absolute right-0 top-0 inline-flex items-center gap-1 rounded-bl-2xl bg-brand-600 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-white">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          Default
        </span>
      ) : null}
      <div className="flex items-center gap-4">
        <DevicePhoto url={image} icon={Icon} />
        <div className="min-w-0 flex-1">
          <p className="text-[0.68rem] font-bold uppercase tracking-wider text-brand-600">{CAT_LABEL[code] || 'Device'}</p>
          <p className="mt-0.5 truncate text-[1.02rem] font-extrabold text-brand-ink" title={deviceName(device)}>
            {deviceName(device)}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {device.color ? <SpecChip>{device.color}</SpecChip> : null}
            {spec ? <SpecChip icon={HardDrive}>{spec}</SpecChip> : null}
            {device.imei ? <SpecChip icon={Hash}>{device.imei}</SpecChip> : null}
          </div>
          {device.note ? <p className="mt-2 line-clamp-1 text-xs text-brand-muted">Note: {device.note}</p> : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-brand-line pt-3">
        <button type="button" onClick={() => onEdit(device)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-full border border-brand-line px-3 py-1.5 text-xs font-bold [@media(pointer:coarse)]:min-h-10 text-brand-ink transition hover:border-brand-600 hover:text-brand-700 disabled:opacity-50">
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />Edit
        </button>
        {!device.isDefault ? (
          <button type="button" onClick={() => onSetDefault(device)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-full border border-brand-line px-3 py-1.5 text-xs font-bold [@media(pointer:coarse)]:min-h-10 text-amber-700 transition hover:border-amber-400 hover:bg-amber-50 disabled:opacity-50">
            <Star className="h-3.5 w-3.5" aria-hidden="true" />Set default
          </button>
        ) : null}
        <button type="button" onClick={() => onDelete(device)} disabled={busy} aria-label={`Delete ${deviceName(device)}`} title="Delete" className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full text-red-600 [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10 transition hover:bg-red-50 disabled:opacity-50">
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </Panel>
  );
}

export default function ManageDevicePage() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mutating, setMutating] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [editor, setEditor] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setDevices(await listDevices());
    } catch (cause) {
      setError(cause?.message || 'Could not load saved devices.');
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Catalogue photo per saved device (one models call per brand).
  const [photos, setPhotos] = useState({});
  useEffect(() => {
    const brandIds = [...new Set(devices.map((d) => d.brandId).filter(Boolean).map(String))];
    if (!brandIds.length) return undefined;
    let alive = true;
    Promise.all(brandIds.map((id) => masterApi.get(`/master/brands/${encodeURIComponent(id)}/models`).catch(() => [])))
      .then((lists) => {
        if (!alive) return;
        const map = {};
        lists.flatMap((l) => (Array.isArray(l) ? l : l?.content || [])).forEach((m) => {
          const url = resolveMediaUrl(m.imageUrl) || (m.imageBase64 ? `data:image/png;base64,${m.imageBase64}` : null);
          if (m?.id && url) map[String(m.id).toLowerCase()] = url;
        });
        setPhotos(map);
      });
    return () => {
      alive = false;
    };
  }, [devices]);

  const counts = useMemo(() => {
    const map = { ALL: devices.length };
    devices.forEach((device) => {
      const code = canonicalCode(device.categoryCode);
      map[code] = (map[code] || 0) + 1;
    });
    return map;
  }, [devices]);

  const visible = useMemo(
    () => (filter === 'ALL' ? devices : devices.filter((device) => canonicalCode(device.categoryCode) === filter)),
    [devices, filter],
  );

  useEffect(() => {
    if (filter !== 'ALL' && !counts[filter]) setFilter('ALL');
  }, [counts, filter]);

  const onSetDefault = async (device) => {
    setMutating(true);
    try {
      await setDefaultDevice(device.id);
      await load();
    } catch (cause) {
      notifyError(cause, 'Could not update the default device.');
    } finally {
      setMutating(false);
    }
  };

  const onDelete = async (device) => {
    if (typeof window !== 'undefined' && !window.confirm('Delete this saved device?')) return;
    setMutating(true);
    try {
      await deleteDevice(device.id);
      await load();
    } catch (cause) {
      notifyError(cause, 'Could not delete this device.');
    } finally {
      setMutating(false);
    }
  };

  const onSaved = async () => {
    setEditor(null);
    await load();
  };

  const chips = CATEGORIES.filter((category) => category.code === 'ALL' || counts[category.code]);
  const editing = Boolean(editor?.id);

  return (
    <div>
      <AccountPageHeader
        eyebrow="Manage My Device"
        title={editor ? (editing ? 'Edit device' : 'Add a device') : 'Saved devices'}
        subtitle={editor ? 'The same device catalogue and save logic used in the NearGFix app.' : 'Your devices, ready for faster repair bookings.'}
        right={!editor ? (
          <Button onClick={() => setEditor({})} variant="primary" size="sm" icon={Plus} iconPosition="left">Add device</Button>
        ) : null}
      />

      {editor ? (
        <div className="mt-5">
          <DeviceWizard device={editing ? editor : null} onClose={() => setEditor(null)} onSaved={onSaved} />
        </div>
      ) : (
        <>
          {!loading && !error && devices.length > 0 ? (
            <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
              {chips.map((category) => (
                <Chip key={category.code} active={filter === category.code} onClick={() => setFilter(category.code)} count={counts[category.code] || 0}>
                  {category.label}
                </Chip>
              ))}
            </div>
          ) : null}

          <div className="mt-5">
            {loading ? (
              <AccountLoader label="Loading your devices…" />
            ) : error ? (
              <AccountError message={error} onRetry={load} />
            ) : devices.length === 0 ? (
              <AccountEmpty
                icon={Smartphone}
                title="No saved devices yet"
                description="Add a device to speed up your repair bookings."
                action={<Button onClick={() => setEditor({})} variant="primary" size="md" icon={Plus} iconPosition="left">Add device</Button>}
              />
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {visible.map((device) => (
                    <DeviceCard
                      key={device.id}
                      device={device}
                      image={photos[String(device.modelId || '').toLowerCase()]}
                      busy={mutating}
                      onSetDefault={onSetDefault}
                      onEdit={setEditor}
                      onDelete={onDelete}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => setEditor({})}
                    className="group flex min-h-[176px] flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-brand-strong bg-brand-50/40 p-5 text-center transition hover:border-brand-600 hover:bg-brand-50"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-soft transition group-hover:scale-105">
                      <Plus className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-extrabold text-brand-ink">Add a new device</span>
                    <span className="text-xs text-brand-muted">Pick a category, brand, model and configuration.</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
