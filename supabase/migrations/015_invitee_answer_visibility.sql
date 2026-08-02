-- supabase/migrations/015_invitee_answer_visibility.sql
-- WHY: "Invitee can answer their invite" (012_tutorial_collaborators.sql) was
--      committed with a WITH CHECK but deliberately no USING clause, to keep
--      an invalid-status write (the invitee trying to set status='pending')
--      failing as a silent zero-row match instead of a hard 42501 — see
--      task-1-fix-round-2-report.md.
--      That decision has a bigger side effect than intended: per Postgres
--      RLS semantics, an UPDATE policy with no USING clause falls back to
--      using its WITH CHECK expression as USING too, evaluated against the
--      OLD row. WITH CHECK requires status in ('accepted', 'declined') —
--      but every real invite starts at status = 'pending'. So the fallback
--      USING makes the OLD row invisible for *any* update the invitee makes,
--      including the legitimate pending -> accepted/declined transition.
--      The accept/decline handshake (routes/collaborator-invites.ts) never
--      worked: every UPDATE silently matches zero rows.
-- HOW: Add back the narrow USING clause the original design (task-1-brief)
--      specified — invited_profile_id = auth.uid(), nothing about status —
--      so the invitee's own pending row is visible to update. WITH CHECK is
--      untouched and still rejects any status other than accepted/declined.
--      This does change the invalid-write failure mode from a silent
--      zero-row match to an explicit 42501 (Postgres' actual behavior for a
--      WITH CHECK violation once the row is visible), which is arguably the
--      more honest failure mode for a security check anyway. The one test
--      that asserted the old silent-failure behavior is updated alongside
--      this migration.
alter policy "Invitee can answer their invite"
  on public.tutorial_collaborator_invites
  using (invited_profile_id = auth.uid());
