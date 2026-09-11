-- Skoolk: room state is changed only by validated, transactional RPCs.
begin;
create schema if not exists skoolk_private;
revoke all on schema skoolk_private from public;
grant usage on schema skoolk_private to authenticated;

create table public.skoolk_books (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(char_length(title) between 1 and 160), author text not null check(char_length(author) between 1 and 160),
 synopsis text not null default '' check(char_length(synopsis)<=12000), cover_url text check(cover_url is null or cover_url ~ '^https://'),
 created_at timestamptz not null default now()
);
create index skoolk_books_owner_idx on public.skoolk_books(owner_id);
create table public.skoolk_rooms (
 id uuid primary key default gen_random_uuid(), code text not null unique check(code ~ '^[A-Z0-9]{6}$'),
 host_id uuid not null references auth.users(id) on delete cascade,
 book_title text not null check(char_length(book_title) between 1 and 160), book_author text not null check(char_length(book_author) between 1 and 160),
 synopsis text not null default '' check(char_length(synopsis)<=12000), cover_url text check(cover_url is null or cover_url ~ '^https://'),
 chapter_start integer not null check(chapter_start between 1 and 2000), chapter_end integer not null check(chapter_end between chapter_start and 2000),
 question_count integer not null check(question_count between 3 and 12), current_question integer not null default 0 check(current_question>=0),
 phase text not null default 'lobby' check(phase in ('lobby','discussion','rating','finished')),
 version integer not null default 0, generation_token uuid, generation_started_at timestamptz, generation_count integer not null default 0,
 created_at timestamptz not null default now(), finished_at timestamptz
);
create index skoolk_rooms_host_idx on public.skoolk_rooms(host_id,created_at desc);
create table public.skoolk_members (
 room_id uuid not null references public.skoolk_rooms(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 nickname text not null check(char_length(trim(nickname)) between 2 and 24), avatar integer not null default 0 check(avatar between 0 and 5),
 joined_at timestamptz not null default now(), primary key(room_id,user_id)
);
create unique index skoolk_members_nickname_idx on public.skoolk_members(room_id,lower(nickname));
create index skoolk_members_user_idx on public.skoolk_members(user_id);
create table public.skoolk_questions (
 id uuid primary key default gen_random_uuid(), room_id uuid not null references public.skoolk_rooms(id) on delete cascade,
 position integer not null check(position between 0 and 11), category text not null check(char_length(category) between 1 and 50),
 prompt text not null check(char_length(prompt) between 10 and 600), hint text not null check(char_length(hint)<=1000),
 unique(room_id,position), unique(room_id,id)
);
create table public.skoolk_ratings (
 room_id uuid not null, question_id uuid not null, user_id uuid not null,
 stars smallint not null check(stars between 1 and 5), created_at timestamptz not null default now(),
 primary key(question_id,user_id),
 foreign key(room_id,question_id) references public.skoolk_questions(room_id,id) on delete cascade,
 foreign key(room_id,user_id) references public.skoolk_members(room_id,user_id) on delete cascade
);
create index skoolk_ratings_room_idx on public.skoolk_ratings(room_id,user_id);
create index skoolk_ratings_user_idx on public.skoolk_ratings(user_id);
create table public.skoolk_feedback (
 room_id uuid not null, user_id uuid not null, book_stars smallint not null check(book_stars between 1 and 5),
 discussion_stars smallint not null check(discussion_stars between 1 and 5), created_at timestamptz not null default now(),
 primary key(room_id,user_id), foreign key(room_id,user_id) references public.skoolk_members(room_id,user_id) on delete cascade
);
create index skoolk_feedback_user_idx on public.skoolk_feedback(user_id);
create table skoolk_private.join_limits (
 user_id uuid primary key references auth.users(id) on delete cascade, window_start timestamptz not null default now(), attempts integer not null default 0
);
alter table skoolk_private.join_limits enable row level security;

create function skoolk_private.is_member(p_room uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.skoolk_members m where m.room_id=p_room and m.user_id=(select auth.uid()));
$$;
create function skoolk_private.is_host(p_room uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.skoolk_rooms r where r.id=p_room and r.host_id=(select auth.uid()));
$$;
create function skoolk_private.permanent_user() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from auth.users u where u.id=(select auth.uid()) and u.is_anonymous=false and u.email_confirmed_at is not null);
$$;

alter table public.skoolk_books enable row level security;
alter table public.skoolk_rooms enable row level security;
alter table public.skoolk_members enable row level security;
alter table public.skoolk_questions enable row level security;
alter table public.skoolk_ratings enable row level security;
alter table public.skoolk_feedback enable row level security;
revoke all on public.skoolk_books, public.skoolk_rooms, public.skoolk_members, public.skoolk_questions, public.skoolk_ratings, public.skoolk_feedback from anon, authenticated;
grant select on public.skoolk_books, public.skoolk_rooms, public.skoolk_members, public.skoolk_questions, public.skoolk_ratings, public.skoolk_feedback to authenticated;
grant insert,update,delete on public.skoolk_books to authenticated;
create policy books_select on public.skoolk_books for select to authenticated using(owner_id=(select auth.uid()));
create policy books_insert on public.skoolk_books for insert to authenticated with check(owner_id=(select auth.uid()) and (select skoolk_private.permanent_user()));
create policy books_update on public.skoolk_books for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()) and (select skoolk_private.permanent_user()));
create policy books_delete on public.skoolk_books for delete to authenticated using(owner_id=(select auth.uid()));
create policy rooms_select on public.skoolk_rooms for select to authenticated using(host_id=(select auth.uid()) or skoolk_private.is_member(id));
create policy members_select on public.skoolk_members for select to authenticated using(skoolk_private.is_member(room_id));
create policy questions_select on public.skoolk_questions for select to authenticated using(skoolk_private.is_member(room_id));
create policy ratings_select on public.skoolk_ratings for select to authenticated using(skoolk_private.is_member(room_id));
create policy feedback_select on public.skoolk_feedback for select to authenticated using(user_id=(select auth.uid()) or skoolk_private.is_host(room_id));

create function skoolk_private.create_room(p_title text,p_author text,p_synopsis text,p_cover_url text,p_chapter_start integer,p_chapter_end integer,p_count integer,p_nickname text)
returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid; new_code text; alphabet constant text:='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i integer;
begin
 if not skoolk_private.permanent_user() then raise exception 'Entre com uma conta confirmada de anfitriã.'; end if;
 if (select count(*) from public.skoolk_rooms where host_id=auth.uid() and phase<>'finished')>=10 then raise exception 'Você já tem 10 encontros abertos. Finalize um deles primeiro.'; end if;
 -- Serialize creation per host; random codes have a unique database constraint.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 for attempt in 1..10 loop
  new_code:='';
  for i in 1..6 loop new_code:=new_code||substr(alphabet,1+floor(random()*length(alphabet))::integer,1); end loop;
  begin
   insert into public.skoolk_rooms(code,host_id,book_title,book_author,synopsis,cover_url,chapter_start,chapter_end,question_count)
   values(new_code,auth.uid(),trim(p_title),trim(p_author),trim(p_synopsis),p_cover_url,p_chapter_start,p_chapter_end,p_count) returning id into rid;
   exit;
  exception when unique_violation then continue;
  end;
 end loop;
 if rid is null then raise exception 'Não foi possível gerar o código. Tente novamente.'; end if;
 insert into public.skoolk_members(room_id,user_id,nickname,avatar) values(rid,auth.uid(),trim(p_nickname),0);
 return rid;
end; $$;

create function skoolk_private.join_room(p_code text,p_nickname text,p_avatar integer) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.skoolk_rooms; lim skoolk_private.join_limits;
begin
 if auth.uid() is null then raise exception 'Entre novamente para participar.'; end if;
 insert into skoolk_private.join_limits(user_id,attempts) values(auth.uid(),1)
 on conflict(user_id) do update set attempts=case when skoolk_private.join_limits.window_start<now()-interval '1 minute' then 1 else skoolk_private.join_limits.attempts+1 end,
 window_start=case when skoolk_private.join_limits.window_start<now()-interval '1 minute' then now() else skoolk_private.join_limits.window_start end returning * into lim;
 -- Return NULL instead of raising to preserve the attempt counter on wrong codes.
 if lim.attempts>12 then return null; end if;
 select * into r from public.skoolk_rooms where code=upper(trim(p_code)) for update;
 if r.id is null then return null; end if;
 if exists(select 1 from public.skoolk_members where room_id=r.id and user_id=auth.uid()) then return r.id; end if;
 if r.phase='finished' or r.created_at<now()-interval '7 days' then return null; end if;
 if (select count(*) from public.skoolk_members where room_id=r.id)>=100 then raise exception 'Esta sala já tem 100 participantes.'; end if;
 begin
  insert into public.skoolk_members(room_id,user_id,nickname,avatar) values(r.id,auth.uid(),trim(p_nickname),p_avatar);
 exception when unique_violation then raise exception 'Esse nome já está na sala. Escolha outro apelido.';
 end;
 return r.id;
end; $$;

create function skoolk_private.advance_room(p_room uuid,p_version integer) returns void language plpgsql security definer set search_path='' as $$
declare r public.skoolk_rooms; n integer;
begin
 select * into r from public.skoolk_rooms where id=p_room for update;
 if auth.uid() is null or r.host_id is distinct from auth.uid() then raise exception 'Apenas a anfitriã pode conduzir o encontro.'; end if;
 if r.version<>p_version then raise exception 'O encontro já avançou. A tela será atualizada.'; end if;
 select count(*) into n from public.skoolk_questions where room_id=r.id;
 if r.phase='lobby' and n<>r.question_count then raise exception 'Prepare as perguntas antes de começar.'; end if;
 if r.phase='finished' then return; end if;
 update public.skoolk_rooms set
 phase=case when r.phase='lobby' then 'discussion' when r.phase='discussion' then 'rating' when r.current_question+1>=n then 'finished' else 'discussion' end,
 current_question=case when r.phase='rating' and r.current_question+1<n then r.current_question+1 else r.current_question end,
 finished_at=case when r.phase='rating' and r.current_question+1>=n then now() else null end,
 version=version+1 where id=r.id;
end; $$;

create function skoolk_private.rate_question(p_room uuid,p_question uuid,p_stars integer) returns void language plpgsql security definer set search_path='' as $$
declare r public.skoolk_rooms;
begin
 if not skoolk_private.is_member(p_room) then raise exception 'Você não participa desta sala.'; end if;
 select * into r from public.skoolk_rooms where id=p_room for share;
 if r.phase<>'rating' or not exists(select 1 from public.skoolk_questions where id=p_question and room_id=p_room and position=r.current_question) then raise exception 'A avaliação desta pergunta já foi encerrada.'; end if;
 if p_stars not between 1 and 5 then raise exception 'Escolha de 1 a 5 estrelas.'; end if;
 insert into public.skoolk_ratings(room_id,question_id,user_id,stars) values(p_room,p_question,auth.uid(),p_stars)
 on conflict(question_id,user_id) do nothing;
end; $$;

create function skoolk_private.submit_feedback(p_room uuid,p_book integer,p_discussion integer) returns void language plpgsql security definer set search_path='' as $$
begin
 if not skoolk_private.is_member(p_room) then raise exception 'Você não participa desta sala.'; end if;
 if not exists(select 1 from public.skoolk_rooms where id=p_room and phase='finished') then raise exception 'O encontro ainda está em andamento.'; end if;
 insert into public.skoolk_feedback(room_id,user_id,book_stars,discussion_stars) values(p_room,auth.uid(),p_book,p_discussion) on conflict(room_id,user_id) do nothing;
end; $$;

create function skoolk_private.begin_generation(p_room uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.skoolk_rooms; token uuid:=gen_random_uuid();
begin
 select * into r from public.skoolk_rooms where id=p_room for update;
 if auth.uid() is null or r.host_id is distinct from auth.uid() then raise exception 'Apenas a anfitriã pode gerar perguntas.'; end if;
 if r.phase<>'lobby' then raise exception 'O encontro já começou.'; end if;
 if r.generation_started_at>now()-interval '90 seconds' then raise exception 'As perguntas já estão sendo preparadas. Aguarde um instante.'; end if;
 if r.generation_count>=5 then raise exception 'O limite de geração deste encontro foi atingido.'; end if;
 if exists(select 1 from public.skoolk_questions where room_id=r.id) then raise exception 'As perguntas deste encontro já estão prontas.'; end if;
 update public.skoolk_rooms set generation_token=token,generation_started_at=now(),generation_count=generation_count+1 where id=r.id;
 return token;
end; $$;
create function skoolk_private.publish_questions(p_room uuid,p_token uuid,p_questions jsonb) returns void language plpgsql security definer set search_path='' as $$
declare r public.skoolk_rooms;
begin
 select * into r from public.skoolk_rooms where id=p_room for update;
 if auth.uid() is null or r.host_id is distinct from auth.uid() then raise exception 'Apenas a anfitriã pode preparar perguntas.'; end if;
 if r.phase<>'lobby' or r.generation_token is distinct from p_token or p_token is null then raise exception 'A preparação expirou. Tente novamente.'; end if;
 if jsonb_typeof(p_questions)<>'array' or jsonb_array_length(p_questions)<>r.question_count then raise exception 'A IA retornou uma quantidade inválida de perguntas.'; end if;
 insert into public.skoolk_questions(room_id,position,category,prompt,hint)
 select r.id, ordinality-1, value->>'category', value->>'prompt', value->>'hint' from jsonb_array_elements(p_questions) with ordinality;
 update public.skoolk_rooms set generation_token=null,generation_started_at=null,version=version+1 where id=r.id;
end; $$;
create function skoolk_private.cancel_generation(p_room uuid,p_token uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not skoolk_private.is_host(p_room) then raise exception 'Acesso negado.'; end if;
 update public.skoolk_rooms set generation_token=null,generation_started_at=null where id=p_room and generation_token=p_token;
end; $$;

-- Exposed wrappers use invoker rights; privileged implementations live outside the Data API.
create function public.skoolk_create_room(p_title text,p_author text,p_synopsis text,p_cover_url text,p_chapter_start integer,p_chapter_end integer,p_count integer,p_nickname text) returns uuid language sql security invoker set search_path='' as $$ select skoolk_private.create_room(p_title,p_author,p_synopsis,p_cover_url,p_chapter_start,p_chapter_end,p_count,p_nickname); $$;
create function public.skoolk_join_room(p_code text,p_nickname text,p_avatar integer) returns uuid language sql security invoker set search_path='' as $$ select skoolk_private.join_room(p_code,p_nickname,p_avatar); $$;
create function public.skoolk_advance_room(p_room uuid,p_version integer) returns void language sql security invoker set search_path='' as $$ select skoolk_private.advance_room(p_room,p_version); $$;
create function public.skoolk_rate_question(p_room uuid,p_question uuid,p_stars integer) returns void language sql security invoker set search_path='' as $$ select skoolk_private.rate_question(p_room,p_question,p_stars); $$;
create function public.skoolk_submit_feedback(p_room uuid,p_book integer,p_discussion integer) returns void language sql security invoker set search_path='' as $$ select skoolk_private.submit_feedback(p_room,p_book,p_discussion); $$;
create function public.skoolk_begin_generation(p_room uuid) returns uuid language sql security invoker set search_path='' as $$ select skoolk_private.begin_generation(p_room); $$;
create function public.skoolk_publish_questions(p_room uuid,p_token uuid,p_questions jsonb) returns void language sql security invoker set search_path='' as $$ select skoolk_private.publish_questions(p_room,p_token,p_questions); $$;
create function public.skoolk_cancel_generation(p_room uuid,p_token uuid) returns void language sql security invoker set search_path='' as $$ select skoolk_private.cancel_generation(p_room,p_token); $$;

revoke all on all functions in schema skoolk_private from public, anon;
grant execute on all functions in schema skoolk_private to authenticated;
do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'skoolk_%' loop
 execute format('revoke all on function %s from public, anon',f.signature);
 execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end $$;
alter publication supabase_realtime add table public.skoolk_rooms,public.skoolk_members,public.skoolk_questions,public.skoolk_ratings,public.skoolk_feedback;
commit;
