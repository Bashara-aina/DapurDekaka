# INTEGRATION_ENGINE.md — Third-Party Integration Implementation
# DapurDekaka.com
**Version:** 1.0
**Last Updated:** May 2026
**Author:** Bashara (Technical Lead)
**Purpose:** Complete implementation specs for every external integration — Midtrans, RajaOngkir, Resend, Cloudinary, Minimax. Includes client setup, retry logic, error recovery, timeout handling, caching, and fallback strategies. Cursor must implement integrations exactly as specified here.

---

## 1. INTEGRATION ARCHITECTURE OVERVIEW

### 1.1 Integration Map

```
┌─────────────────────────────────────────────────────────────┐
│                     lib/integrations/                        │
│                                                             │
│  midtrans/         rajaongkir/      resend/                 │
│  ├─ client.ts      ├─ client.ts     ├─ client.ts            │
│  ├─ create-tx.ts   ├─ provinces.ts  ├─ send-email.ts        │
│  ├─ verify.ts      ├─ cities.ts     └─ templates/           │
│  └─ status.ts      └─ cost.ts          ├─ OrderConfirm.tsx  │
│                                        ├─ OrderShipped.tsx  │
│  cloudinary/       minimax/            ├─ OrderDelivered.tsx │
│  ├─ client.ts      ├─ client.ts       ├─ OrderCancelled.tsx │
│  └─ upload.ts      └─ generate.ts     ├─ PointsExpiring.tsx │
│                                        └─ PasswordReset.tsx │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Shared Principles

Every integration client follows these rules:

```typescript
// lib/utils/integration-helpers.ts

/**
 * Retry wrapper for external API calls.
 * Use for all third-party calls except Midtrans webhook processing.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;     // default: 2 (3 total attempts)
    baseDelayMs?: number;    // default: 500
    maxDelayMs?: number;     // default: 5000
    retryableStatuses?: number[]; // default: [408, 429, 500, 502, 503, 504]
    context?: string;        // for logging: "RajaOngkir.calculateCost"
  } = {}
): Promise<T> {
  const {
    maxRetries = 2,
    baseDelayMs = 500,
    maxDelayMs = 5000,
    retryableStatuses = [408, 429, 500, 502, 503, 504],
    context = 'unknown',
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry client errors (4xx except 408/429)
      if (error instanceof IntegrationError) {
        if (!retryableStatuses.includes(error.statusCode)) {
          throw error;
        }
      }

      if (attempt < maxRetries) {
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
        const jitter = delay * (0.5 + Math.random() * 0.5);
        console.warn(`[${context}] Attempt ${attempt + 1} failed, retrying in ${Math.round(jitter)}ms...`);
        await new Promise(resolve => setTimeout(resolve, jitter));
      }
    }
  }

  console.error(`[${context}] All ${maxRetries + 1} attempts failed`);
  throw lastError;
}

/**
 * Custom error class for integration failures.
 * Carries statusCode so callers can decide retry vs. fail.
 */
export class IntegrationError extends Error {
  constructor(
    public readonly service: string,
    public readonly statusCode: number,
    message: string,
    public readonly raw?: unknown
  ) {
    super(`[${service}] ${message}`);
    this.name = 'IntegrationError';
  }
}

/**
 * Timeout wrapper. Throws if fn doesn't resolve within ms.
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  ms: number,
  context: string
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  try {
    const result = await fn();
    return result;
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new IntegrationError(context, 408, `Request timed out after ${ms}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
```

### 1.3 Timeout Budget Per Integration

| Integration | Timeout (ms) | Retries | Total Max Wait |
|---|---|---|---|
| Midtrans `createTransaction` | 15000 | 1 | ~22s |
| Midtrans webhook verify | 0 (sync, local hash) | 0 | instant |
| RajaOngkir provinces | 8000 | 2 | ~20s |
| RajaOngkir cities | 8000 | 2 | ~20s |
| RajaOngkir cost | 10000 | 2 | ~25s |
| Resend send email | 10000 | 1 | ~15s |
| Cloudinary upload | 30000 | 1 | ~45s |
| Minimax AI generate | 30000 | 1 | ~45s |

---

## 2. MIDTRANS — PAYMENT GATEWAY

### 2.1 Client Setup

```typescript
// lib/midtrans/client.ts
import midtransClient from 'midtrans-client';

const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';

// Snap client for creating transactions
export const snap = new midtransClient.Snap({
  isProduction,
  serverKey: process.env.MIDTRANS_SERVER_KEY!,
  clientKey: process.env.MIDTRANS_CLIENT_KEY!,
});

// Core API client for checking transaction status
export const coreApi = new midtransClient.CoreApi({
  isProduction,
  serverKey: process.env.MIDTRANS_SERVER_KEY!,
  clientKey: process.env.MIDTRANS_CLIENT_KEY!,
});

// Snap.js CDN URL for client-side payment popup
export const SNAP_JS_URL = isProduction
  ? 'https://app.midtrans.com/snap/snap.js'
  : 'https://app.sandbox.midtrans.com/snap/snap.js';

export const MIDTRANS_CLIENT_KEY = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY!;
```

### 2.2 Create Transaction

```typescript
// lib/midtrans/create-transaction.ts
import { snap } from './client';
import { withRetry, IntegrationError } from '@/lib/utils/integration-helpers';

interface MidtransItemDetail {
  id: string;
  price: number;    // integer IDR
  quantity: number;  // integer
  name: string;      // max 50 chars
}

interface CreateTransactionParams {
  orderId: string;         // "DDK-20260512-0047" or "DDK-20260512-0047-retry-1"
  grossAmount: number;     // integer IDR total
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: MidtransItemDetail[];
}

interface MidtransTransactionResult {
  token: string;          // snap_token for client popup
  redirect_url: string;   // fallback redirect URL
}

export async function createMidtransTransaction(
  params: CreateTransactionParams
): Promise<MidtransTransactionResult> {
  // CRITICAL: Validate item_details sum === gross_amount BEFORE calling Midtrans
  const itemSum = params.items.reduce(
    (sum, item) => sum + item.price * item.quantity, 0
  );
  if (itemSum !== params.grossAmount) {
    throw new IntegrationError(
      'Midtrans',
      422,
      `Amount mismatch: item_details sum (${itemSum}) !== gross_amount (${params.grossAmount})`
    );
  }

  // Validate all amounts are integers
  for (const item of params.items) {
    if (!Number.isInteger(item.price)) {
      throw new IntegrationError('Midtrans', 422, `Item price must be integer: ${item.id} = ${item.price}`);
    }
  }

  // Truncate item names to 50 chars (Midtrans limit)
  const safeItems = params.items.map(item => ({
    ...item,
    name: item.name.substring(0, 50),
  }));

  const payload = {
    transaction_details: {
      order_id: params.orderId,
      gross_amount: params.grossAmount,
    },
    customer_details: {
      first_name: params.customerName.substring(0, 50),
      email: params.customerEmail,
      phone: params.customerPhone,
    },
    item_details: safeItems,
    expiry: {
      unit: 'minute' as const,
      duration: 15,
    },
  };

  return withRetry(
    async () => {
      try {
        const result = await snap.createTransaction(payload);
        return result as MidtransTransactionResult;
      } catch (error: any) {
        // Midtrans SDK throws errors with response_code
        const statusCode = error?.httpStatusCode || error?.status_code || 500;
        throw new IntegrationError(
          'Midtrans',
          parseInt(statusCode),
          error?.message || 'Failed to create transaction',
          error
        );
      }
    },
    { maxRetries: 1, baseDelayMs: 1000, context: 'Midtrans.createTransaction' }
  );
}
```

### 2.3 Build Item Details Helper

```typescript
// lib/midtrans/build-items.ts

interface OrderItemForMidtrans {
  variantId: string;
  productNameId: string;   // Indonesian product name
  unitPrice: number;        // integer IDR
  quantity: number;
}

interface MidtransItemsResult {
  items: Array<{ id: string; price: number; quantity: number; name: string }>;
  grossAmount: number;
}

export function buildMidtransItemDetails(
  orderItems: OrderItemForMidtrans[],
  shippingCost: number,
  courierDisplayName: string,
  discountAmount: number,    // coupon discount (positive number)
  pointsDiscount: number     // points discount (positive number)
): MidtransItemsResult {
  const items: Array<{ id: string; price: number; quantity: number; name: string }> = [];

  // Product items
  for (const item of orderItems) {
    items.push({
      id: item.variantId,
      price: item.unitPrice,
      quantity: item.quantity,
      name: item.productNameId.substring(0, 50),
    });
  }

  // Shipping (only for delivery, not pickup)
  if (shippingCost > 0) {
    items.push({
      id: 'shipping',
      price: shippingCost,
      quantity: 1,
      name: `Ongkir ${courierDisplayName}`.substring(0, 50),
    });
  }

  // Discount (negative entry — only if there's a discount)
  const totalDiscount = discountAmount + pointsDiscount;
  if (totalDiscount > 0) {
    items.push({
      id: 'discount',
      price: -totalDiscount,
      quantity: 1,
      name: 'Diskon & Poin',
    });
  }

  const grossAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return { items, grossAmount };
}
```

### 2.4 Webhook Signature Verification

```typescript
// lib/midtrans/verify-webhook.ts
import crypto from 'crypto';

/**
 * Verify Midtrans webhook notification signature.
 * This is a LOCAL hash comparison — no network call, no timeout, no retry.
 * Must be called BEFORE any database operations.
 */
export function verifyMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  serverKey: string,
  signatureKey: string
): boolean {
  const payload = `${orderId}${statusCode}${grossAmount}${serverKey}`;
  const expectedHash = crypto
    .createHash('sha512')
    .update(payload)
    .digest('hex');
  return expectedHash === signatureKey;
}

/**
 * Parse Midtrans webhook body and validate required fields exist.
 */
export interface MidtransWebhookPayload {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status: 'capture' | 'settlement' | 'pending' | 'deny' | 'cancel' | 'expire' | 'failure' | 'refund' | 'partial_refund';
  fraud_status?: 'accept' | 'deny' | 'challenge';
  payment_type: string;
  transaction_id: string;
  transaction_time: string;
}

export function parseMidtransWebhook(body: unknown): MidtransWebhookPayload | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;

  const required = ['order_id', 'status_code', 'gross_amount', 'signature_key', 'transaction_status'];
  for (const field of required) {
    if (typeof b[field] !== 'string') return null;
  }

  return body as MidtransWebhookPayload;
}
```

### 2.5 Transaction Status Check (Fallback)

```typescript
// lib/midtrans/status.ts
import { coreApi } from './client';
import { withRetry, IntegrationError } from '@/lib/utils/integration-helpers';

/**
 * Check transaction status directly with Midtrans.
 * Use as FALLBACK when webhook might have been missed,
 * or for the auto-cancellation cron to verify expired orders.
 */
export async function checkTransactionStatus(orderId: string) {
  return withRetry(
    async () => {
      try {
        const status = await coreApi.transaction.status(orderId);
        return {
          orderId: status.order_id,
          transactionStatus: status.transaction_status as string,
          fraudStatus: status.fraud_status as string | undefined,
          grossAmount: status.gross_amount as string,
          paymentType: status.payment_type as string,
          transactionTime: status.transaction_time as string,
        };
      } catch (error: any) {
        throw new IntegrationError(
          'Midtrans',
          error?.httpStatusCode || 500,
          `Failed to check status for ${orderId}`,
          error
        );
      }
    },
    { maxRetries: 2, baseDelayMs: 1000, context: 'Midtrans.checkStatus' }
  );
}
```

### 2.6 Webhook Handler — Full Flow

```typescript
// app/api/webhooks/midtrans/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyMidtransSignature, parseMidtransWebhook } from '@/lib/midtrans/verify-webhook';
import { handleSettlement, handleFailure, handlePending } from '@/lib/services/order.service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Step 1: Parse and validate shape
    const payload = parseMidtransWebhook(body);
    if (!payload) {
      console.warn('[Midtrans Webhook] Invalid payload shape');
      return NextResponse.json({ received: false }, { status: 400 });
    }

    // Step 2: Verify signature (local, instant)
    const isValid = verifyMidtransSignature(
      payload.order_id,
      payload.status_code,
      payload.gross_amount,
      process.env.MIDTRANS_SERVER_KEY!,
      payload.signature_key
    );
    if (!isValid) {
      console.warn('[Midtrans Webhook] Invalid signature for', payload.order_id);
      return NextResponse.json({ received: false }, { status: 403 });
    }

    // Step 3: Extract real order number (strip retry suffix)
    const orderNumber = payload.order_id.replace(/-retry-\d+$/, '');

    // Step 4: Route by transaction_status
    switch (payload.transaction_status) {
      case 'settlement':
      case 'capture': {
        // For capture, only process if fraud_status is 'accept'
        if (payload.transaction_status === 'capture' && payload.fraud_status !== 'accept') {
          console.warn('[Midtrans Webhook] Capture with fraud_status:', payload.fraud_status);
          await handleFailure(orderNumber, 'fraud_detected');
          break;
        }
        await handleSettlement(orderNumber, payload);
        break;
      }

      case 'pending': {
        await handlePending(orderNumber, payload);
        break;
      }

      case 'deny':
      case 'cancel':
      case 'expire':
      case 'failure': {
        await handleFailure(orderNumber, payload.transaction_status);
        break;
      }

      default:
        console.log('[Midtrans Webhook] Unhandled status:', payload.transaction_status);
    }

    // Step 5: ALWAYS return 200 to Midtrans (even for duplicates or unhandled statuses)
    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('[Midtrans Webhook] Unhandled error:', error);
    // Return 200 anyway — Midtrans will keep retrying on non-200
    // If this is a real bug, the order stays in pending_payment and
    // the auto-cancellation cron will catch it.
    return NextResponse.json({ received: true, note: 'error_logged' });
  }
}
```

### 2.7 Client-Side Snap Integration

```typescript
// hooks/useMidtransSnap.ts
'use client';

import { useEffect, useCallback, useRef } from 'react';
import { SNAP_JS_URL, MIDTRANS_CLIENT_KEY } from '@/lib/midtrans/client';

declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        options: {
          onSuccess?: (result: any) => void;
          onPending?: (result: any) => void;
          onError?: (result: any) => void;
          onClose?: () => void;
        }
      ) => void;
    };
  }
}

export function useMidtransSnap() {
  const scriptLoaded = useRef(false);

  // Load Snap.js script once
  useEffect(() => {
    if (scriptLoaded.current || typeof window === 'undefined') return;
    if (document.querySelector(`script[src="${SNAP_JS_URL}"]`)) {
      scriptLoaded.current = true;
      return;
    }

    const script = document.createElement('script');
    script.src = SNAP_JS_URL;
    script.setAttribute('data-client-key', MIDTRANS_CLIENT_KEY);
    script.async = true;
    script.onload = () => { scriptLoaded.current = true; };
    document.head.appendChild(script);

    return () => {
      // Don't remove on unmount — Snap.js is needed globally
    };
  }, []);

  const pay = useCallback((
    snapToken: string,
    callbacks: {
      onSuccess: (result: any) => void;
      onPending: (result: any) => void;
      onError: (result: any) => void;
      onClose: () => void;
    }
  ) => {
    if (!window.snap) {
      console.error('[Snap] snap.js not loaded yet');
      callbacks.onError({ message: 'Payment system is loading. Please try again.' });
      return;
    }

    window.snap.pay(snapToken, {
      onSuccess: callbacks.onSuccess,
      onPending: callbacks.onPending,
      onError: callbacks.onError,
      onClose: callbacks.onClose,
    });
  }, []);

  return { pay, isReady: scriptLoaded.current };
}
```

### 2.8 Retry Payment Flow

```typescript
// lib/services/checkout.service.ts (partial — retry section)
import { createMidtransTransaction } from '@/lib/midtrans/create-transaction';
import { buildMidtransItemDetails } from '@/lib/midtrans/build-items';
import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const MAX_PAYMENT_RETRIES = 3;

export async function retryPayment(orderNumber: string, userId?: string) {
  // 1. Fetch order
  const order = await db.query.orders.findFirst({
    where: eq(orders.orderNumber, orderNumber),
    with: { items: true },
  });

  if (!order) throw new Error('Order not found');
  if (order.status !== 'pending_payment') {
    throw new Error(`Cannot retry: order status is ${order.status}`);
  }

  // 2. Check retry count limit
  if (order.retryCount >= MAX_PAYMENT_RETRIES) {
    // Auto-cancel the order
    await db.update(orders)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(orders.id, order.id));
    throw new Error('Maximum retry attempts reached. Order has been cancelled.');
  }

  // 3. Generate new Midtrans order ID with retry suffix
  const newRetryCount = order.retryCount + 1;
  const midtransOrderId = `${orderNumber}-retry-${newRetryCount}`;

  // 4. Create new Midtrans transaction
  const result = await createMidtransTransaction({
    orderId: midtransOrderId,
    grossAmount: order.totalAmount,
    customerName: order.recipientName,
    customerEmail: order.recipientEmail!,
    customerPhone: order.recipientPhone,
    items: order.items.map(item => ({
      id: item.variantId,
      price: item.unitPrice,
      quantity: item.quantity,
      name: item.productNameId || 'Product',
    })),
  });

  // 5. Update order with new snap token and retry count
  await db.update(orders).set({
    snapToken: result.token,
    midtransOrderId: midtransOrderId,
    retryCount: newRetryCount,
    paymentExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    updatedAt: new Date(),
  }).where(eq(orders.id, order.id));

  return { snapToken: result.token, retryCount: newRetryCount };
}
```

---

## 3. RAJAONGKIR — SHIPPING COST CALCULATOR

### 3.1 Client Setup

```typescript
// lib/rajaongkir/client.ts
import { IntegrationError } from '@/lib/utils/integration-helpers';

const BASE_URL = process.env.RAJAONGKIR_BASE_URL || 'https://api.rajaongkir.com/starter';
const API_KEY = process.env.RAJAONGKIR_API_KEY!;

interface RajaOngkirFetchOptions {
  path: string;
  method?: 'GET' | 'POST';
  body?: Record<string, string>;
  signal?: AbortSignal;
}

/**
 * Low-level fetch wrapper for RajaOngkir API.
 * Handles auth header, response unwrapping, and error normalization.
 */
export async function rajaOngkirFetch<T>(options: RajaOngkirFetchOptions): Promise<T> {
  const { path, method = 'GET', body, signal } = options;

  const headers: Record<string, string> = {
    key: API_KEY,
  };

  const fetchOptions: RequestInit = {
    method,
    headers,
    signal,
  };

  if (body && method === 'POST') {
    headers['content-type'] = 'application/x-www-form-urlencoded';
    fetchOptions.body = new URLSearchParams(body).toString();
  }

  const response = await fetch(`${BASE_URL}/${path}`, fetchOptions);

  if (!response.ok) {
    throw new IntegrationError(
      'RajaOngkir',
      response.status,
      `API returned ${response.status} for ${path}`
    );
  }

  const json = await response.json();

  // RajaOngkir wraps everything in { rajaongkir: { status, results } }
  const rajaongkir = json.rajaongkir;
  if (!rajaongkir) {
    throw new IntegrationError('RajaOngkir', 500, 'Unexpected response format');
  }

  if (rajaongkir.status?.code !== 200) {
    throw new IntegrationError(
      'RajaOngkir',
      rajaongkir.status?.code || 500,
      rajaongkir.status?.description || 'Unknown error'
    );
  }

  return rajaongkir.results as T;
}
```

### 3.2 Province List (Cached)

```typescript
// lib/rajaongkir/provinces.ts
import { rajaOngkirFetch } from './client';
import { withRetry, withTimeout } from '@/lib/utils/integration-helpers';

interface Province {
  province_id: string;
  province: string;
}

// Module-level cache — persists for serverless function lifecycle
let cachedProvinces: Province[] | null = null;

export async function getProvinces(): Promise<Province[]> {
  if (cachedProvinces) return cachedProvinces;

  const provinces = await withRetry(
    () => withTimeout(
      () => rajaOngkirFetch<Province[]>({ path: 'province' }),
      8000,
      'RajaOngkir.provinces'
    ),
    { maxRetries: 2, context: 'RajaOngkir.getProvinces' }
  );

  cachedProvinces = provinces;
  return provinces;
}
```

### 3.3 City List (Cached with unstable_cache)

```typescript
// lib/rajaongkir/cities.ts
import { unstable_cache } from 'next/cache';
import { rajaOngkirFetch } from './client';
import { withRetry, withTimeout } from '@/lib/utils/integration-helpers';

interface City {
  city_id: string;
  province_id: string;
  province: string;
  type: string;        // "Kabupaten" or "Kota"
  city_name: string;
  postal_code: string;
}

/**
 * Fetch cities for a province. Cached for 24 hours via Next.js unstable_cache.
 * RajaOngkir city list changes very rarely.
 */
export const getCitiesByProvince = unstable_cache(
  async (provinceId: string): Promise<City[]> => {
    return withRetry(
      () => withTimeout(
        () => rajaOngkirFetch<City[]>({
          path: `city?province=${provinceId}`,
        }),
        8000,
        'RajaOngkir.cities'
      ),
      { maxRetries: 2, context: 'RajaOngkir.getCities' }
    );
  },
  ['rajaongkir-cities'],
  { revalidate: 86400 } // 24 hours
);
```

### 3.4 Shipping Cost Calculation (Never Cached)

```typescript
// lib/rajaongkir/cost.ts
import { rajaOngkirFetch } from './client';
import { withRetry, withTimeout, IntegrationError } from '@/lib/utils/integration-helpers';

// Origin is ALWAYS Bandung
const ORIGIN_CITY_ID = '23';

// Only these cold-chain services are allowed
const ALLOWED_SERVICES = [
  { code: 'sicepat', service: 'FROZEN', displayName: 'SiCepat FROZEN' },
  { code: 'jne',     service: 'YES',    displayName: 'JNE YES (Next Day)' },
  { code: 'anteraja', service: 'FROZEN', displayName: 'AnterAja Frozen' },
] as const;

interface ShippingOption {
  courierCode: string;
  serviceName: string;
  displayName: string;
  cost: number;           // integer IDR
  etd: string;            // estimated days: "1-2" or "1"
}

interface ShippingResult {
  available: boolean;
  options: ShippingOption[];
  message?: string;
  whatsappUrl?: string;
}

interface RajaOngkirCostResult {
  code: string;
  name: string;
  costs: Array<{
    service: string;
    description: string;
    cost: Array<{
      value: number;
      etd: string;
      note: string;
    }>;
  }>;
}

/**
 * Calculate shipping weight from cart items.
 * Minimum 1000g, rounded up to nearest 100g.
 */
export function calculateShippingWeight(
  items: Array<{ weightGram: number; quantity: number }>
): number {
  const totalGrams = items.reduce(
    (sum, item) => sum + item.weightGram * item.quantity, 0
  );
  const actualGrams = Math.max(totalGrams, 1000); // minimum 1kg
  return Math.ceil(actualGrams / 100) * 100;       // round up to 100g
}

/**
 * Get shipping options for a destination city.
 * Makes parallel requests for all couriers, then filters to allowed services.
 * NEVER cached — always recalculate at checkout.
 */
export async function calculateShippingCost(
  destinationCityId: string,
  weightGram: number
): Promise<ShippingResult> {
  // Query each courier in parallel
  const courierCodes = [...new Set(ALLOWED_SERVICES.map(s => s.code))];

  const results = await Promise.allSettled(
    courierCodes.map(courierCode =>
      withRetry(
        () => withTimeout(
          () => rajaOngkirFetch<RajaOngkirCostResult[]>({
            path: 'cost',
            method: 'POST',
            body: {
              origin: ORIGIN_CITY_ID,
              destination: destinationCityId,
              weight: String(weightGram),
              courier: courierCode,
            },
          }),
          10000,
          `RajaOngkir.cost.${courierCode}`
        ),
        { maxRetries: 2, context: `RajaOngkir.cost.${courierCode}` }
      )
    )
  );

  // Collect successful results, filter to allowed services
  const options: ShippingOption[] = [];

  results.forEach((result, index) => {
    if (result.status !== 'fulfilled') {
      console.warn(`[RajaOngkir] Courier ${courierCodes[index]} failed:`, result.reason);
      return;
    }

    const courierResults = result.value;
    for (const courier of courierResults) {
      for (const service of courier.costs) {
        const allowed = ALLOWED_SERVICES.find(
          a => a.code === courierCodes[index] && a.service === service.service
        );
        if (!allowed) continue;
        if (!service.cost[0]) continue;

        options.push({
          courierCode: courierCodes[index],
          serviceName: service.service,
          displayName: allowed.displayName,
          cost: service.cost[0].value,
          etd: service.cost[0].etd.replace(/\s*HARI/i, ''), // clean "1-2 HARI" → "1-2"
        });
      }
    }
  });

  // No cold-chain service available → WhatsApp fallback
  if (options.length === 0) {
    return {
      available: false,
      options: [],
      message: 'Mohon maaf, layanan pengiriman frozen ke daerah Anda belum tersedia. Silakan hubungi kami via WhatsApp untuk solusi pengiriman khusus.',
      whatsappUrl: `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}`,
    };
  }

  // Sort by price ascending
  options.sort((a, b) => a.cost - b.cost);

  return { available: true, options };
}
```

### 3.5 Server-Side Shipping Re-verification

```typescript
// lib/services/shipping.service.ts
import { calculateShippingCost, calculateShippingWeight } from '@/lib/rajaongkir/cost';

/**
 * Re-verify shipping cost server-side during checkout initiation.
 * Client picks a shipping option, server validates it hasn't changed.
 * If cost differs by more than 5%, reject and force re-selection.
 */
export async function verifyShippingCost(
  destinationCityId: string,
  items: Array<{ weightGram: number; quantity: number }>,
  selectedCourierCode: string,
  selectedServiceName: string,
  clientSideCost: number
): Promise<{ verified: boolean; actualCost: number; message?: string }> {
  const weight = calculateShippingWeight(items);
  const result = await calculateShippingCost(destinationCityId, weight);

  if (!result.available) {
    return { verified: false, actualCost: 0, message: result.message };
  }

  const matchedOption = result.options.find(
    o => o.courierCode === selectedCourierCode && o.serviceName === selectedServiceName
  );

  if (!matchedOption) {
    return {
      verified: false,
      actualCost: 0,
      message: 'Layanan pengiriman yang dipilih tidak tersedia. Silakan pilih ulang.',
    };
  }

  // Allow up to 5% difference (price may fluctuate between client and server call)
  const tolerance = clientSideCost * 0.05;
  if (Math.abs(matchedOption.cost - clientSideCost) > tolerance) {
    return {
      verified: false,
      actualCost: matchedOption.cost,
      message: `Ongkos kirim telah berubah menjadi ${formatCurrency(matchedOption.cost)}. Silakan konfirmasi ulang.`,
    };
  }

  // Use the server-verified cost (not client-side)
  return { verified: true, actualCost: matchedOption.cost };
}
```

### 3.6 API Routes for Frontend

```typescript
// app/api/shipping/provinces/route.ts
import { NextResponse } from 'next/server';
import { getProvinces } from '@/lib/rajaongkir/provinces';
import { success, serverError } from '@/lib/utils/api-response';

export async function GET() {
  try {
    const provinces = await getProvinces();
    return success(provinces);
  } catch (error) {
    return serverError(error);
  }
}

// app/api/shipping/cities/route.ts
import { NextRequest } from 'next/server';
import { getCitiesByProvince } from '@/lib/rajaongkir/cities';
import { success, serverError, validationError } from '@/lib/utils/api-response';
import { z } from 'zod';

const QuerySchema = z.object({
  provinceId: z.string().min(1),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = QuerySchema.safeParse({ provinceId: searchParams.get('provinceId') });
    if (!parsed.success) return validationError(parsed.error);

    const cities = await getCitiesByProvince(parsed.data.provinceId);
    return success(cities);
  } catch (error) {
    return serverError(error);
  }
}

// app/api/shipping/cost/route.ts
import { NextRequest } from 'next/server';
import { calculateShippingCost, calculateShippingWeight } from '@/lib/rajaongkir/cost';
import { success, serverError, validationError } from '@/lib/utils/api-response';
import { z } from 'zod';

const CostSchema = z.object({
  destinationCityId: z.string().min(1),
  items: z.array(z.object({
    weightGram: z.number().int().positive(),
    quantity: z.number().int().positive(),
  })),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CostSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const weight = calculateShippingWeight(parsed.data.items);
    const result = await calculateShippingCost(parsed.data.destinationCityId, weight);
    return success(result);
  } catch (error) {
    return serverError(error);
  }
}
```

---

## 4. RESEND — TRANSACTIONAL EMAIL

### 4.1 Client Setup

```typescript
// lib/resend/client.ts
import { Resend } from 'resend';

export const resend = new Resend(process.env.RESEND_API_KEY);

export const EMAIL_FROM = {
  email: process.env.RESEND_FROM_EMAIL || 'noreply@dapurdekaka.com',
  name: process.env.RESEND_FROM_NAME || 'Dapur Dekaka 德卡',
};
```

### 4.2 Send Email Function (Fire-and-Forget Safe)

```typescript
// lib/resend/send-email.ts
import { resend, EMAIL_FROM } from './client';
import { withRetry, IntegrationError } from '@/lib/utils/integration-helpers';
import { ReactElement } from 'react';

interface SendEmailParams {
  to: string;
  subject: string;
  react: ReactElement;
  attachments?: Array<{
    filename: string;
    content: Buffer;
  }>;
}

/**
 * Send an email via Resend. Retries once on failure.
 * CRITICAL: This function MUST NOT throw in webhook/order contexts.
 * Wrap calls in try/catch. Email failure must never block order processing.
 */
export async function sendEmail(params: SendEmailParams): Promise<{ id: string } | null> {
  try {
    const result = await withRetry(
      async () => {
        const response = await resend.emails.send({
          from: `${EMAIL_FROM.name} <${EMAIL_FROM.email}>`,
          to: params.to,
          subject: params.subject,
          react: params.react,
          attachments: params.attachments,
        });

        if (response.error) {
          throw new IntegrationError(
            'Resend',
            422,
            response.error.message,
            response.error
          );
        }

        return response.data;
      },
      { maxRetries: 1, baseDelayMs: 2000, context: 'Resend.sendEmail' }
    );

    return result;
  } catch (error) {
    // Log but NEVER rethrow — email failure is non-critical
    console.error('[Email] Failed to send:', {
      to: params.to,
      subject: params.subject,
      error: (error as Error).message,
    });
    return null;
  }
}
```

### 4.3 Email Templates (React Email)

```typescript
// lib/resend/templates/OrderConfirmation.tsx
import {
  Html, Head, Body, Container, Section, Heading, Text, Link,
  Row, Column, Img, Hr, Preview,
} from '@react-email/components';

interface OrderConfirmationProps {
  orderNumber: string;
  customerName: string;
  items: Array<{
    productName: string;
    variantName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
  subtotal: number;
  shippingCost: number;
  discount: number;
  pointsDiscount: number;
  total: number;
  deliveryMethod: 'delivery' | 'pickup';
  shippingAddress?: string;
  courierName?: string;
  orderDate: string;
  trackingUrl: string; // link to /orders/[orderNumber]
}

export function OrderConfirmation(props: OrderConfirmationProps) {
  return (
    <Html>
      <Head />
      <Preview>Pesanan {props.orderNumber} berhasil dikonfirmasi!</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header with brand colors */}
          <Section style={header}>
            <Heading style={headerText}>Dapur Dekaka 德卡</Heading>
          </Section>

          {/* Greeting */}
          <Section style={content}>
            <Heading as="h2" style={h2}>Terima kasih, {props.customerName}!</Heading>
            <Text style={text}>
              Pesanan Anda dengan nomor <strong>{props.orderNumber}</strong> telah berhasil dikonfirmasi.
            </Text>
          </Section>

          {/* Order items table */}
          <Section style={content}>
            <Heading as="h3" style={h3}>Detail Pesanan</Heading>
            {props.items.map((item, i) => (
              <Row key={i} style={itemRow}>
                <Column>
                  <Text style={itemName}>{item.productName} — {item.variantName}</Text>
                  <Text style={itemQty}>{item.quantity}x @ Rp {item.unitPrice.toLocaleString('id-ID')}</Text>
                </Column>
                <Column align="right">
                  <Text style={itemPrice}>Rp {item.subtotal.toLocaleString('id-ID')}</Text>
                </Column>
              </Row>
            ))}
            <Hr style={divider} />

            {/* Totals */}
            <Row><Column><Text style={text}>Subtotal</Text></Column>
              <Column align="right"><Text style={text}>Rp {props.subtotal.toLocaleString('id-ID')}</Text></Column></Row>
            {props.shippingCost > 0 && (
              <Row><Column><Text style={text}>Ongkos Kirim ({props.courierName})</Text></Column>
                <Column align="right"><Text style={text}>Rp {props.shippingCost.toLocaleString('id-ID')}</Text></Column></Row>
            )}
            {props.discount > 0 && (
              <Row><Column><Text style={text}>Diskon Kupon</Text></Column>
                <Column align="right"><Text style={textGreen}>-Rp {props.discount.toLocaleString('id-ID')}</Text></Column></Row>
            )}
            {props.pointsDiscount > 0 && (
              <Row><Column><Text style={text}>Diskon Poin</Text></Column>
                <Column align="right"><Text style={textGreen}>-Rp {props.pointsDiscount.toLocaleString('id-ID')}</Text></Column></Row>
            )}
            <Hr style={divider} />
            <Row><Column><Text style={totalLabel}>TOTAL</Text></Column>
              <Column align="right"><Text style={totalAmount}>Rp {props.total.toLocaleString('id-ID')}</Text></Column></Row>
          </Section>

          {/* Delivery info */}
          <Section style={content}>
            {props.deliveryMethod === 'delivery' ? (
              <>
                <Heading as="h3" style={h3}>Alamat Pengiriman</Heading>
                <Text style={text}>{props.shippingAddress}</Text>
              </>
            ) : (
              <>
                <Heading as="h3" style={h3}>Pengambilan di Toko</Heading>
                <Text style={text}>Jl. Sinom V no. 7, Turangga, Bandung</Text>
                <Text style={text}>Kami akan menghubungi Anda saat pesanan siap diambil.</Text>
              </>
            )}
          </Section>

          {/* Track order CTA */}
          <Section style={content}>
            <Link href={props.trackingUrl} style={button}>
              Lacak Pesanan
            </Link>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              Dapur Dekaka 德卡 — Frozen Dimsum Premium
            </Text>
            <Text style={footerText}>
              Jl. Sinom V no. 7, Turangga, Bandung
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Styles
const body = { backgroundColor: '#F0EAD6', fontFamily: 'Inter, sans-serif' };
const container = { maxWidth: '600px', margin: '0 auto', backgroundColor: '#ffffff' };
const header = { backgroundColor: '#C8102E', padding: '24px', textAlign: 'center' as const };
const headerText = { color: '#ffffff', fontSize: '24px', fontFamily: 'Playfair Display, serif', margin: 0 };
const content = { padding: '24px' };
const h2 = { fontSize: '20px', color: '#1a1a1a' };
const h3 = { fontSize: '16px', color: '#1a1a1a', marginBottom: '8px' };
const text = { fontSize: '14px', color: '#333', lineHeight: '1.5' };
const textGreen = { ...text, color: '#16a34a' };
const itemRow = { padding: '8px 0', borderBottom: '1px solid #eee' };
const itemName = { fontSize: '14px', fontWeight: '600' as const, margin: 0 };
const itemQty = { fontSize: '12px', color: '#666', margin: 0 };
const itemPrice = { fontSize: '14px', textAlign: 'right' as const, margin: 0 };
const divider = { borderColor: '#eee', margin: '12px 0' };
const totalLabel = { fontSize: '16px', fontWeight: '700' as const };
const totalAmount = { fontSize: '16px', fontWeight: '700' as const, color: '#C8102E' };
const button = {
  display: 'inline-block', backgroundColor: '#C8102E', color: '#ffffff',
  padding: '12px 24px', borderRadius: '8px', textDecoration: 'none',
  fontSize: '14px', fontWeight: '600' as const,
};
const footer = { backgroundColor: '#f5f5f5', padding: '16px', textAlign: 'center' as const };
const footerText = { fontSize: '12px', color: '#999', margin: '4px 0' };
```

### 4.4 Other Email Templates (Specs)

```typescript
// lib/resend/templates/OrderShipped.tsx
// Props: orderNumber, customerName, trackingNumber, courierName, trackingUrl, estimatedDays
// Content: "Pesanan Anda sedang dalam perjalanan!"
// Include: courier logo, tracking number, tracking link button
// Style: same brand layout as OrderConfirmation

// lib/resend/templates/OrderDelivered.tsx
// Props: orderNumber, customerName, pointsEarned, totalPoints
// Content: "Pesanan Anda telah sampai!"
// Include: thank you message, points earned, "Belanja Lagi" CTA
// Style: celebration feel, same brand layout

// lib/resend/templates/OrderCancelled.tsx
// Props: orderNumber, customerName, reason, pointsReversed
// Content: "Pesanan Anda telah dibatalkan"
// Include: reason, reversed points info, "Belanja Lagi" CTA
// Style: neutral, no alarming colors

// lib/resend/templates/PointsExpiring.tsx
// Props: customerName, expiringPoints, expiryDate, totalPoints
// Content: "{expiringPoints} poin akan kedaluwarsa pada {expiryDate}"
// Include: points balance, expiry date, "Belanja Sekarang" CTA
// Style: urgent but not alarming, amber accents

// lib/resend/templates/PasswordReset.tsx
// Props: resetUrl (with token), expiresIn (e.g. "1 jam")
// Content: "Reset kata sandi Anda"
// Include: reset link button, expiry notice, security note
// Style: clean, security-focused
```

### 4.5 Email Trigger Integration

```typescript
// lib/services/email.service.ts
import { sendEmail } from '@/lib/resend/send-email';
import { OrderConfirmation } from '@/lib/resend/templates/OrderConfirmation';
import { OrderShipped } from '@/lib/resend/templates/OrderShipped';
import { OrderDelivered } from '@/lib/resend/templates/OrderDelivered';
import { OrderCancelled } from '@/lib/resend/templates/OrderCancelled';
import { PointsExpiring } from '@/lib/resend/templates/PointsExpiring';

/**
 * All email dispatch functions are fire-and-forget safe.
 * They catch errors internally and never throw.
 */

export async function sendOrderConfirmationEmail(
  order: OrderWithItems
): Promise<void> {
  const trackingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/orders/${order.orderNumber}`;

  await sendEmail({
    to: order.recipientEmail!,
    subject: `Pesanan ${order.orderNumber} Dikonfirmasi — Dapur Dekaka`,
    react: OrderConfirmation({
      orderNumber: order.orderNumber,
      customerName: order.recipientName,
      items: order.items.map(item => ({
        productName: item.productNameId,
        variantName: item.variantNameId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.unitPrice * item.quantity,
      })),
      subtotal: order.subtotalAmount,
      shippingCost: order.shippingCost,
      discount: order.couponDiscount,
      pointsDiscount: order.pointsDiscount,
      total: order.totalAmount,
      deliveryMethod: order.deliveryMethod,
      shippingAddress: order.shippingAddress || undefined,
      courierName: order.courierName || undefined,
      orderDate: new Date(order.createdAt).toLocaleDateString('id-ID'),
      trackingUrl,
    }),
  });
}

export async function sendOrderShippedEmail(
  order: OrderWithItems,
  trackingNumber: string
): Promise<void> {
  const courierTrackingUrl = buildCourierTrackingUrl(order.courierCode!, trackingNumber);
  const orderTrackingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/orders/${order.orderNumber}`;

  await sendEmail({
    to: order.recipientEmail!,
    subject: `Pesanan ${order.orderNumber} Sedang Dikirim — Dapur Dekaka`,
    react: OrderShipped({
      orderNumber: order.orderNumber,
      customerName: order.recipientName,
      trackingNumber,
      courierName: order.courierName!,
      trackingUrl: courierTrackingUrl,
      orderTrackingUrl,
      estimatedDays: order.shippingEtd || '1-2',
    }),
  });
}

export async function sendOrderDeliveredEmail(
  order: OrderWithItems,
  pointsEarned: number,
  totalPoints: number
): Promise<void> {
  await sendEmail({
    to: order.recipientEmail!,
    subject: `Pesanan ${order.orderNumber} Telah Sampai — Terima Kasih!`,
    react: OrderDelivered({
      orderNumber: order.orderNumber,
      customerName: order.recipientName,
      pointsEarned,
      totalPoints,
    }),
  });
}

export async function sendPointsExpiringEmail(
  userEmail: string,
  userName: string,
  expiringPoints: number,
  expiryDate: Date,
  totalPoints: number
): Promise<void> {
  await sendEmail({
    to: userEmail,
    subject: `${expiringPoints} Poin Akan Kedaluwarsa — Dapur Dekaka`,
    react: PointsExpiring({
      customerName: userName,
      expiringPoints,
      expiryDate: expiryDate.toLocaleDateString('id-ID'),
      totalPoints,
    }),
  });
}

/**
 * Build courier tracking URL.
 */
function buildCourierTrackingUrl(courierCode: string, trackingNumber: string): string {
  switch (courierCode) {
    case 'sicepat':
      return `https://www.sicepat.com/checkAwb?awb=${trackingNumber}`;
    case 'jne':
      return `https://www.jne.co.id/id/tracking/trace?awb=${trackingNumber}`;
    case 'anteraja':
      return `https://anteraja.id/tracking/${trackingNumber}`;
    default:
      return `https://cekresi.com/?noresi=${trackingNumber}`;
  }
}
```

---

## 5. CLOUDINARY — IMAGE UPLOAD & DELIVERY

### 5.1 Server-Side Client

```typescript
// lib/cloudinary/client.ts
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
  secure: true,
});

export { cloudinary };

// Folder constants
export const CLOUDINARY_FOLDERS = {
  products: 'dapurdekaka/products',
  blog:     'dapurdekaka/blog',
  carousel: 'dapurdekaka/carousel',
  avatars:  'dapurdekaka/avatars',
  gallery:  'dapurdekaka/gallery',
} as const;

export type CloudinaryFolder = keyof typeof CLOUDINARY_FOLDERS;
```

### 5.2 Signed Upload Flow

```typescript
// lib/cloudinary/upload.ts
import { cloudinary, CLOUDINARY_FOLDERS, CloudinaryFolder } from './client';
import { withRetry, IntegrationError } from '@/lib/utils/integration-helpers';

interface SignedUploadParams {
  folder: CloudinaryFolder;
  publicId?: string;    // optional custom public_id
}

interface SignedUploadResult {
  signature: string;
  timestamp: number;
  cloudName: string;
  apiKey: string;
  folder: string;
  publicId?: string;
  uploadUrl: string;
}

/**
 * Generate signed upload parameters.
 * Client uses these to upload directly to Cloudinary.
 * NEVER expose api_secret — only signed params.
 */
export function generateSignedUploadParams(
  params: SignedUploadParams
): SignedUploadResult {
  const timestamp = Math.round(Date.now() / 1000);
  const folder = CLOUDINARY_FOLDERS[params.folder];

  const signParams: Record<string, string | number> = {
    timestamp,
    folder,
  };

  if (params.publicId) {
    signParams.public_id = params.publicId;
  }

  const signature = cloudinary.utils.api_sign_request(
    signParams,
    process.env.CLOUDINARY_API_SECRET!
  );

  return {
    signature,
    timestamp,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
    apiKey: process.env.CLOUDINARY_API_KEY!,
    folder,
    publicId: params.publicId,
    uploadUrl: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
  };
}

/**
 * Server-side upload (for seed scripts, migrations, etc.)
 * NOT for user-facing uploads — use signed client-side uploads instead.
 */
export async function serverSideUpload(
  filePath: string,
  folder: CloudinaryFolder,
  publicId?: string
): Promise<{ url: string; publicId: string }> {
  return withRetry(
    async () => {
      const result = await cloudinary.uploader.upload(filePath, {
        folder: CLOUDINARY_FOLDERS[folder],
        public_id: publicId,
        overwrite: true,
        resource_type: 'image',
      });

      return {
        url: result.secure_url,
        publicId: result.public_id,
      };
    },
    { maxRetries: 1, baseDelayMs: 2000, context: 'Cloudinary.serverUpload' }
  );
}

/**
 * Delete an image from Cloudinary by public_id.
 */
export async function deleteImage(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('[Cloudinary] Failed to delete image:', publicId, error);
    // Non-critical — don't throw
  }
}
```

### 5.3 Image Transformation Helpers

```typescript
// lib/cloudinary/transforms.ts

/**
 * Build optimized Cloudinary URL for display.
 * Apply transformations at display time, NOT upload time.
 */
export function getOptimizedImageUrl(
  cloudinaryUrl: string,
  preset: 'thumbnail' | 'detail' | 'carousel' | 'avatar' | 'og'
): string {
  const transforms: Record<string, string> = {
    thumbnail: 'w_240,h_240,c_fill,g_center,f_webp,q_auto:good',
    detail:    'w_800,h_600,c_fill,g_center,f_webp,q_auto',
    carousel:  'w_1200,h_600,c_fill,g_center,f_webp,q_auto',
    avatar:    'w_80,h_80,c_fill,g_face,f_webp,q_auto',
    og:        'w_1200,h_630,c_fill,g_center,f_jpg,q_80',
  };

  return cloudinaryUrl.replace(
    '/upload/',
    `/upload/${transforms[preset]}/`
  );
}

/**
 * Get responsive srcSet for next/image or native <img>.
 */
export function getResponsiveSrcSet(
  cloudinaryUrl: string,
  widths: number[] = [320, 640, 960, 1280]
): string {
  return widths
    .map(w => {
      const url = cloudinaryUrl.replace(
        '/upload/',
        `/upload/w_${w},c_scale,f_webp,q_auto/`
      );
      return `${url} ${w}w`;
    })
    .join(', ');
}
```

### 5.4 Upload API Route

```typescript
// app/api/upload/route.ts
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { generateSignedUploadParams } from '@/lib/cloudinary/upload';
import { success, unauthorized, forbidden, validationError } from '@/lib/utils/api-response';
import { z } from 'zod';

const UploadSchema = z.object({
  folder: z.enum(['products', 'blog', 'carousel', 'avatars']),
  publicId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Only admin roles can upload
    const session = await auth();
    if (!session?.user) return unauthorized();

    const allowedRoles = ['superadmin', 'owner'];
    if (!allowedRoles.includes(session.user.role as string)) {
      return forbidden();
    }

    const body = await req.json();
    const parsed = UploadSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const params = generateSignedUploadParams(parsed.data);
    return success(params);
  } catch (error) {
    return serverError(error);
  }
}
```

### 5.5 Client-Side Upload Component Pattern

```typescript
// components/admin/common/ImageUploader.tsx
'use client';

import { useState, useRef } from 'react';
import { toast } from 'sonner';

interface ImageUploaderProps {
  folder: 'products' | 'blog' | 'carousel' | 'avatars';
  onUploadComplete: (url: string, publicId: string) => void;
  maxSizeMB?: number;  // default 5MB
}

export function ImageUploader({ folder, onUploadComplete, maxSizeMB = 5 }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`Ukuran file maksimal ${maxSizeMB}MB`);
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Hanya file gambar yang diperbolehkan');
      return;
    }

    setUploading(true);
    setPreview(URL.createObjectURL(file));

    try {
      // Step 1: Get signed params from our API
      const paramsRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder }),
      });

      if (!paramsRes.ok) throw new Error('Failed to get upload signature');
      const { data: signedParams } = await paramsRes.json();

      // Step 2: Upload directly to Cloudinary
      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', signedParams.apiKey);
      formData.append('timestamp', String(signedParams.timestamp));
      formData.append('signature', signedParams.signature);
      formData.append('folder', signedParams.folder);
      if (signedParams.publicId) {
        formData.append('public_id', signedParams.publicId);
      }

      const uploadRes = await fetch(signedParams.uploadUrl, {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) throw new Error('Upload to Cloudinary failed');
      const uploadData = await uploadRes.json();

      onUploadComplete(uploadData.secure_url, uploadData.public_id);
      toast.success('Gambar berhasil diunggah');
    } catch (error) {
      console.error('[Upload]', error);
      toast.error('Gagal mengunggah gambar. Silakan coba lagi.');
      setPreview(null);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        disabled={uploading}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="border-2 border-dashed border-gray-300 rounded-lg p-6 w-full
                   hover:border-gray-400 transition-colors cursor-pointer
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uploading ? 'Mengunggah...' : 'Klik untuk mengunggah gambar'}
      </button>
      {preview && (
        <img src={preview} alt="Preview" className="w-32 h-32 object-cover rounded-lg" />
      )}
    </div>
  );
}
```

---

## 6. MINIMAX M2.7 — AI CONTENT GENERATION

### 6.1 Client Setup

```typescript
// lib/minimax/client.ts
import { IntegrationError } from '@/lib/utils/integration-helpers';

const BASE_URL = process.env.MINIMAX_BASE_URL || 'https://api.minimaxi.chat/v1';
const API_KEY = process.env.MINIMAX_API_KEY!;
const MODEL = process.env.MINIMAX_MODEL || 'MiniMax-M2.7';

interface MinimaxChatOptions {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  responseFormat?: 'json' | 'text';
  maxTokens?: number;
  temperature?: number;
}

interface MinimaxResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export async function minimaxChat(options: MinimaxChatOptions): Promise<string> {
  const response = await fetch(`${BASE_URL}/text/chatcompletion_v2`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: options.messages,
      max_tokens: options.maxTokens || 1024,
      temperature: options.temperature || 0.7,
      ...(options.responseFormat === 'json' ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!response.ok) {
    throw new IntegrationError(
      'Minimax',
      response.status,
      `API returned ${response.status}: ${await response.text()}`
    );
  }

  const data: MinimaxResponse = await response.json();
  if (!data.choices?.[0]?.message?.content) {
    throw new IntegrationError('Minimax', 500, 'Empty response from Minimax');
  }

  return data.choices[0].message.content;
}
```

### 6.2 Caption Generator

```typescript
// lib/minimax/generate-caption.ts
import { minimaxChat } from './client';
import { withRetry, withTimeout } from '@/lib/utils/integration-helpers';

interface CaptionResult {
  caption: string;
  hashtags: string[];
}

export async function generateCaption(
  productName: string,
  productDescription: string,
  platform: 'tiktok' | 'instagram',
  language: 'id' | 'en'
): Promise<CaptionResult> {
  const prompt = `
Kamu adalah content creator food brand Indonesia yang ahli.
Buat caption ${platform === 'tiktok' ? 'TikTok' : 'Instagram'} untuk produk berikut:

Nama Produk: ${productName}
Deskripsi: ${productDescription}
Brand: Dapur Dekaka (德卡) — frozen dimsum premium, Chinese-Indonesian heritage

Requirements:
- Bahasa: ${language === 'id' ? 'Bahasa Indonesia yang natural dan engaging' : 'English'}
- Tone: Warm, appetizing, heritage feel
- Length: ${platform === 'tiktok' ? '150-200 kata' : '100-150 kata'}
- Include: Call to action menuju website dapurdekaka.com
- Separate hashtags (15 relevant hashtags)

Format response as JSON: { "caption": "...", "hashtags": ["#tag1", "#tag2"] }
`.trim();

  const raw = await withRetry(
    () => withTimeout(
      () => minimaxChat({
        messages: [{ role: 'user', content: prompt }],
        responseFormat: 'json',
        temperature: 0.8,
      }),
      30000,
      'Minimax.generateCaption'
    ),
    { maxRetries: 1, context: 'Minimax.generateCaption' }
  );

  try {
    const parsed = JSON.parse(raw) as CaptionResult;
    if (!parsed.caption || !Array.isArray(parsed.hashtags)) {
      throw new Error('Invalid response shape');
    }
    return parsed;
  } catch (parseError) {
    // If JSON parsing fails, try to extract content manually
    console.error('[Minimax] Failed to parse JSON response:', raw);
    return {
      caption: raw,
      hashtags: [],
    };
  }
}
```

### 6.3 AI API Route

```typescript
// app/api/ai/generate-caption/route.ts
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { generateCaption } from '@/lib/minimax/generate-caption';
import { success, unauthorized, forbidden, validationError, serverError } from '@/lib/utils/api-response';
import { z } from 'zod';

const CaptionSchema = z.object({
  productName: z.string().min(1).max(200),
  productDescription: z.string().min(1).max(1000),
  platform: z.enum(['tiktok', 'instagram']),
  language: z.enum(['id', 'en']),
});

export async function POST(req: NextRequest) {
  try {
    // Admin-only feature
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (!['superadmin', 'owner'].includes(session.user.role as string)) {
      return forbidden();
    }

    const body = await req.json();
    const parsed = CaptionSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const result = await generateCaption(
      parsed.data.productName,
      parsed.data.productDescription,
      parsed.data.platform,
      parsed.data.language
    );

    return success(result);
  } catch (error) {
    return serverError(error);
  }
}
```

---

## 7. INTEGRATION ERROR HANDLING MATRIX

### 7.1 When to Fail vs. When to Degrade

| Scenario | Action | Rationale |
|---|---|---|
| Midtrans createTransaction fails | **FAIL checkout** — show error, let user retry | Cannot proceed without payment token |
| Midtrans webhook signature invalid | **REJECT** — return 403 | Potential fraud or misconfiguration |
| Midtrans webhook DB update fails | **LOG ERROR** — return 200 | Don't trigger retries; auto-cancel cron catches it |
| RajaOngkir provinces API fails | **FAIL** — show retry button | Cannot build address form without provinces |
| RajaOngkir cost API fails (1 courier) | **DEGRADE** — show remaining couriers | Other couriers may still work |
| RajaOngkir cost API fails (all couriers) | **DEGRADE** — show WhatsApp fallback | Same as "no service available" |
| RajaOngkir cost at checkout differs | **BLOCK** — require user to re-confirm | Price integrity matters |
| Resend email fails | **LOG** — continue silently | Email is non-critical; order is already confirmed |
| Cloudinary upload fails | **FAIL** — show retry button | Admin can retry; image is required |
| Minimax AI fails | **DEGRADE** — show "AI unavailable" message | Admin can write caption manually |

### 7.2 Integration Health Check

```typescript
// lib/utils/health-check.ts
import { snap } from '@/lib/midtrans/client';
import { getProvinces } from '@/lib/rajaongkir/provinces';
import { resend } from '@/lib/resend/client';
import { cloudinary } from '@/lib/cloudinary/client';

interface HealthStatus {
  service: string;
  status: 'ok' | 'error';
  latencyMs: number;
  error?: string;
}

/**
 * Check all integrations are reachable.
 * Useful for admin dashboard health indicator.
 */
export async function checkIntegrationHealth(): Promise<HealthStatus[]> {
  const checks: Promise<HealthStatus>[] = [
    // RajaOngkir — try fetching provinces
    (async () => {
      const start = Date.now();
      try {
        await getProvinces();
        return { service: 'RajaOngkir', status: 'ok' as const, latencyMs: Date.now() - start };
      } catch (error) {
        return { service: 'RajaOngkir', status: 'error' as const, latencyMs: Date.now() - start, error: (error as Error).message };
      }
    })(),

    // Cloudinary — ping API
    (async () => {
      const start = Date.now();
      try {
        await cloudinary.api.ping();
        return { service: 'Cloudinary', status: 'ok' as const, latencyMs: Date.now() - start };
      } catch (error) {
        return { service: 'Cloudinary', status: 'error' as const, latencyMs: Date.now() - start, error: (error as Error).message };
      }
    })(),

    // Resend — check API key validity (list domains)
    (async () => {
      const start = Date.now();
      try {
        await resend.domains.list();
        return { service: 'Resend', status: 'ok' as const, latencyMs: Date.now() - start };
      } catch (error) {
        return { service: 'Resend', status: 'error' as const, latencyMs: Date.now() - start, error: (error as Error).message };
      }
    })(),
  ];

  return Promise.all(checks);
}
```

---

## 8. ENVIRONMENT VARIABLE VALIDATION

```typescript
// lib/utils/env-validation.ts
import { z } from 'zod';

/**
 * Validate all integration env vars at startup.
 * Call this in app/layout.tsx or a global init.
 * Throws immediately if any required var is missing — fail fast.
 */
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // Auth
  AUTH_SECRET: z.string().min(16),
  AUTH_GOOGLE_ID: z.string().min(1),
  AUTH_GOOGLE_SECRET: z.string().min(1),

  // Midtrans
  MIDTRANS_SERVER_KEY: z.string().min(1),
  MIDTRANS_CLIENT_KEY: z.string().min(1),
  MIDTRANS_IS_PRODUCTION: z.enum(['true', 'false']),

  // RajaOngkir
  RAJAONGKIR_API_KEY: z.string().min(1),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),

  // Resend
  RESEND_API_KEY: z.string().startsWith('re_'),

  // Minimax (optional — AI is P2 feature)
  MINIMAX_API_KEY: z.string().optional(),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`);
    throw new Error(
      `Missing or invalid environment variables:\n${missing.join('\n')}`
    );
  }
  return result.data;
}
```

---

*End of INTEGRATION_ENGINE.md v1.0*
*Covers: Midtrans (payment), RajaOngkir (shipping), Resend (email), Cloudinary (images), Minimax (AI)*
*Next: See PRODUCTION_HARDENING.md for cron jobs, security, monitoring, and deployment ops*
