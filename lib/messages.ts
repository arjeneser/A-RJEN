import { ref, set, push, onValue, off } from "firebase/database";
import { getDb } from "./firebase";

export interface ChatMessage {
  id?: string;
  from: string;
  text: string;
  timestamp: number;
}

/** İki kullanıcı arasındaki sohbet kimliği — sıralı, tutarlı */
export function conversationId(a: string, b: string): string {
  return [a, b].sort().join("__");
}

/** Mesaj gönder */
export async function sendMessage(from: string, to: string, text: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  const cId = conversationId(from, to);
  const msgRef = push(ref(db, `messages/${cId}`));
  await set(msgRef, { from, text, timestamp: Date.now() });
}

/** Sohbeti gerçek zamanlı dinle */
export function subscribeToMessages(
  user1: string,
  user2: string,
  callback: (msgs: ChatMessage[]) => void
): () => void {
  const db = getDb();
  if (!db) return () => {};
  const cId = conversationId(user1, user2);
  const r = ref(db, `messages/${cId}`);
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
