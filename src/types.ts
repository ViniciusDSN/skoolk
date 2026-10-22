export type Phase = 'lobby' | 'discussion' | 'rating' | 'finished';
export type Book = { id: string; title: string; author: string; synopsis: string; cover_url: string | null; owner_id?: string };
export type Room = {
  id: string; code: string; host_id: string; book_title: string; book_author: string;
  synopsis: string; cover_url: string | null; chapter_start: number; chapter_end: number;
  phase: Phase; current_question: number; question_count: number; version: number;
  created_at: string; generation_token?: string | null; question_plan: QuestionPlanItem[];
};
export type QuestionTopic = 'personagens' | 'enredo' | 'temas' | 'ambientacao' | 'narrativa' | 'leitor';
export type QuestionMoment = 'comeco' | 'meio' | 'desfecho' | 'todo';
export type QuestionPlanItem = { topico: QuestionTopic; momento: QuestionMoment };
export type Member = { room_id: string; user_id: string; nickname: string; avatar: number; joined_at: string };
export type QuestionSource = 'manual' | 'ia';
export type Question = { id: string; room_id: string; position: number; category: string; prompt: string; hint: string; source: QuestionSource };
export type QuestionDraft = { prompt: string; category: string; hint: string; source: QuestionSource };
export type Rating = { room_id: string; question_id: string; user_id: string; stars: number };
export type Feedback = { room_id: string; user_id: string; book_stars: number; discussion_stars: number };
export type RoomSnapshot = { room: Room; members: Member[]; questions: Question[]; ratings: Rating[]; feedback: Feedback[] };
export type RoomInput = { book: Book; chapterStart: number; chapterEnd: number; questionCount: number; nickname: string; plan: Partial<QuestionPlanItem>[] };
