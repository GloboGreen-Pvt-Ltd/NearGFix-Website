'use client';

/**
 * /shop-home/sell/spare-parts/ — Sell a Device, Spare Parts path (the Partner
 * app's OwnerSellSparePartsScreen). Five preset groups of part cards, each
 * card with one photo slot (folder "spare-parts"); adding a photo also selects
 * that preset part. "+ Add" drops in a custom card — a typed name and/or a
 * photo makes it count. Sell Now takes the picked parts to Price, where each
 * priced part becomes its own listing.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Camera, CircleX, CloudUpload, Cpu, LayoutGrid, Loader2, Plus, Smartphone, SwitchCamera, X } from 'lucide-react';

import { cx } from '@/components/site/ui';
import { SellButton, SellFooter, SellLoading, SellMissingDraft, SellShell } from '@/components/shop-dashboard/SellStep';
import { SELL_STEP_HREF } from '@/lib/sellFlow';
import { saveSellDraft, uploadSellPhoto, useSellDraft } from '@/lib/sellListing';
import { notifyError } from '@/lib/toast';

const GREEN = { icon: 'bg-[#E5F3F5] text-[#035C6C]', empty: 'border-[#C7E6EA] bg-[#E5F3F5]', on: 'border-[#035C6C] bg-[#E5F3F5] text-[#024A57]', text: 'text-[#035C6C]' };
const AMBER = { icon: 'bg-[#FFFBEB] text-[#D97706]', empty: 'border-[#FDE68A] bg-[#FFFBEB]', on: 'border-[#D97706] bg-[#FFFBEB] text-[#B45309]', text: 'text-[#D97706]' };

// The app's PRESET_GROUPS.
const GROUPS = [
  { key: 'DISPLAY', label: 'Display Combo', sub: 'Add main & sub screen', icon: Smartphone, tone: GREEN, parts: ['Main Screen Display Combo', 'Sub Screen Display Combo'] },
  { key: 'MOTHERBOARD', label: 'Motherboard', sub: 'Add motherboard & variants', icon: Cpu, tone: GREEN, parts: ['Motherboard 16GB / 512GB', 'Battery'] },
  { key: 'FRONT_CAMERA', label: 'Front Camera', sub: 'Add front camera', icon: Camera, tone: GREEN, parts: ['Front Camera'] },
  { key: 'BACK_CAMERA', label: "Back Camera's", sub: 'Add back camera', icon: SwitchCamera, tone: AMBER, parts: ['Back Main Camera'] },
  { key: 'MORE', label: 'More Items', sub: 'Add other components', icon: LayoutGrid, tone: GREEN, parts: ['Side Frame', 'Back Panel (Backshell)', 'Charging Sub Board', 'SIM Tray', 'Loudspeaker'] },
];

const newCustomId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export default function SparePartsPage() {
  const router = useRouter();
  const draft = useSellDraft();
  const [sel, setSel] = useState({}); // groupKey -> preset part names
  const [photos, setPhotos] = useState({}); // groupKey -> { slotId: url }  (slotId = preset name or custom id)
  const [added, setAdded] = useState({}); // groupKey -> [{ id, name }]
  const [uploading, setUploading] = useState(null); // "groupKey/slotId"

  // Coming back to this step keeps the earlier cards, picks and photos.
  useEffect(() => {
    const saved = draft?.partsDraft;
    if (!saved) return;
    setSel(saved.sel || {});
    setPhotos(saved.photos || {});
    setAdded(saved.added || {});
  }, [draft]);

  const items = useMemo(() => {
    const all = [];
    GROUPS.forEach((g) => {
      g.parts.forEach((name) => {
        if (!(sel[g.key] || []).includes(name)) return;
        const url = photos[g.key]?.[name] || null;
        all.push({ groupKey: g.key, group: g.label, partName: name, imageUrl: url, imageUrls: url ? [url] : [], custom: false });
      });
      (added[g.key] || []).forEach((c) => {
        const url = photos[g.key]?.[c.id] || null;
        const name = String(c.name || '').trim();
        if (!name && !url) return; // an untouched blank card
        all.push({ groupKey: g.key, group: g.label, partName: name || 'Custom part', imageUrl: url, imageUrls: url ? [url] : [], custom: true });
      });
    });
    return all;
  }, [sel, photos, added]);

  const shell = { title: 'Spare Parts', subtitle: draft?.model?.name, width: 'max-w-5xl' };
  if (draft === undefined) return <SellShell {...shell}><SellLoading /></SellShell>;
  if (!draft?.model) return <SellShell {...shell}><SellMissingDraft /></SellShell>;

  const togglePreset = (groupKey, name) =>
    setSel((prev) => {
      const list = prev[groupKey] || [];
      return { ...prev, [groupKey]: list.includes(name) ? list.filter((n) => n !== name) : [...list, name] };
    });

  async function onPick(groupKey, slotId, autoSelectPreset, e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(`${groupKey}/${slotId}`);
    try {
      const url = await uploadSellPhoto(file, 'spare-parts');
      setPhotos((prev) => ({ ...prev, [groupKey]: { ...(prev[groupKey] || {}), [slotId]: url } }));
      if (autoSelectPreset) {
        setSel((prev) => {
          const list = prev[groupKey] || [];
          return list.includes(slotId) ? prev : { ...prev, [groupKey]: [...list, slotId] };
        });
      }
    } catch (err) {
      notifyError(err, 'Upload failed. Try again.');
    } finally {
      setUploading(null);
    }
  }

  const removePhoto = (groupKey, slotId) =>
    setPhotos((prev) => {
      const next = { ...(prev[groupKey] || {}) };
      delete next[slotId];
      return { ...prev, [groupKey]: next };
    });

  const addCustom = (groupKey) => setAdded((prev) => ({ ...prev, [groupKey]: [...(prev[groupKey] || []), { id: newCustomId(), name: '' }] }));
  const renameCustom = (groupKey, id, name) =>
    setAdded((prev) => ({ ...prev, [groupKey]: (prev[groupKey] || []).map((c) => (c.id === id ? { ...c, name } : c)) }));
  const removeCustom = (groupKey, id) => {
    setAdded((prev) => ({ ...prev, [groupKey]: (prev[groupKey] || []).filter((c) => c.id !== id) }));
    removePhoto(groupKey, id);
  };

  function onSellNow() {
    if (!items.length) return;
    const partImages = {};
    items
      .flatMap((it) => it.imageUrls)
      .slice(0, 5)
      .forEach((url, i) => {
        partImages[`p${i + 1}`] = url;
      });
    saveSellDraft({ mode: 'parts', spareParts: items, partImages, partsDraft: { sel, photos, added } });
    router.push(SELL_STEP_HREF.price);
  }

  // One photo per card: a dashed upload box, or the photo with Remove and
  // Replace. Called as a function (not a nested component) so its inputs keep
  // their identity across renders.
  function photoSlot(g, slotId, autoSelectPreset, label) {
    const url = photos[g.key]?.[slotId] || null;
    const busy = uploading === `${g.key}/${slotId}`;
    const input = (
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={Boolean(uploading)}
        onChange={(e) => onPick(g.key, slotId, autoSelectPreset, e)}
        aria-label={`${url ? 'Replace' : 'Upload'} photo for ${label}`}
      />
    );
    const Icon = g.icon;
    return (
      <div className={cx('relative h-28 overflow-hidden rounded-[14px] border-[1.5px]', url ? 'border-solid border-[#035C6C] bg-white' : cx('border-dashed', g.tone.empty))}>
        {url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- uploaded photo URL. */}
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => removePhoto(g.key, slotId)}
              aria-label={`Remove photo for ${label}`}
              className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/70"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <label className="absolute bottom-1.5 left-1.5 inline-flex cursor-pointer items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[10.5px] font-bold text-white transition focus-within:ring-2 focus-within:ring-white hover:bg-black/70">
              {input}
              <Camera className="h-3 w-3" aria-hidden="true" />
              Replace
            </label>
          </>
        ) : (
          <label className={cx('flex h-full flex-col items-center justify-center gap-2 focus-within:ring-4 focus-within:ring-[#035C6C]/20', uploading ? 'cursor-wait' : 'cursor-pointer')}>
            {input}
            <Icon className="h-7 w-7 text-[#8E8E8E]" aria-hidden="true" />
            <span className="flex items-center gap-1 text-[11.5px] font-semibold text-[#666666]">
              <CloudUpload className={cx('h-3.5 w-3.5', g.tone.text)} aria-hidden="true" />
              Upload image
            </span>
          </label>
        )}
        {busy ? (
          <span className="absolute inset-0 flex items-center justify-center bg-white/60">
            <Loader2 className={cx('h-6 w-6 animate-spin', g.tone.text)} aria-hidden="true" />
          </span>
        ) : null}
      </div>
    );
  }

  const footer = (
    <SellFooter width="max-w-5xl" caption={uploading ? 'Uploading photo…' : items.length ? `${items.length} part${items.length === 1 ? '' : 's'} selected` : 'Pick or add at least one part'}>
      <SellButton onClick={onSellNow} disabled={!items.length || Boolean(uploading)} icon={ArrowRight}>
        Sell Now{items.length ? ` (${items.length})` : ''}
      </SellButton>
    </SellFooter>
  );

  return (
    <SellShell {...shell} footer={footer}>
      {GROUPS.map((g) => {
        const Icon = g.icon;
        const picked = items.filter((it) => it.groupKey === g.key).length;
        return (
          <section key={g.key} className="rounded-[18px] border border-[#ECECEC] bg-white p-3.5 sm:p-4">
            <div className="mb-3 flex items-center gap-2.5">
              <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]', g.tone.icon)}>
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-[14.5px] font-extrabold text-[#111111]">{g.label}</h3>
                <p className="text-[12px] text-[#8E8E8E]">{g.sub}</p>
              </div>
              <button
                type="button"
                onClick={() => addCustom(g.key)}
                aria-label={`Add a ${g.label} part`}
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#035C6C] px-3.5 py-2 text-[12.5px] font-extrabold text-white transition hover:bg-[#024A57]"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Add
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {g.parts.map((name) => {
                const active = (sel[g.key] || []).includes(name);
                return (
                  <div key={name}>
                    {photoSlot(g, name, true, name)}
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => togglePreset(g.key, name)}
                      className={cx(
                        'mt-1.5 w-full rounded-xl border px-2.5 py-2 text-center text-[12.5px] leading-snug transition',
                        active ? cx(g.tone.on, 'font-extrabold') : 'border-[#ECECEC] bg-white font-bold text-[#111111] hover:border-[#D0D5DD]',
                      )}
                    >
                      {name}
                    </button>
                  </div>
                );
              })}

              {(added[g.key] || []).map((c) => (
                <div key={c.id}>
                  {photoSlot(g, c.id, false, c.name || 'custom part')}
                  <div className="mt-1.5 flex items-center rounded-xl border border-[#ECECEC] bg-white pl-2.5 pr-1 focus-within:border-[#035C6C]">
                    <input
                      value={c.name}
                      onChange={(e) => renameCustom(g.key, c.id, e.target.value)}
                      placeholder="Enter part name"
                      aria-label={`${g.label} part name`}
                      className="min-w-0 flex-1 bg-transparent py-2 text-[12.5px] font-bold text-[#111111] outline-none placeholder:font-semibold placeholder:text-[#8E8E8E]"
                    />
                    <button
                      type="button"
                      onClick={() => removeCustom(g.key, c.id)}
                      aria-label="Remove this part"
                      className="rounded-full p-1 text-[#8E8E8E] transition hover:text-[#D92D20]"
                    >
                      <CircleX className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {picked ? (
              <p className={cx('mt-2 text-[12px] font-bold', g.tone.text)}>
                {picked} item{picked === 1 ? '' : 's'} selected
              </p>
            ) : null}
          </section>
        );
      })}
    </SellShell>
  );
}
