import {
  ref,
  set,
  update,
  get,
  onValue,
  remove,
  runTransaction,
} from "firebase/database";
import { getDb } from "./firebase";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BreakVote {
  initiatedBy: string;
  initiatedAt: number;
  votes: Record<string, "yes" | "no">;
}

export interface SharedFlight {
  status: "flying" | "on_break" | "break_vote" | "completed";
  startTime: number;
  totalPausedMs: number;
  pausedAt: number | null;
  durationMs: number;
  breakIntervalMs: number;
  breakDurationMs: number;
  breakVote: BreakVote | null;
  resumeVotes: Record<string, true> | null;
  activeMembers: Record<string, true>;
}

// ─── Create ───────────────────────────────────────────────────────────────────

/** Lobi başlatılınca çağrılır — sharedFlights/{lobbyId} düğümünü oluşturur */
export async function createSharedFlight(
  lobbyId: string,
  params: {
    durationMs: number;
    breakIntervalMs: number;
    breakDurationMs: number;
    members: string[];
  }
): Promise<void> {
  const db = getDb();
  if (!db) return;

  const activeMembers: Record<string, true> = {};
  params.members.forEach((m) => { activeMembers[m] = true; });

  const flight: SharedFlight = {
    status: "flying",
    startTime: Date.now(),
    totalPausedMs: 0,
    pausedAt: null,
    durationMs: params.durationMs,
    breakIntervalMs: params.breakIntervalMs,
    breakDurationMs: params.breakDurationMs,
    breakVote: null,
    resumeVotes: null,
    activeMembers,
  };

  await set(ref(db, `sharedFlights/${lobbyId}`), flight);
}

// ─── Subscribe ────────────────────────────────────────────────────────────────

/** Gerçek zamanlı dinleme */
export function subscribeToSharedFlight(
  lobbyId: string,
  cb: (f: SharedFlight | null) => void
): () => void {
  const db = getDb();
  if (!db) return () => {};
  const r = ref(db, `sharedFlights/${lobbyId}`);
  return onValue(r, (snap) => {
    cb(snap.exists() ? (snap.val() as SharedFlight) : null);
  });
}

// ─── Break vote ───────────────────────────────────────────────────────────────

/** Acil mola oyu başlat — zaten varsa no-op */
export async function initiateBreakVote(
  lobbyId: string,
  username: string
): Promise<void> {
  const db = getDb();
  if (!db) return;

  const snap = await get(ref(db, `sharedFlights/${lobbyId}/breakVote`));
  if (snap.exists()) return; // Zaten bir oylama var

  const vote: BreakVote = {
    initiatedBy: username,
    initiatedAt: Date.now(),
    votes: {},
  };
  await update(ref(db, `sharedFlights/${lobbyId}`), {
    status: "break_vote",
    breakVote: vote,
  });
}

/** Oy kullan */
export async function castBreakVote(
  lobbyId: string,
  username: string,
  vote: "yes" | "no"
): Promise<void> {
  const db = getDb();
  if (!db) return;
  await set(ref(db, `sharedFlights/${lobbyId}/breakVote/votes/${username}`), vote);
}

/** Oy sonucunu işle — çoğunluk "yes" → applyBreak, değilse → clearBreakVote */
export async function resolveBreakVote(
  lobbyId: string,
  memberCount: number
): Promise<void> {
  const db = getDb();
  if (!db) return;

  const snap = await get(ref(db, `sharedFlights/${lobbyId}/breakVote`));
  if (!snap.exists()) return;

  const voteData = snap.val() as BreakVote;
  const votes = Object.values(voteData.votes ?? {});
  const yesCount = votes.filter((v) => v === "yes").length;

  if (yesCount > memberCount / 2) {
    await applyBreak(lobbyId);
  } else {
    // Oylama iptal — uçmaya devam
    await update(ref(db, `sharedFlights/${lobbyId}`), {
      status: "flying",
      breakVote: null,
    });
  }
}

// ─── Break apply ──────────────────────────────────────────────────────────────

/** Molaya geç */
export async function applyBreak(lobbyId: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  await update(ref(db, `sharedFlights/${lobbyId}`), {
    status: "on_break",
    pausedAt: Date.now(),
    breakVote: null,
    resumeVotes: null,
  });
}

// ─── Resume votes ─────────────────────────────────────────────────────────────

/** Devam et oyu ver */
export async function castResumeVote(
  lobbyId: string,
  username: string
): Promise<void> {
  const db = getDb();
  if (!db) return;
  await set(ref(db, `sharedFlights/${lobbyId}/resumeVotes/${username}`), true);
}

/** Devam et oyunu çöz — çoğunluk varsa uçmaya geç */
export async function resolveResume(
  lobbyId: string,
  memberCount: number
): Promise<void> {
  const db = getDb();
  if (!db) return;

  const snap = await get(ref(db, `sharedFlights/${lobbyId}`));
  if (!snap.exists()) return;

  const flight = snap.val() as SharedFlight;
  const resumeVotes = Object.keys(flight.resumeVotes ?? {}).length;

  if (resumeVotes > memberCount / 2) {
    const now = Date.now();
    const pausedAt = flight.pausedAt ?? now;
    const addedPausedMs = now - pausedAt;

    await update(ref(db, `sharedFlights/${lobbyId}`), {
      status: "flying",
      pausedAt: null,
      totalPausedMs: (flight.totalPausedMs ?? 0) + addedPausedMs,
      resumeVotes: null,
    });
  }
}

// ─── Complete ─────────────────────────────────────────────────────────────────

/** Uçuşu tamamla */
export async function completeSharedFlight(lobbyId: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  await update(ref(db, `sharedFlights/${lobbyId}`), {
    status: "completed",
  });
}

// ─── Elapsed (pure) ───────────────────────────────────────────────────────────

/** Her client'ın lokal olarak çalıştırdığı elapsed hesabı */
export function getSharedElapsedMs(f: SharedFlight): number {
  const now = Date.now();
  const runningMs = (f.status === "flying" || f.status === "break_vote")
    ? now - f.startTime - (f.totalPausedMs ?? 0)
    : (f.status === "on_break" && f.pausedAt)
      ? f.pausedAt - f.startTime - (f.totalPausedMs ?? 0)
      : now - f.startTime - (f.totalPausedMs ?? 0);
  return Math.max(0, runningMs);
}

// ─── Active members ───────────────────────────────────────────────────────────

/** Aktif üye ekle veya çıkar */
export async function setActiveMember(
  lobbyId: string,
  username: string,
  active: boolean
): Promise<void> {
  const db = getDb();
  if (!db) return;
  const r = ref(db, `sharedFlights/${lobbyId}/activeMembers/${username}`);
  if (active) {
    await set(r, true);
  } else {
    await remove(r);
  }
}
