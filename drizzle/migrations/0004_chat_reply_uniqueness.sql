-- Hysto: add an explicit link between assistant replies and user turns.
-- Apply ONLY to the Lovable Cloud database after reviewing the backup.
-- Additive migration: no existing rows are deleted or rewritten.
alter table public.messages
  add column if not exists reply_to_message_id uuid;

-- Existing assistant messages remain unlinked; this is intentional.
-- The FK guarantees the referenced user turn exists (role verified by server).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'messages_reply_to_message_id_fkey'
      and conrelid = 'public.messages'::regclass
  ) then
    alter table public.messages
      add constraint messages_reply_to_message_id_fkey
      foreign key (reply_to_message_id) references public.messages(id)
      on delete set null;
  end if;
end $$;

-- At most one newly persisted assistant reply per user message,
-- including simultaneous requests from different tabs.
create unique index if not exists messages_one_reply_per_user_turn
  on public.messages(reply_to_message_id)
  where reply_to_message_id is not null;

-- Only assistant rows may reference a user turn.
alter table public.messages
  drop constraint if exists messages_reply_link_assistant_only;
alter table public.messages
  add constraint messages_reply_link_assistant_only
  check (reply_to_message_id is null or role = 'assistant');

-- No RLS changes required. The server must verify that the referenced
-- user message belongs to the authenticated user and current character.
-- IMPORTANT: this prevents duplicate saved replies, not concurrent model
-- calls. A separate atomic claim is needed before enabling retry.
