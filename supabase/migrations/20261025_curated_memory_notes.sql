-- Hysto: user-curated, zero-AI memory notes. Additive; does not alter existing story_memories.
-- Apply to a TEST Lovable Cloud DB before enabling in production.
create table if not exists public.story_memory_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  anchor_message_id uuid not null,
  category text not null check (category in ('fact', 'timeline', 'knowledge', 'private')),
  body text not null check (length(btrim(body)) between 1 and 280),
  source_message_id uuid null references public.messages(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists story_memory_notes_scope_idx
  on public.story_memory_notes(user_id, character_id, anchor_message_id, created_at, id);
alter table public.story_memory_notes enable row level security;

-- Scope all actions to a real message owned by the same user/character.
-- When the first conversation message is gone, stale notes cannot be reused
-- in a newly started conversation for the same character.
drop policy if exists story_memory_notes_owner_read on public.story_memory_notes;
create policy story_memory_notes_owner_read on public.story_memory_notes
  for select to authenticated using (
    user_id = (select auth.uid()) and exists (
      select 1 from public.messages m
      where m.id = anchor_message_id and m.user_id = (select auth.uid())
        and m.character_id = story_memory_notes.character_id
    )
  );
drop policy if exists story_memory_notes_owner_insert on public.story_memory_notes;
create policy story_memory_notes_owner_insert on public.story_memory_notes
  for insert to authenticated with check (
    user_id = (select auth.uid()) and exists (
      select 1 from public.messages m
      where m.id = anchor_message_id and m.user_id = (select auth.uid())
        and m.character_id = story_memory_notes.character_id
    ) and (
      source_message_id is null or exists (
        select 1 from public.messages m
        where m.id = source_message_id and m.user_id = (select auth.uid())
          and m.character_id = story_memory_notes.character_id
      )
    )
  );
drop policy if exists story_memory_notes_owner_update on public.story_memory_notes;
create policy story_memory_notes_owner_update on public.story_memory_notes
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid()) and exists (
      select 1 from public.messages m
      where m.id = anchor_message_id and m.user_id = (select auth.uid())
        and m.character_id = story_memory_notes.character_id
    ) and (
      source_message_id is null or exists (
        select 1 from public.messages m
        where m.id = source_message_id and m.user_id = (select auth.uid())
          and m.character_id = story_memory_notes.character_id
      )
    )
  );
drop policy if exists story_memory_notes_owner_delete on public.story_memory_notes;
create policy story_memory_notes_owner_delete on public.story_memory_notes
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.story_memory_notes from anon;
grant select, insert, update, delete on public.story_memory_notes to authenticated;
notify pgrst, 'reload schema';
