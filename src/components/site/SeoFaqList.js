import { ArrowRight } from 'lucide-react';

import JsonLd from '@/components/seo/JsonLd';
import { faqSchema } from '@/lib/seo';

/**
 * Visible FAQ accordion (same <details> styling as the home page's FAQ teaser)
 * with FAQPage JSON-LD for exactly the questions rendered — the markup must
 * never describe content the visitor cannot see.
 */
export default function SeoFaqList({ faqs, withSchema = true }) {
  return (
    <>
      <div className="mx-auto mt-10 max-w-3xl space-y-4">
        {faqs.map((faq) => (
          <details
            key={faq.question}
            className="group rounded-3xl border border-brand-line bg-white p-5 shadow-soft transition open:shadow-lift sm:p-6"
          >
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 rounded-xl text-base font-bold text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2 sm:text-lg [&::-webkit-details-marker]:hidden">
              <h3 className="text-base font-bold sm:text-lg">{faq.question}</h3>
              <span
                className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-700 transition motion-reduce:transition-none group-open:rotate-90"
                aria-hidden="true"
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </summary>
            <p className="mt-3 text-base leading-relaxed text-brand-muted">{faq.answer}</p>
          </details>
        ))}
      </div>
      {withSchema ? <JsonLd data={faqSchema(faqs)} /> : null}
    </>
  );
}
