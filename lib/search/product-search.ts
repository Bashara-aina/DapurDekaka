import Fuse, { type IFuseOptions } from 'fuse.js';

/**
 * Typo-tolerant product search (fuse.js — krisk/Fuse).
 *
 * Server-side `LIKE` only matches exact substrings, so "dimsun", "dim sum"
 * (with space) or "ekadoo" return nothing. Fuse ranks by edit distance with
 * weighted keys, so near-misses still surface the right product.
 *
 * Used in two places:
 * - `GET /api/search/products` — catalog-wide ranked search (server).
 * - `ProductCatalog` — instant re-rank of the loaded page (client).
 */

export interface ProductSearchDoc {
  id: string;
  nameId: string;
  nameEn: string;
  categoryName: string;
  skuText: string;
}

const FUSE_OPTIONS: IFuseOptions<ProductSearchDoc> = {
  keys: [
    { name: 'nameId', weight: 0.5 },
    { name: 'nameEn', weight: 0.25 },
    { name: 'categoryName', weight: 0.1 },
    { name: 'skuText', weight: 0.15 },
  ],
  threshold: 0.4,
  ignoreLocation: true,
  minMatchCharLength: 2,
  includeScore: true,
};

/**
 * Rank docs by relevance to the query. Empty/blank query returns docs as-is.
 * Pure function — safe in server components, route handlers and the browser.
 */
export function rankProducts<T extends ProductSearchDoc>(
  docs: T[],
  query: string,
  limit = 50
): T[] {
  const q = query.trim();
  if (!q) return docs;
  if (q.length < 2) {
    const lower = q.toLowerCase();
    return docs.filter(
      (d) =>
        d.nameId.toLowerCase().includes(lower) ||
        d.nameEn.toLowerCase().includes(lower)
    );
  }
  const fuse = new Fuse(docs, FUSE_OPTIONS);
  return fuse.search(q, { limit }).map((r) => r.item);
}
