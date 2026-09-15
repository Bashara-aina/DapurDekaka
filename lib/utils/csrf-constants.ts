/**
 * Shared CSRF wire constants (no Node.js dependencies — safe to import from
 * both server code and `'use client'` bundles).
 */

export const CSRF_COOKIE_NAME = 'ddk_csrf';
export const CSRF_HEADER_NAME = 'x-csrf-token';
export const CSRF_MAX_AGE_SEC = 60 * 60 * 24; // 1 day (matches upstream default)
