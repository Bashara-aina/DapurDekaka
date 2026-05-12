import { NextResponse } from 'next/server';
import type { ZodError } from 'zod';

export function success<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function created<T>(data: T) {
  return NextResponse.json({ success: true, data }, { status: 201 });
}

export function unauthorized(message = 'Unauthorized') {
  return NextResponse.json(
    { success: false, error: message, code: 'UNAUTHORIZED' },
    { status: 401 }
  );
}

export function forbidden(message = 'Forbidden') {
  return NextResponse.json(
    { success: false, error: message, code: 'FORBIDDEN' },
    { status: 403 }
  );
}

export function notFound(message = 'Not found') {
  return NextResponse.json(
    { success: false, error: message, code: 'NOT_FOUND' },
    { status: 404 }
  );
}

export function validationError(error: ZodError) {
  return NextResponse.json(
    {
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: error.flatten().fieldErrors,
    },
    { status: 422 }
  );
}

export function conflict(message: string) {
  return NextResponse.json(
    { success: false, error: message, code: 'CONFLICT' },
    { status: 409 }
  );
}

export function serverError(error: unknown) {
  console.error('[API Error]', error);
  return NextResponse.json(
    { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
    { status: 500 }
  );
}
