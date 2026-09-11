import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { loadRoom } from '../lib/api';
import { db } from '../lib/supabase';
import { demoSnapshot } from '../demo';
import { friendlyError } from '../domain';
import type { RoomSnapshot } from '../types';

export function useRoom(id: string, demo: boolean) {
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(demo ? JSON.parse(JSON.stringify(demoSnapshot)) : null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(demo);
  const active = useRef(true), serial = useRef(0);
  const refresh = useCallback(async () => {
    if (demo) return;
    const request = ++serial.current;
    try {
      const data = await loadRoom(id);
      if (active.current && request === serial.current) { setSnapshot(data); setError(null); }
    } catch (e) { if (active.current && request === serial.current) setError(friendlyError(e)); }
  }, [id, demo]);
  useEffect(() => {
    active.current = true;
    if (demo) return () => { active.current = false; };
    void refresh();
    const channel = db().channel(`room:${id}`, { config: { postgres_changes_options: { wait: true } } });
    ['skoolk_rooms', 'skoolk_members', 'skoolk_questions', 'skoolk_ratings', 'skoolk_feedback'].forEach(table => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `${table === 'skoolk_rooms' ? 'id' : 'room_id'}=eq.${id}` }, () => void refresh());
    });
    channel.subscribe(status => {
      if (!active.current) return;
      setConnected(status === 'SUBSCRIBED');
      if (status === 'SUBSCRIBED') void refresh();
    });
    // Recover changes missed while the phone sleeps or Realtime reconnects.
    const timer = setInterval(() => { if (AppState.currentState === 'active' || !AppState.currentState) void refresh(); }, 7000);
    const appState = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { active.current = false; clearInterval(timer); appState.remove(); void db().removeChannel(channel); };
  }, [id, demo, refresh]);
  return { snapshot, setSnapshot, error, connected, refresh };
}
