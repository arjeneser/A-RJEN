import { ref, set, update, onValue, push } from "firebase/database";
import { getDb } from "./firebase";
import { createSharedFlight } from "./shared-flight";
import type { City, FlightDurationOption } from "@/types";

// ─── Lobi sohbet mesajı ────────────────────────────────────────────────────────
export interface LobbyMessage {
  id: string;
  username: string;
  text: string;
  timestamp: number;
}

export interface LobbyMember {
  joinedAt: number;
  seat: string | null;
  ready: boolean;
}

export interface Lobby {
  id: string;
  departure: City;
  destination: City;
  durationOption: FlightDurationOption;
  createdBy: string;
  createdAt: number;
  members: Record<string, LobbyMember>;
  status: "waiting" | "starting";
  startTime?: number;
  breakIntervalMinutes: number;      // default 50
  breakDurationMinutes: number;      // default 10
  breakSettingsApprovals: Record<string, true>;  // her üyenin onayı
}

/** Lobi oluştur, oluşturanı üye olarak ekle */
export async function createLobby(
  departure: City,
  destination: City,
  durationOption: FlightDurationOption,
  createdBy: string
): Promise<string> {
  const db = getDb();
  if (!db) return "";
  const lobbyRef = push(ref(db, "lobbies"));
  const id = lobbyRef.key!;
  const now = Date.now();
  await set(lobbyRef, {
    id,
    departure,
    destination,
    durationOption,
    createdBy,
    createdAt: now,
    status: "waiting",
    members: {
      [createdBy]: { joinedAt: now, seat: null, ready: false },
    },
    breakIntervalMinutes: 50,
    breakDurationMinutes: 10,
    breakSettingsApprovals: { [createdBy]: true },
  });
  return id;
}

/** Lobiye katıl */
export async function joinLobby(lobbyId: string, username: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  await update(ref(db, `lobbies/${lobbyId}/members/${username}`), {
    joinedAt: Date.now(),
    seat: null,
    ready: false,
  });
}

/** Koltuk seç */
export async function pickLobbySeat(lobbyId: string, username: string, seat: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  await update(ref(db, `lobbies/${lobbyId}/members/${username}`), { seat });
}

/** Hazır durumunu değiştir */
export async function setLobbyReady(lobbyId: string, username: string, ready: boolean): Promise<void> {
  const db = getDb();
  if (!db) return;
  await update(ref(db, `lobbies/${lobbyId}/members/${username}`), { ready });
}

/** Uçuşu başlat — SharedFlight oluşturur ve tüm üyelere "starting" sinyali verir */
export async function startLobby(
  lobbyId: string,
  breakIntervalMinutes: number,
  breakDurationMinutes: number,
  members: string[],
  durationMs: number
): Promise<void> {
  const db = getDb();
  if (!db) return;

  await createSharedFlight(lobbyId, {
    durationMs,
    breakIntervalMs: breakIntervalMinutes * 60 * 1000,
    breakDurationMs: breakDurationMinutes * 60 * 1000,
    members,
  });

  await update(ref(db, `lobbies/${lobbyId}`), {
    status: "starting",
    startTime: Date.now(),
  });
}

/** Mola ayarlarını güncelle — proposer hariç onayları sıfırla */
export async function updateBreakSettings(
  lobbyId: string,
  username: string,
  intervalMinutes: number,
  durationMinutes: number
): Promise<void> {
  const db = getDb();
  if (!db) return;
  await update(ref(db, `lobbies/${lobbyId}`), {
    breakIntervalMinutes: intervalMinutes,
    breakDurationMinutes: durationMinutes,
    breakSettingsApprovals: { [username]: true },
  });
}

/** Mola ayarlarını onayla */
export async function approveBreakSettings(
  lobbyId: string,
  username: string
): Promise<void> {
  const db = getDb();
  if (!db) return;
  await update(ref(db, `lobbies/${lobbyId}/breakSettingsApprovals`), {
    [username]: true,
  });
}

/** Lobiden ayrıl */
export async function leaveLobby(lobbyId: string, username: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  const { remove } = await import("firebase/database");
  await remove(ref(db, `lobbies/${lobbyId}/members/${username}`));
}

/**
 * Kullanıcının üye olduğu tüm aktif lobileri dinle.
 * Firebase'de "waiting" veya "starting" olan lobiler döner.
 */
export function subscribeToUserLobbies(
  username: string,
  callback: (lobbies: Lobby[]) => void
): () => void {
  const db = getDb();
  if (!db) return () => {};
  const { query, orderByChild, equalTo, get } = require("firebase/database");

  // lobbies/ altındaki tüm lobileri dinle, client-side filtrele
  const r = ref(db, "lobbies");
  return onValue(r, (snap) => {
    const data = snap.val() as Record<string, Lobby> | null;
    if (!data) { callback([]); return; }
    const result = Object.values(data).filter(
      (l) =>
        l.members &&
        l.members[username] !== undefined &&
        (l.status === "waiting" || l.status === "starting")
    );
    result.sort((a, b) => b.createdAt - a.createdAt);
    callback(result);
  });
}

/** Lobi değişikliklerini gerçek zamanlı dinle */
export function subscribeToLobby(
  lobbyId: string,
  callback: (lobby: Lobby | null) => void
): () => void {
  const db = getDb();
  if (!db) return () => {};
  const r = ref(db, `lobbies/${lobbyId}`);
  return onValue(r, (snap) => {
    callback(snap.exists() ? (snap.val() as Lobby) : null);
  });
}

/** Lobi sohbetine mesaj gönder */
export async function sendLobbyMessage(
  lobbyId: string,
  username: string,
  text: string
): Promise<void> {
  const db = getDb();
  if (!db) return;
  const msgRef = push(ref(db, `lobbies/${lobbyId}/chat`));
  await set(msgRef, {
    id: msgRef.key,
    username,
    text: text.trim(),
    timestamp: Date.now(),
  });
}

/** Lobi sohbet mesajlarını gerçek zamanlı dinle */
export function subscribeToLobbyMessages(
  lobbyId: string,
  callback: (messages: LobbyMessage[]) => void
): () => void {
  const db = getDb();
  if (!db) return () => {};
  const r = ref(db, `lobbies/${lobbyId}/chat`);
  return onValue(r, (snap) => {
    const data = snap.val() as Record<string, LobbyMessage> | null;
    const messages = data
      ? Object.values(data).sort((a, b) => a.timestamp - b.timestamp)
      : [];
    callback(messages);
  });
}
