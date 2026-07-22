import { getShippingRates, findQuoteById, parseQuoteId } from './get-rates';
import { verifyCustomerShippingCost, getMarkupAmount } from './markup';
import { calculateInsuranceFee, verifyInsuranceFee } from './insurance';
import type { InsuranceType, ShippingItemInput, ShippingTier } from './types';

export interface CheckoutShippingInput {
  deliveryMethod: 'delivery' | 'pickup';
  selectedQuoteId?: string;
  latitude?: number;
  longitude?: number;
  biteshipAreaId?: string;
  shippingTier?: ShippingTier;
  insuranceType?: InsuranceType;
  insuranceFee?: number;
  customerShippingCost?: number;
  biteshipActualCost?: number;
  courierInstantAck?: boolean;
  cashOnDelivery?: boolean;
  subtotal: number;
  items: ShippingItemInput[];
  originLat?: number;
  originLng?: number;
}

export interface ValidatedShipping {
  shippingCost: number;
  biteshipActualCost: number;
  shippingMarkupAmount: number;
  insuranceType: InsuranceType;
  insuranceFee: number;
  shippingTier: ShippingTier;
  courierCode: string;
  courierService: string;
  courierName: string;
  latitude: string | null;
  longitude: string | null;
  biteshipAreaId: string | null;
  originLatitude: string;
  originLongitude: string;
  dispatchStatus: 'not_required' | 'pending';
  courierInstantAck: boolean;
  cashOnDelivery: boolean;
  cashOnDeliveryFee: number;
}

export class ShippingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShippingValidationError';
  }
}

/**
 * Server-side re-quote and validate shipping selection at checkout.
 */
export async function validateCheckoutShipping(
  input: CheckoutShippingInput
): Promise<ValidatedShipping> {
  const originLat = input.originLat ?? -6.958;
  const originLng = input.originLng ?? 107.636;
  const insuranceType: InsuranceType = input.insuranceType ?? 'none';
  const insuranceFee = calculateInsuranceFee(insuranceType, input.subtotal);

  if (input.deliveryMethod === 'pickup') {
    return {
      shippingCost: 0,
      biteshipActualCost: 0,
      shippingMarkupAmount: 0,
      insuranceType: 'none',
      insuranceFee: 0,
      shippingTier: 'pickup',
      courierCode: '',
      courierService: '',
      courierName: '',
      latitude: null,
      longitude: null,
      biteshipAreaId: null,
      originLatitude: String(originLat),
      originLongitude: String(originLng),
      dispatchStatus: 'not_required',
      courierInstantAck: false,
      cashOnDelivery: false,
      cashOnDeliveryFee: 0,
    };
  }

  if (!input.selectedQuoteId || input.latitude == null || input.longitude == null) {
    throw new ShippingValidationError('Alamat pengiriman dan kurir wajib dipilih');
  }

  const rates = await getShippingRates({
    originLat,
    originLng,
    destLat: input.latitude,
    destLng: input.longitude,
    items: input.items,
    subtotal: input.subtotal,
  });

  const quote = findQuoteById(rates, input.selectedQuoteId);
  if (!quote) {
    throw new ShippingValidationError('Opsi pengiriman tidak valid atau sudah tidak tersedia');
  }

  const customerCost = quote.customerCost;
  if (
    input.customerShippingCost != null &&
    !verifyCustomerShippingCost(quote.actualCost, input.customerShippingCost)
  ) {
    throw new ShippingValidationError('Biaya ongkir tidak sesuai, silakan muat ulang halaman');
  }

  if (
    input.biteshipActualCost != null &&
    input.biteshipActualCost !== quote.actualCost
  ) {
    throw new ShippingValidationError('Tarif pengiriman berubah, silakan pilih ulang kurir');
  }

  if (input.insuranceFee != null && !verifyInsuranceFee(insuranceType, input.subtotal, input.insuranceFee)) {
    throw new ShippingValidationError('Biaya asuransi tidak valid');
  }

  if (quote.tier === 'express' && !input.courierInstantAck) {
    throw new ShippingValidationError('Anda harus menyetujui syarat pengiriman express');
  }

  const cashOnDelivery = input.cashOnDelivery ?? false;
  if (cashOnDelivery && !quote.cashOnDeliveryAvailable) {
    throw new ShippingValidationError('Kurir yang dipilih tidak mendukung pembayaran COD');
  }

  const parsed = parseQuoteId(input.selectedQuoteId);

  return {
    shippingCost: customerCost,
    biteshipActualCost: quote.actualCost,
    shippingMarkupAmount: getMarkupAmount(quote.actualCost, customerCost),
    insuranceType,
    insuranceFee,
    shippingTier: parsed.tier,
    courierCode: parsed.courierCode,
    courierService: parsed.courierType,
    courierName: quote.displayName,
    latitude: String(input.latitude),
    longitude: String(input.longitude),
    biteshipAreaId: input.biteshipAreaId ?? null,
    originLatitude: String(originLat),
    originLongitude: String(originLng),
    dispatchStatus: 'pending',
    courierInstantAck: input.courierInstantAck ?? false,
    cashOnDelivery,
    cashOnDeliveryFee: 0,
  };
}
