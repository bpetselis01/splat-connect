-- 094 — Did it fit? The family says, once, after the parts are collected.
--
-- The board's collected card: "One tap. It goes back to the printer and to the
-- guide author so the next print is better." Two answers, and a timestamp —
-- a print job's stages are timestamps, never status members (058).
--
--   toy_transactions.print_fit     'fitted' or 'reprint'. Null until the family answers.
--   toy_transactions.print_fit_at  when they did. Set with print_fit, never without.
--
-- Counted by 095's print_job_stats as "fitted first time".
--
-- DOWN:
--   alter table public.toy_transactions drop constraint if exists toy_transactions_print_fit_fields;
--   alter table public.toy_transactions drop column if exists print_fit_at;
--   alter table public.toy_transactions drop column if exists print_fit;

alter table public.toy_transactions
  add column print_fit text check (print_fit in ('fitted', 'reprint')),
  add column print_fit_at timestamptz;

alter table public.toy_transactions
  add constraint toy_transactions_print_fit_fields check (
    (type = 'print' or print_fit is null) and ((print_fit is null) = (print_fit_at is null))
  );
