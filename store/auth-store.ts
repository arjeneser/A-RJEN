"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserProfile, CompletedFlight, Stamp } from "@/types";

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
  snapshots:   Record<string, UserSnapshot>;

  login:          (username: string, password: string) => LoginResult;
  register:       (username: string, password: string, securityQuestion: string, securityAnswer: string) => RegisterResult;
  logout:         () => void;
  setCurrentUser: (username: string | null) => void;
  saveSnapshot:   (username: string, snap: UserSnapshot) => void;
  getSnapshot:    (username: string) => UserSnapshot | null;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      currentUsername: null,
      credentials: {},
      snapshots: {},

      // ── login ──────────────────────────────────────────────────────────────
      login: (username, password) => {
        const { credentials } = get();
        const key = username.trim().toLowerCase();
        const cred = credentials[key];
        if (!cred) return "not_found";
        // Eski format: string — yeni format: nesne
        const storedPw = typeof cred === "string" ? cred : cred.password;
        if (storedPw !== password) return "wrong_password";
        set({ currentUsername: key });
        return "ok";
      },

      // ── register ───────────────────────────────────────────────────────────
      register: (username, password, securityQuestion, securityAnswer) => {
        const { credentials } = get();
        const key = username.trim().toLowerCase();
        if (credentials[key]) return "taken";
        set((s) => ({
          credentials: {
            ...s.credentials,
            [key]: {
              password,
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

      // ── saveSnapshot ───────────────────────────────────────────────────────
      saveSnapshot: (username, snap) =>
        set((s) => ({
          snapshots: { ...s.snapshots, [username]: snap },
        })),

      // ── getSnapshot ────────────────────────────────────────────────────────
      getSnapshot: (username) => get().snapshots[username] ?? null,
    }),
    {
      name: "airjen-auth",
      // currentUsername, credentials ve snapshots persist edilir.
      // Oturum kalıcılığı ayrıca airjen-session (localStorage/sessionStorage) ile yönetilir.
    }
  )
);
