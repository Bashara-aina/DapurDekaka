/**
 * Standardized API response helpers for consistent response formatting.
 * All successful responses use ok() or created(), all errors use error().
 */

export function ok<T>(data: T, meta?: object) {
  return { success: true as const, data, ...(meta && { meta }) };
}

export function created<T>(data: T, meta?: object) {
  return { success: true as const, data, ...(meta && { meta }) };
}

export function error(code: string, message: string, status = 400) {
  return { success: false as const, error: { code, message }, status };
}