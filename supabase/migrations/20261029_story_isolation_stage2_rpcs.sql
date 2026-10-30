-- Hysto Phase 3B / Stage 2: story-scoped RPCs.
-- Requires Stage 1 in an isolated test DB.
-- Does NOT replace or remove any legacy function signature.
begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';

create or replace function public.append_story_user_message(
  p_message_id uuid, p_story_id uuid, p_content text
) returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_char uuid; v_last_role text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_content is null or length(btrim(p_content)) = 0 or length(p_content) > 50000
    then raise exception 'Invalid message'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || p_story_id::text, 173));
  select s.character_id into v_char from public.stories s
    join public.characters c on c.id = s.character_id
    where s.id = p_story_id and s.user_id = v_uid and s.archived_at is null
      and (c.user_id = v_uid or c.user_id is null);
  if v_char is null then return false; end if;
  if exists (select 1 from public.messages m where m.id = p_message_id) then return false; end if;
  if exists (select 1 from public.assistant_regeneration_claims c
    where c.user_id = v_uid and c.story_id = p_story_id
      and c.claimed_at >= now() - interval '5 minutes') then return false; end if;
  select m.role into v_last_role from public.messages m
    where m.user_id = v_uid and m.story_id = p_story_id
    order by m.created_at desc,m.id desc limit 1;
  if v_last_role = 'user' then return false; end if;
  insert into public.messages (id, client_message_id, user_id, character_id,
      story_id, role, content)
  values (p_message_id, p_message_id::text, v_uid, v_char, p_story_id, 'user', p_content);
  update public.stories s set updated_at = now()
    where s.id = p_story_id and s.user_id = v_uid;
  return true;
end $$;

create or replace function public.claim_story_generation(
  p_user_message_id uuid, p_story_id uuid
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_token uuid; v_char uuid; v_latest uuid; v_role text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || p_story_id::text, 173));
  select s.character_id into v_char from public.stories s
    where s.id = p_story_id and s.user_id = v_uid and s.archived_at is null;
  if v_char is null then return null; end if;
  select m.id,m.role into v_latest,v_role from public.messages m
    where m.user_id = v_uid and m.story_id = p_story_id
    order by m.created_at desc,m.id desc limit 1;
  if v_latest is distinct from p_user_message_id or v_role is distinct from 'user'
    or exists(select 1 from public.messages m where m.reply_to_message_id = p_user_message_id)
  then return null; end if;
  insert into public.chat_generation_claims
    (user_message_id,user_id,character_id,story_id)
  values (p_user_message_id,v_uid,v_char,p_story_id)
  on conflict (user_message_id) do update
    set claim_token = gen_random_uuid(), claimed_at = now()
    where public.chat_generation_claims.claimed_at < now() - interval '5 minutes'
  returning claim_token into v_token;
  return v_token;
end $$;

create or replace function public.claim_story_regeneration(
  p_assistant_message_id uuid, p_story_id uuid
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_char uuid; v_latest uuid; v_token uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || p_story_id::text, 173));
  select s.character_id into v_char from public.stories s
    where s.id = p_story_id and s.user_id = v_uid and s.archived_at is null;
  if v_char is null then return null; end if;
  select m.id into v_latest from public.messages m where m.user_id = v_uid
    and m.story_id = p_story_id order by m.created_at desc,m.id desc limit 1;
  if v_latest is distinct from p_assistant_message_id
    or not exists (select 1 from public.messages m where m.id = p_assistant_message_id
      and m.user_id = v_uid and m.story_id = p_story_id
      and m.role = 'assistant' and m.reply_to_message_id is not null)
  then return null; end if;
  insert into public.assistant_regeneration_claims
    (assistant_message_id,user_id,character_id,story_id)
  values (p_assistant_message_id,v_uid,v_char,p_story_id)
  on conflict (assistant_message_id) do update
    set claim_token = gen_random_uuid(), claimed_at = now()
    where public.assistant_regeneration_claims.claimed_at < now() - interval '5 minutes'
  returning claim_token into v_token;
  return v_token;
end $$;

create or replace function public.finish_story_regeneration(
  p_assistant_message_id uuid, p_claim_token uuid, p_content text
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_char uuid; v_story uuid; v_latest uuid; v_version uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_content is null or length(btrim(p_content)) = 0 then raise exception 'Empty response'; end if;
  select c.story_id,c.character_id into v_story,v_char
    from public.assistant_regeneration_claims c
    where c.assistant_message_id = p_assistant_message_id
      and c.user_id = v_uid and c.claim_token = p_claim_token
      and c.claimed_at >= now() - interval '5 minutes';
  if v_story is null then return null; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || v_story::text, 173));
  -- The lease could have expired and been replaced while acquiring the lock.
  -- Recheck its exact token and expiry inside the same transaction.
  if not exists (
    select 1 from public.assistant_regeneration_claims c
    where c.assistant_message_id=p_assistant_message_id
      and c.user_id=v_uid and c.story_id=v_story
      and c.claim_token=p_claim_token
      and c.claimed_at >= now()-interval '5 minutes'
  ) then return null; end if;
  select m.id into v_latest from public.messages m where m.user_id = v_uid
    and m.story_id = v_story order by m.created_at desc,m.id desc limit 1;
  if v_latest is distinct from p_assistant_message_id then return null; end if;
  update public.assistant_response_versions set is_selected = false
    where assistant_message_id = p_assistant_message_id and user_id = v_uid
      and story_id = v_story and is_selected;
  insert into public.assistant_response_versions
    (assistant_message_id,user_id,character_id,story_id,content,is_selected)
  values (p_assistant_message_id,v_uid,v_char,v_story,p_content,true)
  returning id into v_version;
  delete from public.assistant_regeneration_claims
    where assistant_message_id = p_assistant_message_id and user_id = v_uid
      and story_id = v_story and claim_token = p_claim_token;
  return v_version;
end $$;

create or replace function public.select_story_response_version(
  p_story_id uuid,p_assistant_message_id uuid,p_version_id uuid
) returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_latest uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || p_story_id::text, 173));
  if not exists (select 1 from public.stories s
    where s.id = p_story_id and s.user_id = v_uid and s.archived_at is null)
  then return false; end if;
  select m.id into v_latest from public.messages m
    where m.user_id = v_uid and m.story_id = p_story_id
    order by m.created_at desc,m.id desc limit 1;
  if v_latest is distinct from p_assistant_message_id
    or not exists (select 1 from public.messages m where m.id = p_assistant_message_id
      and m.user_id = v_uid and m.story_id = p_story_id
      and m.role = 'assistant' and m.reply_to_message_id is not null)
    or exists (select 1 from public.assistant_regeneration_claims c
      where c.assistant_message_id = p_assistant_message_id
        and c.story_id = p_story_id and c.claimed_at >= now() - interval '5 minutes')
  then return false; end if;
  if p_version_id is not null and not exists (
    select 1 from public.assistant_response_versions v
    where v.id = p_version_id and v.assistant_message_id = p_assistant_message_id
      and v.user_id = v_uid and v.story_id = p_story_id
  ) then return false; end if;
  update public.assistant_response_versions set is_selected = false
    where assistant_message_id = p_assistant_message_id and user_id = v_uid
      and story_id = p_story_id and is_selected;
  if p_version_id is not null then
    update public.assistant_response_versions set is_selected = true
      where id = p_version_id and assistant_message_id = p_assistant_message_id
        and user_id = v_uid and story_id = p_story_id;
  end if;
  return true;
end $$;

create or replace function public.commit_story_memory_checkpoint(
  p_story_id uuid,p_assistant_message_id uuid,
  p_summary text,p_scene text,p_known_facts text
) returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_char uuid; v_latest uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_summary is null or p_scene is null or p_known_facts is null or
    length(p_summary)>2400 or length(p_scene)>2400 or length(p_known_facts)>2400
  then raise exception 'Invalid memory fields'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || p_story_id::text, 173));
  select s.character_id into v_char from public.stories s
    where s.id = p_story_id and s.user_id = v_uid and s.archived_at is null;
  if v_char is null then return false; end if;
  select m.id into v_latest from public.messages m where m.user_id = v_uid
    and m.story_id = p_story_id and m.role = 'assistant'
    order by m.created_at desc,m.id desc limit 1;
  if v_latest is distinct from p_assistant_message_id or exists(
    select 1 from public.messages m where m.user_id = v_uid and m.story_id = p_story_id
      and (m.created_at,m.id) > (
        select a.created_at,a.id from public.messages a where a.id = p_assistant_message_id
      )
  ) or exists(
    select 1 from public.assistant_response_versions v
    where v.assistant_message_id = p_assistant_message_id and v.story_id = p_story_id
      and v.is_selected
  ) then return false; end if;
  insert into public.story_memory_checkpoints
    (story_id,user_id,character_id,summary,scene,known_facts,last_processed_message_id)
    values (p_story_id,v_uid,v_char,p_summary,p_scene,p_known_facts,p_assistant_message_id)
  on conflict (story_id) do update set
    summary=excluded.summary,scene=excluded.scene,
    known_facts=excluded.known_facts,last_processed_message_id=excluded.last_processed_message_id,
    revision=public.story_memory_checkpoints.revision+1,updated_at=now();
  return true;
end $$;

create or replace function public.clear_story_messages(p_story_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || p_story_id::text, 173));
  if not exists (select 1 from public.stories s where s.id = p_story_id
    and s.user_id = v_uid and s.archived_at is null) then return false; end if;
  if exists(select 1 from public.assistant_regeneration_claims c
    where c.story_id = p_story_id and c.user_id=v_uid and c.claimed_at >= now()-interval '5 minutes')
  or exists(select 1 from public.chat_generation_claims c
    where c.story_id = p_story_id and c.user_id=v_uid and c.claimed_at >= now()-interval '5 minutes')
  then return false; end if;
  delete from public.story_memory_notes where story_id=p_story_id and user_id=v_uid;
  delete from public.story_memory_checkpoints where story_id=p_story_id and user_id=v_uid;
  delete from public.messages where story_id=p_story_id and user_id=v_uid;
  update public.stories set updated_at=now() where id=p_story_id and user_id=v_uid;
  return true;
end $$;

create or replace function public.delete_story_message(p_story_id uuid,p_message_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_count int;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || p_story_id::text, 173));
  if not exists (select 1 from public.stories s where s.id=p_story_id
    and s.user_id=v_uid and s.archived_at is null) then return false; end if;
  if exists (select 1 from public.assistant_regeneration_claims c
    where c.story_id=p_story_id and c.user_id=v_uid and c.claimed_at>=now()-interval '5 minutes')
  or exists (select 1 from public.chat_generation_claims c
    where c.story_id=p_story_id and c.user_id=v_uid and c.claimed_at>=now()-interval '5 minutes')
  then return false; end if;
  delete from public.messages where id=p_message_id and story_id=p_story_id and user_id=v_uid;
  get diagnostics v_count=row_count;
  if v_count>0 then update public.stories set updated_at=now()
    where id=p_story_id and user_id=v_uid; end if;
  return v_count=1;
end $$;

revoke all on function public.append_story_user_message(uuid,uuid,text) from public,anon;
revoke all on function public.claim_story_generation(uuid,uuid) from public,anon;
revoke all on function public.claim_story_regeneration(uuid,uuid) from public,anon;
revoke all on function public.finish_story_regeneration(uuid,uuid,text) from public,anon;
revoke all on function public.select_story_response_version(uuid,uuid,uuid) from public,anon;
revoke all on function public.commit_story_memory_checkpoint(uuid,uuid,text,text,text) from public,anon;
revoke all on function public.clear_story_messages(uuid) from public,anon;
revoke all on function public.delete_story_message(uuid,uuid) from public,anon;
grant execute on function public.append_story_user_message(uuid,uuid,text) to authenticated;
grant execute on function public.claim_story_generation(uuid,uuid) to authenticated;
grant execute on function public.claim_story_regeneration(uuid,uuid) to authenticated;
grant execute on function public.finish_story_regeneration(uuid,uuid,text) to authenticated;
grant execute on function public.select_story_response_version(uuid,uuid,uuid) to authenticated;
grant execute on function public.commit_story_memory_checkpoint(uuid,uuid,text,text,text) to authenticated;
grant execute on function public.clear_story_messages(uuid) to authenticated;
grant execute on function public.delete_story_message(uuid,uuid) to authenticated;

notify pgrst,'reload schema';
commit;
