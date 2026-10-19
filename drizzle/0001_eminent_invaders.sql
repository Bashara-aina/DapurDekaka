ALTER TABLE "products" ALTER COLUMN "weight_gram" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "is_pre_order" boolean DEFAULT false NOT NULL;