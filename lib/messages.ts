import { ref, set, push, onValue, off } from "firebase/database";
import { getDb } from "./firebase";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id?: string;
  from: string;
  text: string;
  timestamp: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** İki kullanıcı arasındaki sohbet kimliği — sıralı, tutarlı */
export function conversationId(a: string, b: string): string {
  return [a, b].sort().join("__");
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/** Mesaj gönder */
export async function sendMessage(from: string, to: string, text: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  const cId    = conversationId(from, to);
  const msgRef = push(ref(db, `messages/${cId}`));
  await set(msgRef, { from, text, timestamp: Date.now() });
}

/**
 * Sohbet açıldığında okundu imlecini güncelle.
 * Karşı tarafın mesajlarının o ana kadar okunduğunu işaretler.
 */
export async function markConversationRead(
  convId: string,
  username: string
): Promise<void> {
  const db = getDb();
  if (!db) return;
  await set(ref(db, `readCursors/${convId}/${username}`), Date.now());
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

/** Sohbeti gerçek zamanlı dinle */
export function subscribeToMessages(
  user1: string,
  user2: string,
  callback: (msgs: ChatMessage[]) => void
): () => void {
  const db = getDb();
  if (!db) return () => {};
  const cId = conversationId(user1, user2);
  const r   = ref(db, `messages/${cId}`);
  onValue(r, (snap) => {
    const data = snap.val() as Record<string, Omit<ChatMessage, "id">> | null;
    const msgs: ChatMessage[] = data
      ? Object.entries(data)
          .map(([id, msg]) => ({ ...msg, id }))
          .sort((a, b) => a.timestamp - b.timestamp)
      : [];
    callback(msgs);
  });
  return () => off(r);
}

/**
 * Karşı tarafın okundu imlecini dinle.
 * `callback(readAt)` — readAt = karşı tarafın son okuduğu unix ms.
 * Kendi mesajlarının `timestamp <= readAt` ise ✓✓ göster.
 */
export function subscribeToReadCursor(
  convId: string,
  partnerUsername: string,
  callback: (readAt: number) => void
): () => void {
  const db = getDb();
  if (!db) return () => {};
  const r = ref(db, `readCursors/${convId}/${partnerUsername}`);
  onValue(r, (snap) => {
    callback(snap.val() ?? 0);
  });
  return () => off(r);
}
