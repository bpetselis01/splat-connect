-- 118 — report an exchange or a build (report-problem-mobile), and a reporter
-- writes only their own columns.
--
-- The mobile sheet now opens from an exchange thread and a build thread, so
-- subject_kind gains 'exchange' and 'build'. Guarded like 046: abort rather
-- than drop a kind the live check permits.
--
-- 065's insert policy checks reporter_id only, so a member could file a report
-- already 'resolved', with a note_to_reporter and a handled_by of their
-- choosing, straight through PostgREST. The insert grant narrows to what a
-- reporter says; status and the handling columns are an admin's (065's
-- update policy, unchanged). Table-level revoke first: a column grant beside
-- a surviving table grant narrows nothing.
--
-- DOWN:
--   revoke insert (reporter_id, subject_kind, subject_label, subject_id, category, body, ok_to_contact)
--     on public.member_reports from authenticated;
--   grant insert on public.member_reports to anon, authenticated;
--   alter table public.member_reports drop constraint member_reports_subject_kind_check;
--   alter table public.member_reports add constraint member_reports_subject_kind_check
--     check (subject_kind in ('guide', 'toy', 'person', 'organisation', 'print_job', 'other'));

do $$
declare
  def  text;
  lost text;
begin
  select pg_get_constraintdef(oid) into def
    from pg_constraint
   where conname = 'member_reports_subject_kind_check' and conrelid = 'public.member_reports'::regclass;
  if def is null then raise exception 'member_reports_subject_kind_check is absent'; end if;
  select string_agg(distinct m[1], ', ') into lost
    from regexp_matches(def, '''([a-z_]+)''', 'g') as m
   where m[1] not in ('guide', 'toy', 'person', 'organisation', 'print_job', 'exchange', 'build', 'other');
  if lost is not null then
    raise exception 'live member_reports_subject_kind_check permits values 118 would drop: %', lost;
  end if;
end $$;

alter table public.member_reports drop constraint member_reports_subject_kind_check;
alter table public.member_reports add constraint member_reports_subject_kind_check
  check (subject_kind in ('guide', 'toy', 'person', 'organisation', 'print_job', 'exchange', 'build', 'other'));

revoke insert on public.member_reports from anon, authenticated;
grant insert (reporter_id, subject_kind, subject_label, subject_id, category, body, ok_to_contact)
  on public.member_reports to authenticated;
