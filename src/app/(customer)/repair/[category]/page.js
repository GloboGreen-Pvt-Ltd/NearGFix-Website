import Image from 'next/image';
import Link from '@/components/PortalLink';
import { ArrowRight } from 'lucide-react';

import JsonLd from '@/components/seo/JsonLd';
import SeoBreadcrumb from '@/components/site/SeoBreadcrumb';
import SeoFaqList from '@/components/site/SeoFaqList';
import { Badge, Button, CTABand, Section, SectionHeading, StepList } from '@/components/site/ui';
import { getRepairCatalog, getRepairCategory, pickerHref } from '@/lib/repairCatalog';
import { REPAIR_STEPS } from '@/lib/repairSeoContent';
import { pageMetadata, serviceSchema } from '@/lib/seo';

/**
 * /repair/<category>/ — server-rendered landing page per device category
 * (mobile, tablet, laptop, smartwatch, audio). Copy comes from
 * repairSeoContent.js; brands and the full repair list from master data at
 * build time (repairCatalog.js). Every "start" button opens the real /repair
 * picker on this category, so the page feeds the existing flow rather than
 * duplicating it.
 */

export const dynamicParams = false;

export async function generateStaticParams() {
  const catalog = await getRepairCatalog();
  return catalog.map((c) => ({ category: c.slug }));
}

export async function generateMetadata(props) {
  const params = await props.params;
  const category = await getRepairCategory(params.category);
  if (!category) return {};
  const { content } = category;
  return pageMetadata({
    title: content.metaTitle,
    description: content.metaDescription,
    path: `/repair/${category.slug}`,
  });
}

export default async function RepairCategoryPage(props) {
  const params = await props.params;
  const [catalog, category] = await Promise.all([getRepairCatalog(), getRepairCategory(params.category)]);
  const { content } = category;
  const path = `/repair/${category.slug}`;
  const others = catalog.filter((c) => c.slug !== category.slug);
  const label = content.label;

  return (
    <>
      <JsonLd
        data={serviceSchema({
          name: content.h1,
          description: content.metaDescription,
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
            { name: `${label} Repair`, path },
          ]}
        />
      </Section>

      {/* Hero */}
      <Section tone="white" padding="tight">
        <div className="grid items-center gap-8 lg:grid-cols-[1.4fr_1fr] lg:gap-14">
          <div>
            <Badge icon="Wrench">Repair on NearGFix</Badge>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-brand-ink sm:text-4xl lg:text-5xl">
              {content.h1}
            </h1>
            {content.intro.map((p) => (
              <p key={p.slice(0, 32)} className="mt-4 max-w-prose text-base leading-relaxed text-brand-muted sm:text-lg">
                {p}
              </p>
            ))}
            <div className="mt-7 flex flex-wrap gap-3">
              <Button href={pickerHref(category)} size="lg" icon="ArrowRight">
                Start your {label.toLowerCase()} repair
              </Button>
              <Button href="/nearby-shops" variant="outline" size="lg">
                Find repair shops near you
              </Button>
            </div>
          </div>

          {category.imageUrl ? (
            <div className="mx-auto flex aspect-square w-full max-w-[320px] items-center justify-center rounded-4xl bg-brand-50 p-8 lg:max-w-[380px]">
              <Image
                src={category.imageUrl}
                alt={`${label} repair at NearGFix partner shops`}
                width={320}
                height={320}
                priority
                sizes="(min-width: 1024px) 320px, 70vw"
                className="h-auto w-full object-contain"
              />
            </div>
          ) : null}
        </div>
      </Section>

      {/* Common problems */}
      <Section tone="white">
        <SectionHeading
          title={`Common ${content.deviceNoun} problems we can help with`}
          subtitle={`What the problem looks like, and what a NearGFix partner shop can do about it.`}
        />
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {content.issues.map((issue) => (
            <li key={issue.title} className="rounded-3xl border border-brand-line bg-white p-6 shadow-soft">
              <h3 className="text-lg font-bold tracking-tight text-brand-ink">{issue.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-brand-muted sm:text-base">{issue.text}</p>
            </li>
          ))}
        </ul>
      </Section>

      {/* Brands */}
      {category.brands.length ? (
        <Section tone="soft">
          <SectionHeading
            title={`${label} repair by brand`}
            subtitle={`Choose your ${content.deviceNoun} brand to see the models NearGFix partner shops repair.`}
          />
          <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {category.brands.map((brand) => (
              <li key={brand.id}>
                <Link
                  href={`${path}/${brand.slug}/`}
                  className="flex h-full items-center gap-3 rounded-2xl border border-brand-line bg-white p-3 shadow-soft transition hover:border-brand-200 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2 sm:p-4"
                >
                  {brand.imageUrl ? (
                    <Image
                      src={brand.imageUrl}
                      alt={`${brand.name} logo`}
                      width={40}
                      height={40}
                      loading="lazy"
                      className="h-10 w-10 shrink-0 rounded-lg object-contain"
                    />
                  ) : null}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-brand-ink sm:text-base">
                      {brand.name} {label.toLowerCase()} repair
                    </span>
                    <span className="block text-xs text-brand-muted">
                      {brand.models.length} {brand.models.length === 1 ? 'model' : 'models'}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* Full repair list from master data */}
      {category.repairGroups.length ? (
        <Section tone="white">
          <SectionHeading
            title={`${label} repairs you can book`}
            subtitle="Every repair below can be selected in the NearGFix repair flow. Which ones a shop offers, and its price, vary from shop to shop."
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {category.repairGroups.map((group) => (
              <section key={group.name} className="rounded-3xl border border-brand-line bg-white p-6">
                <h3 className="text-base font-bold text-brand-ink sm:text-lg">{group.name}</h3>
                <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-brand-muted">
                  {group.services.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </Section>
      ) : null}

      {/* How it works */}
      <Section tone="page">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
          <SectionHeading
            align="left"
            title={`How ${label.toLowerCase()} repair works on NearGFix`}
            subtitle="From choosing your device to getting it back — and you approve the price before anything is done."
          />
          <StepList steps={REPAIR_STEPS} />
        </div>
      </Section>

      {/* FAQ */}
      <Section tone="white">
        <SectionHeading title={`${label} repair questions`} />
        <SeoFaqList faqs={content.faqs} />
      </Section>

      {/* Other categories + CTA */}
      <Section tone="white" padding="tight">
        <h2 className="text-center text-2xl font-bold tracking-tight text-brand-ink">Other repairs on NearGFix</h2>
        <ul className="mt-6 flex flex-wrap justify-center gap-3">
          {others.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/repair/${c.slug}/`}
                className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-4 py-2 text-sm font-semibold text-brand-ink transition hover:border-brand-600 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2"
              >
                {c.content.h1.replace(/ Services$/, '')}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>

        <CTABand
          className="mt-12"
          title={`Get your ${content.deviceNoun} fixed`}
          subtitle="Pick your device and the problem, then choose a verified repair shop near you."
          primary={{ label: `Start your ${label.toLowerCase()} repair`, href: pickerHref(category) }}
          secondary={{ label: 'Sell your old device instead', href: '/sell' }}
        />
      </Section>
    </>
  );
}
