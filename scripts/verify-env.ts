/**
 * Verify all required environment variables are set
 * Run: npx tsx scripts/verify-env.ts
 */

const required = [
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'MIDTRANS_SERVER_KEY',
  'NEXT_PUBLIC_MIDTRANS_CLIENT_KEY',
  'RAJAONGKIR_API_KEY',
  'RAJAONGKIR_ORIGIN_CITY_ID',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME',
  'RESEND_API_KEY',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
];

const optional = [
  'NEXTAUTH_URL',
  'MIDTRANS_IS_PRODUCTION',
  'CRON_SECRET',
  'MINIMAX_API_KEY',
  'MINIMAX_GROUP_ID',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_WHATSAPP_NUMBER',
];

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error('❌ Missing required env vars:');
  missing.forEach((key) => console.error(`   - ${key}`));
  console.error('\nAdd these to your .env.local file.');
  process.exit(1);
}

console.log('✅ All required env vars present');

const missingOptional = optional.filter((key) => !process.env[key]);
if (missingOptional.length > 0) {
  console.log('⚠️  Optional env vars not set (OK for development):');
  missingOptional.forEach((key) => console.log(`   - ${key}`));
}
