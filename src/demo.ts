import type { RoomSnapshot } from './types';
export const demoSnapshot: RoomSnapshot = {
  room: { id: 'demo', code: 'SKOOLK', host_id: 'demo-host', book_title: 'A Toca da Raposa', book_author: 'Nora Sakavic',
    synopsis: 'Neil Josten chega ao time de Exy da Universidade de Palmetto State carregando um passado que prefere esconder. Entre treinos, desconfianças e alianças improváveis, os Raposas precisam aprender a jogar — e a confiar — juntos. Até onde podemos ir para encontrar um lugar ao qual pertencer?',
    cover_url: null, chapter_start: 1, chapter_end: 12, phase: 'lobby', current_question: 0, question_count: 3, version: 0, created_at: new Date().toISOString() },
  members: [
    { room_id: 'demo', user_id: 'demo-host', nickname: 'Você', avatar: 0, joined_at: '' },
    { room_id: 'demo', user_id: 'reader-1', nickname: 'Marina', avatar: 3, joined_at: '' },
    { room_id: 'demo', user_id: 'reader-2', nickname: 'João', avatar: 4, joined_at: '' },
    { room_id: 'demo', user_id: 'reader-3', nickname: 'Bia', avatar: 1, joined_at: '' },
  ],
  questions: [
    { id: 'demo-1', room_id: 'demo', position: 0, category: 'Personagens', prompt: 'O que faz alguém se sentir parte de um grupo?', hint: 'Pense nas primeiras interações de Neil com os Raposas. Quais gestos aproximam e quais criam distância?' },
    { id: 'demo-2', room_id: 'demo', position: 1, category: 'Conexões', prompt: 'Confiar em alguém é uma escolha ou uma conquista?', hint: 'Converse sobre os limites que os personagens estabelecem. Você se reconheceu em algum deles?' },
    { id: 'demo-3', room_id: 'demo', position: 2, category: 'Entrelinhas', prompt: 'O que o silêncio de um personagem pode revelar?', hint: 'Compartilhe um momento da leitura em que o que não foi dito chamou sua atenção.' },
  ], ratings: [], feedback: [],
};
