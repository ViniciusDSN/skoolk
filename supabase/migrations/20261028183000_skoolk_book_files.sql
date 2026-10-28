begin;

-- The source book is private: only its owner and the authenticated Edge Function
-- acting on behalf of that owner can read it.
insert into storage.buckets (id, name, public, file_size_limit)
values ('skoolk-books', 'skoolk-books', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

create policy "skoolk_books_files_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'skoolk-books' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "skoolk_books_files_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'skoolk-books' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "skoolk_books_files_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'skoolk-books' and (storage.foldername(name))[1] = (select auth.uid()::text));

alter table public.skoolk_books
  add column if not exists file_path text,
  add column if not exists file_name text,
  add column if not exists file_mime text,
  add column if not exists file_size bigint;
alter table public.skoolk_rooms
  add column if not exists book_file_path text,
  add column if not exists book_file_name text,
  add column if not exists book_file_mime text,
  add column if not exists book_file_size bigint;

alter table public.skoolk_books add constraint skoolk_books_file_metadata_check check (
  (file_path is null and file_name is null and file_mime is null and file_size is null) or
  (char_length(file_path) between 3 and 1024 and char_length(file_name) between 1 and 255
    and char_length(file_mime) between 1 and 255 and file_size between 1 and 52428800)
);
alter table public.skoolk_rooms add constraint skoolk_rooms_book_file_metadata_check check (
  (book_file_path is null and book_file_name is null and book_file_mime is null and book_file_size is null) or
  (char_length(book_file_path) between 3 and 1024 and char_length(book_file_name) between 1 and 255
    and char_length(book_file_mime) between 1 and 255 and book_file_size between 1 and 52428800)
);

drop function if exists public.skoolk_create_room(text, text, text, text, integer, integer, integer, text, jsonb);
drop function if exists skoolk_private.create_room(text, text, text, text, integer, integer, integer, text, jsonb);

create function skoolk_private.create_room(
  p_title text, p_author text, p_synopsis text, p_cover_url text,
  p_chapter_start integer, p_chapter_end integer, p_count integer, p_nickname text,
  p_plan jsonb default '[]'::jsonb, p_file_path text default null, p_file_name text default null,
  p_file_mime text default null, p_file_size bigint default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid; new_code text; alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i integer;
begin
 if not skoolk_private.permanent_user() then raise exception 'Entre com uma conta confirmada de anfitriã.'; end if;
 if jsonb_typeof(p_plan) <> 'array' then raise exception 'O plano de perguntas precisa ser uma lista.'; end if;
 if jsonb_array_length(p_plan) > p_count then raise exception 'O plano tem mais itens do que perguntas.'; end if;
 if exists(select 1 from jsonb_array_elements(p_plan) e
   where jsonb_typeof(e) <> 'object'
      or (e->>'topico' is not null and e->>'topico' not in ('personagens','enredo','temas','ambientacao','narrativa','leitor'))
      or (e->>'momento' is not null and e->>'momento' not in ('comeco','meio','desfecho','todo')))
 then raise exception 'Tópico ou momento inválido no plano de perguntas.'; end if;
 if p_file_path is null or p_file_name is null or p_file_mime is null or p_file_size is null then
   raise exception 'Envie o arquivo do livro antes de criar o encontro.';
 end if;
 if p_file_size not between 1 and 52428800 or char_length(p_file_path) > 1024 or char_length(p_file_name) > 255 or char_length(p_file_mime) > 255
 then raise exception 'Arquivo do livro inválido.'; end if;
 if split_part(p_file_path, '/', 1) <> auth.uid()::text
    or not exists(select 1 from storage.objects where bucket_id = 'skoolk-books' and name = p_file_path)
 then raise exception 'Não foi possível acessar o arquivo do livro enviado.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
 if (select count(*) from public.skoolk_rooms where host_id = auth.uid() and phase <> 'finished') >= 10 then raise exception 'Você já tem 10 encontros abertos. Finalize um deles primeiro.'; end if;
 for attempt in 1..10 loop
  new_code := '';
  for i in 1..6 loop new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1); end loop;
  begin
   insert into public.skoolk_rooms(
     code, host_id, book_title, book_author, synopsis, cover_url,
     book_file_path, book_file_name, book_file_mime, book_file_size,
     chapter_start, chapter_end, question_count, question_plan
   ) values (
     new_code, auth.uid(), trim(p_title), trim(p_author), trim(p_synopsis), p_cover_url,
     p_file_path, trim(p_file_name), trim(p_file_mime), p_file_size,
     p_chapter_start, p_chapter_end, p_count, p_plan
   ) returning id into rid;
   exit;
  exception when unique_violation then continue;
  end;
 end loop;
 if rid is null then raise exception 'Não foi possível gerar o código. Tente novamente.'; end if;
 insert into public.skoolk_members(room_id, user_id, nickname, avatar) values (rid, auth.uid(), trim(p_nickname), 0);
 return rid;
end; $$;

create function public.skoolk_create_room(
  p_title text, p_author text, p_synopsis text, p_cover_url text,
  p_chapter_start integer, p_chapter_end integer, p_count integer, p_nickname text,
  p_plan jsonb default '[]'::jsonb, p_file_path text default null, p_file_name text default null,
  p_file_mime text default null, p_file_size bigint default null
) returns uuid language sql security invoker set search_path='' as $$
  select skoolk_private.create_room(p_title, p_author, p_synopsis, p_cover_url, p_chapter_start, p_chapter_end, p_count, p_nickname, p_plan, p_file_path, p_file_name, p_file_mime, p_file_size);
$$;

revoke all on function skoolk_private.create_room(text, text, text, text, integer, integer, integer, text, jsonb, text, text, text, bigint) from public, anon;
revoke all on function public.skoolk_create_room(text, text, text, text, integer, integer, integer, text, jsonb, text, text, text, bigint) from public, anon;
grant execute on function skoolk_private.create_room(text, text, text, text, integer, integer, integer, text, jsonb, text, text, text, bigint), public.skoolk_create_room(text, text, text, text, integer, integer, integer, text, jsonb, text, text, text, bigint) to authenticated;

commit;
