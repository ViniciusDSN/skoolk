import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import QRCode from 'react-native-qrcode-svg';
import { ArrowRight, BookOpen, Check, ChevronRight, Copy, LogOut, MessageCircle, QrCode, Share2, Sparkles, Star, Users, X } from 'lucide-react-native';
import { ScrollArea } from '../components/ScrollArea';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';
import { useRoom } from '../hooks/useRoom';
import { generateQuestions, rpc } from '../lib/api';
import { average, friendlyError, nextPhase, rankedQuestions } from '../domain';
import { colors as c } from '../theme';
import { Avatar, Badge, BookCover, Button, Card, ErrorMessage, Input, Stars, typography as t } from '../components/ui';

export function RoomScreen({ roomId, userId, demo, onLeave }: { roomId: string; userId: string; demo: boolean; onLeave: () => void }) {
  const { snapshot: data, setSnapshot, error: loadError, connected, refresh } = useRoom(roomId, demo);
  const [tab, setTab] = useState<'synopsis' | 'questions'>('questions');
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<'share' | 'leave' | 'advance' | null>(null), [copied, setCopied] = useState(false);
  const [rating, setRating] = useState(0), [bookRating, setBookRating] = useState(0), [discussionRating, setDiscussionRating] = useState(0);
  const [questionsModal, setQuestionsModal] = useState<'write' | 'preview' | null>(null), [drafts, setDrafts] = useState<string[]>([]);
  const scrollRef = useRef<ScrollView>(null);
  const keyboard = useKeyboardHeight();
  const me = demo ? 'demo-host' : userId;
  const room = data?.room, host = room?.host_id === me;
  useEffect(() => { scrollRef.current?.scrollTo({ y: 0, animated: false }); }, [room?.current_question, room?.phase === 'finished', room?.phase === 'lobby']);
  const question = data?.questions.find(q => q.position === room?.current_question);
  const savedRating = data?.ratings.find(r => r.question_id === question?.id && r.user_id === me)?.stars ?? 0;
  const myFeedback = data?.feedback.find(f => f.user_id === me);
  useEffect(() => { setRating(savedRating); }, [question?.id, savedRating]);
  useEffect(() => { if (myFeedback) { setBookRating(myFeedback.book_stars); setDiscussionRating(myFeedback.discussion_stars); } }, [myFeedback?.book_stars, myFeedback?.discussion_stars]);
  const act = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await fn(); if (!demo) await refresh(); } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  };
  if (!data || !room) return <View style={s.loading}><ActivityIndicator color={c.purple} size="large" /><Text style={t.subtitle}>Abrindo seu encontro…</Text><ErrorMessage message={loadError} />{loadError && <><Button title="Tentar novamente" onPress={() => void refresh()} /><Button title="Voltar ao início" secondary onPress={onLeave} /></>}</View>;
  const votes = data.ratings.filter(r => r.question_id === question?.id);
  const isFinished = room.phase === 'finished';
  const advance = () => void act(async () => {
    setModal(null);
    if (demo) {
      const phase = nextPhase(room.phase, room.current_question, room.question_count);
      setSnapshot({ ...data, room: { ...room, phase, version: room.version + 1, current_question: room.phase === 'rating' && phase === 'discussion' ? room.current_question + 1 : room.current_question } });
    } else await rpc('skoolk_advance_room', { p_room: room.id, p_version: room.version });
  });
  const submitRating = () => void act(async () => {
    if (!question || rating < 1) return;
    if (demo) setSnapshot({ ...data, ratings: [...data.ratings.filter(r => r.question_id !== question.id || r.user_id !== me), { room_id: room.id, question_id: question.id, user_id: me, stars: rating }] });
    else await rpc('skoolk_rate_question', { p_room: room.id, p_question: question.id, p_stars: rating });
  });
  const submitFeedback = () => void act(async () => {
    if (demo) setSnapshot({ ...data, feedback: [{ room_id: room.id, user_id: me, book_stars: bookRating, discussion_stars: discussionRating }] });
    else await rpc('skoolk_submit_feedback', { p_room: room.id, p_book: bookRating, p_discussion: discussionRating });
  });
  const saveQuestions = () => void act(async () => {
    if (drafts.some(prompt => prompt.trim().length < 10)) throw new Error('Escreva pelo menos 10 caracteres em cada pergunta.');
    await rpc('skoolk_write_questions', { p_room: room.id, p_questions: drafts.map(prompt => ({ prompt: prompt.trim(), category: 'Discussão', hint: 'Compartilhe sua leitura e escute os outros pontos de vista.' })) });
    setQuestionsModal(null);
  });
  const joinUrl = Linking.createURL('/', { queryParams: { code: room.code } });
  return <LinearGradient colors={['#916CE1', '#7452B7']} style={{ flex: 1 }}>
    <ScrollArea ref={scrollRef} light contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={s.roomHeader}>
        <View style={s.topline}><Text style={s.wordmark}>skoolk<Text style={{ color: '#D8C7F2' }}>.</Text></Text><Badge light>{demo ? 'DEMONSTRAÇÃO' : host ? 'ANFITRIÃ' : 'LEITOR'}</Badge></View>
        <View style={s.bookRow}><BookCover title={room.book_title} uri={room.cover_url} small /><View style={{ flex: 1, gap: 5 }}><Text style={s.bookTitle}>{room.book_title}</Text><Text style={s.author}>{room.book_author}</Text><Text style={s.chapters}>Capítulos {room.chapter_start} — {room.chapter_end}</Text></View>
          <Pressable accessibilityLabel="Compartilhar código da sala" accessibilityRole="button" onPress={() => setModal('share')} style={s.iconButton}><QrCode size={22} color="#fff" /></Pressable>
        </View>
        <View style={s.roomStats}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Código da sala ${room.code}, copiar`} onPress={() => void act(async () => { await Clipboard.setStringAsync(room.code); setCopied(true); })} style={s.stat}>
            <Text style={s.statLabel}>{copied ? 'Código copiado!' : 'Código da sala'}</Text><View style={s.row}><Text style={s.code}>{room.code}</Text><Copy size={12} color="#D8C7EF" /></View>
          </Pressable><View style={s.statDivider} /><View style={s.stat}><Text style={s.statLabel}>Participantes</Text><View style={s.row}><Users size={14} color="#fff" /><Text style={s.code}>{data.members.length.toString().padStart(2, '0')}</Text></View></View>
          <View style={[s.dot, { backgroundColor: connected ? '#C4EDD5' : '#F4D18A' }]} accessibilityLabel={connected ? 'Conectado' : 'Reconectando'} />
        </View>
      </View>
      {!connected && !demo && <View style={{ paddingHorizontal: 24, paddingTop: 16 }}><Text style={{ color: '#FFF3D4', fontSize: 12 }}>Reconectando ao encontro… As ações continuam sendo verificadas no servidor.</Text></View>}
      <View style={{ paddingHorizontal: 24, paddingTop: 16, gap: 16 }}>
        <ErrorMessage message={error ?? loadError} />
        {room.phase === 'lobby' ? <>
          <View style={{ gap: 6 }}><Text style={s.whiteTitle}>{host ? 'Um novo capítulo começa.' : 'Você chegou. Puxe uma cadeira.'}</Text><Text style={s.whiteSubtitle}>{host ? 'Convide os leitores e prepare a conversa.' : 'A anfitriã vai iniciar a dinâmica em instantes.'}</Text></View>
          <Card><View style={s.between}><Text style={t.section}>Na mesma página</Text><Badge>{data.members.length} leitores</Badge></View><View style={s.members}>{data.members.map(m => <View key={m.user_id} style={s.member}><Avatar name={m.nickname} index={m.avatar} /><Text numberOfLines={1} style={s.memberName}>{m.nickname}</Text>{m.user_id === room.host_id && <Text style={{ fontSize: 9, color: c.purple }}>anfitriã</Text>}</View>)}</View>
            {!demo && <Text style={[t.subtitle, { textAlign: 'center', fontSize: 12 }]}>Quem entrar com o código aparece aqui.</Text>}
          </Card>
          {host && <Card style={{ gap: 14 }}><Text style={t.eyebrow}>ESCOLHA UMA DINÂMICA</Text><View style={s.row}><View style={s.iconTile}><MessageCircle size={23} color={c.purple} /></View><View style={{ flex: 1, gap: 4 }}><Text style={t.section}>Entre perguntas e páginas</Text><Text style={[t.subtitle, { fontSize: 12 }]}>{room.question_count} perguntas para abrir a conversa</Text></View></View>
            {data.questions.length > 0 && <View style={s.row}><Check size={16} color={c.success} /><Text style={{ color: c.success, fontSize: 12 }}>{data.questions.length} perguntas prontas para discutir</Text></View>}
            <Text style={[t.subtitle, { fontSize: 11, textAlign: 'center' }]}>A conversa é de vocês. A primeira pergunta, por nossa conta.</Text>
            {data.questions.length > 0 ? <Button title="Revisar perguntas" secondary onPress={() => setQuestionsModal('preview')} /> : <Button title="Escrever minhas perguntas" secondary disabled={busy} onPress={() => { setError(null); setDrafts(Array.from({ length: room.question_count }, () => '')); setQuestionsModal('write'); }} />}
          </Card>}
          {!host && <View style={{ gap: 12, padding: 15, alignItems: 'center' }}><ActivityIndicator color="#fff" /><Text style={s.whiteSubtitle}>Esperando a anfitriã começar…</Text></View>}
          <Pressable accessibilityRole="button" onPress={() => setTab(tab === 'synopsis' ? 'questions' : 'synopsis')} style={s.textButton}><BookOpen size={17} color="#EFE7FB" /><Text style={s.whiteSubtitle}>{tab === 'synopsis' ? 'Ocultar sinopse' : 'Relembrar a sinopse'}</Text></Pressable>
          {tab === 'synopsis' && <Card><Text style={t.section}>{room.book_title}</Text><Text style={s.synopsis}>{room.synopsis || 'A anfitriã ainda não adicionou uma sinopse.'}</Text></Card>}
        </> : isFinished ? <>
          <View style={s.finishHero}><View style={s.finishIcon}><Check size={28} color="#fff" /></View><Text style={[s.whiteTitle, { textAlign: 'center' }]}>{'O encontro acaba.\nA conversa continua.'}</Text><Text style={s.whiteSubtitle}>Obrigada por compartilhar suas páginas com a gente.</Text></View>
          <Card><Text style={[t.section, { textAlign: 'center' }]}>Como foi esse capítulo?</Text><Text style={[t.subtitle, { textAlign: 'center', fontSize: 12 }]}>Sua opinião ajuda a preparar os próximos encontros.</Text><View style={s.ratingBlock}><Text style={s.ratingLabel}>Como você avalia a discussão?</Text><Stars label="Discussão" value={discussionRating} onChange={setDiscussionRating} disabled={!!myFeedback || busy} /></View><View style={s.ratingBlock}><Text style={s.ratingLabel}>E o livro, o que achou?</Text><Stars label="Livro" value={bookRating} onChange={setBookRating} disabled={!!myFeedback || busy} /></View>
            {myFeedback ? <View style={[s.row, { justifyContent: 'center' }]}><Check size={18} color={c.success} /><Text style={{ color: c.success, fontSize: 13 }}>Avaliações enviadas. Obrigada!</Text></View> : <Button title="Enviar minha opinião" busy={busy} disabled={!bookRating || !discussionRating} onPress={submitFeedback} />}
          </Card>
          {host && <Card><View style={s.between}><Text style={t.section}>As favoritas do encontro</Text><Star size={19} color={c.gold} /></View>{rankedQuestions(data.questions, data.ratings).map((q, index) => <View key={q.id} style={{ gap: 8, borderTopWidth: index ? 1 : 0, borderColor: c.line, paddingTop: index ? 16 : 0 }}><View style={s.between}><Badge>{q.category}</Badge><Text style={{ color: c.purple, fontWeight: '700' }}>{q.votes ? q.average.toFixed(1) : '—'} ★</Text></View><Text style={{ color: c.ink, fontSize: 13, lineHeight: 20 }}>{q.prompt}</Text><Text style={{ color: c.muted, fontSize: 11 }}>{q.votes} avaliações</Text></View>)}<Text style={t.subtitle}>{data.feedback.length} opiniões sobre o encontro</Text></Card>}
        </> : <>
          <View style={s.tabs}>{(['synopsis', 'questions'] as const).map(value => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: tab === value }} onPress={() => setTab(value)} style={[s.tab, tab === value && s.tabActive]}><Text style={[s.tabText, tab === value && { color: '#fff', fontWeight: '600' }]}>{value === 'synopsis' ? 'Sinopse' : 'Perguntas'}</Text></Pressable>)}</View>
          {tab === 'synopsis' ? <Card style={{ minHeight: 350, justifyContent: 'center' }}><BookOpen size={28} color={c.purple} style={{ alignSelf: 'center' }} /><Text style={[t.section, { textAlign: 'center' }]}>{room.book_title}</Text><Text style={s.synopsis}>{room.synopsis || 'A anfitriã ainda não adicionou uma sinopse.'}</Text></Card> : <>
            <View style={s.cardStack}><View style={s.stackBack} /><View style={s.stackMiddle} /><Card style={{ minHeight: 363, padding: 24 }}>
              <View style={s.between}><Text style={{ color: c.purple, fontSize: 12, fontWeight: '600' }}>{String(room.current_question + 1).padStart(2, '0')} <Text style={{ color: '#BFB4CF', fontWeight: '400' }}>/ {String(room.question_count).padStart(2, '0')}</Text></Text><Badge>{room.phase === 'rating' ? 'HORA DE AVALIAR' : 'EM DISCUSSÃO'}</Badge></View>
              <View style={{ alignItems: 'center', paddingTop: 6, gap: 9 }}><View style={[s.iconTile, { borderRadius: 30, width: 42, height: 42 }]}><MessageCircle size={21} color={c.purple} /></View><Text style={{ color: c.purple, fontSize: 11 }}>{question?.category ?? 'Carregando'}</Text></View>
              <Text style={s.question}>{question?.prompt ?? 'Carregando a próxima pergunta…'}</Text><Text style={s.hint}>{question?.hint}</Text>
              {room.phase === 'rating' ? <View style={s.ratingBlock}><Text style={s.ratingLabel}>Essa pergunta rendeu uma boa conversa?</Text><Stars label="Pergunta" value={rating} onChange={setRating} disabled={busy || !!savedRating} /><View style={s.between}><Text style={s.starLabel}>Nem tanto</Text><Text style={s.starLabel}>Rendeu muito!</Text></View>{savedRating ? <Text style={{ color: c.success, textAlign: 'center', fontSize: 12, marginTop: 12 }}>✓ Sua avaliação foi registrada</Text> : <Button title="Enviar avaliação" busy={busy} disabled={!rating} onPress={submitRating} />}</View> : <View style={s.discussNote}><Users size={16} color={c.muted} /><Text style={{ color: c.muted, fontSize: 11 }}>Escute, compartilhe, descubra outro ponto de vista.</Text></View>}
            </Card></View>
            <View style={s.dots}>{Array.from({ length: room.question_count }, (_, i) => <View key={i} style={[s.progressDot, i === room.current_question && { width: 20, backgroundColor: '#fff' }, i < room.current_question && { backgroundColor: '#D8C3F4' }]} />)}</View>

          </>}
        </>}
      </View>
    </ScrollArea>
    <View style={s.actionBar}>
      {host && room.phase === 'lobby' && (data.questions.length ? <Button title="Começar a dinâmica" busy={busy} onPress={advance} icon={<ArrowRight size={18} color="#fff" />} /> : <Button title="Gerar perguntas com IA" busy={busy} onPress={() => void act(async () => { await generateQuestions(room.id); })} icon={<Sparkles size={18} color="#fff" />} />)}
      {room.phase !== 'lobby' && !isFinished && (host ? <View style={{ gap: 6 }}><View style={s.between}><Text style={s.whiteSubtitle}>{room.phase === 'rating' ? `${votes.length} de ${data.members.length} avaliações` : 'Todo mundo já compartilhou?'}</Text>{room.phase === 'rating' && <Text style={{ color: '#fff', fontSize: 12 }}>{votes.length ? average(votes).toFixed(1) + ' ★' : ''}</Text>}</View><Button secondary title={room.phase === 'discussion' ? 'Encerrar pergunta e avaliar' : room.current_question + 1 >= room.question_count ? 'Finalizar encontro' : 'Próxima pergunta'} busy={busy} onPress={() => room.phase === 'rating' && votes.length < data.members.length && !demo ? setModal('advance') : advance()} icon={<ChevronRight size={19} color={c.purple} />} /></View> : <View style={s.textButton}><View style={[s.dot, { position: 'relative', backgroundColor: '#D9C9F0', right: 0, top: 0 }]} /><Text style={s.whiteSubtitle}>{room.phase === 'rating' && savedRating ? 'Aguardando a próxima pergunta…' : 'A anfitriã conduz a conversa.'}</Text></View>)}
      {isFinished ? <Button title="Voltar para o início" secondary onPress={onLeave} /> : <Pressable accessibilityRole="button" onPress={() => setModal('leave')} style={s.textButton}><LogOut size={15} color="#EFE7FB" /><Text style={{ color: '#EFE7FB', fontSize: 12 }}>{host ? 'Sair da sala' : 'Sair do encontro'}</Text></Pressable>}
    </View>
    <Modal visible={!!questionsModal} transparent animationType="slide" onRequestClose={() => setQuestionsModal(null)}><View style={[s.overlay, { paddingBottom: keyboard }]}><Card style={{ width: '100%', maxWidth: 400, maxHeight: '90%', padding: 20 }}><View style={s.between}><Text style={[t.section, { flex: 1 }]}>{questionsModal === 'write' ? 'A conversa começa com você' : 'Perguntas do encontro'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Fechar perguntas" onPress={() => setQuestionsModal(null)} style={{ padding: 8 }}><X size={20} color={c.muted} /></Pressable></View><ScrollArea compact avoidKeyboard={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 18 }}>
      {questionsModal === 'write' ? <><Text style={t.subtitle}>Escreva {room.question_count} perguntas abertas para discutir com o clube.</Text>{drafts.map((prompt, index) => <Input key={index} label={`Pergunta ${index + 1}`} multiline maxLength={600} value={prompt} onChangeText={value => setDrafts(previous => previous.map((text, i) => i === index ? value : text))} placeholder="O que vocês gostariam de conversar?" />)}</> : data.questions.map((q, index) => <View key={q.id} style={{ gap: 10 }}><Badge>{index + 1} · {q.category}</Badge><Text style={{ color: c.ink, fontSize: 16, lineHeight: 23 }}>{q.prompt}</Text><Text style={t.subtitle}>{q.hint}</Text></View>)}
    </ScrollArea>{questionsModal === 'write' && <><ErrorMessage message={error} /><Button title="Preparar estas perguntas" busy={busy} onPress={saveQuestions} /></>}</Card></View></Modal>
    <Modal visible={!!modal} transparent animationType="fade" onRequestClose={() => setModal(null)}>
      <View style={s.overlay}><Card style={{ width: '100%', maxWidth: 370, maxHeight: '90%', gap: 18 }}><View style={s.between}><Text style={[t.section, { flex: 1 }]}>{modal === 'share' ? 'Tem lugar para mais um.' : modal === 'advance' ? 'Ainda faltam algumas estrelas' : 'Sair do encontro?'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={() => setModal(null)} style={{ padding: 8 }}><X size={20} color={c.muted} /></Pressable></View>
        <ScrollArea compact contentContainerStyle={{ gap: 18 }}>{modal === 'share' ? <><Text style={t.subtitle}>{demo ? 'Este código é apenas da demonstração local.' : 'Compartilhe o código ou o QR para entrar no encontro.'}</Text>{!demo && <View style={{ alignItems: 'center', padding: 12 }}><QRCode value={joinUrl} size={176} color={c.purpleDark} backgroundColor="#fff" /></View>}<Text style={{ fontSize: 34, letterSpacing: 6, color: c.purple, fontWeight: '700', textAlign: 'center' }}>{room.code}</Text><Button title={copied ? 'Código copiado!' : 'Copiar código'} onPress={() => void act(async () => { await Clipboard.setStringAsync(room.code); setCopied(true); })} icon={<Copy size={17} color="#fff" />} />{!demo && <Button title="Compartilhar convite" secondary onPress={() => void act(async () => { await Share.share({ message: `Vamos ler juntos? Entre no Skoolk com o código ${room.code}: ${joinUrl}` }); })} icon={<Share2 size={17} color={c.purple} />} />}</> : <><Text style={t.subtitle}>{modal === 'advance' ? 'Ao continuar, a avaliação desta pergunta será encerrada para todos. Você pode esperar mais um pouco.' : host ? 'O encontro continua aberto. Você pode voltar pelo painel da anfitriã.' : 'Você poderá voltar usando o mesmo código e nome neste dispositivo.'}</Text><Button title={modal === 'advance' ? 'Continuar agora' : 'Sair da sala'} onPress={modal === 'advance' ? advance : onLeave} /><Button title={modal === 'advance' ? 'Esperar os leitores' : 'Continuar no encontro'} secondary onPress={() => setModal(null)} /></>}
      </ScrollArea></Card></View>
    </Modal>
  </LinearGradient>;
}
const s = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20, padding: 28, backgroundColor: c.background },
  actionBar: { flexShrink: 0, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 4, gap: 2, backgroundColor: '#6542A1', borderTopWidth: 1, borderTopColor: '#FFFFFF24' },
  roomHeader: { backgroundColor: '#50318D44', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 14, gap: 12 },
  topline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, wordmark: { color: '#fff', fontSize: 25, fontWeight: '800', letterSpacing: -1.4 },
  bookRow: { flexDirection: 'row', alignItems: 'center', gap: 14 }, bookTitle: { color: '#fff', fontSize: 17, fontWeight: '600', letterSpacing: -.3 }, author: { color: '#E0D3F2', fontSize: 12 }, chapters: { color: '#D9C7F0', fontSize: 10 },
  iconButton: { width: 42, height: 42, backgroundColor: '#FFFFFF16', borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  roomStats: { flexDirection: 'row', backgroundColor: '#FFFFFF12', borderWidth: 1, borderColor: '#FFFFFF25', borderRadius: 14, padding: 12, position: 'relative' },
  stat: { flex: 1, gap: 5, alignItems: 'center' }, statLabel: { color: '#D8C7EF', fontSize: 10 }, statDivider: { width: 1, backgroundColor: '#FFFFFF25' }, code: { color: '#fff', fontSize: 15, fontWeight: '600', letterSpacing: 1.4 },
  row: { flexDirection: 'row', gap: 9, alignItems: 'center' }, between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, position: 'absolute', right: 12, top: 12 },
  whiteTitle: { color: '#fff', fontSize: 25, fontWeight: '600', letterSpacing: -.7, lineHeight: 32 }, whiteSubtitle: { color: '#E5D9F6', fontSize: 12, lineHeight: 20 },
  members: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, member: { width: 56, alignItems: 'center', gap: 7 }, memberName: { color: c.ink, fontSize: 11 },
  iconTile: { width: 50, height: 54, alignItems: 'center', justifyContent: 'center', backgroundColor: c.lilac, borderRadius: 14 },
  textButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 9, minHeight: 44 },
  tabs: { flexDirection: 'row', paddingHorizontal: 20, gap: 25 }, tab: { flex: 1, alignItems: 'center', paddingBottom: 12, borderBottomWidth: 2, borderColor: 'transparent' }, tabActive: { borderColor: '#fff' }, tabText: { color: '#D0BCEA', fontSize: 13 },
  synopsis: { color: '#8D809B', fontSize: 14, lineHeight: 24, textAlign: 'center' },
  cardStack: { marginRight: 10, marginBottom: 12 }, stackBack: { position: 'absolute', top: 24, left: 18, right: -14, bottom: -14, backgroundColor: '#FFFFFF40', borderRadius: 24, transform: [{ rotate: '2deg' }] }, stackMiddle: { position: 'absolute', top: 12, left: 10, right: -7, bottom: -7, backgroundColor: '#D9C9EF', borderRadius: 24, transform: [{ rotate: '1deg' }] },
  question: { color: c.ink, fontSize: 23, textAlign: 'center', lineHeight: 31, fontWeight: '500', letterSpacing: -.6 }, hint: { color: '#9A8AA9', fontSize: 12, lineHeight: 19, textAlign: 'center', paddingHorizontal: 5 },
  ratingBlock: { borderTopWidth: 1, borderColor: c.line, paddingTop: 18, gap: 9 }, ratingLabel: { color: c.muted, fontSize: 11, textAlign: 'center' }, starLabel: { color: '#A79AB5', fontSize: 9, paddingHorizontal: 6 },
  discussNote: { borderTopWidth: 1, borderColor: c.line, paddingTop: 18, alignItems: 'center', gap: 9 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: 6 }, progressDot: { height: 5, width: 5, backgroundColor: '#B398D5', borderRadius: 10 },
  finishHero: { gap: 15, alignItems: 'center', paddingVertical: 15 }, finishIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFFFFF18', alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, backgroundColor: '#241630AA', justifyContent: 'center', alignItems: 'center', padding: 24 },
});
