import { db } from './supabase';
import type { Book, QuestionDraft, RoomInput, RoomSnapshot } from '../types';

export async function ensureReader() {
  const client = db();
  const { data: { session } } = await client.auth.getSession();
  if (session) return session.user;
  const { data, error } = await client.auth.signInAnonymously();
  if (error) throw error;
  return data.user!;
}
export async function rpc<T = unknown>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db().rpc(name, args);
  if (error) throw error;
  return data as T;
}
export async function createRoom(input: RoomInput) {
  return rpc<string>('skoolk_create_room', {
    p_title: input.book.title, p_author: input.book.author, p_synopsis: input.book.synopsis,
    p_cover_url: input.book.cover_url, p_chapter_start: input.chapterStart, p_chapter_end: input.chapterEnd,
    p_count: input.questionCount, p_nickname: input.nickname,
  });
}
export async function loadRoom(id: string): Promise<RoomSnapshot> {
  const client = db();
  const results = await Promise.all([
    client.from('skoolk_rooms').select('*').eq('id', id).single(),
    client.from('skoolk_members').select('*').eq('room_id', id).order('joined_at'),
    client.from('skoolk_questions').select('*').eq('room_id', id).order('position'),
    client.from('skoolk_ratings').select('*').eq('room_id', id),
    client.from('skoolk_feedback').select('*').eq('room_id', id),
  ]);
  const error = results.find(r => r.error)?.error;
  if (error) throw error;
  return { room: results[0].data, members: results[1].data, questions: results[2].data,
    ratings: results[3].data, feedback: results[4].data } as unknown as RoomSnapshot;
}
function edgeFailure(status?: number): string {
  if (status === 404) return 'A geração por IA ainda não foi publicada neste projeto. Avise quem cuida do back-end.';
  if (status === 401 || status === 403) return 'Entre novamente como anfitriã para gerar perguntas.';
  if (status === 429) return 'O limite de solicitações da IA foi atingido. Tente mais tarde ou escreva suas perguntas.';
  if (status === 503) return 'A geração por IA ainda está sendo configurada. Escreva suas perguntas por enquanto.';
  if (status && status >= 500) return 'A IA não respondeu agora. Tente novamente ou escreva suas perguntas.';
  return 'Não foi possível falar com a geração por IA. Confira sua conexão e tente novamente.';
}
async function edgeError(error: unknown): Promise<Error> {
  const context = (error as { context?: Record<string, unknown> } | null)?.context;
  const status = typeof context?.status === 'number' ? context.status : undefined;
  const read = context?.json ?? context?.text;
  let payload: unknown = null;
  if (typeof read === 'function') {
    payload = await (read as () => Promise<unknown>).call(context).catch(() => null);
    if (typeof payload === 'string') { try { payload = JSON.parse(payload); } catch { payload = null; } }
  }
  const message = payload && typeof payload === 'object' && 'error' in payload ? String((payload as { error: unknown }).error) : null;
  return new Error(message || edgeFailure(status));
}
export async function generateQuestions(roomId: string) {
  const { data, error } = await db().functions.invoke('generate-questions', { body: { roomId } });
  if (error) throw await edgeError(error);
  if (data?.error) throw new Error(data.error);
}
export async function saveQuestions(roomId: string, questions: QuestionDraft[]) {
  return rpc('skoolk_save_questions', { p_room: roomId, p_questions: questions });
}
export async function listBooks(): Promise<Book[]> {
  const { data, error } = await db().from('skoolk_books').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}
