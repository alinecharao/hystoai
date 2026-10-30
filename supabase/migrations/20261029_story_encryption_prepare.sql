-- Preparatory only: DOES NOT encrypt legacy rows or activate encryption.
-- Requires story-isolation migrations. Run exclusively on a tested clone.
BEGIN;
CREATE TABLE IF NOT EXISTS public.story_encrypted_payloads (
  entity_type text NOT NULL CHECK(entity_type IN
    ('message','assistant_version','manual_note',
     'checkpoint_summary','checkpoint_scene','checkpoint_facts')),
  entity_id uuid NOT NULL,
  user_id uuid NOT NULL,
  story_id uuid NOT NULL,
  character_id uuid NOT NULL,
  ciphertext text NOT NULL CHECK(
    length(ciphertext) BETWEEN 30 AND 200000
    AND ciphertext LIKE 'hystoenc:v1:%'),
  key_version smallint NOT NULL DEFAULT 1 CHECK(key_version=1),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_type,entity_id),
  FOREIGN KEY(story_id,user_id,character_id)
    REFERENCES public.stories(id,user_id,character_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS story_encrypted_payload_story_idx
  ON public.story_encrypted_payloads(user_id,story_id,entity_type);
ALTER TABLE public.story_encrypted_payloads ENABLE ROW LEVEL SECURITY;
-- No client-facing policies. A dedicated trusted server gateway must be used.
REVOKE ALL ON public.story_encrypted_payloads FROM public,anon,authenticated;
CREATE OR REPLACE FUNCTION public.hysto_verify_encrypted_payload()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $guard$
BEGIN
  IF new.entity_type='message' THEN
    IF NOT EXISTS (SELECT 1 FROM public.messages m
      WHERE m.id=new.entity_id AND m.story_id=new.story_id
        AND m.user_id=new.user_id AND m.character_id=new.character_id)
      THEN RAISE EXCEPTION 'Invalid encrypted message source'; END IF;
  ELSIF new.entity_type='assistant_version' THEN
    IF NOT EXISTS (SELECT 1 FROM public.assistant_response_versions v
      WHERE v.id=new.entity_id AND v.story_id=new.story_id
        AND v.user_id=new.user_id AND v.character_id=new.character_id)
      THEN RAISE EXCEPTION 'Invalid encrypted version source'; END IF;
  ELSIF new.entity_type='manual_note' THEN
    IF NOT EXISTS (SELECT 1 FROM public.story_memory_notes n
      WHERE n.id=new.entity_id AND n.story_id=new.story_id
        AND n.user_id=new.user_id AND n.character_id=new.character_id)
      THEN RAISE EXCEPTION 'Invalid encrypted note source'; END IF;
  ELSE
    IF new.entity_id<>new.story_id OR NOT EXISTS (
      SELECT 1 FROM public.story_memory_checkpoints k
      WHERE k.story_id=new.story_id AND k.user_id=new.user_id
        AND k.character_id=new.character_id)
      THEN RAISE EXCEPTION 'Invalid encrypted checkpoint'; END IF;
  END IF;
  RETURN new;
END
$guard$;
DROP TRIGGER IF EXISTS hysto_verify_encrypted_payload_guard
  ON public.story_encrypted_payloads;
CREATE TRIGGER hysto_verify_encrypted_payload_guard
  BEFORE INSERT OR UPDATE ON public.story_encrypted_payloads
  FOR EACH ROW EXECUTE FUNCTION public.hysto_verify_encrypted_payload();
NOTIFY pgrst,'reload schema';
COMMIT;
