-- Phase 7 — full-text search vectors.
-- These are GENERATED ALWAYS ... STORED columns (Prisma can't author the GENERATED expression,
-- so the auto-generated plain "ADD COLUMN ... tsvector" was replaced by hand). The schema
-- declares them as Unsupported("tsvector")? purely to silence Prisma drift detection.

-- Post.searchVector — tsvector over the caption.
ALTER TABLE "Post"
  ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce("caption", ''))) STORED;
CREATE INDEX "Post_searchVector_idx" ON "Post" USING GIN ("searchVector");

-- User.searchVector — tsvector over username + display name (username always present).
ALTER TABLE "User"
  ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', "username" || ' ' || coalesce("name", ''))) STORED;
CREATE INDEX "User_searchVector_idx" ON "User" USING GIN ("searchVector");
