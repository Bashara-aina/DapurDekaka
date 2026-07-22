/**
 * Client-safe Midtrans Snap script URL helper.
 * Never import @/lib/midtrans/client from client components — that module
 * instantiates the server SDK with MIDTRANS_SERVER_KEY.
 */

export function getSnapUrl(): string {
  const isProduction =
    process.env.MIDTRANS_IS_PRODUCTION === 'true' ||
    process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true';

  return isProduction
    ? 'https://app.midtrans.com/snap/snap.js'
    : 'https://app.sandbox.midtrans.com/snap/snap.js';
}
