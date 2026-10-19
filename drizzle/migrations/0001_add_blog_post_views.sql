-- Migration: Add blog_post_views table for blog analytics
-- Issue: AUDIT-04 item 5 / AUDIT-05 item 30

CREATE TABLE IF NOT EXISTS blog_post_views (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  blog_post_id uuid NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  visitor_id varchar(255),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  viewed_at timestamp with time zone DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_blog_post_views_post_id ON blog_post_views(blog_post_id);
CREATE INDEX IF NOT EXISTS idx_blog_post_views_visitor_id ON blog_post_views(visitor_id);
CREATE INDEX IF NOT EXISTS idx_blog_post_views_viewed_at ON blog_post_views(viewed_at DESC);