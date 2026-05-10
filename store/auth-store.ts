"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserProfile, CompletedFlight, Stamp } from "@/types";
import { usernameExistsInCloud } from "@/lib/user-sync";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserSnapshot {
  profile:      UserProfile;
  history:      CompletedFlight[];
  stamps:       Stamp[];
  achievements?: import("@/types").Achievement[];
  lastUpdated?:  number;
}

/** Şifreyi string olarak saklayan eski format ile uyumluluk için union */
export interface UserCredential {
  password: string;
  securityQuestion: string;
  securityAnswer: string; // lowercase trimmed
}

type LoginResult   = "ok" | "wrong_password" | "not_found";
type RegisterResult = "ok" | "taken";

interface AuthState {
  currentUsername: string | null;
  credentials: Record<string, UserCredential | string>; // string = eski format

  login:          (username: string, password: string) => Promise<LoginResult>;
  register:       (username: string, password: string, securityQuestion: string, securityAnswer: string) => Promise<RegisterResult>;
  logout:         () => void;
  setCurrentUser: (username: string | null) => void;
}

// ─── Snapshot Store (ayrı key — büyük veri auth'u bozmasın) ──────────────────

interface SnapshotState {
  snapshots: Record<string, UserSnapshot>;
  saveSnapshot: (username: string, snap: UserSnapshot) => void;
  getSnapshot:  (username: string) => UserSnapshot | null;
}

export const useSnapshotStore = create<SnapshotState>()(
  persist(
    (set, get) => ({
      snapshots: {},
      saveSnapshot: (username, snap) =>
        set((s) => ({ snapshots: { ...s.snapshots, [username]: snap } })),
      getSnapshot: (username) => get().snapshots[username] ?? null,
    }),
    { name: "airjen-snapshots" }
  )
);

// ─── Password hashing ─────────────────────────────────────────────────────────

/** SHA-256 hash — 64-char hex string */
async function hashPassword(password: string): Promise<string> {
  if (typeof window === "undefined" || !crypto?.subtle) {
    // SSR fallback: plain text (should never reach production login)
    return password;
  }
  const data = new TextEncoder().encode(password);
  const buf  = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Stored hash? 64-char lowercase hex */
function isHash(s: string): boolean {
  return /^[0-9a-f]{64}$/.test(s);
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      currentUsername: null,
      credentials: {},

      // ── login ──────────────────────────────────────────────────────────────
      login: async (username, password) => {
        const { credentials } = get();
        const key = username.trim().toLowerCase();
        const cred = credentials[key];
        if (!cred) return "not_found";
        // Eski format: string — yeni format: nesne
        const storedPw = typeof cred === "string" ? cred : cred.password;

        if (isHash(storedPw)) {
          // Yeni format — hash karşılaştır
          const hashed = await hashPassword(password);
          if (storedPw !== hashed) return "wrong_password";
        } else {
          // Eski format (plain text) — doğrudan karşılaştır, ardından hash'e yükselt
          if (storedPw !== password) return "wrong_password";
          const hashed = await hashPassword(password);
          const upgraded =
            typeof cred === "string"
              ? hashed
              : { ...cred, password: hashed };
          set((s) => ({
            credentials: { ...s.credentials, [key]: upgraded },
          }));
        }

        set({ currentUsername: key });
        return "ok";
      },

      // ── register ───────────────────────────────────────────────────────────
      register: async (username, password, securityQuestion, securityAnswer) => {
        const { credentials } = get();
        const key = username.trim().toLowerCase();
        // Yerel kontrolü yap
        if (credentials[key]) return "taken";
        // Firebase kontrolü — başka cihazda aynı isimle hesap açılmış mı?
        const cloudTaken = await usernameExistsInCloud(key);
        if (cloudTaken) return "taken";
        const hashed = await hashPassword(password);
        set((s) => ({
          credentials: {
            ...s.credentials,
            [key]: {
              password: hashed,
              securityQuestion,
              securityAnswer: securityAnswer.trim().toLowerCase(),
            },
          },
          currentUsername: key,
        }));
        return "ok";
      },

      // ── logout ─────────────────────────────────────────────────────────────
      logout: () => {
        set({ currentUsername: null });
        if (typeof window !== "undefined") {
          localStorage.removeItem("airjen-session");
          sessionStorage.removeItem("airjen-session");
        }
      },

      // ── setCurrentUser ─────────────────────────────────────────────────────
      setCurrentUser: (username) => set({ currentUsername: username }),
    }),
    {
      name: "airjen-auth",
      // Sadece kimlik doğrulama verisi (küçük, kritik) persist edilir.
      // Snapshot'lar airjen-snapshots key'inde ayrıca saklanır — büyük veri auth'u bozmasın.
      partialize: (s) => ({
        currentUsername: s.currentUsername,
        credentials: s.credentials,
      }),
    }
  )
);
