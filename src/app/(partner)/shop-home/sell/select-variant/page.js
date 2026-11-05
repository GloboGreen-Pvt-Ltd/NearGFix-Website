'use client';

/**
 * /shop-home/sell/select-variant/ — Sell a Device, step 5 (whole device):
 * colour and RAM/storage, the Partner app's SelectVariantScreen in its
 * OWNER_LIST mode (no IMEI, no working/dead toggle — Choose Description asks
 * that next).
 *
 * Options: the model's own colours and "6 GB + 128 GB" / "128 GB" variants
 * (fetchModelOptions), else the full master RAM/storage lists, else (colours
 * only) the app's six fallback colours. Smart watches and audio devices take
 * no RAM/storage. Only real UUIDs go into the device payload, as in the app.
 */

import { useEffect, useState } from 'react';
import { useRouter } from '@/lib/portalNavigation';
import { ArrowRight, Cpu, HardDrive, Palette } from 'lucide-react';

import { cx } from '@/components/site/ui';
import {
  CheckDot,
  SellButton,
  SellCard,
  SellFooter,
  SellLoading,
  SellMissingDraft,
  SellShell,
  SellThumb,
  choiceCls,
} from '@/components/shop-dashboard/SellStep';
import { SELL_STEP_HREF, fetchModelOptions, isUuid } from '@/lib/sellFlow';
import { draftCategoryCode, noRamStorageFor, saveSellDraft, useSellDraft } from '@/lib/sellListing';

// The app's swatch lookup: exact two-word names first, then a keyword match.
const COLOR_SWATCHES = {
  black: '#1A1A1A', white: '#F7FAF7', silver: '#C7CDD1', gold: '#E6C384',
  rose: '#E8B4B8', blue: '#3B82F6', red: '#DC2626', green: '#035C6C',
  purple: '#8B5CF6', pink: '#EC4899', graphite: '#4B5563', midnight: '#1E293B',
  starlight: '#F5F1E6', sierra: '#9DB4C0', alpine: '#2F6B4F', sky: '#BFDBFE',
  phantom: '#374151', cosmic: '#1E3A5F',
};
const COMPOUND_COLOR_SWATCHES = {
  'rose gold': '#E8B4B8',
  'space gray': '#5B5F62',
  'space grey': '#5B5F62',
  'midnight green': '#1E293B',
  'pacific blue': '#1E3A5F',
};
function swatchFor(name) {
  const n = String(name || '').toLowerCase().trim();
  if (COMPOUND_COLOR_SWATCHES[n]) return COMPOUND_COLOR_SWATCHES[n];
  const key = Object.keys(COLOR_SWATCHES).find((k) => n.includes(k));
  return key ? COLOR_SWATCHES[key] : '#8FA08F';
}

const FALLBACK_COLORS = ['Midnight Black', 'Phantom Silver', 'Cosmic Blue', 'Rose Gold', 'Starlight', 'Alpine Green'].map((name) => ({ id: name, name }));

const onlyUuid = (v) => (isUuid(v) ? v : undefined);
const solidCls = (active) =>
  active ? 'border-[#035C6C] bg-[#035C6C] text-white' : 'border-[#ECECEC] bg-white text-[#111111] hover:border-[#D0D5DD]';

function PickerCard({ icon: Icon, title, aside, children }) {
  return (
    <SellCard>
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E5F3F5] text-[#035C6C]">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <h3 className="flex-1 text-[14px] font-extrabold text-[#111111]">{title}</h3>
        {aside}
      </div>
      {children}
    </SellCard>
  );
}

function Swatch({ color, className = 'h-5 w-5' }) {
  return <span className={cx('shrink-0 rounded-full border border-[#D0D5DD]', className)} style={{ backgroundColor: color }} aria-hidden="true" />;
}

export default function SelectVariantPage() {
  const router = useRouter();
  const draft = useSellDraft();
  const modelId = draft?.model?.id;
  const [opts, setOpts] = useState(null); // { colors, specs, rams, storages }
  const [color, setColor] = useState(null);
  const [ram, setRam] = useState(null);
  const [storage, setStorage] = useState(null);

  // Coming back to this step keeps the earlier pick.
  useEffect(() => {
    const pick = draft?.variantPick;
    if (!pick) return;
    setColor(pick.color || null);
    setRam(pick.ram || null);
    setStorage(pick.storage || null);
  }, [draft]);

  useEffect(() => {
    if (!modelId) return undefined;
    let alive = true;
    fetchModelOptions(modelId)
      .then((o) => {
        if (!alive) return;
        const cs = o.colors.length ? o.colors : o.allColors;
        setOpts({ colors: cs.length ? cs : FALLBACK_COLORS, specs: o.specs, rams: o.allRams, storages: o.allStorages });
      })
      .catch(() => alive && setOpts({ colors: FALLBACK_COLORS, specs: [], rams: [], storages: [] }));
    return () => {
      alive = false;
    };
  }, [modelId]);

  const shell = { title: 'Your Device', subtitle: draft?.model?.name };
  if (draft === undefined) return <SellShell {...shell}><SellLoading /></SellShell>;
  if (!draft?.model) return <SellShell {...shell}><SellMissingDraft /></SellShell>;
  if (!opts) return <SellShell {...shell}><SellLoading label="Loading variants…" /></SellShell>;

  const { category, brand, model } = draft;
  const code = draftCategoryCode(draft);
  const noRamStorage = noRamStorageFor(code);
  const specsStorageOnly = opts.specs.length > 0 && opts.specs.every((s) => s.storageOnly);
  // A pick is only required when there is something to pick from.
  const needsStorage = !noRamStorage && (opts.specs.length > 0 || opts.storages.length > 0);
  const needsRam = needsStorage && !specsStorageOnly && (opts.specs.length > 0 || opts.rams.length > 0);
  const ready = Boolean(color && (!needsStorage || storage) && (!needsRam || ram));
  const variantText = [ram?.label, storage?.label].filter(Boolean).join(' · ');

  function onContinue() {
    if (!ready) return;
    const device = {
      categoryId: onlyUuid(category?.id),
      categoryCode: code || undefined,
      brandId: onlyUuid(brand?.id),
      modelId: onlyUuid(model.id),
      modelName: model.name || undefined,
      brandName: brand?.name || undefined,
      imageUrl: model.imageUrl || undefined,
      ramLabel: noRamStorage ? undefined : ram?.label || undefined,
      storageLabel: noRamStorage ? undefined : storage?.label || undefined,
      ramOptionId: noRamStorage ? undefined : onlyUuid(ram?.id),
      storageOptionId: noRamStorage ? undefined : onlyUuid(storage?.id),
      color: color.name || color.id,
      imei: '',
    };
    saveSellDraft({ device, variantPick: { color, ram, storage } });
    router.push(SELL_STEP_HREF.description);
  }

  const footer = (
    <SellFooter caption={ready ? 'Ready — next, choose how to describe it' : `Pick a colour${needsStorage ? ' and variant' : ''} to continue`}>
      <SellButton onClick={onContinue} disabled={!ready} icon={ArrowRight}>
        Choose Description
      </SellButton>
    </SellFooter>
  );

  return (
    <SellShell {...shell} footer={footer}>
      <div className="flex items-center gap-3.5 rounded-[20px] border border-[#C7E6EA] bg-gradient-to-br from-[#E5F3F5] to-white p-3.5">
        <SellThumb src={model.imageUrl} className="h-20 w-20 rounded-2xl border border-[#C7E6EA] bg-white p-1.5" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#666666]">Your device</p>
          <p className="line-clamp-2 text-[16px] font-extrabold text-[#111111]">{model.name}</p>
          {brand?.name ? <p className="text-[12.5px] text-[#666666]">{brand.name}</p> : null}
        </div>
        {ready ? <span className="self-start rounded-full bg-[#035C6C] px-2.5 py-0.5 text-[10.5px] font-extrabold tracking-wide text-white">READY</span> : null}
      </div>

      <SellCard className="p-0 sm:p-0">
        <p className="px-4 pb-2 pt-3.5 text-[10.5px] font-extrabold uppercase tracking-widest text-[#666666] sm:px-5">Device details</p>
        <dl className="divide-y divide-[#F3F3F3] border-t border-[#F3F3F3] text-[13.5px]">
          {[
            brand?.name ? ['Brand', brand.name] : null,
            ['Model', model.name],
            variantText ? [specsStorageOnly || !ram ? 'Storage' : 'RAM · Storage', variantText] : null,
            color ? ['Color', color.name, <Swatch key="sw" color={color.hexCode || swatchFor(color.name)} className="h-3.5 w-3.5" />] : null,
          ]
            .filter(Boolean)
            .map(([label, value, lead]) => (
              <div key={label} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                <dt className="text-[#666666]">{label}</dt>
                <dd className="flex min-w-0 items-center gap-1.5 truncate font-bold text-[#111111]">
                  {lead}
                  <span className="truncate">{value}</span>
                </dd>
              </div>
            ))}
        </dl>
      </SellCard>

      <PickerCard
        icon={Palette}
        title="Color"
        aside={
          color ? (
            <span className="flex min-w-0 items-center gap-1.5 text-[12px] font-bold text-[#111111]">
              <Swatch color={color.hexCode || swatchFor(color.name)} className="h-4 w-4" />
              <span className="truncate">{color.name}</span>
            </span>
          ) : null
        }
      >
        <div role="radiogroup" aria-label="Color" className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {opts.colors.map((c) => {
            const name = c.name || c.id;
            const active = color?.name === name;
            return (
              <button
                key={c.id || name}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setColor({ id: c.id || name, name, hexCode: c.hexCode })}
                className={cx('flex flex-col items-center gap-1.5 rounded-xl border-[1.5px] px-2 py-2.5 transition', choiceCls(active))}
              >
                <span className="flex items-center gap-1">
                  <Swatch color={c.hexCode || swatchFor(name)} />
                  {active ? <CheckDot className="h-4 w-4" /> : null}
                </span>
                <span className="w-full truncate text-center text-[11.5px] font-bold">{name}</span>
              </button>
            );
          })}
        </div>
      </PickerCard>

      {!noRamStorage && opts.specs.length > 0 ? (
        <PickerCard icon={HardDrive} title={specsStorageOnly ? 'Storage' : 'RAM & Storage'} aside={<span className="text-[11.5px] text-[#666666]">Variant</span>}>
          <div role="radiogroup" aria-label="Variant" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {opts.specs.map((sp) => {
              const active = sp.storageOnly ? storage?.id === sp.storageOptionId : ram?.id === sp.ramOptionId && storage?.id === sp.storageOptionId;
              return (
                <button
                  key={sp.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    setRam(sp.storageOnly ? null : { id: sp.ramOptionId, label: sp.ramLabel });
                    setStorage({ id: sp.storageOptionId, label: sp.storageLabel });
                  }}
                  className={cx('truncate rounded-xl border-[1.5px] px-2 py-3 text-[13.5px] font-extrabold transition', solidCls(active))}
                >
                  {sp.label}
                </button>
              );
            })}
          </div>
        </PickerCard>
      ) : null}

      {!noRamStorage && opts.specs.length === 0 && opts.rams.length > 0 ? (
        <PickerCard icon={Cpu} title="RAM" aside={<span className="text-[11.5px] text-[#666666]">Memory</span>}>
          <div role="radiogroup" aria-label="RAM" className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {opts.rams.map((r) => (
              <button
                key={r.id}
                type="button"
                role="radio"
                aria-checked={ram?.id === r.id}
                onClick={() => setRam({ id: r.id, label: r.label })}
                className={cx('truncate rounded-xl border-[1.5px] px-2 py-3 text-[13.5px] font-extrabold transition', solidCls(ram?.id === r.id))}
              >
                {r.label}
              </button>
            ))}
          </div>
        </PickerCard>
      ) : null}

      {!noRamStorage && opts.specs.length === 0 && opts.storages.length > 0 ? (
        <PickerCard icon={HardDrive} title="Storage" aside={<span className="text-[11.5px] text-[#666666]">Capacity</span>}>
          <div role="radiogroup" aria-label="Storage" className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {opts.storages.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={storage?.id === s.id}
                onClick={() => setStorage({ id: s.id, label: s.label })}
                className={cx('truncate rounded-xl border-[1.5px] px-2 py-3 text-[13.5px] font-extrabold transition', solidCls(storage?.id === s.id))}
              >
                {s.label}
              </button>
            ))}
          </div>
        </PickerCard>
      ) : null}
    </SellShell>
  );
}
