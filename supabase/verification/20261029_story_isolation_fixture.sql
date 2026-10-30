-- Synthetic Postgres fixture, NO production data or credentials.
create role authenticated nologin;
create role anon nologin;
create role service_role nologin;
create schema if not exists auth;
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
create function auth.role() returns text language sql stable as $$
 select current_setting('request.jwt.claim.role',true)
$$;
create table auth.users(id uuid primary key);
create table public.characters(
 id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id),name text not null
);
create table public.messages(
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(),
 character_id uuid not null references public.characters(id) on delete cascade,
 role text not null check(role in ('user','assistant')),
 content text not null,created_at timestamptz not null default clock_timestamp(),
 client_message_id text,
 reply_to_message_id uuid references public.messages(id) on delete set null
);
create unique index messages_one_reply_per_user_turn
 on public.messages(reply_to_message_id) where reply_to_message_id is not null;
create table public.story_memories(
 user_id uuid not null references auth.users(id), character_id uuid not null references public.characters(id) on delete cascade,
 summary text not null default '',scene text not null default '',known_facts text not null default '',
 last_processed_message_id uuid,updated_at timestamptz not null default now(),
 source_ids uuid[] not null default '{}',revision bigint not null default 0,
 primary key(user_id,character_id)
);
create table public.story_memory_notes(
 id uuid primary key default gen_random_uuid(), user_id uuid not null, character_id uuid not null,
 anchor_message_id uuid not null,source_message_id uuid references public.messages(id) on delete set null,
 category text not null,body text not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.assistant_response_versions(
 id uuid primary key default gen_random_uuid(),
 assistant_message_id uuid not null references public.messages(id) on delete cascade,
 user_id uuid not null, character_id uuid not null,
 content text not null,is_selected boolean not null default false,
 created_at timestamptz not null default now()
);
create unique index assistant_response_versions_one_selected_idx on public.assistant_response_versions(assistant_message_id) where is_selected;
create table public.chat_generation_claims(
 user_message_id uuid primary key references public.messages(id) on delete cascade,
 user_id uuid not null,character_id uuid not null,
 claim_token uuid not null default gen_random_uuid(),claimed_at timestamptz not null default now()
);
create table public.assistant_regeneration_claims(
 assistant_message_id uuid primary key references public.messages(id) on delete cascade,
 user_id uuid not null,character_id uuid not null,
 claim_token uuid not null default gen_random_uuid(),claimed_at timestamptz not null default now()
);
alter table public.messages enable row level security;
create policy messages_owner on public.messages for all to authenticated
 using (user_id=auth.uid()) with check(user_id=auth.uid());
alter table public.characters enable row level security;
create policy char_read on public.characters for select to authenticated
 using(user_id is null or user_id=auth.uid());
alter table public.story_memory_notes enable row level security;
create policy note_owner on public.story_memory_notes for all to authenticated
 using(user_id=auth.uid()) with check(user_id=auth.uid());
alter table public.assistant_response_versions enable row level security;
create policy versions_owner on public.assistant_response_versions for select to authenticated
 using(user_id=auth.uid());
grant usage on schema public,auth to authenticated;
grant select on public.characters to authenticated;
grant select,insert,update,delete on public.messages to authenticated;
grant select,insert,update,delete on public.story_memory_notes to authenticated;
grant select on public.assistant_response_versions to authenticated;
grant execute on all functions in schema auth to authenticated;
insert into auth.users(id) values
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222');
insert into public.characters(id,user_id,name) values
 ('33333333-3333-4333-8333-333333333333',null,'Personagem público');
insert into public.messages(id,user_id,character_id,role,content) values
 ('44444444-4444-4444-8444-444444444441','11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','user','Conteúdo fictício');
insert into public.messages(id,user_id,character_id,role,content,reply_to_message_id) values
 ('44444444-4444-4444-8444-444444444442','11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','assistant','Resposta fictícia','44444444-4444-4444-8444-444444444441');
insert into public.story_memories(user_id,character_id,summary,last_processed_message_id) values
 ('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','Fato original','44444444-4444-4444-8444-444444444442');
insert into public.story_memory_notes(user_id,character_id,anchor_message_id,category,body) values
 ('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444441','fact','Nota antiga fictícia');
insert into public.assistant_response_versions(assistant_message_id,user_id,character_id,content,is_selected)
 values ('44444444-4444-4444-8444-444444444442','11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','Alternativa fictícia',true);
