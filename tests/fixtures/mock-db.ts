/**
 * Mock database helper for tests.
 * Simple mock functions that don't depend on Vitest types.
 */

interface MockFn {
  (...args: unknown[]): unknown;
  mockReset: () => void;
  mockReturnThis: () => MockFn;
  mockReturnValue: (value: unknown) => MockFn;
}

function createMockFn(initialValue?: unknown): MockFn {
  let returnValue = initialValue;
  const fn = function (..._args: unknown[]) {
    return returnValue;
  } as MockFn;
  fn.mockReset = () => { returnValue = undefined; };
  fn.mockReturnThis = () => fn;
  fn.mockReturnValue = (v: unknown) => { returnValue = v; return fn; };
  return fn;
}

interface MockQueryObj {
  findFirst?: MockFn;
  findMany?: MockFn;
}

export interface MockDb {
  query: Record<string, MockQueryObj>;
  update: MockFn;
  insert: MockFn;
  delete: MockFn;
  transaction: MockFn;
}

/**
 * Creates a mock DB object that mimics Drizzle ORM query interface.
 */
export function createMockDb(overrides?: Partial<MockDb>): MockDb {
  return {
    query: {
      users: { findFirst: createMockFn(), findMany: createMockFn() },
      orders: { findFirst: createMockFn(), findMany: createMockFn() },
      productVariants: { findFirst: createMockFn(), findMany: createMockFn() },
      coupons: { findFirst: createMockFn(), findMany: createMockFn() },
      pointsHistory: { findFirst: createMockFn(), findMany: createMockFn() },
      ...overrides?.query,
    },
    update: createMockFn(),
    insert: createMockFn(),
    delete: createMockFn(),
    transaction: createMockFn(),
    ...overrides,
  };
}

/**
 * Resets all mock functions on a mock DB.
 * Call in beforeEach() or afterEach() in test files.
 */
export function resetMockDb(mockDb: MockDb): void {
  Object.values(mockDb.query).forEach((queryObj) => {
    if (queryObj.findFirst) queryObj.findFirst.mockReset();
    if (queryObj.findMany) queryObj.findMany.mockReset();
  });
  mockDb.update.mockReset();
  mockDb.insert.mockReset();
  mockDb.delete.mockReset();
  mockDb.transaction.mockReset();
}