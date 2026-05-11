import { ref, set, onValue, push } from "firebase/database";
import { getDb } from "./firebase";
import type { City, FlightDurationOption } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Announcement {
  id: string;
  message: string;
  createdBy: string;
  createdAt: number;
  lobbyId: string;
  departure: City;
  destination: City;
  durationOption: FlightDurationOption;
  /** status: "open" → görünür, "started" → uçuş başladı, "expired" → süresi doldu */
  status: "open" | "started" | "expired";
  /** Unix ms — 24 saat sonra otomatik geçersiz */
  expiresAt: number;
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createAnnouncement(
  message: string,
  createdBy: string,
  departure: City,
  destination: City,
  durationOption: FlightDurationOption,
  lobbyId: string,
): Promise<string> {
  const db = getDb();
  if (!db) return "";
  const annRef = push(ref(db, "announcements"));
  const id = annRef.key!;
  const now = Date.now();
  const announcement: Announcement = {
    id,
    message: message.trim(),
    createdBy,
    createdAt: now,
    lobbyId,
    departure,
    destination,
    durationOption,
    status: "open",
    expiresAt: now + 24 * 60 * 60 * 1000, // 24 saat
  };
  await set(annRef, announcement);
  return id;
}

// ─── Subscribe ────────────────────────────────────────────────────────────────

/** Tüm aktif duyuruları gerçek zamanlı dinle */
export function subscribeToAnnouncements(
  callback: (announcements: Announcement[]) => void,
): () => void {
  const db = getDb();
  if (!db) return () => {};
  const r = ref(db, "announcements");
  return onValue(r, (snap) => {
    const data = snap.val() as Record<string, Announcement> | null;
    const now = Date.now();
    const result = data
      ? Object.values(data)
          .filter((a) => a.status === "open" && a.expiresAt > now)
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, 20)
      : [];
    callback(result);
  });
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/** Kendi duyurusunu sil */
export async function deleteAnnouncement(announcementId: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  const { remove } = await import("firebase/database");
  await remove(ref(db, `announcements/${announcementId}`));
}

// ─── Mark started ─────────────────────────────────────────────────────────────

/** Uçuş başlayınca duyuruyu "started" yap */
export async function markAnnouncementStarted(announcementId: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  const { update } = await import("firebase/database");
  await update(ref(db, `announcements/${announcementId}`), { status: "started" });
}
