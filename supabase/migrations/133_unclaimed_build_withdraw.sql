-- 133 — a family can withdraw a Makers wanted post nobody has claimed.
-- 064 let an unclaimed build exist only while status = 'requested', on the
-- reasoning that accept, reject, withdraw and complete are all things an owner
-- does. That is wrong for withdraw: the family that posted the request is the
-- one withdrawing it, and with no owner the update tripped
-- toy_transactions_one_owner and the route answered 500. So an unowned build
-- may now be 'requested' or 'withdrawn'. Nothing else is loosened: an unowned
-- donation, exchange or print job is still refused, and an unowned build still
-- cannot be accepted, rejected or completed (those need an owner).
-- Guarded like 132: abort rather than replace a constraint that is not 064's.
--
-- DOWN:
--   delete from public.toy_transactions
--    where num_nonnulls(owner_id, owner_org_id) = 0 and status = 'withdrawn';
--   alter table public.toy_transactions drop constraint toy_transactions_one_owner;
--   alter table public.toy_transactions add constraint toy_transactions_one_owner
--     check (
--       (num_nonnulls(owner_id, owner_org_id) = 0 and type = 'build' and status = 'requested')
--       or num_nonnulls(owner_id, owner_org_id) = 1
--     );

do $$
declare
  def text;
begin
  select pg_get_constraintdef(oid) into def
    from pg_constraint
   where conname = 'toy_transactions_one_owner' and conrelid = 'public.toy_transactions'::regclass;
  if def is null then raise exception 'toy_transactions_one_owner is absent'; end if;
  if def !~ $re$num_nonnulls\(owner_id, owner_org_id\) = 0\) AND \(type = 'build'::text\) AND \(status = 'requested'::text\)\) OR \(num_nonnulls\(owner_id, owner_org_id\) = 1\)$re$ then
    raise exception 'live toy_transactions_one_owner is not the 064 shape, 133 would replace: %', def;
  end if;
end $$;

alter table public.toy_transactions drop constraint toy_transactions_one_owner;
alter table public.toy_transactions
  add constraint toy_transactions_one_owner
  check (
    (num_nonnulls(owner_id, owner_org_id) = 0 and type = 'build' and status in ('requested', 'withdrawn'))
    or num_nonnulls(owner_id, owner_org_id) = 1
  );
