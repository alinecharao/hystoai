-- Additive foundation for non-destructive alternative assistant replies.
-- Do not activate response regeneration until the application is integrated and tested.
create table if not exists public.assistant_response_versions (
  id uuid primary key default gen_random_uuid(),
  assistant_message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null,
  character_id uuid not null,
  content text not null check (length(btrim(content)) > 0),
  created_at timestamptz not null default now(),
  constraint assistant_response_versions_unique_id_message unique (id, assistant_message_id)
);

create index if not exists assistant_response_versions_message_created_idx
  on public.assistant_response_versions (assistant_message_id, created_at, id);

alter table public.assistant_response_versions enable row level security;

-- Read access only to the owner of the parent assistant message.
drop policy if exists assistant_versions_owner_read on public.assistant_response_versions;
create policy assistant_versions_owner_read on public.assistant_response_versions
  for select to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.messages m
      where m.id = assistant_message_id
        and m.user_id = (select auth.uid())
        and m.character_id = assistant_response_versions.character_id
        and m.role = 'assistant'
    )
  );

-- Client cannot insert/update/delete alternatives directly. Future server RPC
-- must verify parent ownership, generation claims, and timeline consistency.
revoke insert, update, delete on public.assistant_response_versions from anon, authenticated;
grant select on public.assistant_response_versions to authenticated;
