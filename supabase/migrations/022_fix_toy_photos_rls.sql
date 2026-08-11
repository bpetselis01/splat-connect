-- 022_fix_toy_photos_rls.sql
-- Fix the toy-photos-library RLS policies to properly reference the storage object's name column
-- using string_to_array with explicit storage.objects.name qualification

-- Drop existing policies
drop policy if exists "Owner can upload own toy photos" on storage.objects;
drop policy if exists "Owner can update own toy photos" on storage.objects;
drop policy if exists "Owner can delete own toy photos" on storage.objects;

-- Recreate policies using proper table reference
-- The name column in storage.objects policies refers to the file path like "toyId/filename"
create policy "Owner can upload own toy photos"
  on storage.objects for insert
  with check (
    bucket_id = 'toy-photos-library'
    and exists (
      select 1 from public.toys
      where (toys.id)::text = (string_to_array(storage.objects.name, '/'))[1]
      and owner_id = auth.uid()
    )
  );

create policy "Owner can update own toy photos"
  on storage.objects for update
  using (
    bucket_id = 'toy-photos-library'
    and exists (
      select 1 from public.toys
      where (toys.id)::text = (string_to_array(storage.objects.name, '/'))[1]
      and owner_id = auth.uid()
    )
  );

create policy "Owner can delete own toy photos"
  on storage.objects for delete
  using (
    bucket_id = 'toy-photos-library'
    and exists (
      select 1 from public.toys
      where (toys.id)::text = (string_to_array(storage.objects.name, '/'))[1]
      and owner_id = auth.uid()
    )
  );
