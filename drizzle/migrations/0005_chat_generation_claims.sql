-- Hysto: atomic, expiring generation claims for recovery.
-- Apply to the existing Lovable Cloud database only after review.
-- Additive: no existing messages are modified or deleted.

create table if not exists public.chat_generation_claims (
  user_message_id uuid primary key references public.messages(id) on delete cascade,
  user_id uuid not null,
  character_id uuid not null,
  claim_token uuid not null default gen_random_uuid(),
  claimed_at timestamptz not null default now()
);

create index if not exists chat_generation_claims_user_character_idx
  on public.chat_generation_claims (user_id, character_id);

alter table public.chat_generation_claims enable row level security;

-- No direct client access: all operations happen through this security definer function, which validates auth.uid() and message ownership.
revoke all on public.chat_generation_claims from anon, authenticated;

create or replace function public.claim_chat_generation(
  p_user_message_id uuid,
  p_character_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_token uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Serialize claim attempts for this specific turn. This also makes the "is it still the last message?" check stable against other claims.
  perform pg_advisory_xact_lock(hashtextextended(p_user_message_id::text, 0));

  if not exists (
    select 1 from public.messages m
    where m.id = p_user_message_id
      and m.user_id = v_user_id
      and m.character_id = p_character_id
      and m.role = 'user'
      and not exists (
        select 1 from public.messages a
        where a.reply_to_message_id = m.id
      )
      and not exists (
        select 1 from public.messages newer
        where newer.user_id = v_user_id
          and newer.character_id = p_character_id
          and (newer.created_at, newer.id) > (m.created_at, m.id)
      )
  ) then
    return null;
  end if;

  insert into public.chat_generation_claims
    (user_message_id, user_id, character_id)
  values (p_user_message_id, v_user_id, p_character_id)
  on conflict (user_message_id) do update
    set claim_token = gen_random_uuid(),
        claimed_at = now()
    where public.chat_generation_claims.claimed_at < now() - interval '5 minutes'
  returning claim_token into v_token;

  return v_token; -- null means another request owns the unexpired claim
end;
$$;

revoke all on function public.claim_chat_generation(uuid, uuid) from public, anon;
grant execute on function public.claim_chat_generation(uuid, uuid) to authenticated;

-- Release only a claim owned by the authenticated user AND the exact token, so an older request cannot release a newer claimant's lease.
create or replace function public.release_chat_generation(
  p_user_message_id uuid,
  p_claim_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  delete from public.chat_generation_claims
  where user_message_id = p_user_message_id
    and user_id = auth.uid()
    and claim_token = p_claim_token;
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

revoke all on function public.release_chat_generation(uuid, uuid) from public, anon;
grant execute on function public.release_chat_generation(uuid, uuid) to authenticated;

-- This lease prevents overlapping retries for five minutes. The unique reply_to_message_id index remains the final protection against duplicate persisted replies. Application integration is a separate step.