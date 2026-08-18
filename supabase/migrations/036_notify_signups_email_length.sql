-- supabase/migrations/036_notify_signups_email_length.sql
--
-- notify_signups.email had no length constraint: the API's EMAIL_RE matches a
-- string of any length, and there is no select policy on this table for anyone
-- to notice an unbounded row landing in it. RFC 5321's 254-character maximum,
-- enforced at the database in case a future write path skips the API check.

alter table public.notify_signups
  add constraint notify_signups_email_length check (char_length(email) <= 254);
