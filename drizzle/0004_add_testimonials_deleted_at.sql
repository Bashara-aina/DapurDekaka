-- Add missing deleted_at column to testimonials table
ALTER TABLE "testimonials" ADD COLUMN "deleted_at" timestamp with time zone;