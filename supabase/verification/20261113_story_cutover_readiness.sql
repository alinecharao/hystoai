-- Hysto Stage 2 -> Stage 3 readiness gate (READ ONLY).
-- Run in an isolated clone AFTER applying stages 1 and 2, BEFORE stage 3.
-- Passing is NOT permission to migrate production: a verified restore from
-- a separate backup, real-account isolation tests and coordinated flags are
-- mandatory operational prerequisites.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '30s';

DO $ready$
DECLARE
  v_table_name text;
  function_signature text;
  active_claims bigint;
BEGIN
  FOREACH v_table_name IN ARRAY ARRAY[
    'stories','story_memory_checkpoints','messages',
    'assistant_response_versions','story_memory_notes',
    'story_memories','chat_generation_claims',
    'assistant_regeneration_claims'
  ] LOOP
    IF to_regclass('public.' || v_table_name) IS NULL THEN
      RAISE EXCEPTION 'Cutover blocked: missing table %',v_table_name;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relname=v_table_name
         AND c.relkind='r' AND c.relrowsecurity
    ) THEN RAISE EXCEPTION 'Cutover blocked: RLS disabled for %',v_table_name; END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name IN (
        'messages','assistant_response_versions','story_memory_notes',
        'story_memories','chat_generation_claims','assistant_regeneration_claims'
      )
      AND column_name='story_id' AND is_nullable='YES'
  ) OR (
    SELECT count(*) FROM information_schema.columns
    WHERE table_schema='public' AND column_name='story_id'
      AND table_name IN (
        'messages','assistant_response_versions','story_memory_notes',
        'story_memories','chat_generation_claims','assistant_regeneration_claims'
      )
  ) <> 6 THEN RAISE EXCEPTION 'Cutover blocked: missing/nullable story_id'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.messages m
    LEFT JOIN public.stories s ON s.id=m.story_id
    WHERE s.id IS NULL OR s.user_id<>m.user_id OR s.character_id<>m.character_id
  ) OR EXISTS (
    SELECT 1 FROM public.assistant_response_versions v
    LEFT JOIN public.messages m ON m.id=v.assistant_message_id
    WHERE m.id IS NULL OR m.story_id<>v.story_id OR m.user_id<>v.user_id
       OR m.character_id<>v.character_id OR m.role<>'assistant'
  ) OR EXISTS (
    SELECT 1 FROM public.story_memory_notes n
    LEFT JOIN public.messages m ON m.id=n.anchor_message_id
    WHERE m.id IS NULL OR m.story_id<>n.story_id OR m.user_id<>n.user_id
       OR m.character_id<>n.character_id
  ) OR EXISTS (
    SELECT 1 FROM public.story_memories m
    LEFT JOIN public.stories s ON s.id=m.story_id
    WHERE s.id IS NULL OR NOT s.is_legacy
      OR s.user_id<>m.user_id OR s.character_id<>m.character_id
  ) THEN
    RAISE EXCEPTION 'Cutover blocked: inconsistent legacy story association';
  END IF;

  -- These APIs must be callable before obsolete writers are revoked.
  FOREACH function_signature IN ARRAY ARRAY[
    'append_story_user_message(uuid,uuid,text)',
    'claim_story_generation(uuid,uuid)',
    'claim_story_regeneration(uuid,uuid)',
    'finish_story_regeneration(uuid,uuid,text)',
    'select_story_response_version(uuid,uuid,uuid)',
    'commit_story_memory_checkpoint(uuid,uuid,text,text,text)',
    'clear_story_messages(uuid)',
    'delete_story_message(uuid,uuid)'
  ] LOOP
    IF to_regprocedure('public.' || function_signature) IS NULL
      OR NOT has_function_privilege('authenticated','public.' || function_signature,'EXECUTE')
    THEN RAISE EXCEPTION 'Cutover blocked: story RPC unavailable: %',function_signature; END IF;
  END LOOP;

  IF NOT has_table_privilege('authenticated','public.stories','SELECT')
    OR NOT has_table_privilege('authenticated','public.story_memory_checkpoints','SELECT')
    OR has_table_privilege('authenticated','public.stories','DELETE')
    OR has_table_privilege('authenticated','public.story_memory_checkpoints','UPDATE')
  THEN RAISE EXCEPTION 'Cutover blocked: unsafe table privileges'; END IF;

  SELECT
    (SELECT count(*) FROM public.chat_generation_claims
      WHERE claimed_at >= now()-interval '5 minutes')
    + (SELECT count(*) FROM public.assistant_regeneration_claims
      WHERE claimed_at >= now()-interval '5 minutes')
    INTO active_claims;
  IF active_claims>0 THEN
    RAISE EXCEPTION 'Cutover blocked: % active generation claim(s)',active_claims;
  END IF;

  RAISE NOTICE 'Hysto schema and permissions READY for isolated cutover testing. Production still requires a verified restore and authorized release.';
END
$ready$;
ROLLBACK;
