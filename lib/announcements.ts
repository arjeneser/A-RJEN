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
  /** Uçuşun başlayacağı zaman (Unix ms) */
  scheduledAt: number;
  /** scheduledAt + durationMs + 5 dk — bu geçince kart kaybolur */
  expiresAt: number;
  status: "open" | "started" | "expired";
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createAnnouncement(
  message: string,
  createdBy: string,
  departure: City,
  destination: City,
  durationOption: FlightDurationOption,
  lobbyId: string,
  scheduledAt: number,
): Promise<string> {
  const db = getDb();
  if (!db) return "";
  const annRef = push(ref(db, "announcements"));
  const id = annRef.key!;
  const durationMs = durationOption.minutes * 60 * 1000;
  const expiresAt = scheduledAt + durationMs + 5 * 60 * 1000; // bitiş + 5 dk

  const announcement: Announcement = {
    id,
    message: message.trim(),
    createdBy,
    createdAt: Date.now(),
    lobbyId,
    departure,
    destination,
    durationOption,
    scheduledAt,
    expiresAt,
    status: "open",
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
          .sort((a, b) => a.scheduledAt - b.scheduledAt) // en yakın önce
      : [];
    callback(result);
  });
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteAnnouncement(announcementId: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  const { remove } = await import("firebase/database");
  await remove(ref(db, `announcements/${announcementId}`));
}

// ─── Mark started ─────────────────────────────────────────────────────────────

export async function markAnnouncementStarted(announcementId: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  const { update } = await import("firebase/database");
  await update(ref(db, `announcements/${announcementId}`), { status: "started" });
}
