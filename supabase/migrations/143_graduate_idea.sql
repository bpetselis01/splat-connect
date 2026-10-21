-- 143 — graduate_idea(): graduating a challenge as one transaction.
--
-- The API did the claim, the tutorial, the link-back, the contributors, the
-- notifications and the thread message as six separate calls, so a failure
-- partway left a graduated idea with no guide or a guide with no contributors,
-- and an author who had also joined their own challenge failed the contributor
-- insert on the (tutorial_id, profile_id) key every time. One function means
-- all of it lands or none of it does.
--
-- Returns the new tutorial's id, or null when the idea is not a challenge any
-- more (already graduated, withdrawn, a question): the caller answers 409.
-- The author is credited once, as primary, and told once. Removed participants
-- are neither credited nor told.
--
-- SECURITY DEFINER, service role only: the admin route calls it through the
-- admin client after checking the caller is an admin.
--
-- DOWN:
--   drop function if exists public.graduate_idea(uuid);

create function public.graduate_idea(p_idea_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_idea record;
  v_tutorial_id uuid;
begin
  update public.toy_ideas
     set status = 'graduated', updated_at = now()
   where id = p_idea_id and status = 'challenge'
   returning author_id, title, summary into v_idea;
  if not found then
    return null;
  end if;

  insert into public.tutorials (title, description, status, difficulty)
  values (v_idea.title, v_idea.summary, 'draft', 'medium')
  returning id into v_tutorial_id;

  update public.toy_ideas set tutorial_id = v_tutorial_id where id = p_idea_id;

  insert into public.tutorial_contributors (tutorial_id, profile_id, role)
  values (v_tutorial_id, v_idea.author_id, 'primary');
  insert into public.tutorial_contributors (tutorial_id, profile_id, role)
  select v_tutorial_id, profile_id, 'collaborator'
    from public.toy_idea_participants
   where idea_id = p_idea_id and removed_at is null and profile_id <> v_idea.author_id;

  insert into public.notifications (recipient_id, type, idea_id, actor_name)
  select recipient, 'idea_graduated', p_idea_id, 'SPLAT'
    from (
      select v_idea.author_id as recipient
      union
      select profile_id from public.toy_idea_participants
       where idea_id = p_idea_id and removed_at is null
    ) r;

  insert into public.toy_idea_messages (idea_id, sender_id, kind, body)
  values (p_idea_id, v_idea.author_id, 'system', 'This challenge became a draft guide.');

  return v_tutorial_id;
end;
$$;

revoke execute on function public.graduate_idea(uuid) from public, anon, authenticated;
grant execute on function public.graduate_idea(uuid) to service_role;
