-- Stage 3: run ONLY when switching the real application to /api/story-chat.
-- Do NOT apply while the old /api/chat is serving writes.
-- Stages 1/2 must already be applied and story-scoped routes tested.
-- Read-only legacy queries and token-scoped lease releases are preserved.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- Verify that all modern APIs exist BEFORE revoking any legacy permission.
DO $guard$
DECLARE required text;
BEGIN
  FOREACH required IN ARRAY ARRAY[
    'append_story_user_message(uuid,uuid,text)',
    'claim_story_generation(uuid,uuid)',
    'claim_story_regeneration(uuid,uuid)',
    'finish_story_regeneration(uuid,uuid,text)',
    'select_story_response_version(uuid,uuid,uuid)',
    'commit_story_memory_checkpoint(uuid,uuid,text,text,text)',
    'clear_story_messages(uuid)',
    'delete_story_message(uuid,uuid)'
  ] LOOP
    IF to_regprocedure('public.' || required) IS NULL THEN
      RAISE EXCEPTION 'Missing story-scoped RPC: %',required;
    END IF;
  END LOOP;
END
$guard$;

-- Legacy installations differ: some have an older memory RPC, others
-- do not. Revoke the signatures that actually exist; a missing optional
-- function must NOT abort cutover and leave all old writers accessible.
-- Each signature is a fixed literal below, never derived from request input.
DO $legacy$
DECLARE signature text;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'append_chat_user_message(uuid,uuid,text)',
    'claim_chat_generation(uuid,uuid)',
    'claim_assistant_regeneration(uuid,uuid)',
    'finish_assistant_regeneration(uuid,uuid,text)',
    'select_assistant_response_version(uuid,uuid)',
    'commit_chat_story_memory(uuid,uuid,text,text,text)'
  ] LOOP
    IF to_regprocedure('public.' || signature) IS NOT NULL THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', signature);
    END IF;
  END LOOP;
END
$legacy$;

-- These release functions are safe to retain: both require the exact claim
-- token AND user identity, and they do not select a conversation by character.
-- release_chat_generation(uuid,uuid)
-- release_assistant_regeneration(uuid,uuid)

NOTIFY pgrst,'reload schema';
COMMIT;
