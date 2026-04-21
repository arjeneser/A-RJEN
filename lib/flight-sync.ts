import { ref, set, remove, onValue, off } from "firebase/database";
import { getDb } from "./firebase";
import type { City } from "@/types";

export interface LiveFlight {
  username: string;
  departure: City;
  destination: City;
  progress: number;
  lastUpdate: number;
}

/** Uçuş bilgilerini Firebase'e yaz */
export function broadcastFlight(
  username: string,
  departure: City,
  destination: City,
  progress: number
) {
  const db = getDb();
  if (!db) return;
  set(ref(db, `flights/${username}`), {
    username,
    departure,
    destination,
    progress,
    lastUpdate: Date.now(),
  });
}

/** Uçuş bittinde / terk edilince Firebase'den sil */
export function clearFlight(username: string) {
  const db = getDb();
  if (!db) return;
  remove(ref(db, `flights/${username}`));
}

/** Tüm aktif uçuşları dinle, kendi username'ini filtrele */
export function subscribeToFlights(
  ownUsername: string,
  callback: (flights: LiveFlight[]) => void
): () => void {
  const db = getDb();
  if (!db) return () => {};

  const STALE_MS = 60_000; // 60 saniye
  const flightsRef = ref(db, "flights");

  onValue(flightsRef, (snapshot) => {
    const data = snapshot.val() as Record<string, LiveFlight> | null;
    if (!data) { callback([]); return; }
    const now = Date.now();
    const flights = Object.values(data).filter(
      (f) => f.username !== ownUsername && now - f.lastUpdate < STALE_MS
    );
    callback(flights);
  });

  return () => off(flightsRef);
}
