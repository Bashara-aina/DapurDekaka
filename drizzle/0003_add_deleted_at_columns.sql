-- Add missing deleted_at columns (only for tables that were missing them)
-- carousel_slides and product_images were missing deleted_at in the initial migration
ALTER TABLE "carousel_slides" ADD COLUMN "deleted_at" timestamp with time zone;
ALTER TABLE "product_images" ADD COLUMN "deleted_at" timestamp with time zone;