/**
 * Run `fn` over `items` with at most `size` calls in flight.
 *
 * Several admin screens need per-row master-data lookups. Firing them all at
 * once (Promise.all over every brand) or strictly one-at-a-time are both bad:
 * the first can OOM the master-data service, the second is needlessly slow.
 */
export async function mapPool(items, size, fn) {
  const list = Array.from(items || []);
  let next = 0;
  const workers = Array.from({ length: Math.min(size, list.length) }, async () => {
    while (next < list.length) {
      const idx = next++;
      await fn(list[idx], idx);
    }
  });
  await Promise.all(workers);
}
