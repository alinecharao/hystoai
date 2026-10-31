-- Run only against synthetic accounts in disposable Postgres after the quota migration.
DO $check$
BEGIN
 IF has_table_privilege('authenticated','public.visual_generation_reservations','SELECT')
    OR has_table_privilege('authenticated','public.visual_generation_reservations','INSERT')
 THEN RAISE EXCEPTION 'Client can bypass server quota'; END IF;
 IF NOT has_function_privilege('authenticated','public.reserve_visual_generation(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Authenticated user cannot reserve an image'; END IF;
END
$check$;

SET ROLE authenticated;
SET request.jwt.claim.role='authenticated';
SET request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
DO $check$
BEGIN
 IF NOT public.reserve_visual_generation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')
 OR NOT public.reserve_visual_generation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2')
 OR NOT public.reserve_visual_generation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3')
 THEN RAISE EXCEPTION 'Expected three test reservations'; END IF;
 IF public.reserve_visual_generation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4')
 THEN RAISE EXCEPTION 'Daily user quota bypassed'; END IF;
 IF public.reserve_visual_generation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')
 THEN RAISE EXCEPTION 'Repeated request charged twice'; END IF;
END
$check$;
SET request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
DO $check$
BEGIN
 IF NOT public.reserve_visual_generation('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1')
 THEN RAISE EXCEPTION 'Second user quota should be independent'; END IF;
 IF public.reserve_visual_generation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')
 THEN RAISE EXCEPTION 'Cross-user request ID replay succeeded'; END IF;
END
$check$;
RESET ROLE;
