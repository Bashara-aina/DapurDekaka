import { biteshipFetch } from './client';
import type { DispatchResult } from '../../types';

export interface CreateBiteshipOrderInput {
  referenceId: string;
  courierCompany: string;
  courierType: string;
  originLatitude: number;
  originLongitude: number;
  originAddress: string;
  originContactName: string;
  originContactPhone: string;
  destinationLatitude: number;
  destinationLongitude: number;
  destinationAddress: string;
  destinationContactName: string;
  destinationContactPhone: string;
  destinationPostalCode?: string;
  insuranceValue?: number;
  cashOnDeliveryValue?: number;
  cashOnDeliveryType?: string;
  items: Array<{
    name: string;
    value: number;
    weight: number;
    length: number;
    width: number;
    height: number;
    quantity: number;
  }>;
}

interface BiteshipOrderResponse {
  id?: string;
  courier?: {
    waybill_id?: string;
    link?: string;
    tracking_id?: string;
    driver_name?: string;
    driver_phone?: string;
    driver_plate_number?: string;
    driver_photo_url?: string;
    /** @deprecated Use driver_name */
    name?: string;
    /** @deprecated Use driver_phone */
    phone?: string;
  };
  price?: number;
  status?: string;
}

/**
 * Cancel a Biteship order via the API.
 * Docs: POST /v1/orders/:id/cancel
 */
export async function cancelBiteshipOrder(
  biteshipOrderId: string,
  reasonCode: string = 'others',
  customReason?: string
): Promise<{ success?: boolean; status?: string }> {
  const body: Record<string, string> = { cancellation_reason_code: reasonCode };
  if (reasonCode === 'others' && customReason) {
    body.cancellation_reason = customReason;
  }
  return biteshipFetch<{ success?: boolean; status?: string }>(
    `/orders/${biteshipOrderId}/cancel`,
    { method: 'POST', body }
  );
}

/**
 * Create a Biteship order for warehouse dispatch.
 */
export async function createBiteshipOrder(
  input: CreateBiteshipOrderInput
): Promise<DispatchResult> {
  const body = {
    reference_id: input.referenceId,
    courier_company: input.courierCompany,
    courier_type: input.courierType,
    courier_insurance: input.insuranceValue && input.insuranceValue > 0
      ? input.insuranceValue
      : undefined,
    destination_cash_on_delivery: input.cashOnDeliveryValue && input.cashOnDeliveryValue > 0
      ? input.cashOnDeliveryValue
      : undefined,
    destination_cash_on_delivery_type: input.cashOnDeliveryType ?? '7_days',
    delivery_type: 'now',
    origin_contact_name: input.originContactName,
    origin_contact_phone: input.originContactPhone,
    origin_address: input.originAddress,
    origin_coordinate: {
      latitude: input.originLatitude,
      longitude: input.originLongitude,
    },
    destination_contact_name: input.destinationContactName,
    destination_contact_phone: input.destinationContactPhone,
    destination_address: input.destinationAddress,
    destination_postal_code: input.destinationPostalCode ? Number(input.destinationPostalCode) : undefined,
    destination_coordinate: {
      latitude: input.destinationLatitude,
      longitude: input.destinationLongitude,
    },
    items: input.items.map((item) => ({
      name: item.name.substring(0, 50),
      value: item.value,
      weight: item.weight,
      length: item.length,
      width: item.width,
      height: item.height,
      quantity: item.quantity,
      category: 'frozen_food',
    })),
  };

  const data = await biteshipFetch<BiteshipOrderResponse>('/orders', {
    method: 'POST',
    body,
  });

  return {
    biteshipOrderId: data.id ?? '',
    waybillId: data.courier?.waybill_id ?? null,
    trackingUrl: data.courier?.link ?? null,
    actualCost: data.price ?? 0,
    trackingId: data.courier?.tracking_id ?? null,
  };
}
