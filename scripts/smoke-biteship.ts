/** Live Biteship smoke: Rates → Maps → Create/Retrieve/Cancel. Run: npm run smoke:biteship */
import {
  TIER_COURIER_CONFIG,
  WAREHOUSE_ORIGIN_LAT,
  WAREHOUSE_ORIGIN_LNG,
  matchesTierServiceFilter,
} from '../lib/shipping/constants';
import { getShippingRates } from '../lib/shipping/get-rates';
import { BiteshipApiError, biteshipFetch } from '../lib/shipping/providers/biteship/client';
import { createBiteshipOrder } from '../lib/shipping/providers/biteship/orders';
import {
  fetchBiteshipRates,
  buildRateItems,
  type BiteshipPricingRow,
} from '../lib/shipping/providers/biteship/rates';
import { searchAreas } from '../lib/shipping/providers/biteship/maps';
import { fetchBiteshipTracking } from '../lib/shipping/providers/biteship/tracking';

interface Check { name: string; pass: boolean; detail: string; warn?: boolean }
interface Dest { label: string; lat: number; lng: number; address: string; postalCode: string }

const ORIGIN = {
  lat: WAREHOUSE_ORIGIN_LAT,
  lng: WAREHOUSE_ORIGIN_LNG,
  address: 'Jl. Sinom V No. 7, Turangga, Bandung',
  contactName: 'Dapur Dekaka Warehouse',
  contactPhone: '6289673737886',
};

const DEST_BANDUNG: Dest = {
  label: 'Bandung', lat: -6.9175, lng: 107.6191,
  address: 'Jl. Asia Afrika, Bandung Wetan, Kota Bandung', postalCode: '40111',
};

const DEST_JKT: Dest = {
  label: 'Jabodetabek', lat: -6.28927, lng: 106.77492,
  address: 'Lebak Bulus, Cilandak, Jakarta Selatan', postalCode: '12310',
};

const ITEMS = buildRateItems([{
  name: 'Dimsum Crabstick (smoke test)', value: 75000, weightGram: 1000,
  lengthCm: 20, widthCm: 15, heightCm: 10, quantity: 1,
}]);

function mask(key: string): string {
  return key.length < 20 ? '***' : `${key.slice(0, 14)}…${key.slice(-4)}`;
}
function rowStr(r: BiteshipPricingRow): string {
  return `${r.courier_company}/${r.courier_type}=${r.price}`;
}
function cheapest(rows: BiteshipPricingRow[]): BiteshipPricingRow | null {
  return rows.length === 0 ? null : rows.reduce((b, r) => (r.price < b.price ? r : b));
}
function add(out: Check[], name: string, pass: boolean, detail: string, warn = false): void {
  out.push({ name, pass, detail, warn });
}

async function runMaps(out: Check[]): Promise<void> {
  try {
    const areas = await searchAreas('Bandung');
    const ok = (areas?.length ?? 0) >= 1;
    add(
      out,
      'Maps searchAreas(Bandung)',
      ok,
      ok
        ? `${areas!.length} areas: ${areas!.slice(0, 3).map((a) => a.name).join('; ')}`
        : '0 areas'
    );
    add(out, 'Auth', ok, ok ? `OK via Maps (${mask(process.env.BITESHIP_API_KEY ?? '')})` : 'Maps auth failed');
  } catch (err) {
    add(out, 'Maps searchAreas(Bandung)', false, err instanceof Error ? err.message : String(err));
    add(out, 'Auth', false, 'Maps auth failed');
  }
}

async function runRates(out: Check[]): Promise<{
  all: BiteshipPricingRow[];
  bandungExpress: BiteshipPricingRow[];
  walletBlocked: boolean;
}> {
  const all: BiteshipPricingRow[] = [];
  let bandungExpress: BiteshipPricingRow[] = [];
  let walletBlocked = false;

  outer: for (const dest of [DEST_BANDUNG, DEST_JKT]) {
    for (const tier of TIER_COURIER_CONFIG) {
      const label = `Rates ${tier.tier} → ${dest.label}`;
      try {
        const rows = await fetchBiteshipRates({
          originLatitude: ORIGIN.lat,
          originLongitude: ORIGIN.lng,
          destinationLatitude: dest.lat,
          destinationLongitude: dest.lng,
          couriers: tier.couriers.join(','),
          items: ITEMS,
        });
        all.push(...rows);
        if (tier.tier === 'express' && dest.label === 'Bandung') bandungExpress = rows;
        const filtered = tier.serviceFilter
          ? rows.filter((r) => matchesTierServiceFilter(r.courier_type, tier.serviceFilter))
          : rows;
        const need = tier.tier === 'express' && dest.label === 'Bandung';
        add(
          out,
          label,
          need ? rows.length >= 1 : true,
          rows.length === 0
            ? '0 rows (enable couriers in dashboard?)'
            : `${rows.length} raw / ${filtered.length} filtered: ${rows.slice(0, 4).map(rowStr).join(', ')}`,
          !need && filtered.length === 0
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const status = err instanceof BiteshipApiError ? err.status : 0;
        if (/balance|top up|wallet/i.test(msg)) {
          add(out, label, false, `FAILED (${status}): ${msg}`);
          walletBlocked = true;
          add(out, 'Wallet balance', false, msg);
          add(out, 'Rates remaining tiers', true, 'Skipped after wallet block', true);
          break outer;
        }
        // Instant (gojek/grab) often unavailable for long-haul — soft warn
        const noCourier = /no courier available/i.test(msg);
        add(out, label, noCourier, `FAILED (${status}): ${msg}`, noCourier);
      }
    }
  }

  if (!walletBlocked) add(out, 'Wallet balance', true, 'OK');
  add(
    out,
    'Rates express ≥1 Bandung',
    bandungExpress.length >= 1,
    bandungExpress.length >= 1
      ? bandungExpress.map(rowStr).join(', ')
      : walletBlocked
        ? 'Blocked by wallet — top up, then re-run npm run smoke:biteship'
        : 'No gojek/grab quotes'
  );
  return { all, bandungExpress, walletBlocked };
}

async function runAppLayer(out: Check[], walletBlocked: boolean): Promise<void> {
  try {
    const result = await getShippingRates({
      destLat: DEST_BANDUNG.lat,
      destLng: DEST_BANDUNG.lng,
      subtotal: 150000,
      items: [
        {
          variantId: 'smoke-variant',
          quantity: 1,
          weightGram: 1000,
          lengthCm: 20,
          widthCm: 15,
          heightCm: 10,
          name: 'Dimsum Crabstick',
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
      'App getShippingRates(Bandung)',
      n >= 1 || walletBlocked,
      walletBlocked
        ? `0 quotes (expected — wallet); weight=${result.totalWeightGram}g`
        : `express=${result.tiers.express.options.length} same_day=${result.tiers.frozenSameDay.options.length} frozen=${result.tiers.frozenExpress.options.length}`,
      walletBlocked && n === 0
    );
  } catch (err) {
    add(out, 'App getShippingRates(Bandung)', false, err instanceof Error ? err.message : String(err));
  }
}

async function runOrder(
  out: Check[],
  rate: BiteshipPricingRow | null,
  dest: Dest,
  walletBlocked: boolean
): Promise<void> {
  if (!rate) {
    const reason = walletBlocked
      ? 'Skipped — wallet blocks rates (top up first)'
      : 'Skipped — no pricing row';
    add(out, 'Create order', walletBlocked, reason, walletBlocked);
    add(out, 'Retrieve order', walletBlocked, reason, walletBlocked);
    add(out, 'Cancel order', walletBlocked, reason, walletBlocked);
    return;
  }

  let orderId = '';
  try {
    const created = await createBiteshipOrder({
      referenceId: `smoke-ddk-${Date.now()}`,
      courierCompany: rate.courier_company,
      courierType: rate.courier_type,
      originLatitude: ORIGIN.lat,
      originLongitude: ORIGIN.lng,
      originAddress: ORIGIN.address,
      originContactName: ORIGIN.contactName,
      originContactPhone: ORIGIN.contactPhone,
      destinationLatitude: dest.lat,
      destinationLongitude: dest.lng,
      destinationAddress: dest.address,
      destinationContactName: 'Smoke Test Receiver',
      destinationContactPhone: '6281234567890',
      destinationPostalCode: dest.postalCode,
      items: ITEMS.map((i) => ({
        name: i.name,
        value: i.value,
        weight: i.weight,
        length: i.length,
        width: i.width,
        height: i.height,
        quantity: i.quantity,
      })),
    });
    orderId = created.biteshipOrderId;
    add(
      out,
      'Create order',
      orderId.length > 0,
      `id=${orderId} waybill=${created.waybillId ?? 'n/a'} cost=${created.actualCost} via ${rate.courier_company}/${rate.courier_type}`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const body = err instanceof BiteshipApiError ? err.body : undefined;
    add(out, 'Create order', false, `${msg}${body ? ` | ${JSON.stringify(body)}` : ''}`);
    add(out, 'Retrieve order', false, 'Skipped');
    add(out, 'Cancel order', false, 'Skipped');
    return;
  }

  try {
    const t = await fetchBiteshipTracking(orderId);
    add(out, 'Retrieve order', Boolean(t?.status), `status=${t?.status ?? 'unknown'}`);
  } catch (err) {
    add(out, 'Retrieve order', false, err instanceof Error ? err.message : String(err));
  }

  try {
    const res = await biteshipFetch<{ success?: boolean; message?: string; status?: string }>(
      `/orders/${orderId}/cancel`,
      { method: 'POST', body: { cancellation_reason_code: 'others', cancellation_reason: 'DapurDekaka smoke test cleanup' } }
    );
    add(out, 'Cancel order', res.success !== false, `message=${res.message ?? 'ok'} status=${res.status ?? 'n/a'}`);
  } catch (err) {
    add(out, 'Cancel order', false, err instanceof Error ? err.message : String(err));
  }
}

function report(checks: Check[]): number {
  console.log('\n========== BITESHIP SMOKE REPORT ==========\n');
  let hard = 0;
  for (const c of checks) {
    if (c.pass && c.warn) console.log(`[WARN] ${c.name}: ${c.detail}`);
    else if (c.pass) console.log(`[PASS] ${c.name}: ${c.detail}`);
    else {
      hard += 1;
      console.log(`[FAIL] ${c.name}: ${c.detail}`);
    }
  }
  console.log(`\nHard failures: ${hard}\n===========================================\n`);
  return hard;
}

async function main(): Promise<void> {
  if (!process.env.BITESHIP_API_KEY) {
    console.error('ABORT: BITESHIP_API_KEY not set.');
    process.exit(1);
  }
  console.log('Biteship smoke starting…');
  console.log(`Origin=${ORIGIN.lat},${ORIGIN.lng}`);

  const out: Check[] = [];
  await runMaps(out);
  const { all, bandungExpress, walletBlocked } = await runRates(out);
  await runAppLayer(out, walletBlocked);
  await runOrder(
    out,
    cheapest(bandungExpress) ?? cheapest(all),
    bandungExpress.length > 0 ? DEST_BANDUNG : DEST_JKT,
    walletBlocked
  );
  process.exit(report(out) > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Unhandled:', err);
  process.exit(1);
});
