import { Fragment } from 'react';
import Link from '@/components/PortalLink';
import { ArrowUp, ArrowUpRight, Building2, CalendarCheck, CalendarClock, FileText, Info, ShieldCheck } from 'lucide-react';

import SeoBreadcrumb from '@/components/site/SeoBreadcrumb';
import { Badge, Container, cx } from '@/components/site/ui';
import { tone, toneOf } from '@/components/site/tones';
import LegalToc from './LegalToc';

/**
 * Full /terms or /privacy page from one document in src/lib/legalContent.js.
 *
 * Every heading, clause, sub-clause, list and paragraph of the source PDF is
 * rendered in order and with its own numbering — nothing summarised, nothing
 * reworded. `**bold**` spans and line breaks in the data are reproduced. The
 * only text added is page chrome: the hero, the contents list and the links
 * at the end.
 *
 * Anchors: each section is #section-<num> (the table of contents) and each
 * numbered clause is #clause-<num with dots as dashes>, e.g. #clause-6-4.
 * Server component — the whole document is in the exported HTML.
 */

// Company details exactly as the documents state them.
const COMPANY = {
  name: 'Globogreen System and Technology Pvt. Ltd.',
  brand: 'Near G Fix',
  office: 'No. 1/16, South Street, Villiyanallur, Bhuvanagiri Taluk, Tamil Nadu, India',
  website: 'neargfix.com',
};

// Clears the sticky SiteHeader (~121px below md, 64–100px md–lg, ~117px
// compact lg+) when a #section / #clause anchor is jumped to.
const ANCHOR_OFFSET = 'scroll-mt-36 md:scroll-mt-28 lg:scroll-mt-40';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2';

// One colour per document; the switcher and the closing links use it too.
const LEGAL_LINKS = [
  { type: 'TERMS', href: '/terms', title: 'Terms and Conditions', description: 'The rules for using the platform.', Icon: FileText, tone: 'blue' },
  { type: 'PRIVACY', href: '/privacy', title: 'Privacy Policy', description: 'How we collect, use and protect your data.', Icon: ShieldCheck, tone: 'green' },
  { type: 'DISCLAIMER', href: '/disclaimer', title: 'Disclaimer', description: 'What NearGFix is, and is not, responsible for.', Icon: Info, tone: 'orange' },
];

export const sectionId = (section) => `section-${section.num}`;

function clauseId(num) {
  return num ? `clause-${num.replace(/\.$/, '').replace(/\./g, '-')}` : undefined;
}

/** "6.4 Retention of Device Content" / "1.1. \"Platform\"" -> "6.4" / "1.1" */
function headingNumber(text) {
  const match = /^(\d+(?:\.\d+)+)\.?\s/.exec(text);
  return match ? match[1] : null;
}

/** `**` toggles bold; "\n" is a line break. */
function Rich({ text }) {
  return text.split('**').map((part, i) => {
    const lines = part.split('\n');
    const content = lines.map((line, j) => (
      // eslint-disable-next-line react/no-array-index-key -- static text, never reordered.
      <Fragment key={j}>
        {j > 0 ? <br /> : null}
        {line}
      </Fragment>
    ));
    // eslint-disable-next-line react/no-array-index-key -- static text, never reordered.
    return i % 2 ? <strong key={i}>{content}</strong> : <Fragment key={i}>{content}</Fragment>;
  });
}

function Block({ block, ids }) {
  // Ids stay unique even if a clause number were ever repeated.
  const claim = (num) => {
    const id = clauseId(num);
    if (!id || ids.has(id)) return undefined;
    ids.add(id);
    return id;
  };

  switch (block.type) {
    case 'h':
      return (
        <h3 id={claim(headingNumber(block.text))} className={cx('mt-7 text-base font-bold text-brand-ink sm:text-[17px]', ANCHOR_OFFSET)}>
          <Rich text={block.text} />
        </h3>
      );
    case 'n':
      return (
        <div id={claim(block.num)} className={cx('mt-4 flex gap-3', ANCHOR_OFFSET)}>
          <span className="min-w-[2.75rem] shrink-0 font-semibold tabular-nums text-brand-ink">{block.num}</span>
          <p className="min-w-0">
            <Rich text={block.text} />
          </p>
        </div>
      );
    case 'ul':
      return (
        <ul className="mt-3 list-disc space-y-1.5 pl-6 marker:text-[#F79009]">
          {block.items.map((item, i) => (
            // eslint-disable-next-line react/no-array-index-key -- static text, never reordered.
            <li key={i} className="pl-1">
              <Rich text={item} />
            </li>
          ))}
        </ul>
      );
    case 'ol':
      // Items carry their own "a." / "b." lettering from the source.
      return (
        <ol className="mt-3 list-none space-y-1.5 pl-6">
          {block.items.map((item, i) => (
            // eslint-disable-next-line react/no-array-index-key -- static text, never reordered.
            <li key={i}>
              <Rich text={item} />
            </li>
          ))}
        </ol>
      );
    default:
      return (
        <p className="mt-4">
          <Rich text={block.text} />
        </p>
      );
  }
}

/**
 *   doc          LEGAL_DOCS.TERMS or LEGAL_DOCS.PRIVACY
 *   title        page title ("Terms and Conditions")
 *   description  one-line summary under the title (page chrome, not policy text)
 *   path         '/terms' or '/privacy'
 *   related      { href, title, description } — the other document
 *   company      optional chrome override (the Disclaimer uses the NearGFix wording)
 */
export default function LegalDocument({ doc, title, description, path, related, company = COMPANY }) {
  const toc = doc.sections.map((section) => ({ id: sectionId(section), num: section.num, title: section.title }));
  const ids = new Set();

  const current = LEGAL_LINKS.find((l) => l.type === doc.type) || LEGAL_LINKS[0];
  const theme = toneOf(current.tone);
  const others = LEGAL_LINKS.filter((l) => l.type !== doc.type);
  const DocIcon = current.Icon;

  return (
    <>
      {/* ---------------------------------------------------------------- */}
      {/* Hero                                                              */}
      {/* ---------------------------------------------------------------- */}
      <section className={cx('relative overflow-hidden border-b border-brand-line', theme.soft)}>
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/70 blur-3xl" aria-hidden="true" />
        <div className={cx('pointer-events-none absolute -bottom-28 left-1/3 h-56 w-56 rounded-full opacity-20 blur-3xl', theme.bar)} aria-hidden="true" />
        <Container className="relative py-6 sm:py-8 lg:py-10">
          <SeoBreadcrumb
            items={[
              { name: 'Home', path: '/' },
              { name: title, path },
            ]}
          />

          {/* Switch between the three legal documents */}
          <nav aria-label="Legal documents" className="mt-5 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {LEGAL_LINKS.map((l) => {
              const t = toneOf(l.tone);
              const active = l.type === doc.type;
              return (
                <Link
                  key={l.type}
                  href={l.href}
                  aria-current={active ? 'page' : undefined}
                  className={cx(
                    'inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition',
                    active ? cx(t.chip, 'border-transparent shadow-md') : cx('bg-white hover:shadow-soft', t.ring, t.text),
                    FOCUS_RING,
                  )}
                >
                  <l.Icon className="h-4 w-4" aria-hidden="true" />
                  {l.title}
                </Link>
              );
            })}
          </nav>

          <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
            <div className="flex min-w-0 max-w-3xl items-start gap-4">
              <span className={cx('hidden h-16 w-16 shrink-0 items-center justify-center rounded-3xl shadow-lift sm:flex', theme.chip)} aria-hidden="true">
                <DocIcon className="h-8 w-8" />
              </span>
              <div className="min-w-0">
                <Badge icon={DocIcon}>Legal</Badge>
                <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-brand-ink sm:text-4xl">{title}</h1>
                <p className="mt-3 text-base leading-relaxed text-brand-muted">{description}</p>
              </div>
            </div>

            <dl className="grid shrink-0 grid-cols-2 gap-3 text-sm sm:max-w-md">
              {[
                { label: 'Effective Date', value: doc.effectiveDate, Icon: CalendarCheck, t: toneOf('teal') },
                { label: 'Last Updated', value: doc.lastUpdated, Icon: CalendarClock, t: toneOf('purple') },
              ].map((d) => (
                <div key={d.label} className={cx('rounded-2xl border bg-white px-4 py-3 shadow-soft', d.t.ring)}>
                  <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-muted">
                    <span className={cx('flex h-5 w-5 items-center justify-center rounded-md', d.t.chip)}>
                      <d.Icon className="h-3 w-3" aria-hidden="true" />
                    </span>
                    {d.label}
                  </dt>
                  <dd className={cx('mt-1 font-bold', d.t.text)}>{d.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-white bg-white/80 p-4 text-sm leading-relaxed text-brand-muted shadow-soft backdrop-blur">
            <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', toneOf('navy').chip)} aria-hidden="true">
              <Building2 className="h-[18px] w-[18px]" />
            </span>
            <p className="min-w-0 break-words">
              <strong className="font-semibold text-brand-ink">{company.name}</strong>
              <span className="mx-1.5 text-brand-subtle" aria-hidden="true">·</span>
              Trading/Brand Name: {company.brand}
              <br />
              Registered Office: {company.office}
              <span className="mx-1.5 text-brand-subtle" aria-hidden="true">·</span>
              Website: {company.website}
            </p>
          </div>
        </Container>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Contents + full document                                          */}
      {/* ---------------------------------------------------------------- */}
      <div className="bg-brand-page">
        <Container className="py-6 sm:py-8 lg:py-10">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[19rem_minmax(0,1fr)] xl:gap-10">
            <LegalToc items={toc} />

            <div className="min-w-0">
              <article
                id="legal-document"
                aria-label={title}
                className={cx('break-words text-[15px] leading-7 text-brand-ink/80 sm:text-base', ANCHOR_OFFSET)}
              >
                {/* The document's own title block and intro, as in the source. */}
                <div className="relative overflow-hidden rounded-3xl border border-brand-line bg-white p-5 shadow-soft sm:p-8 lg:p-10">
                  <span className={cx('absolute inset-x-0 top-0 h-1.5', theme.bar)} aria-hidden="true" />
                  <header className="border-b border-brand-line pb-5 text-center">
                    <p className={cx('text-xl font-extrabold tracking-wide underline decoration-2 underline-offset-[6px] sm:text-2xl', theme.text)}>
                      {doc.heading}
                    </p>
                    <p className="mt-4 text-sm font-semibold text-brand-ink">
                      Effective Date: {doc.effectiveDate}
                      <br />
                      Last Updated: {doc.lastUpdated}
                    </p>
                  </header>
                  <div className="pt-1">
                    {doc.intro.map((block, i) => (
                      // eslint-disable-next-line react/no-array-index-key -- static content, never reordered.
                      <Block key={i} block={block} ids={ids} />
                    ))}
                  </div>
                </div>

                {doc.sections.map((section, index) => {
                  const id = sectionId(section);
                  const t = tone(index);
                  return (
                    <section
                      key={id}
                      id={id}
                      aria-labelledby={`${id}-title`}
                      className={cx('relative mt-4 overflow-hidden rounded-3xl border bg-white p-5 pl-6 shadow-soft sm:p-8 sm:pl-9', t.ring, ANCHOR_OFFSET)}
                    >
                      <span className={cx('absolute inset-y-0 left-0 w-1.5', t.bar)} aria-hidden="true" />
                      <h2
                        id={`${id}-title`}
                        tabIndex={-1}
                        className="flex items-center gap-3 text-lg font-bold leading-snug tracking-tight text-brand-ink focus:outline-none sm:text-xl"
                      >
                        <span className={cx('inline-flex h-9 min-w-[2.25rem] shrink-0 items-center justify-center rounded-xl px-2 text-sm font-extrabold tabular-nums shadow-md', t.chip)}>
                          {section.num}
                        </span>
                        <span className="min-w-0">{section.title}</span>
                      </h2>
                      {section.blocks.map((block, i) => (
                        // eslint-disable-next-line react/no-array-index-key -- static content, never reordered.
                        <Block key={i} block={block} ids={ids} />
                      ))}
                    </section>
                  );
                })}
              </article>

              {/* ---- After the document: the other two policies + back to top */}
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {others.map((l) => {
                  const t = toneOf(l.tone);
                  return (
                    <Link
                      key={l.type}
                      href={l.href}
                      className={cx('group flex items-center gap-3 rounded-2xl border p-4 shadow-soft transition hover:shadow-lift', t.ring, t.soft, FOCUS_RING)}
                    >
                      <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-md', t.chip)} aria-hidden="true">
                        <l.Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cx('block font-bold', t.text)}>{l.href === related?.href ? related.title : l.title}</span>
                        <span className="block text-sm text-brand-muted">{l.description}</span>
                      </span>
                      <ArrowUpRight className={cx('h-4 w-4 shrink-0', t.text)} aria-hidden="true" />
                    </Link>
                  );
                })}
              </div>
              <div className="mt-4 flex justify-center sm:justify-end">
                <a
                  href="#legal-document"
                  className={cx(
                    'inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold shadow-md transition hover:shadow-lift',
                    theme.chip,
                    FOCUS_RING,
                  )}
                >
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                  Back to top
                </a>
              </div>
            </div>
          </div>
        </Container>
      </div>
    </>
  );
}
