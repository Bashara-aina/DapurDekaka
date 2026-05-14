/**
 * Mock order object for tests.
 * Minimal order for checkout/payment flow testing.
 */

export interface MockOrderItem {
  id: string;
  orderId: string;
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  weightGram: number;
}

export interface MockOrder {
  id: string;
  orderNumber: string;
  userId: string;
  status: 'pending_payment' | 'paid' | 'processing' | 'packed' | 'shipped' | 'delivered' | 'cancelled';
  deliveryMethod: 'delivery' | 'pickup';
  subtotal: number;
  shippingCost: number;
  totalAmount: number;
  recipientName: string;
  recipientEmail: string;
  recipientPhone: string;
  courierCode: string;
  courierName: string;
  trackingNumber: string | null;
  midtransOrderId: string;
  paidAt: Date | null;
  items: MockOrderItem[];
}

export function createMockOrderItem(overrides?: Partial<MockOrderItem>): MockOrderItem {
  return {
    id: '550e8400-e29b-41d4-a716-446655440002',
    orderId: '550e8400-e29b-41d4-a716-446655440001',
    variantId: '550e8400-e29b-41d4-a716-446655440010',
    productId: '550e8400-e29b-41d4-a716-446655440001',
    productName: 'Dimsum Crabstick',
    variantName: '500g',
    sku: 'DIM-CRA-500',
    unitPrice: 45000,
    quantity: 2,
    subtotal: 90000,
    weightGram: 500,
    ...overrides,
  };
}

export function createMockOrder(overrides?: Partial<MockOrder>): MockOrder {
  return {
    id: '550e8400-e29b-41d4-a716-446655440001',
    orderNumber: 'DDK-20260514-0001',
    userId: '550e8400-e29b-41d4-a716-446655440000',
    status: 'pending_payment',
    deliveryMethod: 'delivery',
    subtotal: 120000,
    shippingCost: 25000,
    totalAmount: 145000,
    recipientName: 'Test Recipient',
    recipientEmail: 'recipient@example.com',
    recipientPhone: '+6281234567890',
    courierCode: 'jne',
    courierName: 'JNE',
    trackingNumber: null,
    midtransOrderId: 'DDK-20260514-0001',
    paidAt: null,
    items: [createMockOrderItem()],
    ...overrides,
  };
}

export const mockOrder = createMockOrder();
export const mockOrderItem = createMockOrderItem();