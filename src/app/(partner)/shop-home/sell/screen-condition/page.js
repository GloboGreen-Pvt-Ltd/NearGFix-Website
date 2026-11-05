'use client';

/**
 * /shop-home/sell/screen-condition/ — detailed assessment, step 2: physical
 * condition (the Partner app's SellScreenConditionScreen). Groups from GET
 * /master/condition-groups, each with its own options endpoint (else the
 * group's inline options); the app's four built-in groups when there are
 * none. Shown screen → touch glass → back → side/center; one pick per group.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';

import { cx } from '@/components/site/ui';
import {
  CheckDot,
  SellButton,
  SellCard,
  SellFooter,
  SellIntro,
  SellLoading,
  SellMissingDraft,
  SellShell,
  choiceCls,
} from '@/components/shop-dashboard/SellStep';
import { SELL_STEP_HREF, fetchConditionGroups } from '@/lib/sellFlow';
import { saveSellDraft, useSellDraft } from '@/lib/sellListing';

const FALLBACK_GROUPS = [
  { id: 'SCREEN_VISIBLE', code: 'SCREEN_VISIBLE', name: 'Screen Condition on your Device', options: ['No Damage', 'Minor Spot or patches', 'Major Spot or patches', 'Major Spot or patches', 'Discoloration'] },
  { id: 'TOUCH_GLASS', code: 'TOUCH_GLASS', name: 'Touch Glass Condition on your device', options: ['No Damage', '1 or 2 Minor Scratches', 'Heavy Scratches', 'TouchGlass Broken'] },
  { id: 'BACK_PANEL', code: 'BACK_PANEL', name: 'Back Panel Condition on your Device', options: ['No Damage', '1 or 2 Minor Scratches', 'Heavy Scratches or deep scratches', 'Light Cover Marks on Body', 'Heavy Cover Marks on Body', 'Back Panel Broken'] },
  { id: 'SIDE_PANEL', code: 'SIDE_PANEL', name: 'side and Center Panel Condition on your device', options: ['No defects', 'Minor dent or scratches', 'Major dent or heavy scratches', 'Center panel broken or cracked or bend'] },
];

const orderRank = (g) => {
  const n = String(g.name || g.code || '').toLowerCase();
  if (n.includes('screen')) return 1;
  if (n.includes('touch')) return 2;
  if (n.includes('back')) return 3;
  if (n.includes('side') || n.includes('center')) return 4;
  return 99;
};

// Each option gets a stable key for the selected state (an option without an
// id would otherwise match every other id-less option); the payload still
// carries the option's real id.
function normalise(groups) {
  return [...groups]
    .sort((a, b) => orderRank(a) - orderRank(b))
    .map((g) => {
      const fetched = Array.isArray(g.fetchedOptions) ? g.fetchedOptions : [];
      const options = fetched.length
        ? fetched.map((o, i) => ({ id: o.id, key: o.id != null ? String(o.id) : `${g.id}::${o.label}::${i}`, label: o.label }))
        : (g.options || []).map((label, i) => ({ id: `${g.id}-${i}`, key: `${g.id}-${i}`, label }));
      return { id: g.id, code: g.code, name: g.name, options };
    });
}

export default function ScreenConditionPage() {
  const router = useRouter();
  const draft = useSellDraft();
  const ready = Boolean(draft?.device && draft?.descriptionType);
  const categoryId = draft?.device?.categoryId;
  const [groups, setGroups] = useState(null);
  const [selected, setSelected] = useState({}); // groupId -> option key

  useEffect(() => {
    if (!ready) return undefined;
    let alive = true;
    fetchConditionGroups(categoryId)
      .then((list) => alive && setGroups(normalise(list.length ? list : FALLBACK_GROUPS)))
      .catch(() => alive && setGroups(normalise(FALLBACK_GROUPS)));
    return () => {
      alive = false;
    };
  }, [ready, categoryId]);

  // Coming back to this step keeps the earlier picks (matched by group code or name, then option id or label).
  useEffect(() => {
    const prior = draft?.conditions;
    if (!groups || !Array.isArray(prior)) return;
    const seed = {};
    groups.forEach((g) => {
      const p = prior.find((c) => (c.groupCode && c.groupCode === g.code) || (c.groupName && c.groupName === g.name));
      const opt = p && (g.options.find((o) => o.id != null && o.id === p.optionId) || g.options.find((o) => o.label === p.optionLabel));
      if (opt) seed[g.id] = opt.key;
    });
    setSelected(seed);
  }, [groups, draft]);

  const shell = { title: 'Screen', subtitle: draft?.model?.name };
  if (draft === undefined) return <SellShell {...shell}><SellLoading /></SellShell>;
  if (!ready) return <SellShell {...shell}><SellMissingDraft /></SellShell>;
  if (!groups) return <SellShell {...shell}><SellLoading label="Loading condition checks…" /></SellShell>;

  const done = groups.filter((g) => selected[g.id]).length;

  function onContinue() {
    const conditions = groups
      .filter((g) => selected[g.id])
      .map((g) => {
        const o = g.options.find((x) => x.key === selected[g.id]);
        return { groupCode: g.code, optionId: o.id, optionLabel: o.label, groupName: g.name };
      });
    saveSellDraft({ conditions });
    router.push(SELL_STEP_HREF.functional);
  }

  const footer = (
    <SellFooter caption={groups.length ? `${done} of ${groups.length} sections done` : null}>
      <SellButton onClick={onContinue} disabled={done < groups.length} icon={ArrowRight}>
        Continue
      </SellButton>
    </SellFooter>
  );

  return (
    <SellShell {...shell} footer={footer}>
      <SellIntro title="Physical condition" caption="Pick the option that best matches each part of the device." />
      {groups.map((g) => (
        <SellCard key={g.id}>
          <div className="mb-3 flex items-center gap-2">
            <h3 id={`g-${g.id}`} className="flex-1 text-[14.5px] font-bold text-[#111111]">
              {g.name}
            </h3>
            {selected[g.id] ? <CheckDot className="h-[18px] w-[18px]" /> : null}
          </div>
          <div role="radiogroup" aria-labelledby={`g-${g.id}`} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {g.options.map((o) => {
              const active = selected[g.id] === o.key;
              return (
                <button
                  key={o.key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setSelected((s) => ({ ...s, [g.id]: o.key }))}
                  className={cx(
                    'flex min-h-[56px] items-center justify-center rounded-xl border-[1.5px] px-2 py-2 text-center text-[12.5px] leading-snug transition',
                    choiceCls(active),
                    active ? 'font-bold' : 'font-semibold',
                  )}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </SellCard>
      ))}
    </SellShell>
  );
}
