import { ref, set, onValue, off, onDisconnect } from "firebase/database";
import { getDb } from "./firebase";

export interface UserPresence {
  online: boolean;
  lastSeen: number;
}

/**
 * Kullanıcıyı online olarak işaretle.
 * Firebase bağlantısı kesilince otomatik offline olur.
 * Dönen fonksiyon ile aboneliği iptal edebilirsin.
 */
export function initPresence(username: string): () => void {
  const db = getDb();
  if (!db) return () => {};

  const presRef = ref(db, `presence/${username}`);
  const connRef = ref(db, ".info/connected");

  const handler = (snap: { val: () => boolean | null }) => {
    if (!snap.val()) return;
    onDisconnect(presRef)
      .set({ online: false, lastSeen: Date.now() })
      .catch(() => {});
    set(presRef, { online: true, lastSeen: Date.now() }).catch(() => {});
  };

  onValue(connRef, handler);

  return () => {
    off(connRef, "value", handler as Parameters<typeof off>[2]);
    set(presRef, { online: false, lastSeen: Date.now() }).catch(() => {});
  };
}

/** Bir kullanıcının online durumunu gerçek zamanlı dinle */
export function subscribeToPresence(
  username: string,
  callback: (p: UserPresence | null) => void
): () => void {
  const db = getDb();
  if (!db) return () => {};
  const r = ref(db, `presence/${username}`);
  onValue(r, (snap) => callback(snap.val() as UserPresence | null));
  return () => off(r);
}

/** Birden fazla kullanıcının online durumunu dinle */
export function subscribeToMultiplePresences(
  usernames: string[],
  callback: (presences: Record<string, UserPresence>) => void
): () => void {
  if (usernames.length === 0) return () => {};
  const db = getDb();
  if (!db) return () => {};

  const state: Record<string, UserPresence> = {};
  const unsubs: Array<() => void> = [];

  usernames.forEach((u) => {
    const r = ref(db, `presence/${u}`);
    onValue(r, (snap) => {
      state[u] = snap.val() as UserPresence;
      callback({ ...state });
    });
    unsubs.push(() => off(r));
  });

  return () => unsubs.forEach((fn) => fn());
}
