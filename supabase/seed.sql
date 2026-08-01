-- Deterministic fixtures for local dev.
-- Applied automatically by `supabase db reset`. NEVER run against a cloud project.
-- All passwords: Test1234!
--
-- These rows exist for exploring the app locally. NO E2E SPEC MAY REFERENCE A
-- SEEDED ROW — every spec provisions its own accounts and tutorials through the
-- service-role helpers in packages/{web,mobile}/tests/e2e/helpers.ts, and asserts
-- only on rows it created. That rule is what lets both suites run on parallel
-- workers and pass repeatedly without a reset in between.
-- See docs/superpowers/specs/2026-07-26-e2e-coverage-audit-design.md.

-- ============================================================
-- Auth users (profiles rows are auto-created by on_auth_user_created)
-- ============================================================
-- NOTE: confirmation_token/recovery_token/email_change_token_new/email_change are
-- explicitly set to '' (not left to default to NULL) because this local GoTrue
-- version's Go scanner errors on NULL for these varchar columns:
-- "sql: Scan error on column index 3, name \"confirmation_token\": converting NULL string unsupported".
-- Deviation from the task brief's SQL, required to satisfy the current local auth schema.
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
   confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated', 'contributor@splat-test.local',
   crypt('Test1234!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"name":"Seed Contributor"}', now(), now(),
   '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated', 'admin@splat-test.local',
   crypt('Test1234!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"name":"Seed Admin"}', now(), now(),
   '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444',
   'authenticated', 'authenticated', 'parent@splat-test.local',
   crypt('Test1234!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"name":"Seed Contributor","role":"contributor"}', now(), now(),
   '', '', '', '');

insert into auth.identities
  (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   '{"sub":"11111111-1111-1111-1111-111111111111","email":"contributor@splat-test.local"}',
   'email', now(), now(), now()),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
   '{"sub":"22222222-2222-2222-2222-222222222222","email":"admin@splat-test.local"}',
   'email', now(), now(), now()),
  (gen_random_uuid(), '44444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444',
   '{"sub":"44444444-4444-4444-4444-444444444444","email":"parent@splat-test.local"}',
   'email', now(), now(), now());

-- ============================================================
-- Roles on the auto-created profiles
-- ============================================================
update public.profiles set role = 'contributor', name = 'Seed Contributor'
  where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set role = 'admin',       name = 'Seed Admin'
  where id = '22222222-2222-2222-2222-222222222222';

-- ============================================================
-- Approved tutorial (public library / detail flows)
-- File URLs are placeholders: E2E asserts page rendering, not downloads.
-- ============================================================
insert into public.tutorials
  (id, title, description, difficulty, status, tutorial_pdf_url, toy_photo_url, created_at, reviewed_at)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Seeded Switch-Adapted Bubble Machine',
   'A seeded, approved tutorial used by E2E tests.', 'easy', 'approved',
   'https://placeholder.invalid/tutorial.pdf', 'https://placeholder.invalid/photo.jpg',
   now(), now());

insert into public.tutorial_contributors (tutorial_id, profile_id, role)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'primary');

insert into public.parts (tutorial_id, name, quantity, is_optional, buy_links)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Micro switch', 2, false,
        '[{"label":"Jaycar","url":"https://example.com/switch"}]');

insert into public.tools (tutorial_id, name, is_optional, buy_links)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Soldering iron', false, '[]');

insert into public.stl_files (tutorial_id, filename, file_url)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'mount.stl', 'https://placeholder.invalid/mount.stl');

-- ============================================================
-- Pending tutorial (admin review flow)
-- ============================================================
insert into public.tutorials
  (id, title, description, difficulty, status, tutorial_pdf_url, toy_photo_url)
values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Seeded Pending Plush Toy',
   'A seeded tutorial awaiting admin review.', 'medium', 'pending',
   'https://placeholder.invalid/tutorial2.pdf', 'https://placeholder.invalid/photo2.jpg');

insert into public.tutorial_contributors (tutorial_id, profile_id, role)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'primary');
