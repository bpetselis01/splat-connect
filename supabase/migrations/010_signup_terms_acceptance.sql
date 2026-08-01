-- ============================================================
-- Signup-time contributor_terms acceptance
-- ============================================================
-- enable_confirmations = true means auth.signUp() never returns a session, so
-- there is no bearer token to POST /api/agreements with at signup — the
-- acceptance click on the signup dialog had nowhere to be recorded until the
-- user confirmed their email and signed in, which is why the onboarding gate
-- (app/onboarding/contributor-terms) asked again on first login even for an
-- account that had just accepted.
--
-- app/signup/page.tsx now carries the accepted version through signUp()'s
-- user_metadata instead — the same channel handle_new_user() already reads
-- for `name` below, which needs no session because it runs as a
-- security-definer trigger on auth.users itself. Recording the acceptance
-- here means it exists before the user ever reaches the onboarding gate, so
-- middleware.ts's user_agreements lookup already finds it.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.email, '')
  );

  if new.raw_user_meta_data ? 'contributor_terms_version' then
    insert into public.user_agreements (user_id, agreement_type, version)
    values (new.id, 'contributor_terms', new.raw_user_meta_data->>'contributor_terms_version');
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;
