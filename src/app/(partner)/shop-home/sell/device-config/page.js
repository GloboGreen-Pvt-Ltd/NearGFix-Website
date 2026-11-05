'use client';

/**
 * /shop-home/sell/device-config/ — detailed assessment, step 4: device
 * configuration (the Partner app's SellDeviceConfigScreen). The admin's
 * active config fields (GET /master/config-fields), one value each. With no
 * active fields — or if they can't be read — the step skips itself straight
 * to Accessories, as in the app.
 */

import { useEffect, useState } from 'react';
import { useRouter } from '@/lib/portalNavigation';
import { ArrowRight, ChevronDown } from 'lucide-react';

import { cx } from '@/components/site/ui';
import {
  SellButton,
  SellCard,
  SellFooter,
  SellIntro,
  SellLoading,
  SellMissingDraft,
  SellShell,
} from '@/components/shop-dashboard/SellStep';
import { SELL_STEP_HREF, fetchConfigFields } from '@/lib/sellFlow';
import { saveSellDraft, useSellDraft } from '@/lib/sellListing';

export default function DeviceConfigPage() {
  const router = useRouter();
  const draft = useSellDraft();
  const ready = Boolean(draft?.device && draft?.descriptionType);
  const categoryId = draft?.device?.categoryId;
  const [fields, setFields] = useState(null);
  const [selected, setSelected] = useState({}); // fieldId -> optionId

  useEffect(() => {
    if (!ready) return undefined;
    let alive = true;
    const skip = () => {
      saveSellDraft({ deviceConfig: null });
      router.replace(SELL_STEP_HREF.accessories);
    };
    fetchConfigFields(categoryId)
      .then((list) => {
        if (!alive) return;
        const active = list.filter((f) => f.isActive !== false);
        if (active.length) setFields(active);
        else skip();
      })
      .catch(() => alive && skip());
    return () => {
      alive = false;
    };
  }, [ready, categoryId, router]);

  // Coming back to this step keeps the earlier picks.
  useEffect(() => {
    if (Array.isArray(draft?.deviceConfig)) {
      setSelected(Object.fromEntries(draft.deviceConfig.filter((c) => c.optionId).map((c) => [c.fieldId, c.optionId])));
    }
  }, [draft]);

  const shell = { title: 'Device Configuration', subtitle: draft?.model?.name };
  if (draft === undefined) return <SellShell {...shell}><SellLoading /></SellShell>;
  if (!ready) return <SellShell {...shell}><SellMissingDraft /></SellShell>;
  if (!fields) return <SellShell {...shell}><SellLoading label="Loading configuration…" /></SellShell>;

  const optionFor = (f) => (f.options || []).find((o) => String(o.id) === String(selected[f.id]));
  const chosen = fields.filter((f) => optionFor(f)).length;

  function onContinue() {
    const deviceConfig = fields.map((f) => {
      const o = optionFor(f);
      return { fieldId: f.id, fieldCode: f.code, fieldName: f.name, optionId: o?.id || null, value: o?.value || null };
    });
    saveSellDraft({ deviceConfig });
    router.push(SELL_STEP_HREF.accessories);
  }

  const footer = (
    <SellFooter caption={`${chosen} of ${fields.length} selected`}>
      <SellButton onClick={onContinue} disabled={chosen < fields.length} icon={ArrowRight}>
        Continue
      </SellButton>
    </SellFooter>
  );

  return (
    <SellShell {...shell} footer={footer}>
      <SellIntro title="Device configuration" caption="Tell us about the device's configuration." />
      {fields.map((f) => {
        const value = selected[f.id] ? String(selected[f.id]) : '';
        return (
          <SellCard key={f.id}>
            <label htmlFor={`cfg-${f.id}`} className="mb-2 block text-[14.5px] font-bold text-[#111111]">
              {f.name}
            </label>
            <div className="relative">
              <select
                id={`cfg-${f.id}`}
                value={value}
                onChange={(e) => setSelected((s) => ({ ...s, [f.id]: e.target.value }))}
                className={cx(
                  'h-12 w-full cursor-pointer appearance-none rounded-xl border-[1.5px] pl-3.5 pr-10 text-[14px] outline-none transition focus:ring-4 focus:ring-[#035C6C]/10',
                  value ? 'border-[#035C6C] bg-[#E5F3F5] font-bold text-[#024A57]' : 'border-[#ECECEC] bg-white font-medium text-[#98A2B3]',
                )}
              >
                <option value="" disabled>
                  Select {f.name}
                </option>
                {(f.options || []).map((o) => (
                  <option key={o.id} value={String(o.id)} className="text-[#111111]">
                    {o.value}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#666666]" aria-hidden="true" />
            </div>
          </SellCard>
        );
      })}
    </SellShell>
  );
}
