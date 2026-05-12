export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public isOperational: boolean = true,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class PaymentError extends AppError {
  constructor(message: string) {
    super(message, 'PAYMENT_ERROR', 402);
  }
}

export class StockError extends AppError {
  constructor(variantId: string) {
    super(`Insufficient stock for variant ${variantId}`, 'INSUFFICIENT_STOCK', 409);
  }
}

export class CouponError extends AppError {
  constructor(message: string) {
    super(message, 'COUPON_ERROR', 422);
  }
}