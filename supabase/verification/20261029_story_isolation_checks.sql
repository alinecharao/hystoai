-- PHASE 3B READ-ONLY CHECKS — run AFTER stages 1 and 2 in the ISOLATED DB.
-- No message content, names, secrets, notes, or user identifiers are exposed.
-- Expected: null_story = 0, invalid_links = 0 and RLS enabled=true.
select 'messages' as entity, count(*) as total,
  count(*) filter (where story_id is null) as null_story
  from public.messages
union all select 'assistant_response_versions',count(*),
  count(*) filter(where story_id is null) from public.assistant_response_versions
union all select 'story_memory_notes',count(*),
  count(*) filter(where story_id is null) from public.story_memory_notes
union all select 'story_memories',count(*),
  count(*) filter(where story_id is null) from public.story_memories
union all select 'chat_generation_claims',count(*),
  count(*) filter(where story_id is null) from public.chat_generation_claims
union all select 'assistant_regeneration_claims',count(*),
  count(*) filter(where story_id is null) from public.assistant_regeneration_claims;

select
  (select count(*) from public.stories where is_legacy) as legacy_stories,
  (select count(*) from (
     select distinct user_id,character_id from public.messages
     union select user_id,character_id from public.story_memory_notes
     union select user_id,character_id from public.story_memories
   ) pairs) as legacy_pairs_with_data,
  (select count(*) from public.messages m left join public.stories s on s.id=m.story_id
     where s.id is null or s.user_id<>m.user_id or s.character_id<>m.character_id) as invalid_message_links,
  (select count(*) from public.assistant_response_versions v
     left join public.messages m on m.id=v.assistant_message_id
     where m.id is null or m.story_id<>v.story_id) as invalid_version_links,
  (select count(*) from public.story_memory_notes n
     join public.messages m on m.id=n.anchor_message_id
     where m.story_id<>n.story_id) as invalid_note_links;

select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where relnamespace='public'::regnamespace
  and relname in ('stories','story_memory_checkpoints','messages','story_memory_notes','assistant_response_versions');

select proname, pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p join pg_namespace n on p.pronamespace=n.oid
where n.nspname='public' and p.proname in (
  'append_story_user_message','claim_story_generation','claim_story_regeneration',
  'finish_story_regeneration','select_story_response_version',
  'commit_story_memory_checkpoint','clear_story_messages','delete_story_message'
)
order by proname;

-- Do not count user-visible history as safe until an actual authenticated
-- cross-user/cross-story test has been executed using disposable test accounts.
