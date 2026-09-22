-- 072 — what the public contributor profile needs to draw the board's About
-- and Featured sections.
--
--   profiles.bio                   the "About" paragraph, at most 600 chars.
--   profiles.featured_tutorial_id  the one guide the contributor would hand a
--                                  first-timer. set null when the guide goes,
--                                  and PATCH /api/contributors/me only accepts
--                                  one of the caller's own approved guides —
--                                  the row cannot say that (a guide's status
--                                  changes after the row is written), so the
--                                  public endpoint re-checks it on read.
--
-- Both are client-editable through the same PATCH as name and pickup_*, so
-- 045's column-level UPDATE grant is extended here, as 045 said it must be.
-- Both are public by design, the same way name is: the SELECT grant matches
-- name's, and the SELECT policies (001, 034) already scope who is visible.
--
-- Badges and the families line are derived on read from tutorials,
-- tutorial_thanks and tutorial_orgs — nothing stored.
--
-- DOWN:
--   alter table public.profiles drop column if exists featured_tutorial_id;
--   alter table public.profiles drop column if exists bio;

alter table public.profiles
  add column bio text check (char_length(bio) <= 600),
  add column featured_tutorial_id uuid references public.tutorials on delete set null;

grant select (bio, featured_tutorial_id) on public.profiles to anon, authenticated;
grant update (bio, featured_tutorial_id) on public.profiles to authenticated;
