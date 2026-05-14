/**
 * Mock cart items for tests.
 * Valid cart item shapes matching the cart store and checkout validation.
 */

export interface MockCartItem {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  price: number;
  weightGram: number;
  quantity: number;
  imageUrl: string | null;
}

export const mockCartItems: MockCartItem[] = [
  {
    variantId: '550e8400-e29b-41d4-a716-446655440010',
    productId: '550e8400-e29b-41d4-a716-446655440001',
    productName: 'Dimsum Crabstick',
    variantName: '500g',
    price: 45000,
    weightGram: 500,
    quantity: 2,
    imageUrl: '/assets/menu-items/dimsum-crabstick.png',
  },
  {
    variantId: '550e8400-e29b-41d4-a716-446655440011',
    productId: '550e8400-e29b-41d4-a716-446655440001',
    productName: 'Dimsum Jamur',
    variantName: '500g',
    price: 30000,
    weightGram: 500,
    quantity: 1,
    imageUrl: '/assets/menu-items/dimsum-jamur.png',
  },
];

export const mockCartItemsSingle = [mockCartItems[0]];

export const mockCartItemsMaxQuantity = mockCartItems.map((item) => ({
  ...item,
  quantity: 99,
}));