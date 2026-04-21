"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserProfile, CompletedFlight, Stamp } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserSnapshot {
  profile: UserProfile;
  history: CompletedFlight[];
  stamps: Stamp[];
}

type LoginResult   = "ok" | "wrong_password" | "not_found";
type RegisterResult = "ok" | "taken";

interface AuthState {
  currentUsername: string | null;
  credentials: Record<string, string>;      // username → password
  snapshots:   Record<string, UserSnapshot>; // username → saved data

  login:        (username: string, password: string) => LoginResult;
  register:     (username: string, password: string) => RegisterResult;
  logout:       () => void;
  saveSnapshot: (username: string, snap: UserSnapshot) => void;
  getSnapshot:  (username: string) => UserSnapshot | null;
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
        if (!credentials[key])           return "not_found";
        if (credentials[key] !== password) return "wrong_password";
        set({ currentUsername: key });
        return "ok";
      },

      // ── register ───────────────────────────────────────────────────────────
      register: (username, password) => {
        const { credentials } = get();
        const key = username.trim().toLowerCase();
        if (credentials[key]) return "taken";
        set((s) => ({
          credentials: { ...s.credentials, [key]: password },
          currentUsername: key,
        }));
        return "ok";
      },

      // ── logout ─────────────────────────────────────────────────────────────
      logout: () => set({ currentUsername: null }),

      // ── saveSnapshot ───────────────────────────────────────────────────────
      saveSnapshot: (username, snap) =>
        set((s) => ({
          snapshots: { ...s.snapshots, [username]: snap },
        })),

      // ── getSnapshot ────────────────────────────────────────────────────────
      getSnapshot: (username) => get().snapshots[username] ?? null,
    }),
    { name: "airjen-auth" }
  )
);
