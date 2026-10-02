-- 119 — a second line on a notification (notification-second-line).
--
-- The reason, when the writer has one: a returned guide's rejection_note, a
-- declined idea's review_note, a declined exchange or print's decline_reason,
-- or the message an exchange notice is about. It goes on the one recipient's
-- row and nowhere else. Writers cut it to 300 (notificationBody) rather than
-- let the CHECK refuse the insert, because every writer logs and moves on —
-- a refused row is a notification nobody ever sees.
--
-- Grants: 013's "Users can mark own notifications read" policy lets a
-- recipient update any column of their own row, and the default table grant
-- covers every column. The API only ever writes read_at, so the member update
-- grant narrows to that one column: nobody rewrites the reason they were sent.
-- INSERT stays as it is — no member insert policy exists (admins and the
-- service role write every row).
--
-- DOWN:
--   grant update on public.notifications to anon, authenticated;
--   alter table public.notifications drop column if exists body;

alter table public.notifications
  add column body text check (body is null or length(body) between 1 and 300);

revoke update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;
