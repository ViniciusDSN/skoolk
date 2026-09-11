import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ArrowRight, BookOpen, Check, ChevronRight, Crown, Heart, LogOut, Plus, Sparkles, X } from 'lucide-react-native';
import type { Session } from '@supabase/supabase-js';
import { Avatar, Back, Badge, BookCover, Button, Card, ErrorMessage, Input, typography as t } from './src/components/ui';
import { colors as c, avatarColors, avatarEmoji } from './src/theme';
import { configured, db, supabase } from './src/lib/supabase';
import { createRoom, ensureReader, listBooks, rpc } from './src/lib/api';
import { friendlyError, normalizeCode, validateChapters, validateJoin } from './src/domain';
import { ScrollArea } from './src/components/ScrollArea';
import { RoomScreen } from './src/screens/RoomScreen';
import type { Book, Room } from './src/types';

type Screen = 'home' | 'auth' | 'host' | 'create' | 'room';
const initialBook: Book = { id: 'starter', title: 'A Toca da Raposa', author: 'Nora Sakavic', synopsis: 'Neil Josten se junta aos Raposas, o time de Exy da Universidade de Palmetto State. Entre segredos e alianças improváveis, o grupo enfrenta os desafios de confiar e pertencer. Discuta apenas os acontecimentos dos capítulos selecionados.', cover_url: null };
const emptyBook: Book = { id: '', title: '', author: '', synopsis: '', cover_url: null };
export default function App() {
  const [screen, setScreen] = useState<Screen>('home'), [session, setSession] = useState<Session | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null), [demo, setDemo] = useState(false);
  const [ready, setReady] = useState(false), [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const [code, setCode] = useState(''), [name, setName] = useState(''), [avatar, setAvatar] = useState(0);
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [signup, setSignup] = useState(false), [notice, setNotice] = useState<string | null>(null);
  const [books, setBooks] = useState<Book[]>([]), [rooms, setRooms] = useState<Room[]>([]);
  const [book, setBook] = useState<Book>(initialBook), [start, setStart] = useState('1'), [end, setEnd] = useState('12'), [count, setCount] = useState(6);
  const [bookModal, setBookModal] = useState(false), [bookDraft, setBookDraft] = useState<Book>(emptyBook);
  const isHost = !!session && !session.user.is_anonymous;
  const navigate = (next: Screen) => { setScreen(next); setError(null); setNotice(null); };
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await action(); } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  };
  useEffect(() => {
    let mounted = true;
    const applyLink = (url: string) => { const value = Linking.parse(url).queryParams?.code; if (typeof value === 'string') { setCode(normalizeCode(value)); setScreen('home'); } };
    const linkSub = Linking.addEventListener('url', ({ url }) => applyLink(url));
    const authSub = supabase?.auth.onAuthStateChange((_event, next) => { if (mounted) setSession(next); });
    void (async () => {
      try {
        const storedName = await AsyncStorage.getItem('skoolk.nickname');
        if (storedName && mounted) setName(storedName);
        const current = (await supabase?.auth.getSession())?.data.session;
        if (mounted && current) {
          setSession(current);
          const previous = await AsyncStorage.getItem(`skoolk.room.${current.user.id}`);
          if (previous && mounted) { setRoomId(previous); setScreen('room'); }
        }
        const url = await Linking.getInitialURL(); if (url && mounted) applyLink(url);
      } catch (e) { if (mounted) setError(friendlyError(e)); }
      finally { if (mounted) setReady(true); }
    })();
    return () => { mounted = false; authSub?.data.subscription.unsubscribe(); linkSub.remove(); };
  }, []);
  const enterRoom = async (id: string, user = session?.user.id) => {
    setDemo(false); setRoomId(id); if (user) await AsyncStorage.setItem(`skoolk.room.${user}`, id); navigate('room');
  };
  const leaveRoom = () => { if (session) void AsyncStorage.removeItem(`skoolk.room.${session.user.id}`); setDemo(false); setRoomId(null); navigate('home'); };
  const refreshHost = async () => {
    const [b, r] = await Promise.all([listBooks(), db().from('skoolk_rooms').select('*').eq('host_id', session!.user.id).order('created_at', { ascending: false }).limit(30)]);
    if (r.error) throw r.error; setBooks(b); setRooms(r.data as Room[]);
  };
  useEffect(() => { if (screen === 'host' && isHost) void run(refreshHost); }, [screen, session?.user.id]);
  const join = () => void run(async () => {
    const message = validateJoin(code, name); if (message) throw new Error(message);
    const user = await ensureReader();
    const id = await rpc<string | null>('skoolk_join_room', { p_code: code, p_nickname: name.trim(), p_avatar: avatar });
    if (!id) throw new Error('Sala não encontrada ou encerrada. Confira o código; após muitas tentativas, aguarde um minuto.');
    await AsyncStorage.setItem('skoolk.nickname', name.trim()); await enterRoom(id, user.id);
  });
  const authenticate = () => void run(async () => {
    if (!email.trim() || password.length < 8) throw new Error('Informe seu e-mail e uma senha de pelo menos 8 caracteres.');
    const result = signup ? await db().auth.signUp({ email: email.trim(), password }) : await db().auth.signInWithPassword({ email: email.trim(), password });
    if (result.error) throw result.error;
    if (!result.data.session) { setNotice('Confira seu e-mail para confirmar a conta. Depois, entre com sua senha.'); setSignup(false); return; }
    setSession(result.data.session); setPassword(''); navigate('host');
  });
  const saveBook = () => void run(async () => {
    if (!bookDraft.title.trim() || !bookDraft.author.trim()) throw new Error('Preencha o título e a autoria do livro.');
    if (bookDraft.cover_url && !/^https:\/\//.test(bookDraft.cover_url)) throw new Error('A imagem da capa deve usar um endereço HTTPS.');
    const { data, error } = await db().from('skoolk_books').insert({ owner_id: session!.user.id, title: bookDraft.title.trim(), author: bookDraft.author.trim(), synopsis: bookDraft.synopsis.trim(), cover_url: bookDraft.cover_url || null }).select().single();
    if (error) throw error; setBooks([data, ...books]); setBook(data); setBookModal(false);
  });
  const create = () => void run(async () => {
    const message = validateChapters(Number(start), Number(end)); if (message) throw new Error(message);
    if (name.trim().length < 2 || name.trim().length > 24) throw new Error('Escolha seu nome de anfitriã, entre 2 e 24 caracteres.');
    await enterRoom(await createRoom({ book, chapterStart: Number(start), chapterEnd: Number(end), questionCount: count, nickname: name.trim() }));
  });
  const addBook = () => { setBookDraft(emptyBook); setError(null); setBookModal(true); };
  const lightStatus = screen === 'home' || screen === 'room';
  return <SafeAreaProvider><View style={s.outer}><SafeAreaView style={[s.app, { backgroundColor: lightStatus ? c.purple : c.background }]} edges={['top', 'bottom']}>
    <StatusBar style={lightStatus ? 'light' : 'dark'} />
    {!ready ? <View style={s.loading}><ActivityIndicator color="#fff" size="large" /><Text style={{ color: '#fff', fontSize: 28, fontWeight: '700' }}>skoolk.</Text></View> : screen === 'room' && roomId ? <RoomScreen key={roomId} roomId={roomId} userId={session?.user.id ?? ''} demo={demo} onLeave={leaveRoom} /> : <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollArea contentContainerStyle={{ flexGrow: 1, paddingBottom: 28, backgroundColor: c.background }} keyboardShouldPersistTaps="handled">
      {screen === 'home' ? <>
        <LinearGradient colors={['#926CE4', '#7550B8']} style={s.hero}>
          <View style={s.between}><Text style={s.wordmark}>skoolk<Text style={{ color: '#DCCBF6' }}>.</Text></Text><View style={s.heart}><Heart size={19} color="#E6D7FD" strokeWidth={1.5} /></View></View>
          <View style={{ gap: 10, paddingTop: 30 }}><Text style={s.heroEyebrow}>HISTÓRIAS QUE APROXIMAM</Text><Text style={s.heroTitle}>Um livro.{'\n'}Muitos pontos{'\n'}de vista.</Text><Text style={s.heroSubtitle}>Seu clube do livro, na mesma página.</Text></View>
          <View style={s.heroFooter}><View style={{ flexDirection: 'row' }}>{[3, 0, 4].map((v, i) => <View key={v} style={{ marginLeft: i ? -8 : 0, borderWidth: 3, borderColor: '#7B56BD', borderRadius: 18 }}><Avatar name="Leitores" index={v} size={30} /></View>)}</View><Text style={{ color: '#E3D4F7', fontSize: 11 }}>A melhor parte da leitura{'\n'}é o que a gente compartilha.</Text><Sparkles size={27} color="#D3B9F7" strokeWidth={1} style={{ marginLeft: 'auto' }} /></View>
        </LinearGradient>
        <View style={s.content}>
          <Card style={{ marginTop: -20, gap: 19 }}><View style={{ gap: 5 }}><Text style={[t.title, { fontSize: 25 }]}>Entre na conversa</Text><Text style={t.subtitle}>Pegue o código com a anfitriã e chegue mais.</Text></View>
            <Input label="Código do encontro" placeholder="EX.: ABC234" value={code} onChangeText={value => setCode(normalizeCode(value))} autoCapitalize="characters" autoCorrect={false} maxLength={6} style={{ fontSize: 19, letterSpacing: 5, fontWeight: '600' }} />
            <Input label="Como podemos te chamar?" placeholder="Seu nome ou apelido" value={name} onChangeText={setName} maxLength={24} autoComplete="nickname" onSubmitEditing={join} returnKeyType="go" />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>{avatarEmoji.map((emoji, i) => <Pressable key={emoji} accessibilityRole="button" accessibilityLabel={`Avatar ${i + 1}`} accessibilityState={{ selected: avatar === i }} onPress={() => setAvatar(i)} style={[s.avatarOption, { backgroundColor: avatarColors[i], borderColor: avatar === i ? c.purple : 'transparent' }]}><Text style={{ fontSize: 22 }}>{emoji}</Text></Pressable>)}</View>
            <ErrorMessage message={error} /><Button title="Entrar no encontro" onPress={join} busy={busy} icon={<ArrowRight size={18} color="#fff" />} /><View style={[s.row, { justifyContent: 'center', gap: 5 }]}><Check size={12} color={c.muted} /><Text style={{ fontSize: 10, color: c.muted }}>Sem cadastro. Só você e uma boa conversa.</Text></View>
          </Card>
          <Pressable accessibilityRole="button" accessibilityLabel="Sou anfitriã" onPress={() => navigate(isHost ? 'host' : 'auth')} style={s.hostEntry}><View style={s.crown}><Crown size={22} color={c.purple} strokeWidth={1.5} /></View><View style={{ flex: 1, gap: 4 }}><Text style={{ color: c.ink, fontWeight: '600', fontSize: 13 }}>Você prepara o encontro?</Text><Text style={{ color: c.muted, fontSize: 11 }}>Acesse o espaço da anfitriã</Text></View><ChevronRight size={19} color={c.purple} /></Pressable>
          <Pressable accessibilityRole="button" onPress={() => { setDemo(true); setRoomId('demo'); navigate('room'); }} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={s.demoLink}>Conhecer o Skoolk · experimentar demonstração</Text></Pressable>
          {!configured && <Text style={{ color: c.muted, textAlign: 'center', fontSize: 11 }}>A conexão com o clube ainda está sendo preparada. A demonstração já está disponível.</Text>}
        </View>
      </> : screen === 'auth' ? <>
        <View style={s.nav}><Back onPress={() => navigate('home')} /><Text style={s.navBrand}>skoolk.</Text><View style={{ width: 44 }} /></View>
        <View style={[s.content, { gap: 28, paddingTop: 30 }]}><View style={s.largeIcon}><Crown color={c.purple} size={29} strokeWidth={1.5} /></View><View style={{ gap: 12 }}><Text style={t.eyebrow}>ESPAÇO DA ANFITRIÃ</Text><Text style={t.title}>{signup ? 'Toda boa conversa\ncomeça com você.' : 'Vamos preparar\no próximo encontro?'}</Text><Text style={t.subtitle}>{signup ? 'Crie sua conta para organizar livros e conduzir encontros.' : 'Entre na sua conta para reunir o clube.'}</Text></View>
          <Card><Input label="Seu e-mail" placeholder="voce@exemplo.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" /><Input label="Senha" placeholder="Pelo menos 8 caracteres" value={password} onChangeText={setPassword} secureTextEntry autoComplete={signup ? 'new-password' : 'current-password'} onSubmitEditing={authenticate} />
            <ErrorMessage message={error} />{notice && <Text accessibilityRole="alert" style={{ color: c.success, fontSize: 13, lineHeight: 20 }}>{notice}</Text>}<Button title={signup ? 'Criar minha conta' : 'Entrar como anfitriã'} onPress={authenticate} busy={busy} icon={<ArrowRight size={18} color="#fff" />} /></Card>
          <Pressable accessibilityRole="button" onPress={() => { setSignup(!signup); setError(null); }} style={s.centerButton}><Text style={{ color: c.purple, fontSize: 13 }}>{signup ? 'Já tenho uma conta · entrar' : 'Primeiro encontro? Crie sua conta'}</Text></Pressable>
        </View>
      </> : screen === 'host' ? <>
        <View style={s.nav}><Back onPress={() => navigate('home')} /><Text style={s.navBrand}>skoolk.</Text><Pressable accessibilityRole="button" accessibilityLabel="Sair da conta" style={s.centerButton} onPress={() => void run(async () => { const { error } = await db().auth.signOut(); if (error) throw error; navigate('home'); })}><LogOut color={c.muted} size={19} /></Pressable></View>
        <View style={[s.content, { gap: 25 }]}><View style={{ gap: 9 }}><Text style={t.eyebrow}>SEU CLUBE, SEU RITMO</Text><Text style={t.title}>Bom ter você aqui.</Text><Text style={t.subtitle}>Qual história vai reunir a gente hoje?</Text></View>
          <LinearGradient colors={['#8F68DD', '#6B44AD']} style={s.hostHero}><View style={s.between}><View style={s.heart}><BookOpen size={24} color="#fff" /></View><Sparkles size={23} color="#D8C4FA" /></View><Text style={{ color: '#fff', fontSize: 24, lineHeight: 31, fontWeight: '600', letterSpacing: -.7 }}>Uma sala aberta.{'\n'}Infinitas interpretações.</Text><Button title="Criar um encontro" secondary onPress={() => { if (books.length) setBook(books[0]); navigate('create'); }} icon={<Plus size={18} color={c.purple} />} /></LinearGradient>
          <ErrorMessage message={error} />
          <View style={s.between}><Text style={t.section}>Seus encontros</Text><Pressable accessibilityRole="button" onPress={() => void run(refreshHost)} style={s.centerButton}><Text style={{ color: c.purple, fontSize: 12 }}>Atualizar</Text></Pressable></View>
          {busy && <ActivityIndicator color={c.purple} />}{!rooms.length && !busy ? <Card><Text style={t.subtitle}>Seu primeiro encontro está esperando por você. Escolha um livro e convide o clube.</Text></Card> : rooms.map(r => <Pressable key={r.id} accessibilityRole="button" accessibilityLabel={`Abrir encontro ${r.book_title} ${r.code}`} onPress={() => void run(async () => { await enterRoom(r.id); })}><Card style={{ padding: 18 }}><View style={s.row}><BookCover title={r.book_title} uri={r.cover_url} small /><View style={{ flex: 1, gap: 7 }}><Text style={{ color: c.ink, fontSize: 14, fontWeight: '600' }}>{r.book_title}</Text><Text style={{ color: c.muted, fontSize: 11 }}>{r.code} · Cap. {r.chapter_start}–{r.chapter_end}</Text><Badge>{r.phase === 'finished' ? 'FINALIZADO' : r.phase === 'lobby' ? 'SALA DE ESPERA' : 'EM ANDAMENTO'}</Badge></View><ChevronRight size={17} color={c.purple} /></View></Card></Pressable>)}
          <View style={s.between}><Text style={t.section}>Sua estante</Text><Pressable accessibilityRole="button" onPress={addBook} style={s.centerButton}><Plus size={18} color={c.purple} /><Text style={{ color: c.purple, fontSize: 12 }}>Adicionar</Text></Pressable></View>
          <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ gap: 20 }}>{(books.length ? books : [initialBook]).map(b => <Pressable key={b.id} accessibilityRole="button" accessibilityLabel={`Preparar encontro de ${b.title}`} onPress={() => { setBook(b); navigate('create'); }} style={{ width: 106, gap: 9 }}><BookCover title={b.title} uri={b.cover_url} /><Text numberOfLines={2} style={{ color: c.ink, fontSize: 12, fontWeight: '500' }}>{b.title}</Text><Text numberOfLines={1} style={{ color: c.muted, fontSize: 10 }}>{b.author}</Text></Pressable>)}</ScrollView>
        </View>
      </> : <>
        <View style={s.nav}><Back onPress={() => navigate('host')} /><Text style={s.navTitle}>Novo encontro</Text><Badge>01 / 01</Badge></View>
        <View style={[s.content, { gap: 23 }]}><View style={{ gap: 8 }}><Text style={t.title}>Qual é a leitura{'\n'}da vez?</Text><Text style={t.subtitle}>Escolha o livro. A gente ajuda com a conversa.</Text></View>
          <Card><Text style={t.eyebrow}>LIVRO DO ENCONTRO</Text>{[...books, ...(books.some(b => b.id === book.id) ? [] : [book])].map(b => <Pressable accessibilityRole="radio" accessibilityState={{ checked: b.id === book.id }} key={b.id} onPress={() => setBook(b)} style={[s.bookSelect, b.id === book.id && { borderColor: c.purple, backgroundColor: '#FAF7FF' }]}><BookCover title={b.title} uri={b.cover_url} small /><View style={{ flex: 1, gap: 5 }}><Text style={{ color: c.ink, fontSize: 14, fontWeight: '600' }}>{b.title}</Text><Text style={{ color: c.muted, fontSize: 11 }}>{b.author}</Text></View><View style={[s.radio, b.id === book.id && { borderColor: c.purple, backgroundColor: c.purple }]}>{b.id === book.id && <Check color="#fff" size={12} />}</View></Pressable>)}<Button title="Adicionar outro livro" secondary icon={<Plus size={17} color={c.purple} />} onPress={addBook} /></Card>
          <Card><View style={{ gap: 6 }}><Text style={t.section}>Até onde vamos conversar?</Text><Text style={[t.subtitle, { fontSize: 12 }]}>As perguntas respeitam o trecho da leitura.</Text></View><View style={s.row}><View style={{ flex: 1 }}><Input label="Do capítulo" value={start} onChangeText={setStart} keyboardType="number-pad" maxLength={4} /></View><Text style={{ color: c.muted, marginTop: 22 }}>—</Text><View style={{ flex: 1 }}><Input label="Até o capítulo" value={end} onChangeText={setEnd} keyboardType="number-pad" maxLength={4} /></View></View><Text style={t.section}>Quantas perguntas?</Text><View style={{ flexDirection: 'row', gap: 10 }}>{[3, 6, 9, 12].map(n => <Pressable key={n} accessibilityRole="radio" accessibilityLabel={`${n} perguntas`} accessibilityState={{ checked: n === count }} onPress={() => setCount(n)} style={[s.count, n === count && { backgroundColor: c.purple, borderColor: c.purple }]}><Text style={{ color: count === n ? '#fff' : c.muted, fontSize: 15, fontWeight: '600' }}>{n}</Text></Pressable>)}</View><Input label="Seu nome de anfitriã" placeholder="Como o clube te chama?" value={name} onChangeText={setName} maxLength={24} /></Card>
          <ErrorMessage message={error} /><Button title="Criar sala e receber código" onPress={create} busy={busy} icon={<ArrowRight size={18} color="#fff" />} /><Text style={[t.subtitle, { fontSize: 11, textAlign: 'center' }]}>Você decide quando começar e quando seguir em frente.</Text>
        </View>
      </>}
      </ScrollArea>
    </KeyboardAvoidingView>}
    <Modal visible={bookModal} transparent animationType="slide" onRequestClose={() => setBookModal(false)}><KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={s.sheet}><ScrollArea compact keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 20 }}><View style={s.between}><Text style={t.section}>Mais uma história na estante</Text><Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={() => setBookModal(false)} style={s.centerButton}><X color={c.muted} size={20} /></Pressable></View><Input label="Título do livro" placeholder="Uma nova leitura" value={bookDraft.title} onChangeText={title => setBookDraft({ ...bookDraft, title })} maxLength={160} /><Input label="Autoria" placeholder="Quem escreveu?" value={bookDraft.author} onChangeText={author => setBookDraft({ ...bookDraft, author })} maxLength={160} /><Input label="Sinopse e contexto da leitura" placeholder="Adicione a sinopse e um resumo dos capítulos para ajudar a IA a criar perguntas precisas." multiline value={bookDraft.synopsis} onChangeText={synopsis => setBookDraft({ ...bookDraft, synopsis })} maxLength={12000} /><Input label="Link da imagem da capa (opcional)" placeholder="https://…" value={bookDraft.cover_url ?? ''} onChangeText={cover_url => setBookDraft({ ...bookDraft, cover_url })} autoCapitalize="none" keyboardType="url" /><ErrorMessage message={error} /><Button title="Guardar na estante" onPress={saveBook} busy={busy} icon={<Plus size={18} color="#fff" />} /></ScrollArea></View></KeyboardAvoidingView></Modal>
  </SafeAreaView></View></SafeAreaProvider>;
}
const s = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#EAE4F1', alignItems: 'center' }, app: { flex: 1, width: '100%', maxWidth: 480, overflow: 'hidden' }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  hero: { padding: 26, paddingBottom: 44, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 }, wordmark: { color: '#fff', fontSize: 38, fontWeight: '800', letterSpacing: -2.1 },
  heroEyebrow: { color: '#E2CFFA', fontSize: 9, letterSpacing: 2.5, fontWeight: '600' }, heroTitle: { color: '#fff', fontSize: 43, lineHeight: 48, letterSpacing: -1.6, fontWeight: '600' }, heroSubtitle: { color: '#E0CFF6', fontSize: 13, marginTop: 3 }, heroFooter: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 26 }, heart: { width: 40, height: 40, borderRadius: 15, backgroundColor: '#FFFFFF15', alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 24, gap: 18, paddingTop: 0 }, between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarOption: { height: 42, width: 36, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  hostEntry: { paddingVertical: 12, paddingHorizontal: 5, flexDirection: 'row', gap: 13, alignItems: 'center' }, crown: { backgroundColor: c.lilac, width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, demoLink: { fontSize: 10, textAlign: 'center', color: '#9483A4' },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 15, marginBottom: 12 }, navBrand: { fontSize: 27, fontWeight: '800', color: c.purple, letterSpacing: -1.5 }, navTitle: { color: c.ink, fontSize: 15, fontWeight: '600' },
  largeIcon: { backgroundColor: c.lilac, width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }, centerButton: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 5 },
  hostHero: { borderRadius: 24, padding: 24, gap: 22 }, bookSelect: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderWidth: 1, borderColor: c.line, borderRadius: 14 }, radio: { width: 19, height: 19, borderRadius: 10, borderWidth: 1.5, borderColor: c.line, alignItems: 'center', justifyContent: 'center' }, count: { flex: 1, height: 45, borderRadius: 12, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, backgroundColor: '#241630AA', justifyContent: 'flex-end', alignItems: 'center' }, sheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxWidth: 480, width: '100%', maxHeight: '92%' },
});
