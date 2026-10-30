-- Hysto Phase 3B / Stage 1: additive story identity and legacy backfill.
-- REVIEW IN AN ISOLATED CLONE FIRST. DO NOT APPLY IN PRODUCTION UNTIL STAGE 2
-- (story-scoped RPCs and routes) HAS PASSED MULTI-STORY/MULTI-USER TESTS.
-- This migration does NOT delete or rewrite message content, version content,
-- canon, memory text, user identities, or existing message IDs.
begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete restrict,
  title text not null default 'Minha história'
    check (length(btrim(title)) between 1 and 100),
  is_legacy boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (id, user_id, character_id)
);
create unique index if not exists stories_one_legacy_per_owner_character
  on public.stories (user_id, character_id) where is_legacy;
create index if not exists stories_owner_character_activity
  on public.stories (user_id, character_id, updated_at desc, id);

alter table public.stories enable row level security;
drop policy if exists stories_owner_select on public.stories;
create policy stories_owner_select on public.stories
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists stories_owner_insert on public.stories;
create policy stories_owner_insert on public.stories
  for insert to authenticated with check (
    user_id = (select auth.uid()) and is_legacy = false
    and exists (
      select 1 from public.characters c
      where c.id = character_id
        and (c.user_id = (select auth.uid()) or c.user_id is null)
    )
  );
drop policy if exists stories_owner_update on public.stories;
create policy stories_owner_update on public.stories
  for update to authenticated using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.characters c
      where c.id = character_id
        and (c.user_id = (select auth.uid()) or c.user_id is null)
    )
  );
-- Deliberately no direct DELETE permission: removing a story requires a
-- separate, reviewed server operation with explicit conversation ID.
revoke all on public.stories from anon, authenticated;
grant select, insert, update on public.stories to authenticated;

-- Existing one-conversation-per-character records become exactly one
-- legacy story each, including conversations whose only remaining records
-- are saved memory notes or alternative-response records.
insert into public.stories (user_id, character_id, title, is_legacy)
select distinct a.user_id, a.character_id, 'História original', true
from (
  select user_id, character_id from public.messages
  union
  select user_id, character_id from public.story_memories
  union
  select user_id, character_id from public.story_memory_notes
  union
  select user_id, character_id from public.assistant_response_versions
  union
  select user_id, character_id from public.chat_generation_claims
  union
  select user_id, character_id from public.assistant_regeneration_claims
) as a
join public.characters c on c.id = a.character_id
on conflict (user_id, character_id) where is_legacy do nothing;

-- Preserve all legacy rows and attach their existing owner/character.
alter table public.messages add column if not exists story_id uuid;
alter table public.assistant_response_versions add column if not exists story_id uuid;
alter table public.story_memory_notes add column if not exists story_id uuid;
alter table public.chat_generation_claims add column if not exists story_id uuid;
alter table public.assistant_regeneration_claims add column if not exists story_id uuid;
alter table public.story_memories add column if not exists story_id uuid;

update public.messages m set story_id = s.id
  from public.stories s where m.story_id is null and s.is_legacy
  and s.user_id = m.user_id and s.character_id = m.character_id;
update public.assistant_response_versions v set story_id = m.story_id
  from public.messages m where v.story_id is null and v.assistant_message_id = m.id
  and v.user_id = m.user_id and v.character_id = m.character_id;
update public.story_memory_notes n set story_id = m.story_id
  from public.messages m where n.story_id is null and n.anchor_message_id = m.id
  and n.user_id = m.user_id and n.character_id = m.character_id;
update public.chat_generation_claims c set story_id = m.story_id
  from public.messages m where c.story_id is null and c.user_message_id = m.id
  and c.user_id = m.user_id and c.character_id = m.character_id;
update public.assistant_regeneration_claims c set story_id = m.story_id
  from public.messages m where c.story_id is null and c.assistant_message_id = m.id
  and c.user_id = m.user_id and c.character_id = m.character_id;
update public.story_memories m set story_id = s.id
  from public.stories s where m.story_id is null and s.is_legacy
  and s.user_id = m.user_id and s.character_id = m.character_id;

-- Abort the whole transaction if any existing row was not mapped. A migration
-- must never silently discard data to satisfy a new NOT NULL requirement.
do $$
begin
  if exists (select 1 from public.messages where story_id is null)
    or exists (select 1 from public.assistant_response_versions where story_id is null)
    or exists (select 1 from public.story_memory_notes where story_id is null)
    or exists (select 1 from public.chat_generation_claims where story_id is null)
    or exists (select 1 from public.assistant_regeneration_claims where story_id is null)
    or exists (select 1 from public.story_memories where story_id is null)
  then
    raise exception 'Hysto story migration aborted: unmapped legacy records exist';
  end if;
end $$;

-- Existing v1 RPCs omit story_id. Triggers attach their inserts ONLY to the
-- legacy story. New story APIs must always specify and verify story_id.
create or replace function public.hysto_assign_message_story()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if new.story_id is null then
    select s.id into new.story_id from public.stories s
    where s.user_id = new.user_id and s.character_id = new.character_id
      and s.is_legacy limit 1;
  end if;
  if new.story_id is null or not exists (
    select 1 from public.stories s where s.id = new.story_id
      and s.user_id = new.user_id and s.character_id = new.character_id
  ) then
    raise exception 'Story does not belong to this user and character';
  end if;
  return new;
end $$;
drop trigger if exists hysto_messages_story_guard on public.messages;
create trigger hysto_messages_story_guard before insert or update of story_id, user_id, character_id
  on public.messages for each row execute function public.hysto_assign_message_story();

-- Versions and leases inherit the source message's exact story, not an
-- inferred legacy mapping.
create or replace function public.hysto_assign_linked_story()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare
  v_message_id uuid;
  v_story_id uuid;
  v_user_id uuid;
  v_character_id uuid;
begin
  if tg_table_name = 'chat_generation_claims' then
    v_message_id := new.user_message_id;
  else
    v_message_id := new.assistant_message_id;
  end if;
  select m.story_id, m.user_id, m.character_id
  into v_story_id, v_user_id, v_character_id
  from public.messages m where m.id = v_message_id;
  if v_story_id is null
    or v_user_id is distinct from new.user_id
    or v_character_id is distinct from new.character_id
    or (new.story_id is not null and new.story_id <> v_story_id) then
    raise exception 'Linked message belongs to another story';
  end if;
  new.story_id := v_story_id;
  return new;
end $$;
drop trigger if exists hysto_versions_story_guard on public.assistant_response_versions;
create trigger hysto_versions_story_guard before insert or update of story_id, assistant_message_id, user_id, character_id
  on public.assistant_response_versions for each row execute function public.hysto_assign_linked_story();
drop trigger if exists hysto_generation_claim_story_guard on public.chat_generation_claims;
create trigger hysto_generation_claim_story_guard before insert or update of story_id, user_message_id, user_id, character_id
  on public.chat_generation_claims for each row execute function public.hysto_assign_linked_story();
drop trigger if exists hysto_regeneration_claim_story_guard on public.assistant_regeneration_claims;
create trigger hysto_regeneration_claim_story_guard before insert or update of story_id, assistant_message_id, user_id, character_id
  on public.assistant_regeneration_claims for each row execute function public.hysto_assign_linked_story();

create or replace function public.hysto_assign_note_story()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare v_story_id uuid; v_source_story_id uuid;
begin
  select m.story_id into v_story_id from public.messages m
  where m.id = new.anchor_message_id and m.user_id = new.user_id
    and m.character_id = new.character_id;
  if v_story_id is null
    or (new.story_id is not null and new.story_id <> v_story_id) then
    raise exception 'Memory anchor belongs to another story';
  end if;
  if new.source_message_id is not null then
    select m.story_id into v_source_story_id from public.messages m
      where m.id = new.source_message_id and m.user_id = new.user_id
        and m.character_id = new.character_id;
    if v_source_story_id is distinct from v_story_id then
      raise exception 'Memory source belongs to another story';
    end if;
  end if;
  new.story_id := v_story_id;
  return new;
end $$;
drop trigger if exists hysto_note_story_guard on public.story_memory_notes;
create trigger hysto_note_story_guard before insert or update of story_id, anchor_message_id, source_message_id, user_id, character_id
  on public.story_memory_notes for each row execute function public.hysto_assign_note_story();

create or replace function public.hysto_assign_legacy_memory_story()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if new.story_id is null then
    select s.id into new.story_id from public.stories s
      where s.user_id = new.user_id and s.character_id = new.character_id
      and s.is_legacy limit 1;
  end if;
  if new.story_id is null or not exists (
    select 1 from public.stories s where s.id = new.story_id
      and s.user_id = new.user_id and s.character_id = new.character_id
      and s.is_legacy
  ) then
    raise exception 'Legacy memory cannot attach to another story';
  end if;
  return new;
end $$;
drop trigger if exists hysto_legacy_memory_story_guard on public.story_memories;
create trigger hysto_legacy_memory_story_guard before insert or update of story_id, user_id, character_id
  on public.story_memories for each row execute function public.hysto_assign_legacy_memory_story();

alter table public.messages alter column story_id set not null;
alter table public.assistant_response_versions alter column story_id set not null;
alter table public.story_memory_notes alter column story_id set not null;
alter table public.chat_generation_claims alter column story_id set not null;
alter table public.assistant_regeneration_claims alter column story_id set not null;
alter table public.story_memories alter column story_id set not null;

-- Protect the joint identity at the database layer. Existing role/owner
-- policies continue to run; the FK prevents cross-story misassociation.
alter table public.messages
  add constraint messages_story_owner_character_fk
  foreign key (story_id, user_id, character_id)
  references public.stories(id, user_id, character_id) on delete restrict;
alter table public.assistant_response_versions
  add constraint versions_story_owner_character_fk
  foreign key (story_id, user_id, character_id)
  references public.stories(id, user_id, character_id) on delete restrict;
alter table public.story_memory_notes
  add constraint notes_story_owner_character_fk
  foreign key (story_id, user_id, character_id)
  references public.stories(id, user_id, character_id) on delete restrict;
alter table public.chat_generation_claims
  add constraint generation_claims_story_owner_character_fk
  foreign key (story_id, user_id, character_id)
  references public.stories(id, user_id, character_id) on delete restrict;
alter table public.assistant_regeneration_claims
  add constraint regeneration_claims_story_owner_character_fk
  foreign key (story_id, user_id, character_id)
  references public.stories(id, user_id, character_id) on delete restrict;
alter table public.story_memories
  add constraint legacy_memory_story_owner_character_fk
  foreign key (story_id, user_id, character_id)
  references public.stories(id, user_id, character_id) on delete restrict;

create index if not exists messages_story_recent_idx
  on public.messages (user_id, story_id, created_at desc, id desc);
create index if not exists versions_story_idx
  on public.assistant_response_versions (user_id, story_id, assistant_message_id);
create index if not exists curated_notes_story_idx
  on public.story_memory_notes (user_id, story_id, created_at, id);

-- New stories need independent memory checkpoints. The original
-- story_memories PK (user_id, character_id) must remain untouched for v1 RPCs.
create table if not exists public.story_memory_checkpoints (
  story_id uuid primary key,
  user_id uuid not null,
  character_id uuid not null,
  summary text not null default '',
  scene text not null default '',
  known_facts text not null default '',
  last_processed_message_id uuid references public.messages(id) on delete set null,
  revision bigint not null default 0,
  updated_at timestamptz not null default now(),
  foreign key (story_id, user_id, character_id)
    references public.stories(id, user_id, character_id) on delete restrict
);
alter table public.story_memory_checkpoints enable row level security;
drop policy if exists checkpoints_owner_read on public.story_memory_checkpoints;
create policy checkpoints_owner_read on public.story_memory_checkpoints
  for select to authenticated using (user_id = (select auth.uid()));
-- Writing checkpoints will be restricted to the reviewed story-scoped RPCs.
revoke all on public.story_memory_checkpoints from public, anon, authenticated;
grant select on public.story_memory_checkpoints to authenticated;

-- Force immediate failure if any linked row disagrees about ownership.
do $$
begin
  if exists (
    select 1 from public.assistant_response_versions v
    join public.messages m on m.id = v.assistant_message_id
    where v.story_id <> m.story_id
  ) or exists (
    select 1 from public.story_memory_notes n
    join public.messages m on m.id = n.anchor_message_id
    where n.story_id <> m.story_id
  ) then
    raise exception 'Story migration aborted: cross-story dependency detected';
  end if;
end $$;
notify pgrst, 'reload schema';
commit;
