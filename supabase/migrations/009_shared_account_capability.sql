-- WHY: A parent and a contributor are the same kind of account now — either may
--      author, either may hold a child profile. is_approved_contributor()
--      required role = 'contributor', so a mobile-registered parent was refused
--      by Postgres on every authoring path regardless of what the UI offered.
-- HOW: The function keeps its name and signature, so the ~13 RLS policies
--      referencing it (tutorial insert, tutorial_contributors insert, storage
--      upload/update) inherit the new behaviour with no changes. This is the
--      same technique 005 used when it removed the approval gate, and it is why
--      that indirection was kept.
create or replace function public.is_approved_contributor()
returns boolean as $$
  select exists (
    select 1 from public.profiles where id = auth.uid()
  );
$$ language sql security definer stable;

-- WHY: "User can update own profile" (001_schema.sql:134) has no WITH CHECK, so
--      Postgres reuses USING as the check. auth.uid() = id stays true when role
--      changes, so any signed-in user could PATCH themselves to role='admin'
--      over PostgREST with the browser's anon key, and is_admin() gates every
--      admin policy in the schema.
-- HOW: A BEFORE trigger rather than a WITH CHECK: comparing against the stored
--      role from inside a profiles policy needs a subquery on profiles. OLD is
--      visible in a trigger, so identity is frozen here — the same shape as
--      tutorial_orgs_freeze_identity (007) and tutorials_freeze_review_provenance (008).
create or replace function public.freeze_profile_identity()
returns trigger as $$
begin
  -- service_role and other non-JWT contexts: RLS does not apply to them either,
  -- and is_admin() reads auth.uid(), which they lack. Without this early return
  -- such a write raises 42501 while the caller reports success having changed
  -- nothing — the trap recorded in the 007 header.
  if auth.uid() is null then
    return new;
  end if;

  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'role cannot be changed by its owner';
  end if;

  if new.email is distinct from old.email and not public.is_admin() then
    raise exception 'email is mirrored from auth.users and cannot be set directly';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger profiles_freeze_identity
  before update on public.profiles
  for each row execute function public.freeze_profile_identity();
