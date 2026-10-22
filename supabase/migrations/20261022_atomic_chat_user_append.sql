-- Serialize new user turns per (user, character) to prevent overlapping pending turns.
-- Additive migration: existing messages are never modified.
create or replace function public.append_chat_user_message(
  p_message_id uuid,
  p_character_id uuid,
  p_content text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_last_role text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_content is null or length(btrim(p_content)) = 0 then
    raise exception 'Empty message';
  end if;

  -- A transaction-level lock makes the latest-turn check and insert atomic
  -- across different client-generated message UUIDs.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || p_character_id::text, 173));

  if not exists (
    select 1 from public.characters c
    where c.id = p_character_id and (c.user_id = v_user_id or c.user_id is null)
  ) then
    raise exception 'Character unavailable';
  end if;

  if exists (
    select 1 from public.messages m
    where m.id = p_message_id
  ) then
    return false;
  end if;

  select m.role into v_last_role
  from public.messages m
  where m.user_id = v_user_id and m.character_id = p_character_id
  order by m.created_at desc, m.id desc
  limit 1;

  if v_last_role = 'user' then
    return false;
  end if;

  insert into public.messages
    (id, client_message_id, character_id, user_id, role, content)
  values
    (p_message_id, p_message_id, p_character_id, v_user_id, 'user', p_content);

  return true;
end;
$$;

revoke all on function public.append_chat_user_message(uuid, uuid, text) from public, anon;
grant execute on function public.append_chat_user_message(uuid, uuid, text) to authenticated;
