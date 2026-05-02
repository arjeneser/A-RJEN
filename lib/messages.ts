import { ref, set, push, get, onValue, remove, update } from "firebase/database";
import { getDb } from "./firebase";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReplyRef {
  id: string;
  from: string;
  text: string; // önizleme (max 80 karakter)
}

export interface FlightCardData {
  departureName: string;
  destinationName: string;
  durationLabel: string;
  xp: number;
  countryCode: string;
}

export interface ChatMessage {
  id?: string;
  from: string;
  text: string;
  timestamp: number;
  type?: "text" | "voice" | "flight_card";
  /** Yanıt / alıntı */
  replyTo?: ReplyRef;
  /** Emoji tepkileri: emoji → kullanıcı adları listesi */
  reactions?: Record<string, string[]>;
  /** Sesli mesaj */
  audioBase64?: string;
  audioDuration?: number;
  /** Uçuş kartı */
  flightCard?: FlightCardData;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** İki kullanıcı arasındaki sohbet kimliği — sıralı, tutarlı */
export function conversationId(a: string, b: string): string {
  return [a, b].sort().join("__");
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/** Metin mesajı gönder (yanıt desteğiyle) */
export async function sendMessage(
  from: string,
  to: string,
  text: string,
  replyTo?: ReplyRef
): Promise<void> {
  const db = getDb();
  if (!db) return;
  const cId    = conversationId(from, to);
  const msgRef = push(ref(db, `messages/${cId}`));
  const payload: Record<string, unknown> = { from, text, timestamp: Date.now() };
  if (replyTo) payload.replyTo = replyTo;
  await set(msgRef, payload);
}

/** Sesli mesaj gönder */
export async function sendVoiceMessage(
  from: string,
  to: string,
  audioBase64: string,
  audioDuration: number
): Promise<void> {
  const db = getDb();
  if (!db) return;
  const cId    = conversationId(from, to);
  const msgRef = push(ref(db, `messages/${cId}`));
  await set(msgRef, {
    from,
    text: "🎤 Sesli mesaj",
    timestamp: Date.now(),
    type: "voice",
    audioBase64,
    audioDuration,
  });
}

/** Uçuş kartı paylaş */
export async function sendFlightCardMessage(
  from: string,
  to: string,
  card: FlightCardData
): Promise<void> {
  const db = getDb();
  if (!db) return;
  const cId    = conversationId(from, to);
  const msgRef = push(ref(db, `messages/${cId}`));
  await set(msgRef, {
    from,
    text: `✈ ${card.departureName} → ${card.destinationName}`,
    timestamp: Date.now(),
    type: "flight_card",
    flightCard: card,
  });
}

/** Emoji tepkisi ekle veya kaldır */
export async function toggleReaction(
  convId: string,
  msgId: string,
  emoji: string,
  username: string
): Promise<void> {
  const db = getDb();
  if (!db) return;
  const reactionRef = ref(db, `messages/${convId}/${msgId}/reactions/${emoji}`);
  const snap = await get(reactionRef);
  const users: string[] = snap.val() || [];
  if (users.includes(username)) {
    await set(reactionRef, users.filter((u) => u !== username));
  } else {
    await set(reactionRef, [...users, username]);
  }
}

/** Yazıyor durumunu güncelle */
export async function setTyping(
  convId: string,
  username: string,
  isTyping: boolean
): Promise<void> {
  const db = getDb();
  if (!db) return;
  const r = ref(db, `typing/${convId}/${username}`);
  if (isTyping) {
    await set(r, Date.now());
  } else {
    await remove(r);
  }
}

/**
 * Sohbet açıldığında okundu imlecini güncelle.
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
  // onValue returns a per-listener unsubscribe — do NOT use off(r) which kills all listeners on the path
  return onValue(r, (snap) => {
    const data = snap.val() as Record<string, Omit<ChatMessage, "id">> | null;
    const msgs: ChatMessage[] = data
      ? Object.entries(data)
          .map(([id, msg]) => ({ ...msg, id }))
          .sort((a, b) => a.timestamp - b.timestamp)
      : [];
    callback(msgs);
  });
}

/**
 * Karşı tarafın okundu imlecini dinle.
 */
export function subscribeToReadCursor(
  convId: string,
  partnerUsername: string,
  callback: (readAt: number) => void
): () => void {
  const db = getDb();
  if (!db) return () => {};
  const r = ref(db, `readCursors/${convId}/${partnerUsername}`);
  return onValue(r, (snap) => {
    callback(snap.val() ?? 0);
  });
}

/**
 * Yazıyor durumunu dinle.
 * callback — şu an yazıyor olan kullanıcılar listesi (kendin hariç)
 */
export function subscribeToTyping(
  convId: string,
  excludeUsername: string,
  callback: (typingUsers: string[]) => void
): () => void {
  const db = getDb();
  if (!db) return () => {};
  const r = ref(db, `typing/${convId}`);
  return onValue(r, (snap) => {
    const data = snap.val() as Record<string, number> | null;
    if (!data) { callback([]); return; }
    const now = Date.now();
    // 8 saniyeden eski yazıyor durumlarını filtrele
    const active = Object.entries(data)
      .filter(([u, ts]) => u !== excludeUsername && now - ts < 8000)
      .map(([u]) => u);
    callback(active);
  });
}
