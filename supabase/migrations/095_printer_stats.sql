-- 095 — a printer's track record: jobs done, median turnaround, first-time
-- fit, colours. The board's "21 jobs · ~3 days" on the find card, "21
-- completed · median 3 days / 20 of 21 fitted first time" on the machine
-- picker, and Turnaround / Fit on an organisation's profile.
--
-- Computed on read over completed print jobs, never a counter column. One
-- aggregate over a set of printers, so a machine and an organisation (all its
-- machines) are the same question:
--
--   print_job_stats(uuid[])  jsonb { jobs, median_days, fitted, fit_answers, colours }
--                            service role only; the API calls it for an org.
--   printer_stats(printers)  PostgREST computed field — `select=printer_stats`.
--
-- jobs         completed print jobs.
-- median_days  median of (the later handover confirmation − created_at), whole days.
-- fitted / fit_answers  from 094's print_fit.
-- colours      distinct print_colour, most used first, max 3. "Any colour" is
--              not a colour.
--
-- SECURITY DEFINER for the reason 067 gives: an invoker function runs the
-- caller's RLS on every row, and nobody but the two parties can read a job.
--
-- DOWN:
--   drop function if exists public.printer_stats(public.printers);
--   drop function if exists public.print_job_stats(uuid[]);

create function public.print_job_stats(p_printer_ids uuid[])
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with done as (
    select
      t.created_at,
      greatest(t.owner_confirmed_at, t.requester_confirmed_at) as collected_at,
      t.print_fit,
      t.print_colour
    from public.toy_transactions t
    where t.printer_id = any (p_printer_ids)
      and t.type = 'print'
      and t.status = 'completed'
  )
  select jsonb_build_object(
    'jobs', (select count(*) from done),
    'median_days', (
      select round(percentile_cont(0.5) within group (
        order by extract(epoch from collected_at - created_at) / 86400
      ))::int
      from done
      where collected_at is not null
    ),
    'fitted', (select count(*) from done where print_fit = 'fitted'),
    'fit_answers', (select count(*) from done where print_fit is not null),
    'colours', coalesce((
      select jsonb_agg(print_colour order by n desc, print_colour)
      from (
        select print_colour, count(*) as n
        from done
        where print_colour is not null and print_colour <> 'Any colour'
        group by print_colour
        order by n desc, print_colour
        limit 3
      ) c
    ), '[]'::jsonb)
  )
$$;

revoke execute on function public.print_job_stats(uuid[]) from public, anon, authenticated;

create function public.printer_stats(p public.printers)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.print_job_stats(array[p.id])
$$;
