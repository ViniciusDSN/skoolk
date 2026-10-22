begin;

alter table public.skoolk_rooms add column if not exists question_plan jsonb not null default '[]'::jsonb;

alter table public.skoolk_rooms add constraint skoolk_rooms_question_plan_check
  check (jsonb_typeof(question_plan) = 'array' and jsonb_array_length(question_plan) <= question_count);

drop function if exists public.skoolk_create_room(text,text,text,text,integer,integer,integer,text);
drop function if exists skoolk_private.create_room(text,text,text,text,integer,integer,integer,text);

create function skoolk_private.create_room(p_title text,p_author text,p_synopsis text,p_cover_url text,p_chapter_start integer,p_chapter_end integer,p_count integer,p_nickname text,p_plan jsonb default '[]'::jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid; new_code text; alphabet constant text:='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i integer;
begin
 if not skoolk_private.permanent_user() then raise exception 'Entre com uma conta confirmada de anfitriã.'; end if;
 if jsonb_typeof(p_plan)<>'array' then raise exception 'O plano de perguntas precisa ser uma lista.'; end if;
 if jsonb_array_length(p_plan)>p_count then raise exception 'O plano tem mais itens do que perguntas.'; end if;
 if exists(select 1 from jsonb_array_elements(p_plan) e
   where jsonb_typeof(e)<>'object'
      or (e->>'topico' is not null and e->>'topico' not in ('personagens','enredo','temas','ambientacao','narrativa','leitor'))
      or (e->>'momento' is not null and e->>'momento' not in ('comeco','meio','desfecho','todo')))
 then raise exception 'Tópico ou momento inválido no plano de perguntas.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if (select count(*) from public.skoolk_rooms where host_id=auth.uid() and phase<>'finished')>=10 then raise exception 'Você já tem 10 encontros abertos. Finalize um deles primeiro.'; end if;
 for attempt in 1..10 loop
  new_code:='';
  for i in 1..6 loop new_code:=new_code||substr(alphabet,1+floor(random()*length(alphabet))::integer,1); end loop;
  begin
   insert into public.skoolk_rooms(code,host_id,book_title,book_author,synopsis,cover_url,chapter_start,chapter_end,question_count,question_plan)
   values(new_code,auth.uid(),trim(p_title),trim(p_author),trim(p_synopsis),p_cover_url,p_chapter_start,p_chapter_end,p_count,p_plan) returning id into rid;
   exit;
  exception when unique_violation then continue;
  end;
 end loop;
 if rid is null then raise exception 'Não foi possível gerar o código. Tente novamente.'; end if;
 insert into public.skoolk_members(room_id,user_id,nickname,avatar) values(rid,auth.uid(),trim(p_nickname),0);
 return rid;
end; $$;

create function public.skoolk_create_room(p_title text,p_author text,p_synopsis text,p_cover_url text,p_chapter_start integer,p_chapter_end integer,p_count integer,p_nickname text,p_plan jsonb default '[]'::jsonb) returns uuid language sql security invoker set search_path='' as $$ select skoolk_private.create_room(p_title,p_author,p_synopsis,p_cover_url,p_chapter_start,p_chapter_end,p_count,p_nickname,p_plan); $$;

revoke all on function skoolk_private.create_room(text,text,text,text,integer,integer,integer,text,jsonb) from public,anon;
revoke all on function public.skoolk_create_room(text,text,text,text,integer,integer,integer,text,jsonb) from public,anon;
grant execute on function skoolk_private.create_room(text,text,text,text,integer,integer,integer,text,jsonb),public.skoolk_create_room(text,text,text,text,integer,integer,integer,text,jsonb) to authenticated;

commit;
