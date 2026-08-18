-- 032_scope_upload_buckets_to_owner.sql
-- WHY: the tutorial-pdfs, toy-photos and stl-files policies (001/002) only asked
--      "is this caller a contributor?" — which since 009 means "is anyone signed
--      in" — and never which tutorial's folder was being written to. With
--      upsert:true that let any account overwrite another tutorial's PDF, STL or
--      cover photo by posting its UUID. upload.ts now checks contributorship in
--      app code; this is the database half of that rule.
-- HOW: bind the first path segment ("<tutorialId>/<file>") to a row in
--      tutorial_contributors for the caller — the same shape 022 uses for the
--      toy-photos-library bucket. The ::text comparison (rather than casting the
--      path to uuid) keeps a junk path a policy miss instead of a 22P02 error.

create or replace function public.contributes_to_storage_folder(object_name text)
returns boolean as $$
  select exists (
    select 1 from public.tutorial_contributors
    where (tutorial_contributors.tutorial_id)::text = (string_to_array(object_name, '/'))[1]
      and tutorial_contributors.profile_id = auth.uid()
  );
$$ language sql security definer stable;

drop policy if exists "Authenticated upload tutorial-pdfs" on storage.objects;
create policy "Contributors upload their own tutorial-pdfs"
  on storage.objects for insert
  with check (
    bucket_id = 'tutorial-pdfs'
    and public.contributes_to_storage_folder(storage.objects.name)
  );

drop policy if exists "Authenticated update tutorial-pdfs" on storage.objects;
create policy "Contributors update their own tutorial-pdfs"
  on storage.objects for update
  using (
    bucket_id = 'tutorial-pdfs'
    and public.contributes_to_storage_folder(storage.objects.name)
  )
  with check (
    bucket_id = 'tutorial-pdfs'
    and public.contributes_to_storage_folder(storage.objects.name)
  );

drop policy if exists "Authenticated upload toy-photos" on storage.objects;
create policy "Contributors upload their own toy-photos"
  on storage.objects for insert
  with check (
    bucket_id = 'toy-photos'
    and public.contributes_to_storage_folder(storage.objects.name)
  );

drop policy if exists "Authenticated update toy-photos" on storage.objects;
create policy "Contributors update their own toy-photos"
  on storage.objects for update
  using (
    bucket_id = 'toy-photos'
    and public.contributes_to_storage_folder(storage.objects.name)
  )
  with check (
    bucket_id = 'toy-photos'
    and public.contributes_to_storage_folder(storage.objects.name)
  );

drop policy if exists "Authenticated upload stl-files" on storage.objects;
create policy "Contributors upload their own stl-files"
  on storage.objects for insert
  with check (
    bucket_id = 'stl-files'
    and public.contributes_to_storage_folder(storage.objects.name)
  );

drop policy if exists "Authenticated update stl-files" on storage.objects;
create policy "Contributors update their own stl-files"
  on storage.objects for update
  using (
    bucket_id = 'stl-files'
    and public.contributes_to_storage_folder(storage.objects.name)
  )
  with check (
    bucket_id = 'stl-files'
    and public.contributes_to_storage_folder(storage.objects.name)
  );
