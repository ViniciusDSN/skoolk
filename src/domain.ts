import type { Phase, Question, QuestionMoment, QuestionPlanItem, QuestionTopic, Rating } from './types';

export const TOPICOS: { id: QuestionTopic; nome: string }[] = [
  { id: 'personagens', nome: 'Personagens' }, { id: 'enredo', nome: 'Enredo' }, { id: 'temas', nome: 'Temas' },
  { id: 'ambientacao', nome: 'Ambientação' }, { id: 'narrativa', nome: 'Narrativa' }, { id: 'leitor', nome: 'Você leitor' },
];
export const MOMENTOS: { id: QuestionMoment; nome: string }[] = [
  { id: 'comeco', nome: 'Começo' }, { id: 'meio', nome: 'Meio' }, { id: 'desfecho', nome: 'Desfecho' }, { id: 'todo', nome: 'Tudo' },
];
export function rotuloPlano(item: Partial<QuestionPlanItem> | undefined | null): string | null {
  const topico = TOPICOS.find(x => x.id === item?.topico);
  if (!topico) return null;
  const momento = MOMENTOS.find(x => x.id === item?.momento) ?? MOMENTOS[3];
  return `${topico.nome} · ${momento.nome}`;
}

export const normalizeCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
export function validateJoin(code: string, nickname: string): string | null {
  if (!/^[A-Z0-9]{6}$/.test(code)) return 'Digite o código de 6 caracteres da sala.';
  if (nickname.trim().length < 2 || nickname.trim().length > 24) return 'Use um nome entre 2 e 24 caracteres.';
  return null;
}
export function validateChapters(start: number, end: number): string | null {
  return Number.isInteger(start) && Number.isInteger(end) && start >= 1 && end >= start && end <= 2000
    ? null : 'Confira os capítulos: o final deve ser igual ou maior que o inicial.';
}
export function nextPhase(phase: Phase, position: number, count: number): Phase {
  if (phase === 'lobby') return 'discussion';
  if (phase === 'discussion') return 'rating';
  if (phase === 'rating') return position + 1 >= count ? 'finished' : 'discussion';
  return 'finished';
}
export function average(ratings: { stars: number }[]): number {
  return ratings.length ? ratings.reduce((sum, r) => sum + r.stars, 0) / ratings.length : 0;
}
export function rankedQuestions(questions: Question[], ratings: Rating[]) {
  return questions.map(question => {
    const votes = ratings.filter(r => r.question_id === question.id);
    return { ...question, average: average(votes), votes: votes.length };
  }).sort((a, b) => b.average - a.average || a.position - b.position);
}
export function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : 'Algo deu errado. Tente novamente.';
  if (/email rate limit exceeded/i.test(message)) return 'O limite de envio de e-mails do clube foi atingido. Aguarde a liberação antes de tentar novamente. Se já confirmou sua conta, use a opção de entrar.';
  if (/email address not authorized|email address.*not allowed/i.test(message)) return 'O serviço de e-mail do clube ainda não permite enviar a confirmação para este endereço. A administração precisa configurar o envio de e-mails.';
  if (/Invalid login credentials/i.test(message)) return 'E-mail ou senha incorretos.';
  if (/Email not confirmed/i.test(message)) return 'Confirme seu e-mail antes de entrar.';
  if (/Anonymous sign-ins are disabled/i.test(message)) return 'A entrada de leitores ainda não foi habilitada. Avise a anfitriã.';
  if (/Network|Failed to fetch|fetch failed/i.test(message)) return 'Não foi possível conectar. Confira sua internet e tente novamente.';
  return message;
}
