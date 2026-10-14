begin;
alter table public.skoolk_questions add column if not exists source text not null default 'manual';
alter table public.skoolk_questions drop constraint if exists skoolk_questions_source_check;
alter table public.skoolk_questions add constraint skoolk_questions_source_check check (source in ('manual','ia'));

create or replace function skoolk_private.save_questions(p_room uuid,p_questions jsonb) returns void language plpgsql security definer set search_path='' as $$
declare r public.skoolk_rooms;
begin
 select * into r from public.skoolk_rooms where id=p_room for update;
 if auth.uid() is null or r.host_id is distinct from auth.uid() then raise exception 'Apenas a anfitriã pode preparar perguntas.'; end if;
 if r.phase<>'lobby' then raise exception 'O encontro já começou.'; end if;
 if r.generation_started_at>now()-interval '90 seconds' then raise exception 'A IA ainda está preparando perguntas. Aguarde um instante.'; end if;
 if jsonb_typeof(p_questions)<>'array' then raise exception 'Formato inválido de perguntas.'; end if;
 if jsonb_array_length(p_questions)>r.question_count then raise exception 'Este encontro aceita no máximo % perguntas.', r.question_count; end if;
 delete from public.skoolk_questions where room_id=r.id;
 insert into public.skoolk_questions(room_id,position,category,prompt,hint,source)
 select r.id, ordinality-1, value->>'category', value->>'prompt', value->>'hint',
        case when value->>'source'='ia' then 'ia' else 'manual' end
 from jsonb_array_elements(p_questions) with ordinality;
 update public.skoolk_rooms set version=version+1 where id=r.id;
end; $$;

create or replace function skoolk_private.publish_questions(p_room uuid,p_token uuid,p_questions jsonb) returns void language plpgsql security definer set search_path='' as $$
declare r public.skoolk_rooms; existing integer; base integer;
begin
 select * into r from public.skoolk_rooms where id=p_room for update;
 if auth.uid() is null or r.host_id is distinct from auth.uid() then raise exception 'Apenas a anfitriã pode preparar perguntas.'; end if;
 if r.phase<>'lobby' or r.generation_token is distinct from p_token or p_token is null then raise exception 'A preparação expirou. Tente novamente.'; end if;
 select count(*), coalesce(max(position),-1) into existing, base from public.skoolk_questions where room_id=r.id;
 if jsonb_typeof(p_questions)<>'array' or jsonb_array_length(p_questions)<1 or jsonb_array_length(p_questions)>r.question_count-existing then raise exception 'A IA retornou uma quantidade inválida de perguntas.'; end if;
 insert into public.skoolk_questions(room_id,position,category,prompt,hint,source)
 select r.id, base+ordinality, value->>'category', value->>'prompt', value->>'hint', 'ia'
 from jsonb_array_elements(p_questions) with ordinality;
 update public.skoolk_rooms set generation_token=null,generation_started_at=null,version=version+1 where id=r.id;
end; $$;

create or replace function skoolk_private.begin_generation(p_room uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.skoolk_rooms; token uuid:=gen_random_uuid(); existing integer;
begin
 select * into r from public.skoolk_rooms where id=p_room for update;
 if auth.uid() is null or r.host_id is distinct from auth.uid() then raise exception 'Apenas a anfitriã pode gerar perguntas.'; end if;
 if r.phase<>'lobby' then raise exception 'O encontro já começou.'; end if;
 if r.generation_started_at>now()-interval '90 seconds' then raise exception 'As perguntas já estão sendo preparadas. Aguarde um instante.'; end if;
 if r.generation_count>=5 then raise exception 'O limite de geração deste encontro foi atingido.'; end if;
 select count(*) into existing from public.skoolk_questions where room_id=r.id;
 if existing>=r.question_count then raise exception 'As perguntas deste encontro já estão completas.'; end if;
 update public.skoolk_rooms set generation_token=token,generation_started_at=now(),generation_count=generation_count+1 where id=r.id;
 return token;
end; $$;

create or replace function skoolk_private.write_questions(p_room uuid,p_questions jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 perform skoolk_private.save_questions(p_room,p_questions);
end; $$;

create or replace function public.skoolk_save_questions(p_room uuid,p_questions jsonb) returns void language sql security invoker set search_path='' as $$ select skoolk_private.save_questions(p_room,p_questions); $$;
revoke all on function skoolk_private.save_questions(uuid,jsonb) from public,anon;
revoke all on function public.skoolk_save_questions(uuid,jsonb) from public,anon;
grant execute on function skoolk_private.save_questions(uuid,jsonb),public.skoolk_save_questions(uuid,jsonb) to authenticated;
commit;
