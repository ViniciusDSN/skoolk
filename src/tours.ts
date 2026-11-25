import type { TourPasso } from './components/Tour';

export const TOUR_INICIO: TourPasso[] = [
  { id: 'codigo', titulo: 'O código do encontro', texto: 'A anfitriã compartilha um código de 6 letras. Digite ele aqui para entrar na conversa do clube.' },
  { id: 'perfil', titulo: 'Como você aparece', texto: 'Escolha um apelido e um avatar. É assim que o resto do clube vai te ver na sala.' },
];

export const TOUR_ANFITRIA: TourPasso[] = [
  { id: 'criar', titulo: 'Crie o encontro', texto: 'Escolha o livro, até que capítulo vale conversar e quantas perguntas a IA prepara.' },
  { id: 'encontros', titulo: 'Seus encontros ficam aqui', texto: 'Toque em um deles para voltar, compartilhar o código e conduzir a conversa.' },
  { id: 'estante', titulo: 'A estante vem antes', texto: 'Para criar um encontro você precisa de um livro aqui. Cadastre com o arquivo: é dele que a IA tira as perguntas.' },
];

export const TOUR_SALA_ESPERA: TourPasso[] = [
  { id: 'codigo', titulo: 'Convide o clube', texto: 'Toque no código para copiar e mandar no grupo. É com ele que os leitores entram.' },
  { id: 'leitores', titulo: 'Quem já chegou', texto: 'Cada pessoa que entra com o código aparece aqui, em tempo real.' },
  { id: 'acao', titulo: 'Prepare as perguntas', texto: 'Escreva as que quiser e deixe o resto com a IA. Quando estiverem prontas, este botão inicia a conversa.' },
];

export const TOUR_SALA_DINAMICA: TourPasso[] = [
  { id: 'pergunta', titulo: 'A pergunta da vez', texto: 'Todo mundo na sala vê esta mesma pergunta. A dica abaixo ajuda quem travar.' },
  { id: 'progresso', titulo: 'Onde você está', texto: 'Cada bolinha é uma pergunta do encontro. A clara é a atual.' },
  { id: 'acao', titulo: 'Você conduz o ritmo', texto: 'Quando a conversa esfriar, encerre a pergunta para o clube avaliar e siga para a próxima.' },
];
