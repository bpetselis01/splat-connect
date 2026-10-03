-- 124 — the contributor profile's role line ("Occupational therapist").
--
-- Nothing existing says what a person does: profiles.role is admin or
-- contributor, and a child profile describes a child. So it is one short
-- free-text column the person writes themselves, public by design like name
-- and bio (072). The organisation chip beside it is derived on read from
-- org_leaders — nothing stored.
--
-- DOWN:
--   alter table public.profiles drop column if exists occupation;

alter table public.profiles
  add column occupation text check (char_length(occupation) <= 60);

grant select (occupation) on public.profiles to anon, authenticated;
grant update (occupation) on public.profiles to authenticated;
