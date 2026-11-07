-- Disposable Postgres only; tests schema and access without real secrets.
DO $test$
DECLARE blocked boolean := false;
BEGIN
  IF has_table_privilege('authenticated','public.story_encrypted_payloads','SELECT')
     OR has_table_privilege('authenticated','public.story_encrypted_payloads','INSERT')
  THEN RAISE EXCEPTION 'Client can read or write encrypted storage'; END IF;
  IF NOT has_table_privilege('service_role','public.story_encrypted_payloads','SELECT,INSERT,UPDATE,DELETE')
  THEN RAISE EXCEPTION 'Trusted server role cannot use encrypted storage'; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class
    WHERE oid='public.story_encrypted_payloads'::regclass)
  THEN RAISE EXCEPTION 'RLS disabled'; END IF;
END
$test$;

INSERT INTO public.story_encrypted_payloads
  (entity_type,entity_id,user_id,story_id,character_id,ciphertext)
VALUES (
  'message','77777777-7777-4777-8777-777777777772',
  '11111111-1111-4111-8111-111111111111',
  '66666666-6666-4666-8666-666666666666',
  '33333333-3333-4333-8333-333333333333',
  'hystoenc:v1:AAAAAAAAAAAAAAAA:BBBBBBBBBBBBBBBBBBBBBB:CCCC'
);

DO $test$
DECLARE rejected boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.story_encrypted_payloads
      (entity_type,entity_id,user_id,story_id,character_id,ciphertext)
    VALUES (
      'message','88888888-8888-4888-8888-888888888882',
      '11111111-1111-4111-8111-111111111111',
      '55555555-5555-4555-8555-555555555555',
      '33333333-3333-4333-8333-333333333333',
      'hystoenc:v1:AAAAAAAAAAAAAAAA:BBBBBBBBBBBBBBBBBBBBBB:CCCC'
    );
  EXCEPTION WHEN others THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Ciphertext linked to wrong story'; END IF;
END
$test$;

DELETE FROM public.messages WHERE id='77777777-7777-4777-8777-777777777772';
DO $test$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.story_encrypted_payloads
    WHERE entity_type='message'
      AND entity_id='77777777-7777-4777-8777-777777777772'
  ) THEN RAISE EXCEPTION 'Ciphertext survived deletion of its message'; END IF;
END
$test$;
