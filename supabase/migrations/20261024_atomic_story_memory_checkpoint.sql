-- Hysto: commit narrative memory only for the most recent persisted assistant turn.
-- Additive migration: does not alter existing messages or memory rows.
-- Enabled only when HYSTO_ATOMIC_MEMORY_CHECKPOINT=true in the server environment.
create or replace function public.commit_chat_story_memory(
  p_character_id uuid,
  p_assistant_message_id uuid,
  p_summary text,
  p_scene text,
  p_known_facts text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_latest_id uuid;
  v_latest_role text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_summary is null or p_scene is null or p_known_facts is null
    or length(p_summary) > 2400 or length(p_scene) > 2400 or length(p_known_facts) > 2400 then
    raise exception 'Invalid story memory fields';
  end if;

  -- Serialize memory commits with user-message appends and reply selections.
  -- The actual row order is checked after obtaining this transaction lock.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || p_character_id::text, 173));
  select m.id, m.role into v_latest_id, v_latest_role
    from public.messages m
    where m.user_id = v_uid and m.character_id = p_character_id
    order by m.created_at desc, m.id desc
    limit 1;
  if v_latest_id is distinct from p_assistant_message_id or v_latest_role is distinct from 'assistant' then
    return false;
  end if;

  -- Background memory of the immutable original response cannot overwrite
  -- continuity after an alternative response has been selected.
  if exists (
    select 1 from public.assistant_response_versions v
    where v.assistant_message_id = p_assistant_message_id and v.user_id = v_uid
      and v.character_id = p_character_id and v.is_selected
  ) then return false; end if;

  insert into public.story_memories
    (user_id, character_id, summary, scene, known_facts,
     last_processed_message_id, updated_at)
  values
    (v_uid, p_character_id, p_summary, p_scene, p_known_facts,
     p_assistant_message_id, now())
  on conflict (user_id, character_id) do update set
    summary = excluded.summary,
    scene = excluded.scene,
    known_facts = excluded.known_facts,
    last_processed_message_id = excluded.last_processed_message_id,
    updated_at = excluded.updated_at;
  return true;
end;
$$;
revoke all on function public.commit_chat_story_memory(uuid, uuid, text, text, text) from public, anon;
grant execute on function public.commit_chat_story_memory(uuid, uuid, text, text, text) to authenticated;
notify pgrst, 'reload schema';
