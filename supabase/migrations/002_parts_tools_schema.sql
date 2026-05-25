-- Migration 002: Add is_optional flag and replace buy_link with buy_links JSONB
-- on parts and tools tables.
-- Note: parts and tools tables are expected to be empty at time of migration.

-- Parts
ALTER TABLE public.parts ADD COLUMN is_optional boolean NOT NULL DEFAULT false;
ALTER TABLE public.parts DROP COLUMN buy_link;
ALTER TABLE public.parts ADD COLUMN buy_links jsonb NOT NULL DEFAULT '[]';

-- Tools
ALTER TABLE public.tools ADD COLUMN is_optional boolean NOT NULL DEFAULT false;
ALTER TABLE public.tools DROP COLUMN buy_link;
ALTER TABLE public.tools ADD COLUMN buy_links jsonb NOT NULL DEFAULT '[]';
