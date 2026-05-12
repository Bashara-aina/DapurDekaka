````markdown
# SCHEMA.md — Database Schema
# DapurDekaka.com
**Version:** 1.0
**Last Updated:** May 2026
**Author:** Bashara (Technical Lead)
**Status:** Active — Pre-Development

---

## TABLE OF CONTENTS
1. Schema Overview & Design Principles
2. Auth & Users Tables
3. Product & Inventory Tables
4. Order & Transaction Tables
5. Promotions & Loyalty Tables
6. Content & CMS Tables
7. B2B Tables
8. System & Config Tables
9. Full Drizzle Schema Code
10. Seed Data Reference
11. Query Patterns Reference

---

## 1. SCHEMA OVERVIEW & DESIGN PRINCIPLES

### 1.1 Database: Neon PostgreSQL (Serverless)
- **Driver:** `@neondatabase/serverless` (HTTP, not WebSocket)
- **ORM:** Drizzle ORM with full TypeScript inference
- **Migrations:** Managed via `drizzle-kit`
- **Timezone:** All timestamps stored as UTC, displayed in WIB (UTC+7) on frontend

### 1.2 Design Principles
- **UUID primary keys** everywhere — no sequential integer IDs exposed in URLs
- **Soft deletes** on critical data (products, users, orders) — `deleted_at` timestamp
- **Audit trails** on sensitive mutations — `created_at`, `updated_at`, `created_by`
- **Bilingual fields** — all user-facing content has `_id` (Indonesian) and `_en` (English) variant columns
- **No nullable required fields** — prefer explicit defaults over NULL where possible
- **Enum types** defined in PostgreSQL via Drizzle `pgEnum` for type safety

### 1.3 Entity Relationship Overview

```
users ──────────────────────── sessions (NextAuth)
  │                              │
  ├── addresses                  │
  ├── orders ─────── order_items ─── product_variants
  │     └── order_status_history       │
  │                              product_variants ── products ── categories
  ├── points_history                     │
  │                              product_images
  ├── coupon_usages
  │
  └── b2b_profiles ── b2b_quotes ── b2b_quote_items

coupons ──── coupon_usages

blog_posts ──── blog_categories

carousel_slides

system_settings

admin_users (separate from customer users)
admin_activity_log
```

### 1.4 Naming Conventions
- Tables: `snake_case`, plural nouns (`orders`, `product_variants`)
- Columns: `snake_case`
- Foreign keys: `{referenced_table_singular}_id` (e.g., `product_id`, `user_id`)
- Timestamps: `created_at`, `updated_at`, `deleted_at`
- Booleans: `is_` prefix (`is_active`, `is_featured`, `is_halal`)
- Enums: `snake_case` values, descriptive (`pending_payment`, `paid`, `shipped`)

---

## 2. AUTH & USERS TABLES

### 2.1 Table: `users`
Core customer accounts — managed by NextAuth + Drizzle Adapter.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Primary key |
| `name` | `varchar(255)` | NOT NULL | Full name |
| `email` | `varchar(255)` | UNIQUE, NOT NULL | Email address |
| `email_verified` | `timestamptz` | NULLABLE | NextAuth email verification |
| `image` | `text` | NULLABLE | Profile picture URL (Google or Cloudinary) |
| `password_hash` | `text` | NULLABLE | bcrypt hash — NULL for Google OAuth users |
| `phone` | `varchar(20)` | NULLABLE | Indonesian phone format |
| `role` | `user_role_enum` | NOT NULL, default `customer` | customer, b2b, warehouse, owner, superadmin |
| `is_active` | `boolean` | NOT NULL, default `true` | Account active status |
| `points_balance` | `integer` | NOT NULL, default `0` | Current redeemable points |
| `language_preference` | `varchar(5)` | NOT NULL, default `id` | `id` or `en` |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Account creation |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | Last update |
| `deleted_at` | `timestamptz` | NULLABLE | Soft delete timestamp |

**Enums:**
```sql
CREATE TYPE user_role_enum AS ENUM (
  'customer',
  'b2b',
  'warehouse',
  'owner',
  'superadmin'
);
```

**Indexes:**
```sql
CREATE UNIQUE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_created_at ON users(created_at DESC);
```

---

### 2.2 Table: `accounts`
NextAuth OAuth account links (Google, etc.)

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Primary key |
| `user_id` | `uuid` | FK → users.id, NOT NULL | Owner |
| `type` | `varchar(255)` | NOT NULL | oauth, credentials, email |
| `provider` | `varchar(255)` | NOT NULL | google, credentials |
| `provider_account_id` | `varchar(255)` | NOT NULL | Provider's user ID |
| `refresh_token` | `text` | NULLABLE | OAuth refresh token |
| `access_token` | `text` | NULLABLE | OAuth access token |
| `expires_at` | `integer` | NULLABLE | Token expiry (Unix) |
| `token_type` | `varchar(255)` | NULLABLE | bearer |
| `scope` | `text` | NULLABLE | OAuth scopes |
| `id_token` | `text` | NULLABLE | OAuth ID token |
| `session_state` | `text` | NULLABLE | OAuth session state |

---

### 2.3 Table: `sessions`
NextAuth database sessions.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Primary key |
| `session_token` | `varchar(255)` | UNIQUE, NOT NULL | Session token |
| `user_id` | `uuid` | FK → users.id, NOT NULL | Session owner |
| `expires` | `timestamptz` | NOT NULL | Session expiry |

---

### 2.4 Table: `verification_tokens`
NextAuth email verification tokens.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `identifier` | `varchar(255)` | NOT NULL | Email address |
| `token` | `varchar(255)` | NOT NULL | Verification token |
| `expires` | `timestamptz` | NOT NULL | Token expiry |

**Composite PK:** `(identifier, token)`

---

### 2.5 Table: `addresses`
Customer delivery addresses (multiple per user).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Primary key |
| `user_id` | `uuid` | FK → users.id, NOT NULL | Address owner |
| `label` | `varchar(100)` | NULLABLE | "Rumah", "Kantor", etc. |
| `recipient_name` | `varchar(255)` | NOT NULL | Name of recipient |
| `recipient_phone` | `varchar(20)` | NOT NULL | Phone of recipient |
| `address_line` | `text` | NOT NULL | Street address, number, RT/RW |
| `district` | `varchar(255)` | NOT NULL | Kecamatan |
| `city` | `varchar(255)` | NOT NULL | Kota/Kabupaten |
| `city_id` | `varchar(10)` | NOT NULL | RajaOngkir city_id |
| `province` | `varchar(255)` | NOT NULL | Provinsi |
| `province_id` | `varchar(10)` | NOT NULL | RajaOngkir province_id |
| `postal_code` | `varchar(10)` | NOT NULL | Kode pos |
| `is_default` | `boolean` | NOT NULL, default `false` | Default address flag |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Created timestamp |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | Updated timestamp |

**Indexes:**
```sql
CREATE INDEX idx_addresses_user_id ON addresses(user_id);
```

**Business Rule:** Only one address per user can have `is_default = true`. Enforced in application layer.

---

### 2.6 Table: `password_reset_tokens`
Secure password reset flow.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Primary key |
| `user_id` | `uuid` | FK → users.id, NOT NULL | Token owner |
| `token_hash` | `varchar(255)` | UNIQUE, NOT NULL | SHA256 hash of token |
| `expires_at` | `timestamptz` | NOT NULL | Expiry (1 hour from creation) |
| `used_at` | `timestamptz` | NULLABLE | When token was consumed |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Created timestamp |

---

## 3. PRODUCT & INVENTORY TABLES

### 3.1 Table: `categories`
Product categories.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Primary key |
| `name_id` | `varchar(100)` | NOT NULL | Indonesian name |
| `name_en` | `varchar(100)` | NOT NULL | English name |
| `slug` | `varchar(100)` | UNIQUE, NOT NULL | URL-safe slug |
| `description_id` | `text` | NULLABLE | Indonesian description |
| `description_en` | `text` | NULLABLE | English description |
| `image_url` | `text` | NULLABLE | Cloudinary URL |
| `sort_order` | `integer` | NOT NULL, default `0` | Display order |
| `is_active` | `boolean` | NOT NULL, default `true` | Visibility flag |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Created timestamp |

**Seed categories:**
```
1. Dimsum       — dimsum
2. Siomay       — siomay
3. Bakso & Sosis — bakso-sosis
4. Snack Frozen — snack-frozen
5. Paket Hemat  — paket-hemat
```

---

### 3.2 Table: `products`
Master product records.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Primary key |
| `category_id` | `uuid` | FK → categories.id, NOT NULL | Product category |
| `name_id` | `varchar(255)` | NOT NULL | Indonesian name |
| `name_en` | `varchar(255)` | NOT NULL | English name |
| `slug` | `varchar(255)` | UNIQUE, NOT NULL | URL slug (auto-generated) |
| `description_id` | `text` | NULLABLE | Indonesian description (rich text) |
| `description_en` | `text` | NULLABLE | English description (rich text) |
| `short_description_id` | `varchar(500)` | NULLABLE | Short blurb (ID) for cards |
| `short_description_en` | `varchar(500)` | NULLABLE | Short blurb (EN) for cards |
| `weight_gram` | `integer` | NOT NULL | Base weight in grams (per unit) |
| `is_halal` | `boolean` | NOT NULL, default `true` | Halal certification |
| `is_active` | `boolean` | NOT NULL, default `true` | Visible in store |
| `is_featured` | `boolean` | NOT NULL, default `false` | Show in featured section |
| `is_b2b_available` | `boolean` | NOT NULL, default `true` | Visible in B2B catalog |
| `sort_order` | `integer` | NOT NULL, default `0` | Display order within category |
| `meta_title_id` | `varchar(255)` | NULLABLE | SEO meta title (ID) |
| `meta_title_en` | `varchar(255)` | NULLABLE | SEO meta title (EN) |
| `meta_description_id` | `varchar(500)` | NULLABLE | SEO meta description (ID) |
| `meta_description_en` | `varchar(500)` | NULLABLE | SEO meta description (EN) |
| `shopee_url` | `text` | NULLABLE | Reference Shopee listing URL |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Created timestamp |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | Updated timestamp |
| `deleted_at` | `timestamptz` | NULLABLE | Soft delete |

**Indexes:**
```sql
CREATE UNIQUE INDEX idx_products_slug ON products(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_is_active ON products(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_is_featured ON products(is_featured) WHERE is_active = true;
```

---

### 3.3 Table: `product_variants`
Each product has 1–N variants (e.g., 25pcs, 50pcs).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Primary key |
| `product_id` | `uuid` | FK → products.id, NOT NULL | Parent product |
| `name_id` | `varchar(100)` | NOT NULL | Variant name in Indonesian (e.g., "25 pcs") |
| `name_en` | `varchar(100)` | NOT NULL | Variant name in English |
| `sku` | `varchar(100)` | UNIQUE, NOT NULL | Stock Keeping Unit |
| `price` | `integer` | NOT NULL | Price in IDR (integer, no decimals) |
| `b2b_price` | `integer` | NULLABLE | B2B bulk price in IDR |
| `stock` | `integer` | NOT NULL, default `0` | Current stock count |
| `weight_gram` | `integer` | NOT NULL | Weight for this variant (may differ from base) |
| `sort_order` | `integer` | NOT NULL, default `0` | Display order within product |
| `is_active` | `boolean` | NOT NULL, default `true` | Variant available for purchase |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Created timestamp |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | Updated timestamp |

**Indexes:**
```sql
CREATE UNIQUE INDEX idx_variants_sku ON product_variants(sku);
CREATE INDEX idx_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_variants_stock ON product_variants(stock);
```

**Business Rules:**
- `stock` minimum enforced at application layer: never allow `stock < 0`
- `price` must be > 0 (validated in admin form)
- `sku` format convention: `DDK-{category_code}-{product_number}-{variant_code}` (e.g., `DDK-DIM-001-25`)

---

### 3.4 Table: `product_images`
Multiple images per product, ordered.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Primary key |
| `product_id` | `uuid` | FK → products.id, NOT NULL | Parent product |
| `cloudinary_url` | `text` | NOT NULL | Full Cloudinary URL |
| `cloudinary_public_id` | `varchar(255)` | NOT NULL | Cloudinary public_id (for deletion) |
| `alt_text_id` | `varchar(255)` | NULLABLE | Indonesian alt text for accessibility |
| `alt_text_en` | `varchar(255)` | NULLABLE | English alt text |
| `sort_order` | `integer` | NOT NULL, default `0` | 0 = primary/thumbnail image |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Upload timestamp |

**Indexes:**
```sql
CREATE INDEX idx_product_images_product_id ON product_images(product_id);
```

**Business Rule:** Image with `sort_order = 0` is used as thumbnail on product cards.

---

### 3.5 Table: `inventory_logs`
Audit trail for all stock changes.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Primary key |
| `variant_id` | `uuid` | FK → product_variants.id, NOT NULL | Affected variant |
| `changed_by_user_id` | `uuid` | FK → users.id, NULLABLE | Admin who made change |
| `change_type` | `inventory_change_enum` | NOT NULL | manual, sale, restock, adjustment |
| `quantity_before` | `integer` | NOT NULL | Stock before change |
| `quantity_after` | `integer` | NOT NULL | Stock after change |
| `quantity_delta` | `integer` | NOT NULL | Difference (positive or negative) |
| `order_id` | `uuid` | FK → orders.id, NULLABLE | Related order (if sale) |
| `note` | `text` | NULLABLE | Optional note from admin |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Change timestamp |

**Enums:**
```sql
CREATE TYPE inventory_change_enum AS ENUM (
  'manual',     -- warehouse staff manual update
  'sale',       -- deducted after successful payment
  'restock',    -- new stock added
  'adjustment', -- admin correction
  'reversal'    -- reversed after order cancellation (if applicable)
);
```

---

## 4. ORDER & TRANSACTION TABLES

### 4.1 Table: `orders`
Master order records.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Internal primary key |
| `order_number` | `varchar(20)` | UNIQUE, NOT NULL | Human-readable: DDK-YYYYMMDD-XXXX |
| `user_id` | `uuid` | FK → users.id, NULLABLE | NULL for guest orders |
| `status` | `order_status_enum` | NOT NULL, default `pending_payment` | Current order status |
| `delivery_method` | `delivery_method_enum` | NOT NULL | delivery, pickup |
| `recipient_name` | `varchar(255)` | NOT NULL | Name on order |
| `recipient_email` | `varchar(255)` | NOT NULL | Email for notifications |
| `recipient_phone` | `varchar(20)` | NOT NULL | Phone for delivery |
| `address_line` | `text` | NULLABLE | Full address (NULL for pickup) |
| `district` | `varchar(255)` | NULLABLE | Kecamatan |
| `city` | `varchar(255)` | NULLABLE | Kota |
| `city_id` | `varchar(10)` | NULLABLE | RajaOngkir city_id |
| `province` | `varchar(255)` | NULLABLE | Provinsi |
| `province_id` | `varchar(10)` | NULLABLE | RajaOngkir province_id |
| `postal_code` | `varchar(10)` | NULLABLE | Postal code |
| `courier_code` | `varchar(50)` | NULLABLE | sicepat, jne, anteraja |
| `courier_service` | `varchar(50)` | NULLABLE | FROZEN, YES |
| `courier_name` | `varchar(100)` | NULLABLE | Display name: "SiCepat FROZEN" |
| `shipping_cost` | `integer` | NOT NULL, default `0` | Shipping cost in IDR |
| `estimated_days` | `varchar(50)` | NULLABLE | "1-2 hari" |
| `subtotal` | `integer` | NOT NULL | Sum of item prices × qty |
| `discount_amount` | `integer` | NOT NULL, default `0` | Total coupon discount applied |
| `points_discount` | `integer` | NOT NULL, default `0` | Points redeemed as discount |
| `total_amount` | `integer` | NOT NULL | Final amount: subtotal - discount - points + shipping |
| `coupon_id` | `uuid` | FK → coupons.id, NULLABLE | Applied coupon |
| `coupon_code` | `varchar(50)` | NULLABLE | Snapshot of coupon code used |
| `points_used` | `integer` | NOT NULL, default `0` | Points used for this order |
| `points_earned` | `integer` | NOT NULL, default `0` | Points earned from this order |
| `customer_note` | `text` | NULLABLE | Order notes from customer |
| `midtrans_order_id` | `varchar(100)` | NULLABLE | Midtrans order_id (may differ on retry) |
| `midtrans_transaction_id` | `varchar(255)` | NULLABLE | Midtrans transaction_id |
| `midtrans_payment_type` | `varchar(100)` | NULLABLE | bank_transfer, gopay, qris, etc. |
| `midtrans_va_number` | `varchar(100)` | NULLABLE | Virtual account number (if applicable) |
| `midtrans_snap_token` | `text` | NULLABLE | Snap token (cleared after use) |
| `payment_expires_at` | `timestamptz` | NULLABLE | Payment expiry (15 min from creation) |
| `payment_retry_count` | `integer` | NOT NULL, default `0` | Number of payment retries |
| `tracking_number` | `varchar(255)` | NULLABLE | Courier tracking number |
| `tracking_url` | `text` | NULLABLE | Deep-link to courier tracking |
| `pickup_code` | `varchar(20)` | NULLABLE | Same as order_number for pickup |
| `is_b2b` | `boolean` | NOT NULL, default `false` | B2B order flag |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Order creation time |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | Last status update |
| `paid_at` | `timestamptz` | NULLABLE | When payment confirmed |
| `shipped_at` | `timestamptz` | NULLABLE | When tracking number added |
| `delivered_at` | `timestamptz` | NULLABLE | When marked delivered |
| `cancelled_at` | `timestamptz` | NULLABLE | When cancelled |

**Enums:**
```sql
CREATE TYPE order_status_enum AS ENUM (
  'pending_payment',
  'paid',
  'processing',
  'packed',
  'shipped',
  'delivered',
  'cancelled',
  'refunded'
);

CREATE TYPE delivery_method_enum AS ENUM (
  'delivery',
  'pickup'
);
```

**Indexes:**
```sql
CREATE UNIQUE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_recipient_email ON orders(recipient_email);
CREATE INDEX idx_orders_midtrans_order_id ON orders(midtrans_order_id);
```

---

### 4.2 Table: `order_items`
Individual line items within an order — snapshot at time of purchase.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Primary key |
| `order_id` | `uuid` | FK → orders.id, NOT NULL | Parent order |
| `variant_id` | `uuid` | FK → product_variants.id, NOT NULL | Ordered variant |
| `product_id` | `uuid` | FK → products.id, NOT NULL | Parent product (denormalized) |
| `product_name_id` | `varchar(255)` | NOT NULL | **Snapshot** of product name (ID) at purchase |
| `product_name_en` | `varchar(255)` | NOT NULL | **Snapshot** of product name (EN) at purchase |
| `variant_name_id` | `varchar(100)` | NOT NULL | **Snapshot** of variant name (ID) |
| `variant_name_en` | `varchar(100)` | NOT NULL | **Snapshot** of variant name (EN) |
| `sku` | `varchar(100)` | NOT NULL | **Snapshot** of SKU at purchase |
| `product_image_url` | `text` | NULLABLE | **Snapshot** of primary image URL |
| `unit_price` | `integer` | NOT NULL | **Snapshot** of price at purchase (IDR) |
| `quantity` | `integer` | NOT NULL | Quantity ordered |
| `subtotal` | `integer` | NOT NULL | `unit_price × quantity` |
| `weight_gram` | `integer` | NOT NULL | **Snapshot** of variant weight |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Created timestamp |

**Indexes:**
```sql
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_variant_id ON order_items(variant_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
```

**Critical Design Note:** All `product_name_*`, `variant_name_*`, `unit_price`, `sku`, `weight_gram` are **snapshots** — copied at order creation. This ensures order history remains accurate even if products are later edited or deleted.

---

### 4.3 Table: `order_status_history`
Full audit trail of every order status change.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Primary key |
| `order_id` | `uuid` | FK → orders.id, NOT NULL | Parent order |
| `from_status` | `order_status_enum` | NULLABLE | Previous status (NULL for first entry) |
| `to_status` | `order_status_enum` | NOT NULL | New status |
| `changed_by_user_id` | `uuid` | FK → users.id, NULLABLE | Admin who changed (NULL = system/webhook) |
| `changed_by_type` | `varchar(50)` | NOT NULL, default `system` | system, admin, warehouse, customer |
| `note` | `text` | NULLABLE | Admin note about status change |
| `metadata` | `jsonb` | NULLABLE | Extra data (e.g., Midtrans response snapshot) |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Change timestamp |

**Indexes:**
```sql
CREATE INDEX idx_status_history_order_id ON order_status_history(order_id);
CREATE INDEX idx_status_history_created_at ON order_status_history(created_at DESC);
```

---

## 5. PROMOTIONS & LOYALTY TABLES

### 5.1 Table: `coupons`
All coupon/promo code configurations.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Primary key |
| `code` | `varchar(50)` | UNIQUE, NOT NULL | Coupon code (stored uppercase) |
| `type` | `coupon_type_enum` | NOT NULL | percentage, fixed, free_shipping, buy_x_get_y |
| `name_id` | `varchar(255)` | NOT NULL | Internal name / display name (ID) |
| `name_en` | `varchar(255)` | NOT NULL | Internal name (EN) |
| `description_id` | `text` | NULLABLE | Customer-facing description (ID) |
| `description_en` | `text` | NULLABLE | Customer-facing description (EN) |
| `discount_value` | `integer` | NULLABLE | Percentage (1-100) or fixed IDR amount |
| `min_order_amount` | `integer` | NOT NULL, default `0` | Minimum subtotal to apply coupon |
| `max_discount_amount` | `integer` | NULLABLE | Cap for percentage discounts (IDR) |
| `free_shipping` | `boolean` | NOT NULL, default `false` | Waive shipping cost entirely |
| `buy_quantity` | `integer` | NULLABLE | Buy X qty (for buy_x_get_y type) |
| `get_quantity` | `integer` | NULLABLE | Get Y qty free (for buy_x_get_y type) |
| `max_uses` | `integer` | NULLABLE | Maximum total uses (NULL = unlimited) |
| `used_count` | `integer` | NOT NULL, default `0` | Current usage count |
| `max_uses_per_user` | `integer` | NULLABLE | Maximum uses per user (NULL = unlimited) |
| `applicable_product_ids` | `uuid[]` | NULLABLE | If set, coupon only applies to these products |
| `applicable_category_ids` | `uuid[]` | NULLABLE | If set, coupon only applies to these categories |
| `is_active` | `boolean` | NOT NULL, default `true` | Manual on/off toggle |
| `is_public` | `boolean` | NOT NULL, default `false` | Show in public coupons page |
| `starts_at` | `timestamptz` | NULLABLE | Valid from (NULL = immediately) |
| `expires_at` | `timestamptz` | NULLABLE | Valid until (NULL = no expiry) |
| `created_by` | `uuid` | FK → users.id, NOT NULL | Admin who created |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Created timestamp |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | Updated timestamp |

**Enums:**
```sql
CREATE TYPE coupon_type_enum AS ENUM (
  'percentage',
  'fixed',
  'free_shipping',
  'buy_x_get_y'
);
```

**Indexes:**
```sql
CREATE UNIQUE INDEX idx_coupons_code ON coupons(UPPER(code)) WHERE is_active = true;
CREATE INDEX idx_coupons_expires_at ON coupons(expires_at);
CREATE INDEX idx_coupons_is_active ON coupons(is_active);
```

---

### 5.2 Table: `coupon_usages`
Track which user used which coupon on which order.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Primary key |
| `coupon_id` | `uuid` | FK → coupons.id, NOT NULL | Coupon used |
| `order_id` | `uuid` | FK → orders.id, NOT NULL | Order where used |
| `user_id` | `uuid` | FK → users.id, NULLABLE | User who used (NULL = guest) |
| `discount_applied` | `integer` | NOT NULL | Actual discount amount applied (IDR) |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Usage timestamp |

**Indexes:**
```sql
CREATE INDEX idx_coupon_usages_coupon_id ON coupon_usages(coupon_id);
CREATE INDEX idx_coupon_usages_user_id ON coupon_usages(user_id);
CREATE INDEX idx_coupon_usages_order_id ON coupon_usages(order_id);
```

---

### 5.3 Table: `points_history`
Complete ledger of all loyalty point transactions.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Primary key |
| `user_id` | `uuid` | FK → users.id, NOT NULL | Points owner |
| `type` | `points_type_enum` | NOT NULL | earn, redeem, expire, adjust |
| `points_amount` | `integer` | NOT NULL | Points (positive for earn, negative for redeem/expire) |
| `points_balance_after` | `integer` | NOT NULL | Running balance snapshot after this transaction |
| `order_id` | `uuid` | FK → orders.id, NULLABLE | Related order |
| `description_id` | `varchar(255)` | NOT NULL | Transaction description (ID) |
| `description_en` | `varchar(255)` | NOT NULL | Transaction description (EN) |
| `expires_at` | `timestamptz` | NULLABLE | When these earned points expire (1 year from earn date) |
| `is_expired` | `boolean` | NOT NULL, default `false` | Whether these points have expired |
| `adjusted_by` | `uuid` | FK → users.id, NULLABLE | Admin who made manual adjustment |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Transaction timestamp |

**Enums:**
```sql
CREATE TYPE points_type_enum AS ENUM (
  'earn',    -- points earned from purchase
  'redeem',  -- points used as discount
  'expire',  -- points expired
  'adjust'   -- manual admin adjustment
);
```

**Indexes:**
```sql
CREATE INDEX idx_points_user_id ON points_history(user_id);
CREATE INDEX idx_points_order_id ON points_history(order_id);
CREATE INDEX idx_points_expires_at ON points_history(expires_at) WHERE is_expired = false;
CREATE INDEX idx_points_type ON points_history(type);
```

**Business Rules:**
- FIFO redemption: oldest non-expired points used first
- Each `earn` record carries its own `expires_at` (1 year from `created_at`)
- When points expire: create an `expire` record with negative `points_amount`
- `users.points_balance` is the running total — must stay in sync with sum of `points_history`

---

## 6. CONTENT & CMS TABLES

### 6.1 Table: `blog_categories`
Blog post categories.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Primary key |
| `name_id` | `varchar(100)` | NOT NULL | Category name (ID) |
| `name_en` | `varchar(100)` | NOT NULL | Category name (EN) |
| `slug` | `varchar(100)` | UNIQUE, NOT NULL | URL slug |
| `sort_order` | `integer` | NOT NULL, default `0` | Display order |

---

### 6.2 Table: `blog_posts`
SEO-driven blog content.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Primary key |
| `blog_category_id` | `uuid` | FK → blog_categories.id, NULLABLE | Post category |
| `title_id` | `varchar(255)` | NOT NULL | Post title (ID) |
| `title_en` | `varchar(255)` | NOT NULL | Post title (EN) |
| `slug` | `varchar(255)` | UNIQUE, NOT NULL | URL slug |
| `excerpt_id` | `text` | NULLABLE | Short excerpt (ID), shown in listing |
| `excerpt_en` | `text` | NULLABLE | Short excerpt (EN) |
| `content_id` | `text` | NOT NULL | Full rich text content (HTML/Tiptap JSON) (ID) |
| `content_en` | `text` | NOT NULL | Full rich text content (EN) |
| `cover_image_url` | `text` | NULLABLE | Cloudinary cover image |
| `cover_image_public_id` | `varchar(255)` | NULLABLE | Cloudinary public_id |
| `meta_title_id` | `varchar(255)` | NULLABLE | SEO meta title (ID) |
| `meta_title_en` | `varchar(255)` | NULLABLE | SEO meta title (EN) |
| `meta_description_id` | `varchar(500)` | NULLABLE | SEO meta description (ID) |
| `meta_description_en` | `varchar(500)` | NULLABLE | SEO meta description (EN) |
| `is_published` | `boolean` | NOT NULL, default `false` | Published/draft toggle |
| `is_ai_assisted` | `boolean` | NOT NULL, default `false` | Flag if AI-assisted content |
| `author_id` | `uuid` | FK → users.id, NOT NULL | Author (admin user) |
| `published_at` | `timestamptz` | NULLABLE | Publication timestamp |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Created timestamp |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | Updated timestamp |

**Indexes:**
```sql
CREATE UNIQUE INDEX idx_blog_slug ON blog_posts(slug) WHERE is_published = true;
CREATE INDEX idx_blog_published ON blog_posts(is_published, published_at DESC);
CREATE INDEX idx_blog_category ON blog_posts(blog_category_id);
```

---

### 6.3 Table: `carousel_slides`
Homepage hero carousel management.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Primary key |
| `type` | `carousel_type_enum` | NOT NULL | product_hero, promo, brand_story |
| `title_id` | `varchar(255)` | NOT NULL | Slide headline (ID) |
| `title_en` | `varchar(255)` | NOT NULL | Slide headline (EN) |
| `subtitle_id` | `varchar(500)` | NULLABLE | Slide subtext (ID) |
| `subtitle_en` | `varchar(500)` | NULLABLE | Slide subtext (EN) |
| `image_url` | `text` | NOT NULL | Cloudinary background image |
| `image_public_id` | `varchar(255)` | NOT NULL | Cloudinary public_id |
| `cta_label_id` | `varchar(100)` | NULLABLE | CTA button text (ID) |
| `cta_label_en` | `varchar(100)` | NULLABLE | CTA button text (EN) |
| `cta_url` | `varchar(500)` | NULLABLE | CTA link destination |
| `badge_text` | `varchar(100)` | NULLABLE | Optional badge/pill text (e.g. coupon code) |
| `sort_order` | `integer` | NOT NULL, default `0` | Display order |
| `is_active` | `boolean` | NOT NULL, default `true` | Visibility toggle |
| `starts_at` | `timestamptz` | NULLABLE | Schedule: show from |
| `ends_at` | `timestamptz` | NULLABLE | Schedule: show until |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Created timestamp |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | Updated timestamp |

**Enums:**
```sql
CREATE TYPE carousel_type_enum AS ENUM (
  'product_hero',
  'promo',
  'brand_story'
);
```

---

### 6.4 Table: `testimonials`
Static customer testimonials (V1: manually curated).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Primary key |
| `customer_name` | `varchar(100)` | NOT NULL | Display name |
| `customer_location` | `varchar(100)` | NULLABLE | City (e.g., "Bandung") |
| `avatar_url` | `text` | NULLABLE | Profile photo URL |
| `rating` | `integer` | NOT NULL | 1–5 stars |
| `content_id` | `text` | NOT NULL | Testimonial text (ID) |
| `content_en` | `text` | NULLABLE | Testimonial text (EN) |
| `is_active` | `boolean` | NOT NULL, default `true` | Visibility toggle |
| `sort_order` | `integer` | NOT NULL, default `0` | Display order |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Created timestamp |

---

## 7. B2B TABLES

### 7.1 Table: `b2b_profiles`
Extended profile for B2B customer accounts.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Primary key |
| `user_id` | `uuid` | FK → users.id, UNIQUE, NOT NULL | Linked customer account |
| `company_name` | `varchar(255)` | NOT NULL | Business/company name |
| `company_type` | `varchar(100)` | NULLABLE | Hotel, Restoran, Catering, Event Organizer, etc. |
| `npwp` | `varchar(30)` | NULLABLE | Tax ID (NPWP) |
| `business_address` | `text` | NULLABLE | Business address |
| `pic_name` | `varchar(255)` | NOT NULL | Person in charge name |
| `pic_phone` | `varchar(20)` | NOT NULL | PIC phone (WhatsApp preferred) |
| `pic_email` | `varchar(255)` | NOT NULL | PIC email |
| `monthly_volume_estimate` | `integer` | NULLABLE | Estimated monthly order volume (IDR) |
| `is_approved` | `boolean` | NOT NULL, default `false` | Superadmin approval required |
| `is_net30_approved` | `boolean` | NOT NULL, default `false` | Net-30 payment terms approved |
| `assigned_wa_contact` | `varchar(20)` | NULLABLE | Dedicated WA contact number |
| `notes` | `text` | NULLABLE | Internal notes from superadmin |
| `approved_by` | `uuid` | FK → users.id, NULLABLE | Superadmin who approved |
| `approved_at` | `timestamptz` | NULLABLE | Approval timestamp |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Created timestamp |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | Updated timestamp |

---

### 7.2 Table: `b2b_inquiries`
B2B inquiry form submissions (pre-account).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Primary key |
| `company_name` | `varchar(255)` | NOT NULL | Company name |
| `pic_name` | `varchar(255)` | NOT NULL | Contact person name |
| `pic_email` | `varchar(255)` | NOT NULL | Contact email |
| `pic_phone` | `varchar(20)` | NOT NULL | WhatsApp number |
| `company_type` | `varchar(100)` | NULLABLE | Type of business |
| `message` | `text` | NOT NULL | Inquiry message |
| `estimated_volume_id` | `varchar(100)` | NULLABLE | Estimated monthly volume (dropdown selection) |
| `status` | `b2b_inquiry_status_enum` | NOT NULL, default `new` | new, contacted, converted, rejected |
| `handled_by` | `uuid` | FK → users.id, NULLABLE | Admin handling inquiry |
| `internal_notes` | `text` | NULLABLE | Admin internal notes |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Submission timestamp |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | Updated timestamp |

**Enums:**
```sql
CREATE TYPE b2b_inquiry_status_enum AS ENUM (
  'new',
  'contacted',
  'converted',
  'rejected'
);
```

---

### 7.3 Table: `b2b_quotes`
Custom B2B quote/proposal records.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Primary key |
| `quote_number` | `varchar(30)` | UNIQUE, NOT NULL | Format: DDK-B2B-YYYYMMDD-XXXX |
| `b2b_profile_id` | `uuid` | FK → b2b_profiles.id, NOT NULL | B2B customer |
| `created_by` | `uuid` | FK → users.id, NOT NULL | Admin who created quote |
| `status` | `b2b_quote_status_enum` | NOT NULL, default `draft` | draft, sent, accepted, rejected, expired |
| `subtotal` | `integer` | NOT NULL | Subtotal IDR |
| `discount_amount` | `integer` | NOT NULL, default `0` | Special discount amount |
| `total_amount` | `integer` | NOT NULL | Final total IDR |
| `valid_until` | `timestamptz` | NULLABLE | Quote expiry date |
| `payment_terms` | `varchar(100)` | NULLABLE | "Net-30", "50% DP", "Full payment" |
| `notes_id` | `text` | NULLABLE | Notes on quote (ID) |
| `notes_en` | `text` | NULLABLE | Notes on quote (EN) |
| `pdf_url` | `text` | NULLABLE | Generated PDF URL |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Created timestamp |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | Updated timestamp |

**Enums:**
```sql
CREATE TYPE b2b_quote_status_enum AS ENUM (
  'draft',
  'sent',
  'accepted',
  'rejected',
  'expired'
);
```

---

### 7.4 Table: `b2b_quote_items`
Line items within a B2B quote.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Primary key |
| `quote_id` | `uuid` | FK → b2b_quotes.id, NOT NULL | Parent quote |
| `variant_id` | `uuid` | FK → product_variants.id, NOT NULL | Product variant |
| `product_name_id` | `varchar(255)` | NOT NULL | Snapshot product name (ID) |
| `variant_name_id` | `varchar(100)` | NOT NULL | Snapshot variant name (ID) |
| `sku` | `varchar(100)` | NOT NULL | Snapshot SKU |
| `quantity` | `integer` | NOT NULL | Quoted quantity |
| `unit_price` | `integer` | NOT NULL | Negotiated B2B unit price |
| `subtotal` | `integer` | NOT NULL | `unit_price × quantity` |

---

## 8. SYSTEM & CONFIG TABLES

### 8.1 Table: `system_settings`
Key-value store for admin-configurable settings.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Primary key |
| `key` | `varchar(100)` | UNIQUE, NOT NULL | Setting key |
| `value` | `text` | NOT NULL | Setting value (JSON string for complex values) |
| `type` | `varchar(50)` | NOT NULL | string, integer, boolean, json |
| `description` | `text` | NULLABLE | Admin-readable description |
| `updated_by` | `uuid` | FK → users.id, NULLABLE | Last admin to update |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | Last update timestamp |

**Default System Settings Seed:**
```json
[
  { "key": "store_whatsapp_number",     "value": "6281234567890",          "type": "string" },
  { "key": "store_opening_hours",       "value": "09:00 - 17:00 WIB",     "type": "string" },
  { "key": "store_open_days",           "value": "Senin - Sabtu",          "type": "string" },
  { "key": "points_earn_rate",          "value": "1",                      "type": "integer" },
  { "key": "points_per_idr",            "value": "1000",                   "type": "integer" },
  { "key": "points_expiry_days",        "value": "365",                    "type": "integer" },
  { "key": "points_min_redeem",         "value": "100",                    "type": "integer" },
  { "key": "points_max_redeem_pct",     "value": "50",                     "type": "integer" },
  { "key": "payment_expiry_minutes",    "value": "15",                     "type": "integer" },
  { "key": "payment_max_retries",       "value": "3",                      "type": "integer" },
  { "key": "rajaongkir_origin_city_id", "value": "23",                     "type": "string"  },
  { "key": "min_order_weight_gram",     "value": "1000",                   "type": "integer" },
  { "key": "b2b_points_multiplier",     "value": "2",                      "type": "integer" },
  { "key": "maintenance_mode",          "value": "false",                  "type": "boolean" },
  { "key": "instagram_handle",          "value": "@dapurdekaka",           "type": "string"  }
]
```

---

### 8.2 Table: `admin_activity_logs`
Audit trail for all admin mutations.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Primary key |
| `user_id` | `uuid` | FK → users.id, NOT NULL | Admin who performed action |
| `action` | `varchar(100)` | NOT NULL | e.g., `order.status_updated`, `product.created` |
| `entity_type` | `varchar(100)` | NOT NULL | order, product, coupon, user, etc. |
| `entity_id` | `uuid` | NULLABLE | ID of affected entity |
| `before_state` | `jsonb` | NULLABLE | Snapshot before change |
| `after_state` | `jsonb` | NULLABLE | Snapshot after change |
| `ip_address` | `varchar(45)` | NULLABLE | Admin's IP address |
| `user_agent` | `text` | NULLABLE | Browser user agent |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Action timestamp |

**Indexes:**
```sql
CREATE INDEX idx_activity_logs_user_id ON admin_activity_logs(user_id);
CREATE INDEX idx_activity_logs_entity ON admin_activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_created_at ON admin_activity_logs(created_at DESC);
```

---

## 9. FULL DRIZZLE SCHEMA CODE

```typescript
// lib/db/schema.ts
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
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

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
  weightGram: integer('weight_gram').notNull(),
  isHalal: boolean('is_halal').notNull().default(true),
  isActive: boolean('is_active').notNull().default(true),
  isFeatured: boolean('is_featured').notNull().default(false),
  isB2bAvailable: boolean('is_b2b_available').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  metaTitleId: varchar('meta_title_id', { length: 255 }),
  metaTitleEn: varchar('meta_title_en', { length: 255 }),
  metaDescriptionId: varchar('meta_description_id', { length: 500 }),
  metaDescriptionEn: varchar('meta_description_en', { length: 500 }),
  shopeeUrl: text('shopee_url'),
  ...timestamps,
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
});

export const couponUsages = pgTable('coupon_usages', {
  id: uuid('id').primaryKey().defaultRandom(),
  couponId: uuid('coupon_id').notNull().references(() => coupons.id),
  orderId: uuid('order_id').notNull().references(() => orders.id),
  userId: uuid('user_id').references(() => users.id),
  discountApplied: integer('discount_applied').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

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

export const productVariantsRelations = relations(productVariants, ({ one, many }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
  inventoryLogs: many(inventoryLogs),
  orderItems: many(orderItems),
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
```

---

## 10. SEED DATA REFERENCE

```typescript
// scripts/seed.ts — run with: npm run db:seed

// 1. Categories (5)
const SEED_CATEGORIES = [
  { nameId: 'Dimsum',        nameEn: 'Dimsum',          slug: 'dimsum',       sortOrder: 1 },
  { nameId: 'Siomay',        nameEn: 'Siomay',          slug: 'siomay',       sortOrder: 2 },
  { nameId: 'Bakso & Sosis', nameEn: 'Meatballs & Sausage', slug: 'bakso-sosis', sortOrder: 3 },
  { nameId: 'Snack Frozen',  nameEn: 'Frozen Snacks',   slug: 'snack-frozen', sortOrder: 4 },
  { nameId: 'Paket Hemat',   nameEn: 'Bundle Deals',    slug: 'paket-hemat',  sortOrder: 5 },
];

// 2. Superadmin user
const SEED_ADMIN = {
  name: 'Bashara',
  email: process.env.SEED_ADMIN_EMAIL,
  passwordHash: await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD, 12),
  role: 'superadmin',
};

// 3. System settings (see Section 8.1 above)

// 4. Sample coupons
const SEED_COUPONS = [
  {
    code: 'SELAMATDATANG',
    type: 'percentage',
    nameId: 'Selamat Datang',
    discountValue: 10,
    minOrderAmount: 50000,
    maxUses: 1000,
    isPublic: true,
  },
  {
    code: 'GRATISONGKIR',
    type: 'free_shipping',
    nameId: 'Gratis Ongkir',
    minOrderAmount: 150000,
    maxUses: 500,
    isPublic: true,
  },
];

// 5. Products (19 SKUs from Shopee — prices set 15-20% below Shopee reference)
// Scraped from: https://shopee.co.id/dapurdekaka
// To be populated with actual scraped data
```

---

## 11. QUERY PATTERNS REFERENCE

```typescript
// lib/db/queries/orders.ts

// Get order by order number (public tracking)
export async function getOrderByNumber(orderNumber: string) {
  return await db.query.orders.findFirst({
    where: eq(orders.orderNumber, orderNumber),
    with: {
      items: true,
      statusHistory: {
        orderBy: [asc(orderStatusHistory.createdAt)],
      },
    },
  });
}

// Get user orders with pagination
export async function getUserOrders(userId: string, page = 1, perPage = 10) {
  return await db.query.orders.findMany({
    where: and(
      eq(orders.userId, userId),
      isNull(orders.cancelledAt)
    ),
    with: { items: true },
    orderBy: [desc(orders.createdAt)],
    limit: perPage,
    offset: (page - 1) * perPage,
  });
}

// Admin: get all orders with filters
export async function getAdminOrders(filters: {
  status?: string;
  search?: string;
  page?: number;
}) {
  const conditions = [];
  if (filters.status) conditions.push(eq(orders.status, filters.status as any));
  if (filters.search) conditions.push(
    or(
      ilike(orders.orderNumber, `%${filters.search}%`),
      ilike(orders.recipientEmail, `%${filters.search}%`),
      ilike(orders.recipientName, `%${filters.search}%`),
    )
  );
  return await db.query.orders.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    with: { items: true },
    orderBy: [desc(orders.createdAt)],
    limit: 20,
    offset: ((filters.page ?? 1) - 1) * 20,
  });
}

// Validate coupon
export async function validateCoupon(code: string, subtotal: number, userId?: string) {
  const coupon = await db.query.coupons.findFirst({
    where: and(
      eq(coupons.code, code.toUpperCase()),
      eq(coupons.isActive, true),
      or(isNull(coupons.expiresAt), gt(coupons.expiresAt, new Date())),
      or(isNull(coupons.startsAt), lte(coupons.startsAt, new Date())),
    ),
  });
  if (!coupon) return { valid: false, error: 'Kupon tidak ditemukan atau sudah tidak berlaku' };
  if (coupon.maxUses && coupon.usedCount >= coupon.maxUses)
    return { valid: false, error: 'Kupon sudah mencapai batas penggunaan' };
  if (subtotal < coupon.minOrderAmount)
    return { valid: false, error: `Minimal pembelian Rp ${formatIDR(coupon.minOrderAmount)}` };
  return { valid: true, coupon };
}

// Get expiring points (for cron job / email reminder)
export async function getExpiringPoints(daysAhead: number) {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + daysAhead);
  return await db.query.pointsHistory.findMany({
    where: and(
      eq(pointsHistory.type, 'earn'),
      eq(pointsHistory.isExpired, false),
      lte(pointsHistory.expiresAt, targetDate),
      gt(pointsHistory.expiresAt, new Date()),
    ),
    with: { user: true },
  });
}
```

---

*End of SCHEMA.md v1.0*
*Next document: CURSOR_RULES.md*
````