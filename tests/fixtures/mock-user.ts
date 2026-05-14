/**
 * Mock user object for tests.
 * B2B role is toggled via role field.
 */

export type MockUserRole = 'customer' | 'b2b' | 'warehouse' | 'owner' | 'superadmin';

export interface MockUser {
  id: string;
  email: string;
  name: string;
  role: MockUserRole;
  phone: string;
  pointsBalance: number;
  isB2b: boolean;
  b2bCompanyName: string | null;
  b2bCompanyType: string | null;
}

export function createMockUser(overrides?: Partial<MockUser> & { isB2B?: boolean }): MockUser {
  const isB2B = overrides?.isB2B ?? false;

  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'test@example.com',
    name: 'Test User',
    role: isB2B ? 'b2b' : 'customer',
    phone: '+6281234567890',
    pointsBalance: 10000,
    isB2b: isB2B,
    b2bCompanyName: isB2B ? 'Test Company PT' : null,
    b2bCompanyType: isB2B ? 'restaurant' : null,
    ...overrides,
  };
}

export const mockCustomerUser = createMockUser({ isB2B: false });
export const mockB2BUser = createMockUser({ isB2B: true });