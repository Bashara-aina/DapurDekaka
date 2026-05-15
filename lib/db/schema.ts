import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────

export const userRoleEnum = pgEnum('user_role_enum', [
  'customer', 'b2b', 'warehouse', 'owner', 'superadmin',
]);

export const orderStatusEnum = pgEnum('order_status_enum', [
  'pending_payment', 'paid', 'processing', 'packed',
  'shipped', 'delivered', 'cancelled', 'refunded',
]);

export const deliveryMethodEnum = pgEnum('delivery_method_enum', [
  'delivery', 'pickup',
]);

export const couponTypeEnum = pgEnum('coupon_type_enum', [
  'percentage', 'fixed', 'free_shipping', 'buy_x_get_y',
]);

export const pointsTypeEnum = pgEnum('points_type_enum', [
  'earn', 'redeem', 'expire', 'adjust',
]);

export const inventoryChangeEnum = pgEnum('inventory_change_enum', [
  'manual', 'sale', 'restock', 'adjustment', 'reversal',
]);

export const carouselTypeEnum = pgEnum('carousel_type_enum', [
  'product_hero', 'promo', 'brand_story',
]);

export const b2bInquiryStatusEnum = pgEnum('b2b_inquiry_status_enum', [
  'new', 'contacted', 'converted', 'rejected',
]);

export const b2bQuoteStatusEnum = pgEnum('b2b_quote_status_enum', [
  'draft', 'sent', 'accepted', 'rejected', 'expired',
]);

// ─────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
};

// ─────────────────────────────────────────
// AUTH TABLES (NextAuth v5 + Drizzle Adapter)
// ─────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  emailVerified: timestamp('email_verified', { withTimezone: true }),
  image: text('image'),
  passwordHash: text('password_hash'),
  phone: varchar('phone', { length: 20 }),
  role: userRoleEnum('role').notNull().default('customer'),
  isActive: boolean('is_active').notNull().default(true),
  pointsBalance: integer('points_balance').notNull().default(0),
  languagePreference: varchar('language_preference', { length: 5 }).notNull().default('id'),
  ...timestamps,
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 255 }).notNull(),
  provider: varchar('provider', { length: 255 }).notNull(),
  providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(),
  refreshToken: text('refresh_token'),
  accessToken: text('access_token'),
  expiresAt: integer('expires_at'),
  tokenType: varchar('token_type', { length: 255 }),
  scope: text('scope'),
  idToken: text('id_token'),
  sessionState: text('session_state'),
});

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionToken: varchar('session_token', { length: 255 }).notNull().unique(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable('verification_tokens', {
  identifier: varchar('identifier', { length: 255 }).notNull(),
  token: varchar('token', { length: 255 }).notNull(),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
});

export const addresses = pgTable('addresses', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  label: varchar('label', { length: 100 }),
  recipientName: varchar('recipient_name', { length: 255 }).notNull(),
  recipientPhone: varchar('recipient_phone', { length: 20 }).notNull(),
  addressLine: text('address_line').notNull(),
  district: varchar('district', { length: 255 }).notNull(),
  city: varchar('city', { length: 255 }).notNull(),
  cityId: varchar('city_id', { length: 10 }).notNull(),
  province: varchar('province', { length: 255 }).notNull(),
  provinceId: varchar('province_id', { length: 10 }).notNull(),
  postalCode: varchar('postal_code', { length: 10 }).notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  ...timestamps,
});

export const savedCarts = pgTable('saved_carts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id').notNull().references(() => productVariants.id),
  quantity: integer('quantity').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 255 }).notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────
// PRODUCT TABLES
// ─────────────────────────────────────────

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  nameId: varchar('name_id', { length: 100 }).notNull(),
  nameEn: varchar('name_en', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  descriptionId: text('description_id'),
  descriptionEn: text('description_en'),
  imageUrl: text('image_url'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  categoryId: uuid('category_id').notNull().references(() => categories.id),
  nameId: varchar('name_id', { length: 255 }).notNull(),
  nameEn: varchar('name_en', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  descriptionId: text('description_id'),
  descriptionEn: text('description_en'),
  shortDescriptionId: varchar('short_description_id', { length: 500 }),
  shortDescriptionEn: varchar('short_description_en', { length: 500 }),
  weightGram: integer('weight_gram').notNull().default(0),
  isHalal: boolean('is_halal').notNull().default(true),
  isActive: boolean('is_active').notNull().default(true),
  isFeatured: boolean('is_featured').notNull().default(false),
  isB2bAvailable: boolean('is_b2b_available').notNull().default(true),
  isPreOrder: boolean('is_pre_order').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  metaTitleId: varchar('meta_title_id', { length: 255 }),
  metaTitleEn: varchar('meta_title_en', { length: 255 }),
  metaDescriptionId: varchar('meta_description_id', { length: 500 }),
  metaDescriptionEn: varchar('meta_description_en', { length: 500 }),
  shopeeUrl: text('shopee_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const productVariants = pgTable('product_variants', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  nameId: varchar('name_id', { length: 100 }).notNull(),
  nameEn: varchar('name_en', { length: 100 }).notNull(),
  sku: varchar('sku', { length: 100 }).notNull().unique(),
  price: integer('price').notNull(),
  b2bPrice: integer('b2b_price'),
  stock: integer('stock').notNull().default(0),
  weightGram: integer('weight_gram').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps,
});

export const productImages = pgTable('product_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  cloudinaryUrl: text('cloudinary_url').notNull(),
  cloudinaryPublicId: varchar('cloudinary_public_id', { length: 255 }).notNull(),
  altTextId: varchar('alt_text_id', { length: 255 }),
  altTextEn: varchar('alt_text_en', { length: 255 }),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const inventoryLogs = pgTable('inventory_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  variantId: uuid('variant_id').notNull().references(() => productVariants.id),
  changedByUserId: uuid('changed_by_user_id').references(() => users.id),
  changeType: inventoryChangeEnum('change_type').notNull(),
  quantityBefore: integer('quantity_before').notNull(),
  quantityAfter: integer('quantity_after').notNull(),
  quantityDelta: integer('quantity_delta').notNull(),
  orderId: uuid('order_id'),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────
// ORDER TABLES
// ─────────────────────────────────────────

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderNumber: varchar('order_number', { length: 20 }).notNull().unique(),
  userId: uuid('user_id').references(() => users.id),
  status: orderStatusEnum('status').notNull().default('pending_payment'),
  deliveryMethod: deliveryMethodEnum('delivery_method').notNull(),
  recipientName: varchar('recipient_name', { length: 255 }).notNull(),
  recipientEmail: varchar('recipient_email', { length: 255 }).notNull(),
  recipientPhone: varchar('recipient_phone', { length: 20 }).notNull(),
  addressLine: text('address_line'),
  district: varchar('district', { length: 255 }),
  city: varchar('city', { length: 255 }),
  cityId: varchar('city_id', { length: 10 }),
  province: varchar('province', { length: 255 }),
  provinceId: varchar('province_id', { length: 10 }),
  postalCode: varchar('postal_code', { length: 10 }),
  courierCode: varchar('courier_code', { length: 50 }),
  courierService: varchar('courier_service', { length: 50 }),
  courierName: varchar('courier_name', { length: 100 }),
  shippingCost: integer('shipping_cost').notNull().default(0),
  estimatedDays: varchar('estimated_days', { length: 50 }),
  subtotal: integer('subtotal').notNull(),
  discountAmount: integer('discount_amount').notNull().default(0),
  pointsDiscount: integer('points_discount').notNull().default(0),
  totalAmount: integer('total_amount').notNull(),
  couponId: uuid('coupon_id').references(() => coupons.id),
  couponCode: varchar('coupon_code', { length: 50 }),
  pointsUsed: integer('points_used').notNull().default(0),
  pointsEarned: integer('points_earned').notNull().default(0),
  customerNote: text('customer_note'),
  midtransOrderId: varchar('midtrans_order_id', { length: 100 }),
  midtransTransactionId: varchar('midtrans_transaction_id', { length: 255 }),
  midtransPaymentType: varchar('midtrans_payment_type', { length: 100 }),
  midtransVaNumber: varchar('midtrans_va_number', { length: 100 }),
  midtransSnapToken: text('midtrans_snap_token'),
  paymentExpiresAt: timestamp('payment_expires_at', { withTimezone: true }),
  paymentRetryCount: integer('payment_retry_count').notNull().default(0),
  trackingNumber: varchar('tracking_number', { length: 255 }),
  trackingUrl: text('tracking_url'),
  pickupCode: varchar('pickup_code', { length: 20 }),
  isB2b: boolean('is_b2b').notNull().default(false),
  ...timestamps,
  paidAt: timestamp('paid_at', { withTimezone: true }),
  shippedAt: timestamp('shipped_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
});

export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id').notNull().references(() => productVariants.id),
  productId: uuid('product_id').notNull().references(() => products.id),
  productNameId: varchar('product_name_id', { length: 255 }).notNull(),
  productNameEn: varchar('product_name_en', { length: 255 }).notNull(),
  variantNameId: varchar('variant_name_id', { length: 100 }).notNull(),
  variantNameEn: varchar('variant_name_en', { length: 100 }).notNull(),
  sku: varchar('sku', { length: 100 }).notNull(),
  productImageUrl: text('product_image_url'),
  unitPrice: integer('unit_price').notNull(),
  quantity: integer('quantity').notNull(),
  subtotal: integer('subtotal').notNull(),
  weightGram: integer('weight_gram').notNull(),
  variantOptions: jsonb('variant_options'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const orderStatusHistory = pgTable('order_status_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  fromStatus: orderStatusEnum('from_status'),
  toStatus: orderStatusEnum('to_status').notNull(),
  changedByUserId: uuid('changed_by_user_id').references(() => users.id),
  changedByType: varchar('changed_by_type', { length: 50 }).notNull().default('system'),
  note: text('note'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────
// PROMOTIONS & LOYALTY
// ─────────────────────────────────────────

export const coupons = pgTable('coupons', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  type: couponTypeEnum('type').notNull(),
  nameId: varchar('name_id', { length: 255 }).notNull(),
  nameEn: varchar('name_en', { length: 255 }).notNull(),
  descriptionId: text('description_id'),
  descriptionEn: text('description_en'),
  discountValue: integer('discount_value'),
  minOrderAmount: integer('min_order_amount').notNull().default(0),
  maxDiscountAmount: integer('max_discount_amount'),
  freeShipping: boolean('free_shipping').notNull().default(false),
  buyQuantity: integer('buy_quantity'),
  getQuantity: integer('get_quantity'),
  maxUses: integer('max_uses'),
  usedCount: integer('used_count').notNull().default(0),
  maxUsesPerUser: integer('max_uses_per_user'),
  isActive: boolean('is_active').notNull().default(true),
  isPublic: boolean('is_public').notNull().default(false),
  startsAt: timestamp('starts_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  ...timestamps,
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const couponUsages = pgTable('coupon_usages', {
  id: uuid('id').primaryKey().defaultRandom(),
  couponId: uuid('coupon_id').notNull().references(() => coupons.id),
  orderId: uuid('order_id').notNull().references(() => orders.id),
  userId: uuid('user_id').references(() => users.id),
  discountApplied: integer('discount_applied').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  couponOrderUnique: unique('uq_coupon_usages_coupon_order').on(table.couponId, table.orderId),
}));

export const pointsHistory = pgTable('points_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: pointsTypeEnum('type').notNull(),
  pointsAmount: integer('points_amount').notNull(),
  pointsBalanceAfter: integer('points_balance_after').notNull(),
  orderId: uuid('order_id').references(() => orders.id),
  descriptionId: varchar('description_id', { length: 255 }).notNull(),
  descriptionEn: varchar('description_en', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  isExpired: boolean('is_expired').notNull().default(false),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  // Self-reference without .references() to avoid circular type inference
  referencedEarnId: uuid('referenced_earn_id'),
  adjustedBy: uuid('adjusted_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────
// CONTENT TABLES
// ─────────────────────────────────────────

export const blogCategories = pgTable('blog_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  nameId: varchar('name_id', { length: 100 }).notNull(),
  nameEn: varchar('name_en', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const blogPosts = pgTable('blog_posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  blogCategoryId: uuid('blog_category_id').references(() => blogCategories.id),
  titleId: varchar('title_id', { length: 255 }).notNull(),
  titleEn: varchar('title_en', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  excerptId: text('excerpt_id'),
  excerptEn: text('excerpt_en'),
  contentId: text('content_id').notNull(),
  contentEn: text('content_en').notNull(),
  coverImageUrl: text('cover_image_url'),
  coverImagePublicId: varchar('cover_image_public_id', { length: 255 }),
  metaTitleId: varchar('meta_title_id', { length: 255 }),
  metaTitleEn: varchar('meta_title_en', { length: 255 }),
  metaDescriptionId: varchar('meta_description_id', { length: 500 }),
  metaDescriptionEn: varchar('meta_description_en', { length: 500 }),
  isPublished: boolean('is_published').notNull().default(false),
  isAiAssisted: boolean('is_ai_assisted').notNull().default(false),
  authorId: uuid('author_id').notNull().references(() => users.id),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  ...timestamps,
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const carouselSlides = pgTable('carousel_slides', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: carouselTypeEnum('type').notNull(),
  titleId: varchar('title_id', { length: 255 }).notNull(),
  titleEn: varchar('title_en', { length: 255 }).notNull(),
  subtitleId: varchar('subtitle_id', { length: 500 }),
  subtitleEn: varchar('subtitle_en', { length: 500 }),
  imageUrl: text('image_url').notNull(),
  imagePublicId: varchar('image_public_id', { length: 255 }).notNull(),
  ctaLabelId: varchar('cta_label_id', { length: 100 }),
  ctaLabelEn: varchar('cta_label_en', { length: 100 }),
  ctaUrl: varchar('cta_url', { length: 500 }),
  badgeText: varchar('badge_text', { length: 100 }),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  startsAt: timestamp('starts_at', { withTimezone: true }),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  ...timestamps,
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const testimonials = pgTable('testimonials', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerName: varchar('customer_name', { length: 100 }).notNull(),
  customerLocation: varchar('customer_location', { length: 100 }),
  avatarUrl: text('avatar_url'),
  rating: integer('rating').notNull(),
  contentId: text('content_id').notNull(),
  contentEn: text('content_en'),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// ─────────────────────────────────────────
// B2B TABLES
// ─────────────────────────────────────────

export const b2bProfiles = pgTable('b2b_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  companyName: varchar('company_name', { length: 255 }).notNull(),
  companyType: varchar('company_type', { length: 100 }),
  npwp: varchar('npwp', { length: 30 }),
  businessAddress: text('business_address'),
  picName: varchar('pic_name', { length: 255 }).notNull(),
  picPhone: varchar('pic_phone', { length: 20 }).notNull(),
  picEmail: varchar('pic_email', { length: 255 }).notNull(),
  monthlyVolumeEstimate: integer('monthly_volume_estimate'),
  isApproved: boolean('is_approved').notNull().default(false),
  isNet30Approved: boolean('is_net30_approved').notNull().default(false),
  assignedWaContact: varchar('assigned_wa_contact', { length: 20 }),
  notes: text('notes'),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  ...timestamps,
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const b2bInquiries = pgTable('b2b_inquiries', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyName: varchar('company_name', { length: 255 }).notNull(),
  picName: varchar('pic_name', { length: 255 }).notNull(),
  picEmail: varchar('pic_email', { length: 255 }).notNull(),
  picPhone: varchar('pic_phone', { length: 20 }).notNull(),
  companyType: varchar('company_type', { length: 100 }),
  message: text('message').notNull(),
  estimatedVolumeId: varchar('estimated_volume_id', { length: 100 }),
  status: b2bInquiryStatusEnum('status').notNull().default('new'),
  handledBy: uuid('handled_by').references(() => users.id),
  internalNotes: text('internal_notes'),
  ...timestamps,
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const b2bQuotes = pgTable('b2b_quotes', {
  id: uuid('id').primaryKey().defaultRandom(),
  quoteNumber: varchar('quote_number', { length: 30 }).notNull().unique(),
  b2bProfileId: uuid('b2b_profile_id').notNull().references(() => b2bProfiles.id),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  status: b2bQuoteStatusEnum('status').notNull().default('draft'),
  subtotal: integer('subtotal').notNull(),
  discountAmount: integer('discount_amount').notNull().default(0),
  totalAmount: integer('total_amount').notNull(),
  validUntil: timestamp('valid_until', { withTimezone: true }),
  paymentTerms: varchar('payment_terms', { length: 100 }),
  notesId: text('notes_id'),
  notesEn: text('notes_en'),
  pdfUrl: text('pdf_url'),
  ...timestamps,
});

export const b2bQuoteItems = pgTable('b2b_quote_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  quoteId: uuid('quote_id').notNull().references(() => b2bQuotes.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id').notNull().references(() => productVariants.id),
  productNameId: varchar('product_name_id', { length: 255 }).notNull(),
  variantNameId: varchar('variant_name_id', { length: 100 }).notNull(),
  sku: varchar('sku', { length: 100 }).notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: integer('unit_price').notNull(),
  subtotal: integer('subtotal').notNull(),
});

// ─────────────────────────────────────────
// SYSTEM TABLES
// ─────────────────────────────────────────

export const systemSettings = pgTable('system_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  value: text('value').notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  description: text('description'),
  updatedBy: uuid('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const orderDailyCounters = pgTable('order_daily_counters', {
  id: uuid('id').primaryKey().defaultRandom(),
  date: varchar('date', { length: 10 }).notNull().unique(),
  lastSequence: integer('last_sequence').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const adminActivityLogs = pgTable('admin_activity_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 100 }).notNull(),
  entityId: uuid('entity_id'),
  beforeState: jsonb('before_state'),
  afterState: jsonb('after_state'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────
// RELATIONS
// ─────────────────────────────────────────

export const usersRelations = relations(users, ({ many, one }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  addresses: many(addresses),
  savedCarts: many(savedCarts),
  orders: many(orders),
  pointsHistory: many(pointsHistory),
  couponUsages: many(couponUsages),
  b2bProfile: one(b2bProfiles),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  variants: many(productVariants),
  images: many(productImages),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, { fields: [productImages.productId], references: [products.id] }),
}));

export const productVariantsRelations = relations(productVariants, ({ one, many }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
  inventoryLogs: many(inventoryLogs),
  orderItems: many(orderItems),
  savedByUsers: many(savedCarts),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  items: many(orderItems),
  statusHistory: many(orderStatusHistory),
  coupon: one(coupons, { fields: [orders.couponId], references: [coupons.id] }),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  variant: one(productVariants, { fields: [orderItems.variantId], references: [productVariants.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));

export const couponsRelations = relations(coupons, ({ many }) => ({
  usages: many(couponUsages),
  orders: many(orders),
}));

export const pointsHistoryRelations = relations(pointsHistory, ({ one }) => ({
  user: one(users, { fields: [pointsHistory.userId], references: [users.id] }),
  order: one(orders, { fields: [pointsHistory.orderId], references: [orders.id] }),
}));

export const blogPostsRelations = relations(blogPosts, ({ one }) => ({
  category: one(blogCategories, { fields: [blogPosts.blogCategoryId], references: [blogCategories.id] }),
  author: one(users, { fields: [blogPosts.authorId], references: [users.id] }),
}));

export const b2bProfilesRelations = relations(b2bProfiles, ({ one, many }) => ({
  user: one(users, { fields: [b2bProfiles.userId], references: [users.id] }),
  quotes: many(b2bQuotes),
}));

export const b2bQuotesRelations = relations(b2bQuotes, ({ one, many }) => ({
  b2bProfile: one(b2bProfiles, { fields: [b2bQuotes.b2bProfileId], references: [b2bProfiles.id] }),
  items: many(b2bQuoteItems),
}));

// ─────────────────────────────────────────
// TYPE EXPORTS
// ─────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductVariant = typeof productVariants.$inferSelect;
export type NewProductVariant = typeof productVariants.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
export type Coupon = typeof coupons.$inferSelect;
export type NewCoupon = typeof coupons.$inferInsert;
export type PointsHistory = typeof pointsHistory.$inferSelect;
export type Address = typeof addresses.$inferSelect;
export type BlogPost = typeof blogPosts.$inferSelect;
export type CarouselSlide = typeof carouselSlides.$inferSelect;
export type B2bProfile = typeof b2bProfiles.$inferSelect;
export type SystemSetting = typeof systemSettings.$inferSelect;
export type OrderDailyCounter = typeof orderDailyCounters.$inferSelect;

// ─────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────

export const ordersUserIdIdx = index('idx_orders_user_id').on(orders.userId);
export const ordersStatusIdx = index('idx_orders_status').on(orders.status);
export const ordersPaymentExpiresAtIdx = index('idx_orders_payment_expires_at').on(orders.paymentExpiresAt);
export const ordersMidtransOrderIdIdx = index('idx_orders_midtrans_order_id').on(orders.midtransOrderId);
export const orderItemsOrderIdIdx = index('idx_order_items_order_id').on(orderItems.orderId);
export const productVariantsProductIdIdx = index('idx_product_variants_product_id').on(productVariants.productId);
export const pointsHistoryUserIdIdx = index('idx_points_history_user_id').on(pointsHistory.userId);
export const pointsHistoryOrderIdIdx = index('idx_points_history_order_id').on(pointsHistory.orderId);
export const pointsHistoryExpiresAtIdx = index('idx_points_history_expires_at').on(pointsHistory.expiresAt);
export const pointsHistoryTypeIdx = index('idx_points_history_type').on(pointsHistory.type);
export const pointsHistoryIsExpiredIdx = index('idx_points_history_is_expired').on(pointsHistory.isExpired);
export const couponUsagesCouponUserIdx = index('idx_coupon_usages_coupon_user').on(couponUsages.couponId, couponUsages.userId);
export const adminLogsUserIdIdx = index('idx_admin_logs_user_id').on(adminActivityLogs.userId);
export const adminLogsEntityIdx = index('idx_admin_logs_entity').on(adminActivityLogs.entityType, adminActivityLogs.entityId);
export const b2bInquiriesStatusIdx = index('idx_b2b_inquiries_status').on(b2bInquiries.status);
export const inventoryLogsVariantIdIdx = index('idx_inventory_logs_variant_id').on(inventoryLogs.variantId);
