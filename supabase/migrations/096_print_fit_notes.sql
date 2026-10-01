-- 096 — Customization on the print request, per job.
--
-- Decided 2026-09-30: reach, switch size, mount and tray thickness are asked
-- on the print request, not on the account — the board's profile placement is
-- overridden. The board's questions and options, all optional: "Physical
-- dimensions we use to size printed mounts and brackets. Nothing here is
-- required." The printer reads them on the offer and job screens.
--
--   toy_transactions.print_fit_notes  jsonb object, keys reach / switch_size /
--                                     mount / tray. The options are checked in
--                                     the API (packages/types printing.ts); the
--                                     keys and the shape are checked here.
--
-- DOWN:
--   alter table public.toy_transactions drop constraint if exists toy_transactions_print_fit_notes;
--   alter table public.toy_transactions drop column if exists print_fit_notes;

alter table public.toy_transactions add column print_fit_notes jsonb;

alter table public.toy_transactions
  add constraint toy_transactions_print_fit_notes check (
    print_fit_notes is null or (
      type = 'print'
      and jsonb_typeof(print_fit_notes) = 'object'
      and print_fit_notes - array['reach', 'switch_size', 'mount', 'tray'] = '{}'::jsonb
    )
  );
