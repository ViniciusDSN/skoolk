-- Serialize the room quota check and require a transition version.
begin;
create or replace function skoolk_private.create_room(p_title text,p_author text,p_synopsis text,p_cover_url text,p_chapter_start integer,p_chapter_end integer,p_count integer,p_nickname text)
returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid; new_code text; alphabet constant text:='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i integer;
begin
 if not skoolk_private.permanent_user() then raise exception 'Entre com uma conta confirmada de anfitriã.'; end if;
 -- Serialize creation per host; random codes have a unique database constraint.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if (select count(*) from public.skoolk_rooms where host_id=auth.uid() and phase<>'finished')>=10 then raise exception 'Você já tem 10 encontros abertos. Finalize um deles primeiro.'; end if;
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

create or replace function skoolk_private.advance_room(p_room uuid,p_version integer) returns void language plpgsql security definer set search_path='' as $$
declare r public.skoolk_rooms; n integer;
begin
 select * into r from public.skoolk_rooms where id=p_room for update;
 if auth.uid() is null or r.host_id is distinct from auth.uid() then raise exception 'Apenas a anfitriã pode conduzir o encontro.'; end if;
 if p_version is null or r.version<>p_version then raise exception 'O encontro já avançou. A tela será atualizada.'; end if;
 select count(*) into n from public.skoolk_questions where room_id=r.id;
 if r.phase='lobby' and n<>r.question_count then raise exception 'Prepare as perguntas antes de começar.'; end if;
 if r.phase='finished' then return; end if;
 update public.skoolk_rooms set
 phase=case when r.phase='lobby' then 'discussion' when r.phase='discussion' then 'rating' when r.current_question+1>=n then 'finished' else 'discussion' end,
 current_question=case when r.phase='rating' and r.current_question+1<n then r.current_question+1 else r.current_question end,
 finished_at=case when r.phase='rating' and r.current_question+1>=n then now() else null end,
 version=version+1 where id=r.id;
end; $$;

commit;
