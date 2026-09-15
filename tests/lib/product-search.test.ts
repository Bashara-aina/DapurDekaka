import { describe, it, expect } from 'vitest';
import { rankProducts, type ProductSearchDoc } from '@/lib/search/product-search';

const DOCS: ProductSearchDoc[] = [
  { id: '1', nameId: 'Dimsum Ayam Original', nameEn: 'Original Chicken Dimsum', categoryName: 'Dimsum', skuText: 'DDK-DIM-AYM-25' },
  { id: '2', nameId: 'Ekado Ayam Udang', nameEn: 'Chicken Shrimp Ekado', categoryName: 'Ekado', skuText: 'DDK-EKD-50' },
  { id: '3', nameId: 'Pangsit Ayam Rebus', nameEn: 'Boiled Chicken Wonton', categoryName: 'Pangsit', skuText: 'DDK-PGS-25' },
];

describe('product-search (fuse.js typo tolerance)', () => {
  it('matches exact substrings', () => {
    expect(rankProducts(DOCS, 'dimsum').map((d) => d.id)).toContain('1');
  });

  it('tolerates typos (dimsun → dimsum)', () => {
    const ids = rankProducts(DOCS, 'dimsun').map((d) => d.id);
    expect(ids[0]).toBe('1');
  });

  it('tolerates doubled letters (ekadoo → ekado)', () => {
    expect(rankProducts(DOCS, 'ekadoo')[0]?.id).toBe('2');
  });

  it('matches English names', () => {
    expect(rankProducts(DOCS, 'wonton')[0]?.id).toBe('3');
  });

  it('matches category names', () => {
    expect(rankProducts(DOCS, 'pangsit').map((d) => d.id)).toContain('3');
  });

  it('returns docs as-is on blank query', () => {
    expect(rankProducts(DOCS, '   ')).toHaveLength(3);
  });

  it('returns empty array when nothing is close', () => {
    expect(rankProducts(DOCS, 'zzzqqqxxx')).toHaveLength(0);
  });

  it('respects the limit', () => {
    expect(rankProducts(DOCS, 'ayam', 1)).toHaveLength(1);
  });
});