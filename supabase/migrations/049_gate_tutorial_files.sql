-- supabase/migrations/049_gate_tutorial_files.sql
-- WHY: a tutorial's PDF and STL files are the thing a parent or maker came
--      for, and until now anyone with the page open could take them: both
--      buckets were public (001), the public API handed out the URLs, and the
--      page rendered them as plain links. Makers Making Change gates exactly
--      these — design files behind a login, parts sourcing open — and SPLAT
--      follows that line. toy-photos stays public: cover photos are on every
--      card in a browse grid built for signed-out parents.
-- HOW: flip the two buckets private and replace "anyone reads" with "a
--      signed-in user reads". That select policy is what lets a user's own
--      JWT mint a signed URL (Storage checks select before signing with
--      anything but the service key); the web route handler at
--      /files/<bucket>/<path> does the minting. The stored values change from
--      the public URL to the object path, because a public URL to a private
--      bucket is a dead link and the path is what the signer needs. Verified
--      on the linked project before writing this: every existing value is in
--      the one shape the rewrite below handles; stl_files was empty.

update storage.buckets set public = false where id in ('tutorial-pdfs', 'stl-files');

drop policy if exists "Public read tutorial-pdfs" on storage.objects;
drop policy if exists "Public read stl-files" on storage.objects;

create policy "Signed-in read tutorial-pdfs"
  on storage.objects for select
  using (bucket_id = 'tutorial-pdfs' and auth.uid() is not null);

create policy "Signed-in read stl-files"
  on storage.objects for select
  using (bucket_id = 'stl-files' and auth.uid() is not null);

update public.tutorials
  set tutorial_pdf_url = substring(tutorial_pdf_url from '/object/public/tutorial-pdfs/(.*)$')
  where tutorial_pdf_url like '%/object/public/tutorial-pdfs/%';

update public.stl_files
  set file_url = substring(file_url from '/object/public/stl-files/(.*)$')
  where file_url like '%/object/public/stl-files/%';
