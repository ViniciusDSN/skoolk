begin;

create or replace function skoolk_private.save_questions(p_room uuid, p_questions jsonb)
returns void language plpgsql security definer set search_path='' as $$
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
 from jsonb_array_elements(p_questions) with ordinality
 where coalesce(btrim(value->>'prompt'),'')<>'';
 update public.skoolk_rooms set version=version+1 where id=r.id;
end; $$;

create or replace function skoolk_private.publish_questions(p_room uuid, p_token uuid, p_questions jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare r public.skoolk_rooms; existing integer;
begin
 select * into r from public.skoolk_rooms where id=p_room for update;
 if auth.uid() is null or r.host_id is distinct from auth.uid() then raise exception 'Apenas a anfitriã pode preparar perguntas.'; end if;
 if r.phase<>'lobby' or r.generation_token is distinct from p_token or p_token is null then raise exception 'A preparação expirou. Tente novamente.'; end if;
 select count(*) into existing from public.skoolk_questions where room_id=r.id;
 if jsonb_typeof(p_questions)<>'array' or jsonb_array_length(p_questions)<1 or jsonb_array_length(p_questions)>r.question_count-existing then raise exception 'A IA retornou uma quantidade inválida de perguntas.'; end if;
 insert into public.skoolk_questions(room_id,position,category,prompt,hint,source)
 select r.id, v.pos, e.value->>'category', e.value->>'prompt', e.value->>'hint', 'ia'
 from (select g.pos, row_number() over (order by g.pos) as ord
       from generate_series(0, r.question_count-1) g(pos)
       where not exists (select 1 from public.skoolk_questions q where q.room_id=r.id and q.position=g.pos)) v
 join jsonb_array_elements(p_questions) with ordinality e(value, ord) on e.ord=v.ord;
 update public.skoolk_rooms set generation_token=null,generation_started_at=null,version=version+1 where id=r.id;
end; $$;

commit;
