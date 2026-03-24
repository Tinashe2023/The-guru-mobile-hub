-- Sync local schema with live Neon additions.
-- Safe/idempotent migration.

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES users(id);

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS shared_admin_id UUID REFERENCES users(id);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS current_challenge TEXT;
