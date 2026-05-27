-- Storage UPDATE policies for file replacement
--
-- upsert:true in the upload routes runs as INSERT ON CONFLICT DO UPDATE.
-- PostgreSQL evaluates both INSERT and UPDATE RLS policies during this
-- operation. Without UPDATE policies, replacing an existing file (e.g.
-- when a contributor edits a pending tutorial) fails with:
--   "new row violates row-level security policy"
--
-- These policies mirror the INSERT policies already in 001_schema.sql.

create policy "Authenticated update tutorial-pdfs"
  on storage.objects for update
  using  (bucket_id = 'tutorial-pdfs' and public.is_approved_contributor())
  with check (bucket_id = 'tutorial-pdfs' and public.is_approved_contributor());

create policy "Authenticated update toy-photos"
  on storage.objects for update
  using  (bucket_id = 'toy-photos' and public.is_approved_contributor())
  with check (bucket_id = 'toy-photos' and public.is_approved_contributor());

create policy "Authenticated update stl-files"
  on storage.objects for update
  using  (bucket_id = 'stl-files' and public.is_approved_contributor())
  with check (bucket_id = 'stl-files' and public.is_approved_contributor());
