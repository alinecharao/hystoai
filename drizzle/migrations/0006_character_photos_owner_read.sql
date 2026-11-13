DROP POLICY IF EXISTS "character photos readable by signed in" ON storage.objects;
CREATE POLICY "character photos readable by owner" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'character-photos' AND (storage.foldername(name))[1] = (select auth.uid())::text);