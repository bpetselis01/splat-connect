-- 087 — a caption per guide photo (guide-photo-captions).
--
-- Parallel to photo_urls (053): photo_captions[i] belongs to photo_urls[i],
-- null for none. Never longer than the photos — the API moves captions with
-- their photo on every reorder or removal, and this check is the backstop.
--
-- DOWN:
--   alter table public.tutorials drop constraint if exists tutorials_photo_captions_fit,
--     drop column if exists photo_captions;
--   drop function if exists public.captions_fit(text[]);

-- A CHECK cannot hold a subquery; a function that does can be called from one.
create or replace function public.captions_fit(c text[])
returns boolean
language sql immutable set search_path = ''
as $$
  select coalesce(bool_and(x is null or length(x) <= 60), true) from unnest(c) as x
$$;

alter table public.tutorials
  add column photo_captions text[] not null default '{}',
  add constraint tutorials_photo_captions_fit check (
    cardinality(photo_captions) <= 5
    and cardinality(photo_captions) <= cardinality(photo_urls)
    and public.captions_fit(photo_captions)
  );
