/**
 * Renders schema.org structured data as a JSON-LD <script>. Server component:
 * the JSON is in the exported HTML, so crawlers see it without running JS.
 * "<" is escaped so a value containing "</script>" can't break out of the tag.
 */
export default function JsonLd({ data }) {
  const items = Array.isArray(data) ? data.filter(Boolean) : [data];
  return items.map((item, i) => (
    <script
      // eslint-disable-next-line react/no-array-index-key -- static, never reordered.
      key={i}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(item).replace(/</g, '\\u003c') }}
    />
  ));
}
