-- 100 — Mark unavailable: a toy stops taking requests without leaving the library.
--
-- Decided 2026-09-30 (registry: toy-pause-unavailable). The toy stays listed
-- and readable, the request button hides, and POST /api/toy-transactions
-- refuses with 409; one tap resumes. A timestamp rather than a `status`
-- member: status is the draft/published axis the whole publish flow reads.
--
--   toys.paused_at  when the holder paused it. Null = taking requests.
--
-- Owner-editable through PATCH /api/toys/:id (both whitelists). The confirm
-- handler clears it when the toy changes hands: a pause is the holder's
-- choice, not the toy's.
--
-- DOWN:
--   alter table public.toys drop column if exists paused_at;

alter table public.toys add column paused_at timestamptz;
