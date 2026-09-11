import 'react-native-url-polyfill/auto';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const configured = Boolean(url && key);
// Large sessions are split into SecureStore entries on native platforms.
const secureStorage = {
  async getItem(key: string) {
    const count = Number(await SecureStore.getItemAsync(`${key}.count`) ?? 0);
    if (!count) return null;
    const pieces = await Promise.all(Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(`${key}.${i}`)));
    return pieces.some(p => p === null) ? null : pieces.join('');
  },
  async setItem(key: string, value: string) {
    await secureStorage.removeItem(key);
    const chunks = value.match(/.{1,1500}/gs) ?? [];
    for (let i = 0; i < chunks.length; i++) await SecureStore.setItemAsync(`${key}.${i}`, chunks[i]);
    await SecureStore.setItemAsync(`${key}.count`, String(chunks.length));
  },
  async removeItem(key: string) {
    const count = Number(await SecureStore.getItemAsync(`${key}.count`) ?? 0);
    for (let i = 0; i < count; i++) await SecureStore.deleteItemAsync(`${key}.${i}`);
    await SecureStore.deleteItemAsync(`${key}.count`);
  },
};
export const supabase = configured ? createClient(url!, key!, {
  auth: { storage: Platform.OS === 'web' ? AsyncStorage : secureStorage, autoRefreshToken: true,
    persistSession: true, detectSessionInUrl: false },
}) : null;
if (Platform.OS !== 'web' && supabase) {
  AppState.addEventListener('change', state => state === 'active' ? supabase.auth.startAutoRefresh() : supabase.auth.stopAutoRefresh());
}
export function db() {
  if (!supabase) throw new Error('Configure a conexão com o Supabase para usar salas ao vivo.');
  return supabase;
}
