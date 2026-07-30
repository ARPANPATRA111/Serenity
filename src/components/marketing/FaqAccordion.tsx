import type { FaqItem } from '@/lib/seo/structuredData';

/**
 * FAQ built on native `<details>`/`<summary>`.
 *
 * No JavaScript, no ARIA of our own, and correct expand/collapse semantics for
 * free. The answers are in the server-rendered HTML whether open or not, so
 * they stay crawlable and match the FAQPage structured data on the page.
 */
export function FaqAccordion({ items }: { items: FaqItem[] }) {
  return (
    <div className="mt-10 border-t border-[rgb(var(--sr-line))]">
      {items.map((item, index) => (
        <details key={item.question} className="sr-acc" open={index === 0}>
          <summary>
            {item.question}
            <span className="sr-acc-sign" aria-hidden="true" />
          </summary>
          <p className="sr-body sr-acc-answer">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
