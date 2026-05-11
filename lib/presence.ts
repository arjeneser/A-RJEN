import { ref, set, onValue, off, onDisconnect, serverTimestamp } from "firebase/database";
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

  let intervalId: ReturnType<typeof setInterval> | null = null;

  const handler = (snap: { val: () => boolean | null }) => {
    if (!snap.val()) return;
    onDisconnect(presRef)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .set({ online: false, lastSeen: serverTimestamp() as any })
      .catch(() => {});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    set(presRef, { online: true, lastSeen: serverTimestamp() as any }).catch(() => {});

    // Her 60 saniyede bir presence'ı güncelle — max 60s sapma
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      set(presRef, { online: true, lastSeen: serverTimestamp() as any }).catch(() => {});
    }, 60_000);
  };

  onValue(connRef, handler);

  return () => {
    off(connRef, "value", handler as Parameters<typeof off>[2]);
    if (intervalId) clearInterval(intervalId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    set(presRef, { online: false, lastSeen: serverTimestamp() as any }).catch(() => {});
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
  // Return the per-listener unsubscribe from onValue, not off(r) which kills all listeners
  return onValue(r, (snap) => callback(snap.val() as UserPresence | null));
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
    unsubs.push(
      onValue(r, (snap) => {
        state[u] = snap.val() as UserPresence;
        callback({ ...state });
      })
    );
  });

  return () => unsubs.forEach((fn) => fn());
}
