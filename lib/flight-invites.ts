import { ref, set, push, remove, onValue, off } from "firebase/database";
import { getDb } from "./firebase";
import type { City, FlightDurationOption } from "@/types";

export interface FlightInvite {
  id: string;
  from: string;
  departure: City;
  destination: City;
  durationOption: FlightDurationOption;
  status: "pending";
  timestamp: number;
  lobbyId?: string;
}

/** Uçuş daveti gönder */
export async function sendFlightInvite(
  from: string,
  to: string,
  departure: City,
  destination: City,
  durationOption: FlightDurationOption,
  lobbyId?: string
): Promise<void> {
  const db = getDb();
  if (!db) return;
  const inviteRef = push(ref(db, `flightInvites/${to}`));
  const id = inviteRef.key!;
  const payload: Record<string, unknown> = {
    id,
    from,
    departure,
    destination,
    durationOption,
    status: "pending",
    timestamp: Date.now(),
  };
  if (lobbyId) payload.lobbyId = lobbyId;
  await set(inviteRef, payload);
}

/** Daveti sil (reddet veya kabul sonrası temizle) */
export async function removeFlightInvite(username: string, inviteId: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  await remove(ref(db, `flightInvites/${username}/${inviteId}`));
}

/** Gelen uçuş davetlerini dinle */
export function subscribeToFlightInvites(
  username: string,
  callback: (invites: FlightInvite[]) => void
): () => void {
  const db = getDb();
  if (!db) return () => {};
  const r = ref(db, `flightInvites/${username}`);
  onValue(r, (snap) => {
    const data = snap.val() as Record<string, FlightInvite> | null;
    const invites = data
      ? Object.values(data).sort((a, b) => b.timestamp - a.timestamp)
      : [];
    callback(invites);
  });
  return () => off(r);
}
