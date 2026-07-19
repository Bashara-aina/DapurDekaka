/**
 * Financial Constitution (L2) — single source of truth for monetary guardrails.
 *
 * These rules are the implementation of DapurDekaka.com's 10 immutable
 * financial rules. They are enforced in coupon validation, webhook settlement,
 * refund handling, and the daily ops card.
 *
 * Hard rule changes here must be ratified by Bashara (FOUNDER DECISION in L2).
 */

/** i18n key — bundled shipping line presented to customers. */
export const BUNDLED_ONGKIR_I18N_KEY = 'shipping.bundledLabel';

/** Maximum coupon economic cost per order, in integer IDR. */
export const MAX_COUPON_VALUE_IDR = 15_000;

/** Maximum coupon cost as % of subtotal (matches MAX_COUPON_VALUE_IDR — whichever is lower). */
export const MAX_COUPON_PERCENT = 10;

/** Minimum subtotal required for any coupon to apply (integer IDR). */
export const MIN_ORDER_FOR_COUPON_IDR = 100_000;

/** Refund reserve target — 5% of weekly gross (configurable via systemSettings). */
export const DEFAULT_REFUND_RESERVE_PERCENT = 5;

/** Refund due window — refund must be processed within 7 days of cancellation. */
export const REFUND_DUE_DAYS = 7;

/** Intercity minimum order for frozen_express lane (Phase 2 policy). */
export const INTERCITY_MIN_SUBTOTAL_IDR = 250_000;

/** Pickup auto-release window — claim before this and we keep the stock reserved. */
export const PICKUP_AUTO_RELEASE_HOURS = 48;

/** B2B prepaid only — no Net-30 for first 90 days. */
export const B2B_CREDIT_ENABLED_DEFAULT = false;

/** Wallet floor — never let Biteship wallet drop below 2× weekly dispatch cost. */
export const WALLET_FLOOR_MULTIPLIER = 2;

/** Helper trigger — sustained orders/week that crosses hiring threshold. */
export const HELPER_TRIGGER_ORDERS_PER_WEEK = 80;

/** Operator solo ceiling (orders/week) before feature freeze must be respected. */
export const SOLO_OPS_CEILING_ORDERS_PER_WEEK = 60;

/** Sampler promo — minimum subtotal to qualify for the free SKU add-on. */
export const SAMPLER_PROMO_MIN_SUBTOTAL_IDR = 150_000;

/**
 * Format a money rule violation message in Bahasa Indonesia.
 * Returned to the API caller so checkout UI can show it without translation.
 */
export function couponCapError(subtotal: number): string {
  return `Maksimum diskon kupon adalah ${formatIdr(MAX_COUPON_VALUE_IDR)} atau ${MAX_COUPON_PERCENT}% dari subtotal (${formatIdr(subtotal)})`;
}

/** Format integer IDR to "Rp 123.456" without relying on the i18n formatter. */
function formatIdr(value: number): string {
  return `Rp ${value.toLocaleString('id-ID')}`;
}
