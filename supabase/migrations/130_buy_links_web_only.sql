-- 130 — a buy link is a shop name and a web address, enforced by the table.
--
-- Both clients render a part's or tool's buy links as links (an href on web).
-- The API checks them (routes/sub-resource.ts buyLinksError), but a
-- contributor's own session can write parts and tools straight through
-- PostgREST under 001's policies, so the API is not the only door. The check
-- lives here, where every writer passes.
--
-- Existing links that would fail are dropped from their lists first (any
-- javascript:, data:, app scheme or bare domain), so the constraint goes on
-- valid.
--
-- DOWN:
--   alter table public.parts drop constraint if exists parts_buy_links_web;
--   alter table public.tools drop constraint if exists tools_buy_links_web;
--   drop function if exists public.buy_link_ok(jsonb);
--   drop function if exists public.buy_links_ok(jsonb);

create function public.buy_link_ok(l jsonb) returns boolean
language sql immutable set search_path = ''
as $$
  select jsonb_typeof(l) = 'object'
    and jsonb_typeof(l -> 'label') = 'string' and length(btrim(l ->> 'label')) between 1 and 80
    and jsonb_typeof(l -> 'url') = 'string' and length(l ->> 'url') <= 500
    and btrim(l ->> 'url') ~* '^https?://\S+$'
$$;

create function public.buy_links_ok(links jsonb) returns boolean
language sql immutable set search_path = ''
as $$
  select jsonb_typeof(links) = 'array'
    and not exists (select 1 from jsonb_array_elements(links) l where not public.buy_link_ok(l))
$$;

update public.parts set buy_links = coalesce(
  (select jsonb_agg(l) from jsonb_array_elements(buy_links) l where public.buy_link_ok(l)), '[]'::jsonb)
  where not public.buy_links_ok(buy_links);
update public.tools set buy_links = coalesce(
  (select jsonb_agg(l) from jsonb_array_elements(buy_links) l where public.buy_link_ok(l)), '[]'::jsonb)
  where not public.buy_links_ok(buy_links);

alter table public.parts add constraint parts_buy_links_web check (public.buy_links_ok(buy_links));
alter table public.tools add constraint tools_buy_links_web check (public.buy_links_ok(buy_links));
