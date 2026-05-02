/**
 * user-sync.ts
 * ─────────────
 * Firebase'e tam kullanıcı snapshot'ı (profil + geçmiş + pul + başarım) kaydet/yükle.
 * Uçuş tamamlandığında anında çağrılır; giriş yapılınca yüklenir.
 */
import { ref, set, get } from "firebase/database";
import { getDb } from "./firebase";
import type { UserProfile, CompletedFlight, Stamp, Achievement } from "@/types";

export interface CloudUserSnapshot {
  profile:      UserProfile;
  history:      CompletedFlight[];
  stamps:       Stamp[];
  achievements: Achievement[];
  lastUpdated:  number;
}

/** Tam snapshot'ı Firebase'e kaydet (uçuş bitişinde çağrılır) */
export async function saveUserSnapshot(
  username: string,
  snap: Omit<CloudUserSnapshot, "lastUpdated">
): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    // history & stamps büyük olabilir; son 50 uçuş + 200 pul ile sınırla
    const payload: CloudUserSnapshot = {
      profile:      snap.profile,
      history:      snap.history.slice(0, 50),
      stamps:       snap.stamps.slice(0, 200),
      achievements: snap.achievements,
      lastUpdated:  Date.now(),
    };
    await set(ref(db, `userSnapshots/${username}`), payload);
  } catch {
    // ağ hatası olsa da sessizce geç — veriler localStorage'da güvende
  }
}

/** Firebase'den snapshot yükle (login sonrası çağrılır) */
export async function loadUserSnapshot(
  username: string
): Promise<CloudUserSnapshot | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const snap = await get(ref(db, `userSnapshots/${username}`));
    if (!snap.exists()) return null;
    return snap.val() as CloudUserSnapshot;
  } catch {
    return null;
  }
}
