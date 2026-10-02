-- 104 — the note to the maker is optional (build-request-options).
--
-- 057 required a non-empty build_brief on every build; 061 is the live text of
-- toy_transactions_subject (it added the print arm). This recreates 061's
-- constraint with one change: a build's brief may be null, and when present is
-- still 1–2000 characters after trimming. Every other arm is 061's, verbatim.
--
-- DOWN:
--   (recreate 061's toy_transactions_subject; it succeeds only once no build
--    row has a null build_brief)

alter table public.toy_transactions drop constraint toy_transactions_subject;
alter table public.toy_transactions
  add constraint toy_transactions_subject
  check (
    case
      when type = 'build' then
        toy_id is null
        and offered_toy_id is null
        and tutorial_id is not null
        and (build_brief is null or length(btrim(build_brief)) between 1 and 2000)
        and printer_id is null
        and event_id is null
        and part_sets is null
      when type = 'print' then
        toy_id is null
        and offered_toy_id is null
        and tutorial_id is not null
        and build_brief is null
        and num_nonnulls(printer_id, event_id) = 1
        and (event_id is null) = (part_sets is null)
        and working_photo_url is null
        and work_approved_at is null
      else
        toy_id is not null
        and tutorial_id is null
        and build_brief is null
        and printer_id is null
        and event_id is null
        and part_sets is null
        and working_photo_url is null
        and work_approved_at is null
        and print_note is null
        and printing_started_at is null
        and ready_at is null
        and ready_photo_url is null
    end
  );
