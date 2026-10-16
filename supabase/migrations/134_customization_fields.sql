-- 134 — contributor-defined customization fields (spec 2026-10-09-contributor-customization-fields).
--
--   tutorials.customization_fields  jsonb array, at most 6 of
--     { key, label, kind: 'choice' | 'number', options? | unit/min/max, param? }.
--     The shape is checked in the API (packages/types printing.ts); the table
--     checks "array, at most 6".
--   toy_transactions.print_fit_notes  was { reach, switch_size, mount, tray }
--     (096); now an array of { label, value }, so a request still reads right
--     after its guide's fields change. Existing rows are converted.
--
-- DOWN: not reversible without data loss (labels the four keys no longer map to).
--   alter table public.tutorials drop constraint if exists tutorials_customization_fields;
--   alter table public.tutorials drop column if exists customization_fields;

alter table public.tutorials
  add column customization_fields jsonb not null default '[]'::jsonb,
  add constraint tutorials_customization_fields check (
    jsonb_typeof(customization_fields) = 'array' and jsonb_array_length(customization_fields) <= 6
  );

alter table public.toy_transactions drop constraint if exists toy_transactions_print_fit_notes;

update public.toy_transactions t
set print_fit_notes = nullif((
  select coalesce(jsonb_agg(jsonb_build_object('label', l.label, 'value', t.print_fit_notes ->> l.key) order by l.ord), '[]'::jsonb)
  from (values
    (1, 'reach', 'Reach from seated'),
    (2, 'switch_size', 'Preferred switch size'),
    (3, 'mount', 'Mount needed'),
    (4, 'tray', 'Tray thickness')
  ) as l(ord, key, label)
  where t.print_fit_notes ? l.key
), '[]'::jsonb)
where t.print_fit_notes is not null;

alter table public.toy_transactions
  add constraint toy_transactions_print_fit_notes check (
    print_fit_notes is null or (
      type = 'print'
      and jsonb_typeof(print_fit_notes) = 'array'
      and jsonb_array_length(print_fit_notes) <= 6
    )
  );
