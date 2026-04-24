import { ref, set, update, onValue, off, push, serverTimestamp } from "firebase/database";
import { getDb } from "./firebase";
import type { City, FlightDurationOption } from "@/types";

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

/** Uçuşu başlat (tüm üyelere "starting" sinyali) */
export async function startLobby(lobbyId: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  await update(ref(db, `lobbies/${lobbyId}`), {
    status: "starting",
    startTime: Date.now(),
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
  onValue(r, (snap) => {
    callback(snap.exists() ? (snap.val() as Lobby) : null);
  });
  return () => off(r);
}
