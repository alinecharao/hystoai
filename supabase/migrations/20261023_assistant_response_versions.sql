-- Hysto: additive, owner-scoped assistant alternatives. No historic messages are rewritten.
-- Install in Lovable Cloud before merging/enabling the response-version UI.

create table if not exists public.assistant_response_versions (
  id uuid primary key default gen_random_uuid(),
  assistant_message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null,
  character_id uuid not null,
  content text not null check (length(btrim(content)) > 0),
  is_selected boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.assistant_response_versions
  add column if not exists is_selected boolean not null default false;
create index if not exists assistant_response_versions_message_created_idx
  on public.assistant_response_versions (assistant_message_id, created_at, id);
create unique index if not exists assistant_response_versions_one_selected_idx
  on public.assistant_response_versions (assistant_message_id) where is_selected;

alter table public.assistant_response_versions enable row level security;
drop policy if exists assistant_versions_owner_read on public.assistant_response_versions;
create policy assistant_versions_owner_read on public.assistant_response_versions
  for select to authenticated
  using (
    user_id = (select auth.uid()) and
    exists (
      select 1 from public.messages m
      where m.id = assistant_message_id and m.user_id = (select auth.uid())
        and m.character_id = assistant_response_versions.character_id and m.role = 'assistant'
    )
  );
revoke all on public.assistant_response_versions from anon, authenticated;
grant select on public.assistant_response_versions to authenticated;

-- A lease is only for an existing final assistant message; it is distinct from
-- the claim used when answering a pending user turn.
create table if not exists public.assistant_regeneration_claims (
  assistant_message_id uuid primary key references public.messages(id) on delete cascade,
  user_id uuid not null,
  character_id uuid not null,
  claim_token uuid not null default gen_random_uuid(),
  claimed_at timestamptz not null default now()
);
create index if not exists assistant_regeneration_claims_conversation_idx
  on public.assistant_regeneration_claims (user_id, character_id, claimed_at);
alter table public.assistant_regeneration_claims enable row level security;
revoke all on public.assistant_regeneration_claims from public, anon, authenticated;

create or replace function public.claim_assistant_regeneration(p_assistant_message_id uuid, p_character_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_token uuid; v_latest uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || p_character_id::text, 173));
  select m.id into v_latest from public.messages m
    where m.user_id = v_uid and m.character_id = p_character_id
    order by m.created_at desc, m.id desc limit 1;
  if v_latest is distinct from p_assistant_message_id or
    not exists (select 1 from public.messages m where m.id = p_assistant_message_id
      and m.user_id = v_uid and m.character_id = p_character_id
      and m.role = 'assistant' and m.reply_to_message_id is not null) then
    return null;
  end if;
  insert into public.assistant_regeneration_claims
    (assistant_message_id, user_id, character_id)
  values (p_assistant_message_id, v_uid, p_character_id)
  on conflict (assistant_message_id) do update set
    claim_token = gen_random_uuid(), claimed_at = now()
    where public.assistant_regeneration_claims.claimed_at < now() - interval '5 minutes'
  returning claim_token into v_token;
  return v_token;
end;
$$;

create or replace function public.release_assistant_regeneration(p_assistant_message_id uuid, p_claim_token uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_count integer;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  delete from public.assistant_regeneration_claims
    where assistant_message_id = p_assistant_message_id
      and user_id = auth.uid() and claim_token = p_claim_token;
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

-- Saving an alternative and selecting it is atomic. If a newer message exists,
-- the reply is not attached to the wrong turn.
create or replace function public.finish_assistant_regeneration(
  p_assistant_message_id uuid, p_claim_token uuid, p_content text
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_character uuid; v_latest uuid; v_version uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_content is null or length(btrim(p_content)) = 0 then raise exception 'Empty response'; end if;
  select c.character_id into v_character from public.assistant_regeneration_claims c
    where c.assistant_message_id = p_assistant_message_id
      and c.user_id = v_uid and c.claim_token = p_claim_token
      and c.claimed_at >= now() - interval '5 minutes';
  if v_character is null then return null; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || v_character::text, 173));
  select m.id into v_latest from public.messages m where m.user_id = v_uid
    and m.character_id = v_character order by m.created_at desc, m.id desc limit 1;
  if v_latest is distinct from p_assistant_message_id then return null; end if;

  update public.assistant_response_versions set is_selected = false
    where assistant_message_id = p_assistant_message_id and user_id = v_uid and is_selected;
  insert into public.assistant_response_versions
    (assistant_message_id, user_id, character_id, content, is_selected)
  values (p_assistant_message_id, v_uid, v_character, p_content, true)
  returning id into v_version;
  delete from public.assistant_regeneration_claims where assistant_message_id = p_assistant_message_id
    and user_id = v_uid and claim_token = p_claim_token;
  return v_version;
end;
$$;

-- NULL means the immutable original in messages.content.
create or replace function public.select_assistant_response_version(
  p_assistant_message_id uuid, p_version_id uuid
) returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_character uuid; v_latest uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select m.character_id into v_character from public.messages m
    where m.id = p_assistant_message_id and m.user_id = v_uid
      and m.role = 'assistant';
  if v_character is null then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || v_character::text, 173));
  select m.id into v_latest from public.messages m
    where m.user_id = v_uid and m.character_id = v_character
    order by m.created_at desc, m.id desc limit 1;
  if v_latest is distinct from p_assistant_message_id then return false; end if;
  if exists (select 1 from public.assistant_regeneration_claims c
    where c.assistant_message_id = p_assistant_message_id
      and c.claimed_at >= now() - interval '5 minutes') then return false; end if;
  if p_version_id is not null and not exists (
    select 1 from public.assistant_response_versions v
    where v.id = p_version_id and v.assistant_message_id = p_assistant_message_id
      and v.user_id = v_uid and v.character_id = v_character) then return false; end if;
  update public.assistant_response_versions set is_selected = false
    where assistant_message_id = p_assistant_message_id and user_id = v_uid and is_selected;
  if p_version_id is not null then
    update public.assistant_response_versions set is_selected = true
      where id = p_version_id and assistant_message_id = p_assistant_message_id and user_id = v_uid;
  end if;
  return true;
end;
$$;

-- Amend the already-installed atomic append RPC to respect active regenerations.
-- All existing messages and its previous checks remain unchanged.
create or replace function public.append_chat_user_message(
  p_message_id uuid, p_character_id uuid, p_content text
) returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_last_role text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_content is null or length(btrim(p_content)) = 0 then raise exception 'Empty message'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || p_character_id::text, 173));
  if not exists (select 1 from public.characters c
    where c.id = p_character_id and (c.user_id = v_uid or c.user_id is null)) then
    raise exception 'Character unavailable';
  end if;
  if exists (select 1 from public.assistant_regeneration_claims c
    where c.user_id = v_uid and c.character_id = p_character_id
      and c.claimed_at >= now() - interval '5 minutes') then return false; end if;
  if exists (select 1 from public.messages m where m.id = p_message_id) then return false; end if;
  select m.role into v_last_role from public.messages m
    where m.user_id = v_uid and m.character_id = p_character_id
    order by m.created_at desc, m.id desc limit 1;
  if v_last_role = 'user' then return false; end if;
  insert into public.messages (id, client_message_id, character_id, user_id, role, content)
    values (p_message_id, p_message_id, p_character_id, v_uid, 'user', p_content);
  return true;
end;
$$;

revoke all on function public.claim_assistant_regeneration(uuid, uuid) from public, anon;
revoke all on function public.release_assistant_regeneration(uuid, uuid) from public, anon;
revoke all on function public.finish_assistant_regeneration(uuid, uuid, text) from public, anon;
revoke all on function public.select_assistant_response_version(uuid, uuid) from public, anon;
grant execute on function public.claim_assistant_regeneration(uuid, uuid) to authenticated;
grant execute on function public.release_assistant_regeneration(uuid, uuid) to authenticated;
grant execute on function public.finish_assistant_regeneration(uuid, uuid, text) to authenticated;
grant execute on function public.select_assistant_response_version(uuid, uuid) to authenticated;
revoke all on function public.append_chat_user_message(uuid, uuid, text) from public, anon;
grant execute on function public.append_chat_user_message(uuid, uuid, text) to authenticated;

-- Ensure the REST API discovers the new RPC signatures after a manual SQL Editor run.
notify pgrst, 'reload schema';
