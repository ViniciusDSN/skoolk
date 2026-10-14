import React from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { BookOpen, ChevronLeft, Star } from 'lucide-react-native';
import { colors as c, avatarColors } from '../theme';
import { avatarIcons } from './avatars';

export function Button({ title, onPress, busy = false, disabled = false, secondary = false, icon, testID }: {
  title: string; onPress: () => void; busy?: boolean; disabled?: boolean; secondary?: boolean; icon?: React.ReactNode; testID?: string;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: disabled || busy, busy }} testID={testID}
    onPress={onPress} disabled={disabled || busy} style={({ pressed }) => [s.button, secondary && s.secondary, (disabled || busy) && { opacity: .5 }, pressed && { opacity: .8, transform: [{ scale: .985 }] }]}>
    {busy ? <ActivityIndicator color={secondary ? c.purple : '#fff'} /> : icon}
    <Text style={[s.buttonText, secondary && { color: c.purple }]}>{title}</Text>
  </Pressable>;
}
export function Input({ label, error, ...props }: TextInputProps & { label?: string; error?: boolean }) {
  return <View style={{ gap: 8 }}>
    {label && <Text style={s.label}>{label}</Text>}
    <TextInput accessibilityLabel={label ?? props.placeholder} placeholderTextColor="#AA9FB7" {...props} style={[s.input, props.multiline && { minHeight: 112, textAlignVertical: 'top' }, error && { borderColor: c.danger }, props.style]} />
  </View>;
}
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}
export function ErrorMessage({ message }: { message: string | null }) {
  return message ? <View accessibilityRole="alert" style={s.error}><Text style={{ color: c.danger, fontSize: 13, lineHeight: 20 }}>{message}</Text></View> : null;
}
export function Stars({ value, onChange, disabled, size = 34, label = 'Avaliação' }: {
  value: number; onChange?: (value: number) => void; disabled?: boolean; size?: number; label?: string;
}) {
  return <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
    {[1, 2, 3, 4, 5].map(n => <Pressable key={n} accessibilityRole="button" accessibilityLabel={`${label}: ${n} ${n === 1 ? 'estrela' : 'estrelas'}`}
      accessibilityState={{ selected: value === n, disabled: disabled || !onChange }} disabled={disabled || !onChange} onPress={() => onChange?.(n)}
      style={({ pressed }) => ({ flex: 1, minWidth: 36, minHeight: 48, alignItems: 'center', justifyContent: 'center', opacity: pressed ? .65 : 1 })}>
      <Star size={size} strokeWidth={1.3} color={n <= value ? c.purple : '#DDD4E8'} fill={n <= value ? c.purple : '#EEE8F5'} />
    </Pressable>)}
  </View>;
}
export function Avatar({ name, index, size = 48 }: { name: string; index: number; size?: number }) {
  const Icon = avatarIcons[index % avatarIcons.length];
  return <View accessibilityLabel={name} style={{ width: size, height: size, borderRadius: size * .36, alignItems: 'center', justifyContent: 'center', backgroundColor: avatarColors[index % avatarColors.length] }}><Icon size={size * .46} color={c.purpleDark} strokeWidth={1.6} /></View>;
}
export function BookCover({ title, uri, small = false }: { title: string; uri?: string | null; small?: boolean }) {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [uri]);
  const width = small ? 44 : 96, height = small ? 63 : 142;
  if (uri && !failed) return <Image source={{ uri }} onError={() => setFailed(true)} style={{ width, height, borderRadius: 7, backgroundColor: c.lilac }} accessibilityLabel={`Capa de ${title}`} />;
  return <View style={{ width, height, borderRadius: 7, backgroundColor: '#E9D5AF', borderLeftWidth: 5, borderLeftColor: '#C4A575', padding: small ? 5 : 10, alignItems: 'center', justifyContent: 'space-between', overflow: 'hidden' }}>
    <Text style={{ color: '#665139', fontSize: small ? 5 : 8, letterSpacing: small ? 0 : 1.5 }}>CLUBE DO LIVRO</Text>
    <BookOpen size={small ? 18 : 34} color="#786043" strokeWidth={1.1} />
    <Text numberOfLines={3} style={{ fontFamily: 'Georgia', fontSize: small ? 8 : 14, color: '#493C2C', textAlign: 'center' }}>{title}</Text>
  </View>;
}
export function Back({ onPress, light = false }: { onPress: () => void; light?: boolean }) {
  return <Pressable accessibilityLabel="Voltar" accessibilityRole="button" onPress={onPress} style={s.back}>
    <ChevronLeft color={light ? '#fff' : c.ink} size={22} />
  </Pressable>;
}
export function Badge({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return <View style={[s.badge, light && { backgroundColor: '#FFFFFF20' }]}><Text style={[s.badgeText, light && { color: '#F1E9FF' }]}>{children}</Text></View>;
}
export const typography = StyleSheet.create({
  title: { fontSize: 30, fontWeight: '700', letterSpacing: -1, color: c.ink, lineHeight: 37 },
  subtitle: { fontSize: 14, color: c.muted, lineHeight: 22 },
  section: { fontSize: 16, fontWeight: '600', color: c.ink },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: c.purple, textTransform: 'uppercase' },
});
const s = StyleSheet.create({
  button: { minHeight: 54, paddingHorizontal: 20, borderRadius: 16, backgroundColor: c.purple, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  secondary: { backgroundColor: c.lilac }, buttonText: { flexShrink: 1, textAlign: 'center', paddingVertical: 12, color: '#fff', fontSize: 14, fontWeight: '600' },
  label: { color: c.ink, fontWeight: '600', fontSize: 12 },
  input: { backgroundColor: '#FCFAFF', borderWidth: 1, borderColor: c.line, borderRadius: 14, minHeight: 54, paddingHorizontal: 16, paddingVertical: 14, color: c.ink, fontSize: 15 },
  card: { padding: 24, borderRadius: 24, backgroundColor: '#fff', borderWidth: 1, borderColor: '#F0EBF6', gap: 18 },
  error: { padding: 14, borderRadius: 12, backgroundColor: '#FFF0F3' },
  back: { width: 44, height: 44, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  badge: { backgroundColor: c.lilac, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start' },
  badgeText: { color: c.purple, fontSize: 10, fontWeight: '600', letterSpacing: .3 },
});
