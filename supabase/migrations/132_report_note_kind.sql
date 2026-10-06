-- 132 — a community note on a guide can be reported on its own (the mobile
-- Feedback tab's ⋯ menu). Until now the app filed such a report against the
-- whole guide, so the admin queue could not tell which note was meant.
-- Guarded like 118: abort rather than drop a kind the live check permits.
--
-- DOWN:
--   alter table public.member_reports drop constraint member_reports_subject_kind_check;
--   alter table public.member_reports add constraint member_reports_subject_kind_check
--     check (subject_kind in ('guide', 'toy', 'person', 'organisation', 'print_job', 'exchange', 'build', 'other'));

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
   where m[1] not in ('guide', 'toy', 'person', 'organisation', 'print_job', 'exchange', 'build', 'note', 'other');
  if lost is not null then
    raise exception 'live member_reports_subject_kind_check permits values 132 would drop: %', lost;
  end if;
end $$;

alter table public.member_reports drop constraint member_reports_subject_kind_check;
alter table public.member_reports add constraint member_reports_subject_kind_check
  check (subject_kind in ('guide', 'toy', 'person', 'organisation', 'print_job', 'exchange', 'build', 'note', 'other'));
