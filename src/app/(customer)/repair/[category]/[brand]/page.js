import Image from 'next/image';
import Link from '@/components/PortalLink';
import { ArrowRight } from 'lucide-react';

import JsonLd from '@/components/seo/JsonLd';
import SeoBreadcrumb from '@/components/site/SeoBreadcrumb';
import { Badge, Button, CheckList, CTABand, Section, SectionHeading, StepList } from '@/components/site/ui';
import { getRepairCatalog, getRepairCategory, pickerHref } from '@/lib/repairCatalog';
import { REPAIR_STEPS } from '@/lib/repairSeoContent';
import { pageMetadata, serviceSchema } from '@/lib/seo';

/**
 * /repair/<category>/<brand>/ — one page per brand NearGFix actually lists in that
 * category with at least one model (e.g. /repair/mobile/samsung/). The model
 * list is the real master-data list, which is what makes each page specific;
 * the issue list links back to the category page instead of repeating its copy.
 */

export const dynamicParams = false;

export async function generateStaticParams() {
  const catalog = await getRepairCatalog();
  return catalog.flatMap((c) => c.brands.map((b) => ({ category: c.slug, brand: b.slug })));
}

async function load(params) {
  const category = await getRepairCategory(params.category);
  const brand = category?.brands.find((b) => b.slug === params.brand) || null;
  return { category, brand };
}

/** "A, B and C" from as many model names as fit within `max` characters. */
function exampleModels(models, max) {
  const picked = [];
  for (const m of models) {
    const next = [...picked, m.name];
    if (next.join(', ').length > max) break;
    picked.push(m.name);
    if (picked.length === 3) break;
  }
  if (picked.length <= 1) return picked.join('');
  return `${picked.slice(0, -1).join(', ')} and ${picked[picked.length - 1]}`;
}

function brandDescription(category, brand) {
  const { content } = category;
  const count = brand.models.length;
  const head = `Repair your ${brand.name} ${content.deviceNoun} at a NearGFix partner shop near you.`;
  const tail = ' Compare shops and approve the price first.';
  const room = 155 - head.length - tail.length - ` ${count} models listed, including .`.length;
  const examples = count > 1 ? exampleModels(brand.models, Math.max(room, 0)) : brand.models[0].name;
  let middle;
  if (count === 1) middle = ` ${examples} listed.`;
  else if (examples) middle = ` ${count} models listed, including ${examples}.`;
  else middle = ` ${count} ${brand.name} models listed.`; // names too long to quote
  const text = `${head}${middle}${tail}`;
  // Few or short model names leave a thin snippet; add the one other true fact.
  const extra = ' Doorstep pickup where offered.';
  return text.length < 125 && text.length + extra.length <= 158 ? `${text}${extra}` : text;
}

export async function generateMetadata({ params }) {
  const { category, brand } = await load(await params);
  if (!brand) return {};
  return pageMetadata({
    title: `${brand.name} ${category.content.label} Repair Near You`,
    description: brandDescription(category, brand),
    path: `/repair/${category.slug}/${brand.slug}`,
  });
}

export default async function RepairBrandPage({ params }) {
  const [catalog, { category, brand }] = await Promise.all([getRepairCatalog(), load(await params)]);
  const { content } = category;
  const label = content.label;
  const categoryPath = `/repair/${category.slug}`;
  const path = `${categoryPath}/${brand.slug}`;
  const h1 = `${brand.name} ${label} Repair`;
  const siblings = category.brands.filter((b) => b.slug !== brand.slug);
  const sameBrandElsewhere = catalog
    .filter((c) => c.slug !== category.slug)
    .map((c) => ({ category: c, brand: c.brands.find((b) => b.slug === brand.slug) }))
    .filter((x) => x.brand);

  return (
    <>
      <JsonLd
        data={serviceSchema({
          name: h1,
          description: brandDescription(category, brand),
          path,
          serviceType: `${label} repair`,
          offers: content.issues.map((i) => i.title),
        })}
      />

      <Section tone="white" padding="snug">
        <SeoBreadcrumb
          items={[
            { name: 'Home', path: '/' },
            { name: 'Repair', path: '/repair' },
            { name: `${label} Repair`, path: categoryPath },
            { name: brand.name, path },
          ]}
        />
      </Section>

      {/* Hero */}
      <Section tone="white" padding="tight">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
          {brand.imageUrl ? (
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl border border-brand-line bg-white p-4 shadow-soft">
              <Image
                src={brand.imageUrl}
                alt={`${brand.name} logo`}
                width={64}
                height={64}
                priority
                className="h-16 w-16 object-contain"
              />
            </div>
          ) : null}
          <div className="min-w-0">
            <Badge icon="Wrench">{label} repair</Badge>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-brand-ink sm:text-4xl lg:text-5xl">{h1}</h1>
            <p className="mt-4 max-w-prose text-base leading-relaxed text-brand-muted sm:text-lg">
              Get your {brand.name} {content.deviceNoun} repaired by a verified NearGFix partner shop within 20 km. Choose
              your model, pick the problem and compare nearby shops — the shop sends a quote and nothing starts until
              you approve it.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button href={pickerHref(category, brand)} size="lg" icon="ArrowRight">
                Start your {brand.name} repair
              </Button>
              <Button href="/nearby-shops" variant="outline" size="lg">
                Find repair shops near you
              </Button>
            </div>
          </div>
        </div>
      </Section>

      {/* Models */}
      <Section tone="soft">
        <SectionHeading
          title={`${brand.name} ${content.devicePlural} we repair`}
          subtitle={`${brand.models.length} ${brand.name} ${brand.models.length === 1 ? 'model is' : 'models are'} listed on NearGFix. Select yours in the repair flow to see the repairs available for it.`}
        />
        <ul className="mt-10 grid grid-cols-1 gap-x-6 gap-y-2 rounded-3xl border border-brand-line bg-white p-6 text-sm text-brand-ink shadow-soft sm:grid-cols-2 sm:p-8 lg:grid-cols-3 sm:text-base">
          {brand.models.map((m) => (
            <li key={m.id} className="break-words">
              {m.name}
            </li>
          ))}
        </ul>
      </Section>

      {/* Common repairs → category page */}
      <Section tone="white">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionHeading
              align="left"
              title={`Common ${brand.name} ${content.deviceNoun} repairs`}
              subtitle={`The problems people most often bring in. Read what each one means on our ${label.toLowerCase()} repair guide.`}
            />
            <Link
              href={`${categoryPath}/`}
              className="mt-6 inline-flex items-center gap-2 rounded-full px-1 py-1 text-base font-semibold text-brand-700 transition hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2"
            >
              {content.h1.replace(/ Services$/, '')} guide
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <CheckList items={content.issues.map((i) => i.title)} className="sm:columns-2 sm:gap-6 [&>li]:break-inside-avoid" />
        </div>
      </Section>

      {/* How it works */}
      <Section tone="page">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
          <SectionHeading
            align="left"
            title={`How ${brand.name} repair works on NearGFix`}
            subtitle="You stay in control from booking to delivery."
          />
          <StepList steps={REPAIR_STEPS} />
        </div>
      </Section>

      {/* Internal links: other brands in this category, same brand elsewhere */}
      <Section tone="white" padding="tight">
        <h2 className="text-center text-2xl font-bold tracking-tight text-brand-ink">More {label.toLowerCase()} brands</h2>
        <ul className="mt-6 flex flex-wrap justify-center gap-2.5">
          {siblings.map((b) => (
            <li key={b.slug}>
              <Link
                href={`${categoryPath}/${b.slug}/`}
                className="inline-flex rounded-full border border-brand-line bg-white px-4 py-2 text-sm font-semibold text-brand-ink transition hover:border-brand-600 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2"
              >
                {b.name} {label.toLowerCase()} repair
              </Link>
            </li>
          ))}
        </ul>

        {sameBrandElsewhere.length ? (
          <>
            <h2 className="mt-10 text-center text-2xl font-bold tracking-tight text-brand-ink">Other {brand.name} repairs</h2>
            <ul className="mt-6 flex flex-wrap justify-center gap-2.5">
              {sameBrandElsewhere.map(({ category: c, brand: b }) => (
                <li key={c.slug}>
                  <Link
                    href={`/repair/${c.slug}/${b.slug}/`}
                    className="inline-flex rounded-full border border-brand-line bg-white px-4 py-2 text-sm font-semibold text-brand-ink transition hover:border-brand-600 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2"
                  >
                    {b.name} {c.content.label.toLowerCase()} repair
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <CTABand
          className="mt-12"
          title={`Book your ${brand.name} repair`}
          subtitle="Choose your model and the problem, then a verified shop near you takes it from there."
          primary={{ label: `Start your ${brand.name} repair`, href: pickerHref(category, brand) }}
          secondary={{ label: `All ${label.toLowerCase()} repairs`, href: `${categoryPath}/` }}
        />
      </Section>
    </>
  );
}
