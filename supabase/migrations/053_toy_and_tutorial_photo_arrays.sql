-- supabase/migrations/053_toy_and_tutorial_photo_arrays.sql
-- WHY: A toy carried one cover photo plus a separate switch-photo gallery, and
--      a guide carried exactly one photo. Both are now up to five photos in a
--      single carousel, uploaded through one box — so the two toy columns
--      become one ordered array, and the guide's scalar becomes the same array.
--
-- HOW: cover_photo_url and toy_photo_url survive as GENERATED columns reading
--      photo_urls[1]. That is the whole reason this migration is small: every
--      card, list, picks row, inventory tile and exchange snapshot that reads
--      the scalar keeps working untouched, and a mobile build shipped before
--      this change still renders a cover after it lands. Postgres cannot turn
--      an existing plain column into a generated one, hence drop-and-re-add
--      after the backfill has read it.
--
--      Nothing writes these two scalars any more. PostgREST rejects a write
--      naming a generated column, which is the point: the array is the only
--      way in, so photo_urls[1] and "the cover" cannot drift apart.
--
--      Verified against the development project before writing this: 8 toys,
--      11 tutorials, max 1 switch photo on any toy, 0 rows that would exceed
--      the new cap. The merge below is therefore unambiguous — no row needs a
--      human to decide which photo leads.

-- ---------------------------------------------------------------- toys ----
alter table public.toys add column photo_urls text[] not null default '{}';

-- Which photo shows the accessibility switch. A scalar pointing into
-- photo_urls rather than a second gallery: the publish rule needs to know that
-- a switch-adapted toy has *pictured* its switch, and "any two photos" would
-- not have been that rule.
alter table public.toys add column switch_photo_url text;

-- Cover first, then the switch photos, so the carousel opens on what the
-- cards already show. array_remove strips the NULL that array[] yields for a
-- toy with no cover, leaving it with an empty array rather than a {NULL}.
update public.toys
set photo_urls = array_remove(array[cover_photo_url] || switch_photo_urls, null),
    switch_photo_url = case when switch_adapted then switch_photo_urls[1] end;

alter table public.toys drop column cover_photo_url;
alter table public.toys drop column switch_photo_urls;

alter table public.toys
  add column cover_photo_url text generated always as (photo_urls[1]) stored;

-- array_length returns NULL for an empty array, hence the coalesce; without it
-- the check evaluates to NULL and passes by accident rather than by rule.
alter table public.toys
  add constraint toys_photo_cap check (coalesce(array_length(photo_urls, 1), 0) <= 5);

alter table public.toys
  add constraint toys_switch_photo_member
  check (switch_photo_url is null or switch_photo_url = any(photo_urls));

-- ----------------------------------------------------------- tutorials ----
alter table public.tutorials add column photo_urls text[] not null default '{}';

update public.tutorials
set photo_urls = array_remove(array[toy_photo_url], null);

alter table public.tutorials drop column toy_photo_url;

alter table public.tutorials
  add column toy_photo_url text generated always as (photo_urls[1]) stored;

alter table public.tutorials
  add constraint tutorials_photo_cap check (coalesce(array_length(photo_urls, 1), 0) <= 5);

-- ------------------------------------------------------------- buckets ----
-- WHY: both photo buckets are public with no size limit and no MIME allowlist.
--      Until now the only thing bounding them was the upload route itself —
--      /photo deleted every existing file before writing, so a tutorial could
--      only ever hold one. Five photos removes that implicit bound, so the
--      real one goes here instead of nowhere.
--
--      HEIF as well as HEIC: an iPhone shooting in High Efficiency sends
--      either depending on how the picker transcodes.
update storage.buckets
set file_size_limit = 10485760,  -- 10 MB; a phone photo is 2-5 MB
    allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'
    ]
where id in ('toy-photos', 'toy-photos-library');
