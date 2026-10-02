-- 106 — one photo on an idea (idea-photo; challenge-brief-photo reads it).
--
--   toy_ideas.photo_path   a toy-photos storage PATH, never a URL (093's rule
--                          for note photos). The API's /upload/idea-photo
--                          writes it with the service role under
--                          ideas/<author>/<uuid>.<ext>, the ext from the
--                          checked MIME type; every read builds photo_url.
--
-- The CHECK pins the path to the author's own folder, so neither a direct
-- PostgREST write nor the API can point an idea at a URL or at someone else's
-- upload. One exception: 083's delete_account repoints a deleted member's ideas
-- to the placeholder profile, and the photo stays where it was filed — so a
-- placeholder-owned row may keep any ideas/<uuid>/ path. Nobody signs in as the
-- placeholder (083), and 037's policies only let an author write their own
-- author_id, so no member can reach that branch.
--
-- A pending idea's photo is public to whoever holds its unguessable URL before
-- review — accepted, as for note photos.
--
-- Public on a published challenge, so it joins 040's anon column grant
-- (review_note never does).
--
-- DOWN:
--   revoke select (photo_path) on public.toy_ideas from anon;
--   alter table public.toy_ideas drop column if exists photo_path;

alter table public.toy_ideas
  add column photo_path text,
  add constraint toy_ideas_photo_path_check check (
    photo_path is null
    or photo_path ~ ('^ideas/' || author_id::text || '/[0-9a-f-]{36}\.(jpg|png|webp|avif|heic|heif)$')
    or (author_id = '00000000-0000-4000-8000-00000000dead'
        and photo_path ~ '^ideas/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|avif|heic|heif)$')
  );

grant select (photo_path) on public.toy_ideas to anon;
