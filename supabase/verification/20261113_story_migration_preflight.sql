-- Hysto stage-1 migration preflight (READ ONLY).
-- Run on an isolated copy of the legacy database BEFORE stage 1.
-- It does not contain, export, modify, or print private conversation text.
-- A stale/deleted memory checkpoint is a WARNING, not a destructive repair.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '30s';

DO $preflight$
DECLARE
  required_table text;
  stale_memory_anchors bigint;
BEGIN
  FOREACH required_table IN ARRAY ARRAY[
    'characters','messages','story_memories','story_memory_notes',
    'assistant_response_versions','chat_generation_claims',
    'assistant_regeneration_claims'
  ] LOOP
    IF to_regclass('public.' || required_table) IS NULL THEN
      RAISE EXCEPTION 'Hysto migration preflight: missing legacy table %', required_table;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='story_memories'
      AND column_name='revision' AND data_type='bigint'
  ) THEN
    RAISE EXCEPTION 'Hysto migration preflight: legacy memory revision column is missing';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.messages m LEFT JOIN public.characters c
      ON c.id=m.character_id
    WHERE c.id IS NULL OR (c.user_id IS NOT NULL AND c.user_id<>m.user_id)
  ) THEN RAISE EXCEPTION 'Hysto migration preflight: message owner/character mismatch'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.assistant_response_versions v
    LEFT JOIN public.messages m ON m.id=v.assistant_message_id
    WHERE m.id IS NULL OR m.user_id<>v.user_id
       OR m.character_id<>v.character_id OR m.role<>'assistant'
  ) THEN RAISE EXCEPTION 'Hysto migration preflight: invalid response-version reference'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.story_memory_notes n
    LEFT JOIN public.messages m ON m.id=n.anchor_message_id
    WHERE m.id IS NULL OR m.user_id<>n.user_id OR m.character_id<>n.character_id
  ) THEN RAISE EXCEPTION 'Hysto migration preflight: invalid memory-note anchor'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.story_memory_notes n
    LEFT JOIN public.messages m ON m.id=n.source_message_id
    WHERE n.source_message_id IS NOT NULL
      AND (m.id IS NULL OR m.user_id<>n.user_id OR m.character_id<>n.character_id)
  ) THEN RAISE EXCEPTION 'Hysto migration preflight: invalid memory-note source'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.story_memories s LEFT JOIN public.characters c
      ON c.id=s.character_id
    WHERE c.id IS NULL OR (c.user_id IS NOT NULL AND c.user_id<>s.user_id)
  ) THEN RAISE EXCEPTION 'Hysto migration preflight: legacy memory owner mismatch'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.chat_generation_claims c
    LEFT JOIN public.messages m ON m.id=c.user_message_id
    WHERE m.id IS NULL OR m.user_id<>c.user_id OR m.character_id<>c.character_id
      OR m.role<>'user'
  ) THEN RAISE EXCEPTION 'Hysto migration preflight: invalid generation lease'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.assistant_regeneration_claims c
    LEFT JOIN public.messages m ON m.id=c.assistant_message_id
    WHERE m.id IS NULL OR m.user_id<>c.user_id OR m.character_id<>c.character_id
      OR m.role<>'assistant'
  ) THEN RAISE EXCEPTION 'Hysto migration preflight: invalid regeneration lease'; END IF;

  SELECT count(*) INTO stale_memory_anchors FROM public.story_memories s
    LEFT JOIN public.messages m
      ON m.id=s.last_processed_message_id
     AND m.user_id=s.user_id
     AND m.character_id=s.character_id
     AND m.role='assistant'
    WHERE s.last_processed_message_id IS NOT NULL AND m.id IS NULL;
  IF stale_memory_anchors > 0 THEN
    RAISE NOTICE 'Hysto preflight: % stale memory checkpoint(s); original IDs are preserved, new checkpoint pointers will be NULL',stale_memory_anchors;
  END IF;

  RAISE NOTICE 'Hysto legacy preflight PASSED (read-only). This does not authorize production cutover.';
END
$preflight$;
ROLLBACK;
