-- 140 — Admins can post in a member thread, labelled as such.
--
-- toy_transaction_messages.kind gains 'admin'. The member insert policy also
-- pins kind = 'user': until now a party could insert a 'system' message
-- through PostgREST with their own JWT, and with 'admin' allowed they could
-- forge a SPLAT admin message the same way. The admin `for all` policy (026)
-- and the service-role client keep writing any kind.
--
-- Deploy order: this must be on hosted before the API that writes 'admin', or
-- every admin message fails the CHECK.
--
-- DOWN:
--   alter table public.toy_transaction_messages drop constraint toy_transaction_messages_kind_check;
--   alter table public.toy_transaction_messages add constraint toy_transaction_messages_kind_check
--     check (kind in ('system', 'user'));
--   (and restore 033's "Parties can message while a toy transaction is open" without `kind = 'user'`)

alter table public.toy_transaction_messages drop constraint toy_transaction_messages_kind_check;
alter table public.toy_transaction_messages add constraint toy_transaction_messages_kind_check
  check (kind in ('system', 'user', 'admin'));

drop policy "Parties can message while a toy transaction is open" on public.toy_transaction_messages;
create policy "Parties can message while a toy transaction is open"
  on public.toy_transaction_messages for insert
  with check (
    sender_id = auth.uid()
    and kind = 'user'
    and public.is_toy_transaction_party(transaction_id)
    and exists (
      select 1 from public.toy_transactions t
      where t.id = transaction_id and t.status in ('requested', 'accepted')
    )
  );
