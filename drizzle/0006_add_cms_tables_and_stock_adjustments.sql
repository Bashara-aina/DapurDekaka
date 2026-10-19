-- Migration: Add CMS tables, stock_adjustments, and B22B net30 fields
-- Issue: CMS tables + stock_adjustments declared in schema.ts but never in SQL migrations

-- ============================================================================
-- STOCK ADJUSTMENTS (manual inventory changes log)
-- ============================================================================
CREATE TABLE IF NOT EXISTS stock_adjustments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  previous_stock integer NOT NULL,
  delta integer NOT NULL,
  new_stock integer NOT NULL,
  reason varchar(255),
  changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stock_adjustments_variant_id ON stock_adjustments(variant_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_created_at ON stock_adjustments(created_at DESC);

-- ============================================================================
-- CMS GALLERY USAGE ENUM
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE cms_gallery_usage_enum AS ENUM ('instagram_feed', 'about_hero', 'og', 'general');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- CMS PAGES
-- ============================================================================
CREATE TABLE IF NOT EXISTS cms_pages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug varchar(100) NOT NULL UNIQUE,
  title varchar(255) NOT NULL,
  is_published boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT NOW() NOT NULL,
  updated_at timestamp with time zone DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cms_pages_slug ON cms_pages(slug);

-- ============================================================================
-- CMS PAGE SECTIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS cms_page_sections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id uuid NOT NULL REFERENCES cms_pages(id) ON DELETE CASCADE,
  section_key varchar(100) NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  title_id varchar(500),
  title_en varchar(500),
  body_id text,
  body_en text,
  cta_label_id varchar(255),
  cta_label_en varchar(255),
  cta_href varchar(500),
  image_public_id varchar(255),
  meta jsonb,
  created_at timestamp with time zone DEFAULT NOW() NOT NULL,
  updated_at timestamp with time zone DEFAULT NOW() NOT NULL,
  CONSTRAINT uq_cms_page_section UNIQUE (page_id, section_key)
);

CREATE INDEX IF NOT EXISTS idx_cms_page_sections_sort ON cms_page_sections(page_id, sort_order);

-- ============================================================================
-- CMS GALLERY IMAGES
-- ============================================================================
CREATE TABLE IF NOT EXISTS cms_gallery_images (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  public_id varchar(255) NOT NULL,
  alt_id varchar(255),
  alt_en varchar(255),
  sort_order integer DEFAULT 0 NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  usage cms_gallery_usage_enum DEFAULT 'general' NOT NULL,
  created_at timestamp with time zone DEFAULT NOW() NOT NULL,
  updated_at timestamp with time zone DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cms_gallery_usage_sort ON cms_gallery_images(usage, sort_order);
