-- Test new-story separation with fabricated users and stories.
set role authenticated;
set request.jwt.claim.role='authenticated';
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';

do $$
declare v_count int;
begin
  select count(*) into v_count from public.messages where story_id is null;
  if v_count <> 0 then raise exception 'Legacy backfill failed'; end if;
  if not exists (select 1 from public.story_memory_checkpoints where summary='Fato original')
    then raise exception 'Legacy memory was not preserved'; end if;
end $$;

insert into public.stories(id,user_id,character_id,title,is_legacy) values
 ('55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','História A',false),
 ('66666666-6666-4666-8666-666666666666','11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','História B',false);

do $$
begin
 if not public.append_story_user_message(
   '77777777-7777-4777-8777-777777777771',
   '55555555-5555-4555-8555-555555555555','Fala A'
 ) then raise exception 'Cannot append A'; end if;
 if not public.append_story_user_message(
   '77777777-7777-4777-8777-777777777772',
   '66666666-6666-4666-8666-666666666666','Fala B'
 ) then raise exception 'Cannot append B'; end if;
 if (select count(*) from public.messages where story_id='55555555-5555-4555-8555-555555555555')<>1
   or (select count(*) from public.messages where story_id='66666666-6666-4666-8666-666666666666')<>1
 then raise exception 'Cross-story message leak'; end if;
end $$;

insert into public.messages(id,user_id,character_id,story_id,role,content,reply_to_message_id)
 values
 ('88888888-8888-4888-8888-888888888881','11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','55555555-5555-4555-8555-555555555555','assistant','Resposta A','77777777-7777-4777-8777-777777777771'),
 ('88888888-8888-4888-8888-888888888882','11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','66666666-6666-4666-8666-666666666666','assistant','Resposta B','77777777-7777-4777-8777-777777777772');

do $$
declare token uuid; version_id uuid;
begin
 token:=public.claim_story_regeneration('88888888-8888-4888-8888-888888888881','55555555-5555-4555-8555-555555555555');
 if token is null then raise exception 'Could not claim response A'; end if;
 version_id:=public.finish_story_regeneration('88888888-8888-4888-8888-888888888881',token,'Versão A2');
 if version_id is null then raise exception 'Could not finish response A'; end if;
 if exists(select 1 from public.assistant_response_versions where story_id='66666666-6666-4666-8666-666666666666')
  then raise exception 'Alternative crossed stories'; end if;
 if public.select_story_response_version(
   '66666666-6666-4666-8666-666666666666',
   '88888888-8888-4888-8888-888888888881',version_id)
 then raise exception 'Foreign story selected a version'; end if;
end $$;

-- A note anchored in A must not import knowledge from a source in B.
do $
declare blocked boolean := false;
begin
  begin
    insert into public.story_memory_notes
      (user_id,character_id,anchor_message_id,source_message_id,category,body)
    values (
      '11111111-1111-4111-8111-111111111111',
      '33333333-3333-4333-8333-333333333333',
      '77777777-7777-4777-8777-777777777771',
      '77777777-7777-4777-8777-777777777772',
      'private','Fonte de outra história'
    );
  exception when others then blocked:=true;
  end;
  if not blocked then raise exception 'Cross-story memory source was accepted'; end if;
end $;

do $
begin
 if not public.clear_story_messages('55555555-5555-4555-8555-555555555555')
 then raise exception 'Could not clear A'; end if;
 if exists(select 1 from public.messages where story_id='55555555-5555-4555-8555-555555555555')
 then raise exception 'A was not cleared'; end if;
 if (select count(*) from public.messages where story_id='66666666-6666-4666-8666-666666666666')<>2
 then raise exception 'B changed while clearing A'; end if;
 if (select count(*) from public.messages m join public.stories s on s.id=m.story_id where s.is_legacy)<>2
 then raise exception 'Original legacy messages were modified'; end if;
end $$;

set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
do $$
begin
 if exists(select 1 from public.stories where id='55555555-5555-4555-8555-555555555555')
 then raise exception 'RLS failed: other user sees story A'; end if;
 if public.clear_story_messages('66666666-6666-4666-8666-666666666666')
 then raise exception 'User 2 could clear user 1 story'; end if;
end $$;
-- The legacy server can still start a first chat for a new user/character
-- after the additive migration; its trigger creates the legacy story safely.
insert into public.messages(id,user_id,character_id,role,content)
 values (
 '99999999-9999-4999-8999-999999999991',
 '22222222-2222-4222-8222-222222222222',
 '33333333-3333-4333-8333-333333333333',
 'user','Primeiro envio legado do usuário 2'
 );
do $
begin
 if not exists (
   select 1 from public.stories s join public.messages m on m.story_id=s.id
   where m.id='99999999-9999-4999-8999-999999999991'
     and s.user_id='22222222-2222-4222-8222-222222222222' and s.is_legacy
 ) then raise exception 'Legacy trigger failed to create first conversation'; end if;
end $;
reset role;
