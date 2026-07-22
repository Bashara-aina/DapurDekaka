import { biteshipFetch } from './client';
import type { BiteshipCoordinate } from '../../types';

export interface BiteshipRateItem {
  name: string;
  value: number;
  weight: number;
  length: number;
  width: number;
  height: number;
  quantity: number;
  category?: string;
}

export interface BiteshipRateRequest {
  originLatitude: number;
  originLongitude: number;
  destinationLatitude: number;
  destinationLongitude: number;
  couriers: string;
  items: BiteshipRateItem[];
}

export interface BiteshipPricingRow {
  courier_company: string;
  courier_type: string;
  courier_name?: string;
  price: number;
  duration?: string;
  shipment_duration_range?: string;
  available_for_cash_on_delivery?: boolean;
  available_for_insurance?: boolean;
}

/** Raw pricing row as returned by Biteship Rates API v1. */
interface BiteshipApiPricingRow {
  company?: string;
  courier_code?: string;
  courier_company?: string;
  type?: string;
  courier_service_code?: string;
  courier_type?: string;
  courier_name?: string;
  price: number;
  duration?: string;
  shipment_duration_range?: string;
  available_for_cash_on_delivery?: boolean;
  available_for_insurance?: boolean;
}

export interface BiteshipRatesResponse {
  pricing?: BiteshipApiPricingRow[];
  success?: boolean;
}

/**
 * Normalize Biteship pricing fields to our internal courier_company / courier_type shape.
 * Live API returns company + type (or courier_code + courier_service_code).
 */
export function normalizePricingRow(row: BiteshipApiPricingRow): BiteshipPricingRow {
  return {
    courier_company: row.courier_company ?? row.company ?? row.courier_code ?? '',
    courier_type: row.courier_type ?? row.type ?? row.courier_service_code ?? '',
    courier_name: row.courier_name,
    price: row.price,
    duration: row.duration,
    shipment_duration_range: row.shipment_duration_range,
    available_for_cash_on_delivery: row.available_for_cash_on_delivery,
    available_for_insurance: row.available_for_insurance,
  };
}

/**
 * Fetch courier rates from Biteship for given origin/dest and courier list.
 */
export async function fetchBiteshipRates(
  request: BiteshipRateRequest
): Promise<BiteshipPricingRow[]> {
  const body = {
    origin_latitude: request.originLatitude,
    origin_longitude: request.originLongitude,
    destination_latitude: request.destinationLatitude,
    destination_longitude: request.destinationLongitude,
    couriers: request.couriers,
    items: request.items.map((item) => ({
      name: item.name,
      value: item.value,
      weight: item.weight,
      length: item.length,
      width: item.width,
      height: item.height,
      quantity: item.quantity,
      category: item.category ?? 'frozen_food',
    })),
  };

  const data = await biteshipFetch<BiteshipRatesResponse>('/rates/couriers', {
    method: 'POST',
    body,
  });

  return (data.pricing ?? []).map(normalizePricingRow);
}

/**
 * Build Biteship rate items from cart with frozen_food category.
 */
export function buildRateItems(
  items: Array<{
    name: string;
    value: number;
    weightGram: number;
    lengthCm: number;
    widthCm: number;
    heightCm: number;
    quantity: number;
    category?: string;
  }>
): BiteshipRateItem[] {
  return items.map((item) => ({
    name: item.name.substring(0, 50),
    value: item.value,
    weight: Math.max(item.weightGram, 1000),
    length: item.lengthCm,
    width: item.widthCm,
    height: item.heightCm,
    quantity: item.quantity,
    category: item.category ?? 'frozen_food',
  }));
}

export function coordsFromRequest(
  origin: BiteshipCoordinate,
  dest: BiteshipCoordinate
): Pick<BiteshipRateRequest, 'originLatitude' | 'originLongitude' | 'destinationLatitude' | 'destinationLongitude'> {
  return {
    originLatitude: origin.latitude,
    originLongitude: origin.longitude,
    destinationLatitude: dest.latitude,
    destinationLongitude: dest.longitude,
  };
}
