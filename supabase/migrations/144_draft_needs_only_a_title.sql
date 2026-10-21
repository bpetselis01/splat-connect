-- 144 — A draft event or story needs only a title; every other rule applies at publish.
--
-- Before this, a draft event still needed a date and a place (starts_at NOT
-- NULL, org_events_where) and a draft story still needed a summary, body and
-- byline, so "Save as draft" refused what the form said it would keep.
--
-- Events: starts_at becomes nullable and org_events_where and a new
-- org_events_published_has_a_date apply to published rows only.
-- Stories: the columns stay NOT NULL (a draft stores ''), the >= 1 length
-- floors move to a published-only check.
--
-- DOWN:
--   (delete or complete every draft with a null starts_at, then set starts_at
--    NOT NULL, restore org_events_where as 059 wrote it, drop
--    org_events_published_has_a_date and org_stories_published_is_complete,
--    and restore the three >= 1 story checks)

alter table public.org_events alter column starts_at drop not null;

alter table public.org_events drop constraint org_events_where;
alter table public.org_events add constraint org_events_where check (
  status = 'draft'
  or case
    when format = 'in_person' then location is not null and length(btrim(location)) > 0
    else online_url is not null and length(btrim(online_url)) > 0
  end
);

alter table public.org_events add constraint org_events_published_has_a_date
  check (status = 'draft' or starts_at is not null);

alter table public.org_stories drop constraint org_stories_summary_check;
alter table public.org_stories drop constraint org_stories_body_check;
alter table public.org_stories drop constraint org_stories_byline_check;
alter table public.org_stories
  add constraint org_stories_summary_check check (length(btrim(summary)) <= 300),
  add constraint org_stories_body_check check (length(btrim(body)) <= 20000),
  add constraint org_stories_byline_check check (length(btrim(byline)) <= 120),
  add constraint org_stories_published_is_complete check (
    status = 'draft'
    or (length(btrim(summary)) >= 1 and length(btrim(body)) >= 1 and length(btrim(byline)) >= 1)
  );
