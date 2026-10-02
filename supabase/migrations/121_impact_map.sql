-- 121 — the deliveries map (impact-map).
--
-- Story s4's promise, kept here rather than in a caller: completed handoffs
-- "at suburb level, never at address level, and never for fewer than three
-- deliveries in a suburb. It will not show individual families."
--
--   a delivery   a completed donation or exchange of a toy. Builds and print
--                jobs share toy_transactions and are not deliveries.
--   the place    the pickup suburb and state copied onto the row when it was
--                accepted (025/033), trimmed and case-folded so one suburb
--                spelt two ways is one group, not two groups under three.
--   the point    the mean of the group's postcode centres (099, ABS). Never an
--                address: pickup_line1 is not read. A postcode with no centre
--                drops out rather than landing at 0,0.
--   the floor    HAVING count(*) >= 3. This function is the map's only reader
--                and GET /api/public/impact/map returns its rows untouched,
--                so no caller can forget it.
--
-- SECURITY DEFINER: toy_transactions has no anon read (026). Execute is the
-- service role's only — the API calls it through the admin client — so the
-- floor cannot be probed or bypassed from a browser key either.
--
-- DOWN:
--   drop function if exists public.impact_map();

create function public.impact_map()
returns table (suburb text, state text, deliveries int, lat double precision, lng double precision)
language sql stable security definer set search_path = ''
as $$
  select initcap(lower(btrim(t.pickup_suburb))),
         upper(btrim(t.pickup_state)),
         count(*)::int,
         round(avg(c.lat)::numeric, 3)::double precision,
         round(avg(c.lng)::numeric, 3)::double precision
    from public.toy_transactions t
    join public.postcode_centroids c on c.postcode = btrim(t.pickup_postcode)
   where t.status = 'completed'
     and t.type in ('donation', 'exchange')
     and t.toy_id is not null
     and nullif(btrim(t.pickup_suburb), '') is not null
     and nullif(btrim(t.pickup_state), '') is not null
   group by lower(btrim(t.pickup_suburb)), upper(btrim(t.pickup_state))
  having count(*) >= 3
   order by 3 desc, 1
$$;

revoke execute on function public.impact_map() from public, anon, authenticated;
grant execute on function public.impact_map() to service_role;
