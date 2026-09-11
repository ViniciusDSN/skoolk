begin;
create function skoolk_private.write_questions(p_room uuid,p_questions jsonb) returns void language plpgsql security definer set search_path='' as $$
declare r public.skoolk_rooms; token uuid:=gen_random_uuid();
begin
 select * into r from public.skoolk_rooms where id=p_room for update;
 if auth.uid() is null or r.host_id is distinct from auth.uid() then raise exception 'Apenas a anfitriã pode preparar perguntas.'; end if;
 if r.phase<>'lobby' then raise exception 'O encontro já começou.'; end if;
 if r.generation_started_at>now()-interval '90 seconds' then raise exception 'A IA ainda está preparando perguntas. Aguarde um instante.'; end if;
 if exists(select 1 from public.skoolk_questions where room_id=r.id) then raise exception 'As perguntas deste encontro já estão prontas.'; end if;
 update public.skoolk_rooms set generation_token=token,generation_started_at=now() where id=r.id;
 perform skoolk_private.publish_questions(r.id,token,p_questions);
end; $$;
create function public.skoolk_write_questions(p_room uuid,p_questions jsonb) returns void language sql security invoker set search_path='' as $$ select skoolk_private.write_questions(p_room,p_questions); $$;
revoke all on function skoolk_private.write_questions(uuid,jsonb) from public,anon;
revoke all on function public.skoolk_write_questions(uuid,jsonb) from public,anon;
grant execute on function skoolk_private.write_questions(uuid,jsonb),public.skoolk_write_questions(uuid,jsonb) to authenticated;
alter policy books_select on public.skoolk_books using(owner_id=(select auth.uid()) and (select skoolk_private.permanent_user()));
alter policy books_delete on public.skoolk_books using(owner_id=(select auth.uid()) and (select skoolk_private.permanent_user()));
alter policy books_update on public.skoolk_books using(owner_id=(select auth.uid()) and (select skoolk_private.permanent_user())) with check(owner_id=(select auth.uid()) and (select skoolk_private.permanent_user()));
-- Explicit deny: only the validated private function may access the throttle table.
create policy join_limits_no_direct_access on skoolk_private.join_limits for all to authenticated using(false) with check(false);
commit;
