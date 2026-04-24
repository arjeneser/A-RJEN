import { ref, set, remove, onValue, off, get } from "firebase/database";
import { getDb } from "./firebase";
import type { City } from "@/types";

export interface FriendRequest {
  from: string;
  timestamp: number;
}

export interface FriendStats {
  totalXP: number;
  totalFlights: number;
  currentStreak: number;
}

export interface FriendInfo {
  username: string;
  isFlying: boolean;
  stats?: FriendStats;
  flight?: {
    departure: City;
    destination: City;
    progress: number;
    durationMs?: number;
    lastUpdate?: number;
  };
}

/** Kullanıcı varlığını Firebase'e kaydet (giriş sonrası çağrılır) */
export async function registerPresence(username: string) {
  const db = getDb();
  if (!db) return;
  try {
    await set(ref(db, `users/${username}/lastSeen`), Date.now());
  } catch { /* ignore */ }
}

/** Kullanıcı istatistiklerini Firebase'e yaz (uçuş sonrası çağrılır) */
export async function syncStats(username: string, stats: FriendStats) {
  const db = getDb();
  if (!db) return;
  try {
    await set(ref(db, `users/${username}/stats`), stats);
  } catch { /* ignore */ }
}

/** Arkadaşlık isteği gönder */
export async function sendFriendRequest(from: string, to: string): Promise<"ok" | "not_found" | "already_friends" | "self"> {
  const db = getDb();
  if (!db) return "not_found";
  if (from === to) return "self";

  // Kullanıcı var mı kontrol et
  const userSnap = await get(ref(db, `users/${to}`));
  if (!userSnap.val()) return "not_found";

  const alreadyFriend = await get(ref(db, `friendships/${from}/list/${to}`));
  if (alreadyFriend.val()) return "already_friends";

  // Outgoing isteği daha önce gönderilmiş mi?
  const alreadyOutgoing = await get(ref(db, `friendships/${from}/outgoing/${to}`));
  if (alreadyOutgoing.val()) return "ok"; // zaten gönderilmiş

  await set(ref(db, `friendships/${to}/incoming/${from}`), { from, timestamp: Date.now() });
  await set(ref(db, `friendships/${from}/outgoing/${to}`), { timestamp: Date.now() });
  return "ok";
}

/** Arkadaşlık isteğini kabul et */
export async function acceptFriendRequest(username: string, from: string) {
  const db = getDb();
  if (!db) return;
  await set(ref(db, `friendships/${username}/list/${from}`), true);
  await set(ref(db, `friendships/${from}/list/${username}`), true);
  await remove(ref(db, `friendships/${username}/incoming/${from}`));
  await remove(ref(db, `friendships/${from}/outgoing/${username}`));
}

/** Arkadaşlık isteğini reddet */
export async function rejectFriendRequest(username: string, from: string) {
  const db = getDb();
  if (!db) return;
  await remove(ref(db, `friendships/${username}/incoming/${from}`));
  await remove(ref(db, `friendships/${from}/outgoing/${username}`));
}

/** Arkadaşı çıkar */
export async function removeFriend(username: string, friend: string) {
  const db = getDb();
  if (!db) return;
  await remove(ref(db, `friendships/${username}/list/${friend}`));
  await remove(ref(db, `friendships/${friend}/list/${username}`));
}

/** Gelen istekleri dinle */
export function subscribeToIncomingRequests(
  username: string,
  callback: (requests: FriendRequest[]) => void
): () => void {
  const db = getDb();
  if (!db) return () => {};
  const r = ref(db, `friendships/${username}/incoming`);
  onValue(r, (snap) => {
    const data = snap.val() as Record<string, FriendRequest> | null;
    callback(data ? Object.values(data) : []);
  });
  return () => off(r);
}

/** Arkadaş listesini + uçuş durumlarını + istatistikleri dinle */
export function subscribeToFriends(
  username: string,
  callback: (friends: FriendInfo[]) => void
): () => void {
  const db = getDb();
  if (!db) return () => {};

  const listRef   = ref(db, `friendships/${username}/list`);
  const flightRef = ref(db, "flights");
  const usersRef  = ref(db, "users");

  let friendUsernames: string[] = [];
  let flightData: Record<string, any> = {};
  let usersData:  Record<string, any> = {};

  const merge = () => {
    const friends: FriendInfo[] = friendUsernames.map((u) => {
      const f = flightData[u];
      const isFlying = !!f && Date.now() - f.lastUpdate < 60_000;
      const rawStats = usersData[u]?.stats;
      const stats: FriendStats | undefined = rawStats
        ? {
            totalXP:       rawStats.totalXP       ?? 0,
            totalFlights:  rawStats.totalFlights  ?? 0,
            currentStreak: rawStats.currentStreak ?? 0,
          }
        : undefined;
      return { username: u, isFlying, stats, flight: isFlying ? f : undefined };
    });
    callback(friends);
  };

  onValue(listRef, (snap) => {
    friendUsernames = snap.val() ? Object.keys(snap.val()) : [];
    merge();
  });

  onValue(flightRef, (snap) => {
    flightData = snap.val() || {};
    merge();
  });

  onValue(usersRef, (snap) => {
    usersData = snap.val() || {};
    merge();
  });

  return () => {
    off(listRef);
    off(flightRef);
    off(usersRef);
  };
}
