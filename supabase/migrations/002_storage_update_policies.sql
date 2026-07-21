-- WHY: The fix in 001_schema.sql only affects new databases. This migration
--      applies the same "replace file" permissions to an already-running database.
-- HOW: On a fresh database (local dev / CI), 001 has already created these
--      policies, so each create is preceded by drop-if-exists to keep this
--      migration safe to apply in both orders.
--
-- Storage UPDATE policies for file replacement
--
-- upsert:true in the upload routes runs as INSERT ON CONFLICT DO UPDATE.
-- PostgreSQL evaluates both INSERT and UPDATE RLS policies during this
-- operation. Without UPDATE policies, replacing an existing file (e.g.
-- when a contributor edits a pending tutorial) fails with:
--   "new row violates row-level security policy"
--
-- These policies mirror the INSERT policies already in 001_schema.sql.

drop policy if exists "Authenticated update tutorial-pdfs" on storage.objects;
create policy "Authenticated update tutorial-pdfs"
  on storage.objects for update
  using  (bucket_id = 'tutorial-pdfs' and public.is_approved_contributor())
  with check (bucket_id = 'tutorial-pdfs' and public.is_approved_contributor());

drop policy if exists "Authenticated update toy-photos" on storage.objects;
create policy "Authenticated update toy-photos"
  on storage.objects for update
  using  (bucket_id = 'toy-photos' and public.is_approved_contributor())
  with check (bucket_id = 'toy-photos' and public.is_approved_contributor());

drop policy if exists "Authenticated update stl-files" on storage.objects;
create policy "Authenticated update stl-files"
  on storage.objects for update
  using  (bucket_id = 'stl-files' and public.is_approved_contributor())
  with check (bucket_id = 'stl-files' and public.is_approved_contributor());
