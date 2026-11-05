'use client';

/**
 * /shop-home/sell/functional/ — detailed assessment, step 3: functional
 * issues (the Partner app's SellFunctionalScreen). GET
 * /master/functional-issues, else the app's built-in list. Pick every issue
 * the device has — none at all is a valid answer.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, TriangleAlert } from 'lucide-react';

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
import { SELL_STEP_HREF, fetchFunctionalIssues } from '@/lib/sellFlow';
import { saveSellDraft, useSellDraft } from '@/lib/sellListing';

const FALLBACK = [
  'Battery issue', 'Battery Replaced Local Market', 'Flash Light Not Working', 'Front Camera not working',
  'Back Camera not working', 'Camera Glass Broken', 'Sim Slot Broken', 'Network issues', 'Speaker not working',
  'Mic not working', 'Touch Id or Face Id not working', 'Volume Button not working', 'WiFi or Bluetooth not working',
  'Charging Port not working', 'Proximity Sensor not working', 'Power button not working',
  'Ear Speaker not working or low', 'Vibrator not working',
].map((name, i) => ({ id: `f${i}`, name }));

export default function FunctionalPage() {
  const router = useRouter();
  const draft = useSellDraft();
  const ready = Boolean(draft?.device && draft?.descriptionType);
  const categoryId = draft?.device?.categoryId;
  const [issues, setIssues] = useState(null);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    if (!ready) return undefined;
    let alive = true;
    fetchFunctionalIssues(categoryId)
      .then((list) => alive && setIssues(list.length ? list : FALLBACK))
      .catch(() => alive && setIssues(FALLBACK));
    return () => {
      alive = false;
    };
  }, [ready, categoryId]);

  // Coming back to this step keeps the earlier picks.
  useEffect(() => {
    if (Array.isArray(draft?.issues)) setSelected(draft.issues.map((i) => i.issueId));
  }, [draft]);

  const shell = { title: 'Functional', subtitle: draft?.model?.name };
  if (draft === undefined) return <SellShell {...shell}><SellLoading /></SellShell>;
  if (!ready) return <SellShell {...shell}><SellMissingDraft /></SellShell>;
  if (!issues) return <SellShell {...shell}><SellLoading label="Loading issues…" /></SellShell>;

  const picked = issues.filter((it) => selected.includes(it.id));
  const toggle = (id) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  function onContinue() {
    saveSellDraft({ issues: picked.map((it) => ({ issueId: it.id })) });
    router.push(SELL_STEP_HREF.deviceConfig);
  }

  const footer = (
    <SellFooter caption={picked.length ? `${picked.length} issue${picked.length === 1 ? '' : 's'} selected` : 'No issues selected'}>
      <SellButton onClick={onContinue} icon={ArrowRight}>
        Continue
      </SellButton>
    </SellFooter>
  );

  return (
    <SellShell {...shell} footer={footer}>
      <SellIntro title="Functionality issues" caption="Tap every issue the device has. Leave all unselected if it works fine." />
      <SellCard>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {issues.map((it) => {
            const active = selected.includes(it.id);
            return (
              <button
                key={it.id}
                type="button"
                role="checkbox"
                aria-checked={active}
                onClick={() => toggle(it.id)}
                className={cx(
                  'flex min-h-[88px] flex-col items-center justify-center gap-1.5 rounded-xl border-[1.5px] px-2 py-2.5 text-center text-[12px] leading-snug transition',
                  choiceCls(active),
                  active ? 'font-bold' : 'font-semibold',
                )}
              >
                {active ? (
                  <CheckDot className="h-6 w-6" />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FEF3C7] text-[#B45309]" aria-hidden="true">
                    <TriangleAlert className="h-3.5 w-3.5" />
                  </span>
                )}
                <span className="line-clamp-3">{it.name}</span>
              </button>
            );
          })}
        </div>
      </SellCard>
    </SellShell>
  );
}
