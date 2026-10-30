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

-- The previous functions operate on user_id+character_id, a scope that is
-- ambiguous once a character has >1 story. Prevent clients (including stale
-- browser tabs) from invoking those write paths after the new UI is enabled.
REVOKE EXECUTE ON FUNCTION public.append_chat_user_message(uuid,uuid,text) FROM public,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_chat_generation(uuid,uuid) FROM public,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_assistant_regeneration(uuid,uuid) FROM public,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.finish_assistant_regeneration(uuid,uuid,text) FROM public,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.select_assistant_response_version(uuid,uuid) FROM public,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.commit_chat_story_memory(uuid,uuid,text,text,text) FROM public,anon,authenticated;

-- These release functions are safe to retain: both require the exact claim
-- token AND user identity, and they do not select a conversation by character.
-- release_chat_generation(uuid,uuid)
-- release_assistant_regeneration(uuid,uuid)

NOTIFY pgrst,'reload schema';
COMMIT;
