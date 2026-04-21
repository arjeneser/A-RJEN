import { db } from "./firebase";
import { ref, set, remove, onValue, off, serverTimestamp } from "firebase/database";
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
  const flightRef = ref(db, `flights/${username}`);
  set(flightRef, {
    username,
    departure,
    destination,
    progress,
    lastUpdate: Date.now(),
  });
}

/** Uçuş bittinde / terk edilince Firebase'den sil */
export function clearFlight(username: string) {
  remove(ref(db, `flights/${username}`));
}

/** Tüm aktif uçuşları dinle, kendi username'ini filtrele */
export function subscribeToFlights(
  ownUsername: string,
  callback: (flights: LiveFlight[]) => void
): () => void {
  const flightsRef = ref(db, "flights");
  const STALE_MS = 10_000; // 10 saniyedir güncellenmemişse gösterme

  onValue(flightsRef, (snapshot) => {
    const data = snapshot.val() as Record<string, LiveFlight> | null;
    if (!data) { callback([]); return; }

    const now = Date.now();
    const flights = Object.values(data).filter(
      (f) =>
        f.username !== ownUsername &&
        now - f.lastUpdate < STALE_MS
    );
    callback(flights);
  });

  return () => off(flightsRef);
}
