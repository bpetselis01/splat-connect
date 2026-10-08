-- ============================================================
-- 131 · The Deleted member placeholder, readable by Auth
-- ============================================================
-- 083 inserted the placeholder by hand. Auth scans every user row into Go
-- types and fails the whole listing on one it cannot read, so while this row
-- existed the dashboard's Users page and the test cleanup script both failed
-- ("Database error finding users"). Two things it could not read:
--   · banned_until 'infinity': a far date does the same job;
--   · NULL token columns: Auth expects '' where it did not set one.

update auth.users
set
  banned_until = case when banned_until = 'infinity' then '9999-12-31 00:00:00+00' else banned_until end,
  confirmation_token = coalesce(confirmation_token, ''),
  recovery_token = coalesce(recovery_token, ''),
  email_change = coalesce(email_change, ''),
  email_change_token_new = coalesce(email_change_token_new, '')
where id = '00000000-0000-4000-8000-00000000dead';
