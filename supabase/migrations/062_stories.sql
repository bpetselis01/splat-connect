-- 062 — stories: the public reading surface for what org_stories already holds.
--
-- 059 built org_stories as a leader's own log and gave it a kind vocabulary to
-- match: delivery, build_day, partnership, other. The artboard's /about/stories
-- filters by a different four — Family story, Maker story, Organisation update,
-- Announcement — because they answer a different question. 059's words describe
-- what HAPPENED; these describe WHOSE VOICE it is, which is what a reader
-- chooses by. "A delivery" and "a build day" both read as a family story when
-- the family is the one telling it.
--
-- The rest is what a public reading page needs and a leader's list did not: a
-- cover photo, a featured slot, the pull quote the detail page draws, one link
-- back into the product, and a publication date that is not the row's
-- created_at — a story written on Monday and published on Thursday is dated
-- Thursday.
--
-- `org_id` becomes nullable for the same reason the vocabulary changed. The
-- list's fourth filter is "From SPLAT", and a platform announcement has no
-- organisation behind it. Its guards are below: a story with no org must be an
-- announcement, only an admin may write one, and a story WITH an org keeps the
-- leader policies it already had.
--
-- DOWN:
--   alter table public.org_stories
--     drop column photo_urls, drop column featured, drop column pull_quote,
--     drop column pull_quote_by, drop column link_tutorial_id, drop column published_at;
--   alter table public.org_stories drop constraint org_stories_kind_check;
--   update public.org_stories set kind = 'other';
--   alter table public.org_stories add constraint org_stories_kind_check
--     check (kind in ('delivery', 'build_day', 'partnership', 'other'));
--   alter table public.org_stories alter column org_id set not null;

alter table public.org_stories drop constraint if exists org_stories_kind_check;

-- The old words map onto the new ones by who is most likely speaking. Nothing
-- is lost that was not already a guess: 059 shipped days ago and these rows are
-- drafts.
update public.org_stories
set kind = case kind
  when 'delivery' then 'family'
  when 'build_day' then 'org_update'
  when 'partnership' then 'org_update'
  else 'announcement'
end;

alter table public.org_stories
  add constraint org_stories_kind_check
  check (kind in ('family', 'maker', 'org_update', 'announcement'));

alter table public.org_stories
  alter column org_id drop not null,
  add column photo_urls text[] not null default '{}',
  -- One featured story at the top of the list. Not a rank: the artboard draws
  -- exactly one, and a number would invite a second.
  add column featured boolean not null default false,
  add column pull_quote text check (pull_quote is null or length(btrim(pull_quote)) <= 400),
  add column pull_quote_by text check (pull_quote_by is null or length(btrim(pull_quote_by)) <= 120),
  -- The one link back into the product. A guide, because that is what the
  -- artboard draws and what a reader of a family story most often wants next.
  -- A profile or an organisation would each need their own column and their own
  -- FK; neither has asked yet, and the story's own org already renders in the
  -- byline.
  add column link_tutorial_id uuid references public.tutorials (id) on delete set null,
  -- When it went public, which is not when the row was written.
  add column published_at timestamptz;

-- A story with no organisation is a platform announcement, and nothing else.
-- Without this, dropping the NOT NULL above would let a leader's draft lose its
-- org and become unattributable — visible on the public list with no byline to
-- hold it to account.
alter table public.org_stories
  add constraint org_stories_orgless_is_an_announcement
  check (org_id is not null or kind = 'announcement');

-- A pull quote needs someone to have said it. The detail page draws the
-- attribution as part of the quote, and an unattributed one reads as the
-- platform's own voice put in a family's mouth.
alter table public.org_stories
  add constraint org_stories_quote_has_a_voice
  check (pull_quote is null or (pull_quote_by is not null and length(btrim(pull_quote_by)) > 0));

-- Backfill: every published row already public should carry a date.
update public.org_stories set published_at = created_at where status = 'published' and published_at is null;

-- Published and dated go together. A published story with no date sorts to the
-- bottom of a list ordered by it and is, in effect, invisible.
alter table public.org_stories
  add constraint org_stories_published_is_dated
  check (status <> 'published' or published_at is not null);

create index org_stories_published_idx
  on public.org_stories (published_at desc)
  where status = 'published';

-- ---------------------------------------------------------------------------
-- Writing an announcement
-- ---------------------------------------------------------------------------

-- 059's public policy is already `status = 'published'` with no mention of
-- org_id, so it admits a published announcement with no organisation as it
-- stands — nothing to change, and dropping and recreating it to say the same
-- thing would only risk saying it differently.
--
-- What is missing is who may WRITE one. 059's leader policy is
-- `is_org_leader(org_id)`, which is false for a null org, so an announcement
-- is currently unwritable by anybody but the service role. An announcement
-- speaks for SPLAT, so that is an admin's to write and nobody else's.
drop policy if exists org_stories_admin_write on public.org_stories;
create policy org_stories_admin_write
  on public.org_stories for all to authenticated
  using (org_id is null and public.is_admin())
  with check (org_id is null and public.is_admin());
