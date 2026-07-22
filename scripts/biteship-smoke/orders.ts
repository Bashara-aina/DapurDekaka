/** Order create → retrieve → cancel helpers for Biteship matrix smoke. */
import { BiteshipApiError, biteshipFetch } from '../../lib/shipping/providers/biteship/client';
import { createBiteshipOrder } from '../../lib/shipping/providers/biteship/orders';
import type { BiteshipPricingRow } from '../../lib/shipping/providers/biteship/rates';
import { fetchBiteshipTracking } from '../../lib/shipping/providers/biteship/tracking';
import { ITEMS_LIGHT, ORIGIN, type Dest } from './fixtures';

export interface Check {
  name: string;
  pass: boolean;
  detail: string;
  warn?: boolean;
}

export interface Bookable {
  dest: Dest;
  rate: BiteshipPricingRow;
}

export function add(
  out: Check[],
  name: string,
  pass: boolean,
  detail: string,
  warn = false
): void {
  out.push({ name, pass, detail, warn });
}

export function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function report(checks: Check[]): number {
  console.log('\n========== BITESHIP MATRIX REPORT ==========\n');
  let hard = 0;
  let warn = 0;
  let pass = 0;
  for (const c of checks) {
    if (c.pass && c.warn) {
      warn += 1;
      console.log(`[WARN] ${c.name}: ${c.detail}`);
    } else if (c.pass) {
      pass += 1;
      console.log(`[PASS] ${c.name}: ${c.detail}`);
    } else {
      hard += 1;
      console.log(`[FAIL] ${c.name}: ${c.detail}`);
    }
  }
  console.log(`\nPASS=${pass} WARN=${warn} FAIL=${hard}\n============================================\n`);
  return hard;
}

export async function bookOne(out: Check[], b: Bookable): Promise<void> {
  const tag = `${b.rate.courier_company}/${b.rate.courier_type} → ${b.dest.label}`;
  let orderId = '';
  try {
    const created = await createBiteshipOrder({
      referenceId: `smoke-mtx-${Date.now()}-${b.rate.courier_company}`,
      courierCompany: b.rate.courier_company,
      courierType: b.rate.courier_type,
      originLatitude: ORIGIN.lat,
      originLongitude: ORIGIN.lng,
      originAddress: ORIGIN.address,
      originContactName: ORIGIN.contactName,
      originContactPhone: ORIGIN.contactPhone,
      destinationLatitude: b.dest.lat,
      destinationLongitude: b.dest.lng,
      destinationAddress: b.dest.address,
      destinationContactName: 'Smoke Matrix Receiver',
      destinationContactPhone: '6281234567890',
      destinationPostalCode: b.dest.postalCode,
      items: ITEMS_LIGHT.map((i) => ({
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
      `Order create ${tag}`,
      orderId.length > 0,
      `id=${orderId} waybill=${created.waybillId ?? 'n/a'} cost=${created.actualCost}`
    );
  } catch (err) {
    const body = err instanceof BiteshipApiError ? err.body : undefined;
    add(out, `Order create ${tag}`, false, `${errMsg(err)}${body ? ` | ${JSON.stringify(body)}` : ''}`);
    return;
  }

  try {
    const t = await fetchBiteshipTracking(orderId);
    add(out, `Order retrieve ${tag}`, Boolean(t?.status), `status=${t?.status ?? '?'}`);
  } catch (err) {
    add(out, `Order retrieve ${tag}`, false, errMsg(err));
  }

  try {
    const res = await biteshipFetch<{ success?: boolean; status?: string }>(
      `/orders/${orderId}/cancel`,
      { method: 'POST', body: { cancellation_reason: 'DapurDekaka matrix smoke cleanup' } }
    );
    add(out, `Order cancel ${tag}`, res.success !== false, `status=${res.status ?? 'n/a'}`);
  } catch (err) {
    add(out, `Order cancel ${tag}`, false, errMsg(err));
  }
}
