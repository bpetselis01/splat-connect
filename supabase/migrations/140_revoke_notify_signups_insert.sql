-- POST /api/public/notify was the only writer and carried the only feature_key
-- allowlist; with the route gone the open insert grant from 035 would let
-- anyone add rows through REST. Closed here; the table itself goes in a later
-- migration once hosted has been checked for rows worth exporting.
drop policy if exists "anyone may register interest" on public.notify_signups;
revoke insert on public.notify_signups from anon, authenticated;
