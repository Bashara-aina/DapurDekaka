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
    name?: string;
    phone?: string;
    vehicle_number?: string;
  };
  price?: number;
  status?: string;
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
    destination_postal_code: input.destinationPostalCode,
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
  };
}
