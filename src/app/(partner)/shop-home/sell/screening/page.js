'use client';

/**
 * /shop-home/sell/screening/ — detailed assessment, step 1: the screening
 * questions (the Partner app's SellScreeningScreen). The WORKING or DEAD set
 * follows the description picked; GET /master/screening-questions, else the
 * app's built-in questions. Every question must be answered.
 */

import { useEffect, useState } from 'react';
import { useRouter } from '@/lib/portalNavigation';
import { ArrowRight } from 'lucide-react';

import { cx } from '@/components/site/ui';
import {
  CheckDot,
  RadioRing,
  SellButton,
  SellCard,
  SellFooter,
  SellIntro,
  SellLoading,
  SellMissingDraft,
  SellShell,
  choiceCls,
} from '@/components/shop-dashboard/SellStep';
import { SELL_STEP_HREF, fetchScreeningQuestions } from '@/lib/sellFlow';
import { saveSellDraft, useSellDraft } from '@/lib/sellListing';

const FALLBACK = {
  DEAD: [
    { id: 'd1', question: 'What is the current condition of your phone?', helperText: '', options: ['Phone Dead (Not powering on)', 'Unknown Condition (Not sure / partially working)'] },
    { id: 'd2', question: "Is your phone's display original?", helperText: 'Choose Yes if never changed.', options: ['Yes', 'No'] },
  ],
  WORKING: [
    { id: 'w1', question: 'Is your phone working properly?', helperText: 'Check your phone powers on.', options: ['Yes', 'No'] },
    { id: 'w2', question: 'Is your touchscreen working properly?', helperText: 'Check touch functionality.', options: ['Yes', 'No'] },
    { id: 'w3', question: "Is your phone's display original?", helperText: 'Choose Yes if never changed.', options: ['Yes', 'No'] },
    { id: 'w4', question: 'Is your phone have a valid warranty?', helperText: '', options: ['Yes', 'No'] },
  ],
};

const optionsOf = (q) => (Array.isArray(q.options) && q.options.length ? q.options : ['Yes', 'No']);
// Two short answers (Yes / No) sit side by side; anything longer stacks.
const isCompact = (opts) => opts.length === 2 && opts.every((o) => String(o).length <= 12);

export default function ScreeningPage() {
  const router = useRouter();
  const draft = useSellDraft();
  const ready = Boolean(draft?.device && draft?.descriptionType);
  const flow = draft?.workingCondition === 'DEAD' ? 'DEAD' : 'WORKING';
  const categoryId = draft?.device?.categoryId;
  const [questions, setQuestions] = useState(null);
  const [answers, setAnswers] = useState({});

  useEffect(() => {
    if (!ready) return undefined;
    let alive = true;
    fetchScreeningQuestions(flow, categoryId)
      .then((list) => alive && setQuestions(list.length ? list : FALLBACK[flow]))
      .catch(() => alive && setQuestions(FALLBACK[flow]));
    return () => {
      alive = false;
    };
  }, [ready, flow, categoryId]);

  // Coming back to this step keeps the earlier answers.
  useEffect(() => {
    const prior = draft?.screeningAnswers;
    if (Array.isArray(prior)) setAnswers(Object.fromEntries(prior.map((a) => [a.questionId, a.answer])));
  }, [draft]);

  const shell = { title: 'Screening Question', subtitle: draft?.model?.name };
  if (draft === undefined) return <SellShell {...shell}><SellLoading /></SellShell>;
  if (!ready) return <SellShell {...shell}><SellMissingDraft /></SellShell>;
  if (!questions) return <SellShell {...shell}><SellLoading label="Loading questions…" /></SellShell>;

  const answered = questions.filter((q) => answers[q.id]).length;
  const allAnswered = answered === questions.length;

  function onContinue() {
    saveSellDraft({
      screeningAnswers: questions.filter((q) => answers[q.id]).map((q) => ({ questionId: q.id, answer: answers[q.id], question: q.question })),
    });
    router.push(SELL_STEP_HREF.screenCondition);
  }

  const footer = (
    <SellFooter caption={questions.length ? `${answered} of ${questions.length} answered` : null}>
      <SellButton onClick={onContinue} disabled={!allAnswered} icon={ArrowRight}>
        Continue
      </SellButton>
    </SellFooter>
  );

  return (
    <SellShell {...shell} footer={footer}>
      <SellIntro title="Quick device check" caption="Answer each question about the device's current condition." />
      {questions.map((q, i) => {
        const opts = optionsOf(q);
        return (
          <SellCard key={q.id}>
            <div className="flex items-start gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E5F3F5] text-[12.5px] font-extrabold text-[#024A57]">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p id={`q-${q.id}`} className="text-[14.5px] font-bold leading-snug text-[#111111]">
                  {q.question}
                </p>
                {q.helperText ? <p className="mt-0.5 text-[12.5px] text-[#666666]">{q.helperText}</p> : null}
              </div>
            </div>
            <div role="radiogroup" aria-labelledby={`q-${q.id}`} className={cx('mt-3 grid gap-2', isCompact(opts) ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2')}>
              {opts.map((opt) => {
                const active = answers[q.id] === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                    className={cx('flex min-h-[46px] items-center gap-2.5 rounded-xl border-[1.5px] px-3 text-left text-[13.5px] transition', choiceCls(active), active ? 'font-bold' : 'font-semibold')}
                  >
                    {active ? <CheckDot /> : <RadioRing />}
                    <span className="min-w-0 flex-1">{opt}</span>
                  </button>
                );
              })}
            </div>
          </SellCard>
        );
      })}
    </SellShell>
  );
}
