/**
 * Full Biteship matrix: locations × tiers × couriers × cart cases × order lifecycle.
 * Run: npm run smoke:biteship:full
 */
import { TIER_COURIER_CONFIG, matchesTierServiceFilter } from '../../lib/shipping/constants';
import { getShippingRates } from '../../lib/shipping/get-rates';
import { classifyDestination } from '../../lib/shipping/geo-policy';
import { BiteshipApiError } from '../../lib/shipping/providers/biteship/client';
import {
  fetchBiteshipRates,
  type BiteshipPricingRow,
  type BiteshipRateItem,
} from '../../lib/shipping/providers/biteship/rates';
import { searchAreas } from '../../lib/shipping/providers/biteship/maps';
import {
  COURIERS_ALL,
  DESTINATIONS,
  ITEMS_HEAVY,
  ITEMS_LIGHT,
  ITEMS_MULTI,
  MAP_QUERIES,
  ORIGIN,
  type Dest,
} from './fixtures';
import { add, bookOne, errMsg, report, type Bookable, type Check } from './orders';

const MAX_ORDERS = 6;

function rowStr(r: BiteshipPricingRow): string {
  return `${r.courier_company}/${r.courier_type}=${r.price}`;
}

async function runMaps(out: Check[]): Promise<void> {
  let authOk = false;
  for (const q of MAP_QUERIES) {
    try {
      const areas = await searchAreas(q);
      const ok = (areas?.length ?? 0) >= 1;
      if (ok) authOk = true;
      add(out, `Maps "${q}"`, ok, ok ? `${areas!.length} areas — ${areas![0]?.name}` : '0 areas');
    } catch (err) {
      add(out, `Maps "${q}"`, false, errMsg(err));
    }
  }
  add(out, 'Auth', authOk, authOk ? 'OK via Maps' : 'All maps queries failed');
}

async function runGeoClass(out: Check[]): Promise<void> {
  for (const d of DESTINATIONS) {
    const got = classifyDestination(d.lat, d.lng);
    add(out, `Geo ${d.label}`, got === d.zone, `expected=${d.zone} got=${got}`);
  }
}

async function quoteAllTiers(dest: Dest, items: BiteshipRateItem[]): Promise<BiteshipPricingRow[]> {
  const rows: BiteshipPricingRow[] = [];
  for (const tier of TIER_COURIER_CONFIG) {
    try {
      rows.push(
        ...(await fetchBiteshipRates({
          originLatitude: ORIGIN.lat,
          originLongitude: ORIGIN.lng,
          destinationLatitude: dest.lat,
          destinationLongitude: dest.lng,
          couriers: tier.couriers.join(','),
          items,
        }))
      );
    } catch (err) {
      if (!/no courier available/i.test(errMsg(err))) throw err;
    }
  }
  return rows;
}

async function runRatesMatrix(out: Check[]): Promise<Bookable[]> {
  const bookables: Bookable[] = [];
  const seenCourier = new Set<string>();

  for (const dest of DESTINATIONS) {
    for (const tier of TIER_COURIER_CONFIG) {
      const label = `Rates ${tier.tier} → ${dest.label}`;
      try {
        const rows = await fetchBiteshipRates({
          originLatitude: ORIGIN.lat,
          originLongitude: ORIGIN.lng,
          destinationLatitude: dest.lat,
          destinationLongitude: dest.lng,
          couriers: tier.couriers.join(','),
          items: ITEMS_LIGHT,
        });
        const filtered = tier.serviceFilter
          ? rows.filter((r) => matchesTierServiceFilter(r.courier_type, tier.serviceFilter))
          : rows;
        const expected = (dest.expectTiers as readonly string[]).includes(tier.tier);
        const hasRaw = rows.length >= 1;
        add(
          out,
          label,
          expected ? hasRaw : true,
          hasRaw
            ? `${rows.length} raw / ${filtered.length} filtered: ${rows.slice(0, 4).map(rowStr).join(', ')}`
            : expected
              ? '0 rows (expected quotes for this zone)'
              : '0 rows (ok for this zone)',
          (!expected && hasRaw) || (expected && filtered.length === 0 && hasRaw)
        );

        for (const r of filtered.length > 0 ? filtered : rows) {
          if (!r.courier_company || !r.courier_type || seenCourier.has(r.courier_company)) continue;
          if (bookables.length >= MAX_ORDERS) continue;
          seenCourier.add(r.courier_company);
          bookables.push({ dest, rate: r });
        }
      } catch (err) {
        const msg = errMsg(err);
        const status = err instanceof BiteshipApiError ? err.status : 0;
        if (/balance|top up|wallet/i.test(msg)) {
          add(out, label, false, `FAILED (${status}): ${msg}`);
          add(out, 'Wallet', false, msg);
          return bookables;
        }
        const soft = /no courier available/i.test(msg);
        const expected = (dest.expectTiers as readonly string[]).includes(tier.tier);
        add(out, label, soft || !expected, `FAILED (${status}): ${msg}`, soft);
      }
    }
  }
  add(out, 'Wallet', true, 'OK');
  return bookables;
}

async function runPerCourierBandung(out: Check[]): Promise<void> {
  const dest = DESTINATIONS[0]!;
  for (const courier of COURIERS_ALL) {
    try {
      const rows = await fetchBiteshipRates({
        originLatitude: ORIGIN.lat,
        originLongitude: ORIGIN.lng,
        destinationLatitude: dest.lat,
        destinationLongitude: dest.lng,
        couriers: courier,
        items: ITEMS_LIGHT,
      });
      add(
        out,
        `Courier ${courier} → Bandung`,
        rows.length >= 1,
        rows.length >= 1 ? rows.map(rowStr).join(', ') : '0 services — enable in dashboard?'
      );
    } catch (err) {
      const soft = /no courier available/i.test(errMsg(err));
      add(out, `Courier ${courier} → Bandung`, soft, errMsg(err), soft);
    }
  }
}

async function runCartCases(out: Check[]): Promise<void> {
  const dest = DESTINATIONS[0]!;
  for (const c of [
    { name: 'light-1kg', items: ITEMS_LIGHT },
    { name: 'heavy-4kg', items: ITEMS_HEAVY },
    { name: 'multi-item', items: ITEMS_MULTI },
  ]) {
    try {
      const rows = await quoteAllTiers(dest, c.items);
      add(
        out,
        `Cart case ${c.name} → Bandung`,
        rows.length >= 1,
        rows.length >= 1
          ? `${rows.length} quotes; cheapest ${rowStr(rows.reduce((a, b) => (a.price < b.price ? a : b)))}`
          : '0 quotes'
      );
    } catch (err) {
      add(out, `Cart case ${c.name} → Bandung`, false, errMsg(err));
    }
  }
}

async function runAppLayer(out: Check[]): Promise<void> {
  for (const dest of DESTINATIONS.filter((d) => d.zone !== 'beyond')) {
    try {
      const result = await getShippingRates({
        destLat: dest.lat,
        destLng: dest.lng,
        subtotal: 200000,
        items: [
          {
            variantId: 'smoke-v1',
            quantity: 1,
            weightGram: 1000,
            lengthCm: 20,
            widthCm: 15,
            heightCm: 10,
            name: 'Dimsum',
            value: 75000,
          },
        ],
      });
      const n =
        result.tiers.express.options.length +
        result.tiers.frozenSameDay.options.length +
        result.tiers.frozenExpress.options.length;
      add(
        out,
        `App rates → ${dest.label}`,
        n >= 1 || dest.expectTiers.length === 0,
        `express=${result.tiers.express.options.length} same_day=${result.tiers.frozenSameDay.options.length} frozen=${result.tiers.frozenExpress.options.length}`,
        n === 0 && dest.expectTiers.length > 0
      );
    } catch (err) {
      add(out, `App rates → ${dest.label}`, false, errMsg(err));
    }
  }
}

async function main(): Promise<void> {
  if (!process.env.BITESHIP_API_KEY) {
    console.error('ABORT: BITESHIP_API_KEY not set.');
    process.exit(1);
  }
  console.log('Biteship FULL matrix starting…');
  console.log(`Origin=${ORIGIN.lat},${ORIGIN.lng} | dests=${DESTINATIONS.length} | maxOrders=${MAX_ORDERS}`);

  const out: Check[] = [];
  await runMaps(out);
  await runGeoClass(out);
  await runPerCourierBandung(out);
  await runCartCases(out);
  const bookables = await runRatesMatrix(out);
  await runAppLayer(out);

  add(out, 'Order bookables', bookables.length >= 1, `${bookables.length} unique couriers queued`);
  for (const b of bookables) await bookOne(out, b);

  process.exit(report(out) > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Unhandled:', err);
  process.exit(1);
});
