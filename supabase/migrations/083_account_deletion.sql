-- ============================================================
-- 083 · Self-serve account deletion
-- ============================================================
-- docs/superpowers/specs/2026-09-30-account-deletion-design.md
--
-- Personal data goes at once; rows other people rely on (their exchanges,
-- messages, cost records, published guides) are repointed to one fixed
-- "Deleted member" profile instead of being cascaded away. Before this, the
-- admin's bare auth.admin.deleteUser either failed outright (038's
-- toy_idea_messages.sender_id is NO ACTION; 058/061's printer_id and event_id
-- are RESTRICT) or deleted the counterparty's side of every exchange.

-- ── The placeholder ─────────────────────────────────────────
-- A real auth user, because profiles.id references auth.users. No password,
-- banned for good, and handle_new_user() gives it its profile.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, banned_until, created_at, updated_at
) values (
  '00000000-0000-4000-8000-00000000dead',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'deleted-member@splat.invalid', '',
  '{"provider":"email","providers":["email"]}', '{"name":"Deleted member"}',
  'infinity', now(), now()
) on conflict (id) do nothing;

-- public_showcase false: its contributor page 404s like any opted-out person.
update public.profiles set name = 'Deleted member', public_showcase = false
where id = '00000000-0000-4000-8000-00000000dead';

-- The name a guide keeps when its author ticked "Keep my name". Null means
-- the credit reads "A former contributor".
alter table public.tutorial_contributors add column if not exists former_name text;

-- ── What the delete screen shows ────────────────────────────
create or replace function public.account_deletion_preview(uid uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'open', (
      select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'type', t.type) order by t.created_at), '[]')
      from toy_transactions t
      where t.status in ('requested', 'accepted') and (t.requester_id = uid or t.owner_id = uid)
    ),
    'childProfiles', (select count(*) from child_profiles where parent_id = uid),
    'publishedGuides', (
      select count(*) from tutorial_contributors tc join tutorials tu on tu.id = tc.tutorial_id
      where tc.profile_id = uid and tu.status = 'approved'
    ),
    'soleLedOrgs', (
      select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name)), '[]')
      from organizations o
      where exists (select 1 from org_leaders l where l.org_id = o.id and l.user_id = uid)
        and not exists (select 1 from org_leaders l where l.org_id = o.id and l.user_id <> uid)
    )
  )
$$;

-- ── The deletion ────────────────────────────────────────────
-- One transaction. Returns what the API still has to do outside the database:
-- Storage under each deleted toy/guide id, and a notification per cancelled
-- transaction's other party.
create or replace function public.delete_account(uid uuid, keep_credit boolean default false)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  ghost constant uuid := '00000000-0000-4000-8000-00000000dead';
  who text;
  cancelled jsonb;
  gone_toys uuid[];
  gone_guides uuid[];
begin
  if uid = ghost then raise exception 'placeholder_account'; end if;
  if jsonb_array_length(account_deletion_preview(uid)->'soleLedOrgs') > 0 then
    raise exception 'sole_leader';
  end if;
  select name into who from profiles where id = uid;

  -- 1. Cancel what is in flight: their requests withdrawn, requests to them rejected.
  with c as (
    update toy_transactions
    set status = case when requester_id = uid then 'withdrawn' else 'rejected' end
    where status in ('requested', 'accepted') and (requester_id = uid or owner_id = uid)
    returning id, status, case when requester_id = uid then owner_id else requester_id end as other
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'status', status, 'other', other)), '[]')
  into cancelled from c;

  -- 2. Their pickup address copies.
  update toy_transactions
  set pickup_line1 = null, pickup_suburb = null, pickup_state = null,
      pickup_postcode = null, pickup_instructions = null
  where owner_id = uid;

  -- 3. Guides: solo unpublished drafts nothing depends on are deleted; every
  --    other credit moves to the placeholder (at most one placeholder row per
  --    guide, so a second departed co-author's row is simply dropped).
  with solo as (
    select tu.id from tutorials tu
    join tutorial_contributors tc on tc.tutorial_id = tu.id and tc.profile_id = uid
    where tu.status <> 'approved'
      and not exists (select 1 from tutorial_contributors o where o.tutorial_id = tu.id and o.profile_id <> uid)
      and not exists (select 1 from toy_transactions t where t.tutorial_id = tu.id)
  ), del as (
    delete from tutorials where id in (select id from solo) returning id
  )
  select coalesce(array_agg(id), '{}') into gone_guides from del;

  delete from tutorial_contributors tc
  where tc.profile_id = uid
    and exists (select 1 from tutorial_contributors g where g.tutorial_id = tc.tutorial_id and g.profile_id = ghost);
  update tutorial_contributors
  set profile_id = ghost, former_name = case when keep_credit then nullif(who, '') end
  where profile_id = uid;

  -- 4. Toys: history keeps the toy (off the library); no history, it goes.
  with del as (
    delete from toys t where t.owner_id = uid
      and not exists (select 1 from toy_transactions x where x.toy_id = t.id or x.offered_toy_id = t.id)
    returning id
  )
  select coalesce(array_agg(id), '{}') into gone_toys from del;
  update toys set owner_id = ghost, status = 'draft' where owner_id = uid;

  -- 5. Printers: jobs keep the printer (not accepting); no jobs, it goes.
  delete from printers p where p.owner_id = uid
    and not exists (select 1 from toy_transactions x where x.printer_id = p.id);
  update printers set owner_id = ghost, accepting = false where owner_id = uid;

  -- 6. Everything other people rely on.
  update toy_transactions set requester_id = ghost where requester_id = uid;
  update toy_transactions set owner_id = ghost where owner_id = uid;
  update toy_transaction_messages set sender_id = ghost where sender_id = uid;
  update exchange_costs set payer_id = ghost where payer_id = uid;
  update exchange_costs set payee_id = ghost where payee_id = uid;
  update exchange_costs set created_by = ghost where created_by = uid;
  update exchange_settlements set updated_by = ghost where updated_by = uid;
  update toy_ideas set author_id = ghost where author_id = uid;
  update toy_idea_messages set sender_id = ghost where sender_id = uid;
  update toy_idea_reports set reported_by = ghost where reported_by = uid;
  update toy_idea_reports set reported_profile_id = ghost where reported_profile_id = uid;
  update member_reports set reporter_id = ghost where reporter_id = uid;
  update org_events set created_by = ghost where created_by = uid;
  update org_stories set created_by = ghost where created_by = uid;
  update recycling_dropoffs set contributor_id = ghost where contributor_id = uid;
  update org_messages set sender_id = ghost where sender_id = uid;
  -- A conversation with an org the placeholder already talks to is merged
  -- into that one (org_id, profile_id is unique).
  update org_messages m set conversation_id = g.id
  from org_conversations mine, org_conversations g
  where m.conversation_id = mine.id and mine.profile_id = uid
    and g.org_id = mine.org_id and g.profile_id = ghost;
  delete from org_conversations mine
  where mine.profile_id = uid
    and exists (select 1 from org_conversations g where g.org_id = mine.org_id and g.profile_id = ghost);
  update org_conversations set profile_id = ghost where profile_id = uid;

  -- 7. The person. Cascades take the profile, child profiles, notifications,
  --    saves, agreements, follows, thanks, registrations, invites,
  --    participation, leadership and organisation requests.
  delete from auth.users where id = uid;

  return jsonb_build_object('cancelled', cancelled, 'toyIds', to_jsonb(gone_toys), 'tutorialIds', to_jsonb(gone_guides));
end;
$$;

-- Service role only: the API checks who is asking and that they just proved it.
revoke all on function public.account_deletion_preview(uuid) from public, anon, authenticated;
revoke all on function public.delete_account(uuid, boolean) from public, anon, authenticated;
grant execute on function public.account_deletion_preview(uuid) to service_role;
grant execute on function public.delete_account(uuid, boolean) to service_role;
