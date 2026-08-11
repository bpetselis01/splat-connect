-- 021_toys.sql
create table public.toys (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  name text not null,
  description text,
  condition smallint not null check (condition between 1 and 10),
  switch_adapted boolean not null default false,
  cover_photo_url text,
  switch_photo_urls text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.toys enable row level security;

create policy "Anyone can read published toys, or their own draft"
  on public.toys for select using (status = 'published' or owner_id = auth.uid());
create policy "Owner can insert own toy"
  on public.toys for insert with check (owner_id = auth.uid());
create policy "Owner can update own toy"
  on public.toys for update using (owner_id = auth.uid());
create policy "Owner can delete own toy"
  on public.toys for delete using (owner_id = auth.uid());
create policy "Admin full access to toys"
  on public.toys for all using (public.is_admin());

insert into storage.buckets (id, name, public)
values ('toy-photos-library', 'toy-photos-library', true)
on conflict (id) do nothing;

create policy "Public read access to toy photos library"
  on storage.objects for select
  using (bucket_id = 'toy-photos-library');

create policy "Owner can upload own toy photos"
  on storage.objects for insert
  with check (
    bucket_id = 'toy-photos-library'
    and exists (
      select 1 from public.toys
      where id::text = (storage.foldername(name))[1]
      and owner_id = auth.uid()
    )
  );

create policy "Owner can update own toy photos"
  on storage.objects for update
  using (
    bucket_id = 'toy-photos-library'
    and exists (
      select 1 from public.toys
      where id::text = (storage.foldername(name))[1]
      and owner_id = auth.uid()
    )
  );

create policy "Owner can delete own toy photos"
  on storage.objects for delete
  using (
    bucket_id = 'toy-photos-library'
    and exists (
      select 1 from public.toys
      where id::text = (storage.foldername(name))[1]
      and owner_id = auth.uid()
    )
  );
