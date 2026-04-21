"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  UserProfile,
  CompletedFlight,
  AirjenLevel,
  AirjenLevelInfo,
  Stamp,
} from "@/types";
import { generateId, todayISO, isConsecutiveDay } from "@/lib/utils";

// ─── Level Config ─────────────────────────────────────────────────────────────

export const LEVEL_CONFIG: AirjenLevelInfo[] = [
  { name: "Trainee",  emoji: "✈️",  requiredFlights: 0,   color: "#94A3B8" },
  { name: "Cadet",    emoji: "🎖️",  requiredFlights: 10,  color: "#60A5FA" },
  { name: "Pilot",    emoji: "👨‍✈️", requiredFlights: 25,  color: "#A78BFA" },
  { name: "Captain",  emoji: "⭐",   requiredFlights: 50,  color: "#F59E0B" },
  { name: "Legend",   emoji: "🏆",   requiredFlights: 100, color: "#EF4444" },
];

// ─── Level helpers (exported for use in components) ───────────────────────────

export function getLevel(totalFlights: number): AirjenLevelInfo {
  for (let i = LEVEL_CONFIG.length - 1; i >= 0; i--) {
    if (totalFlights >= LEVEL_CONFIG[i].requiredFlights) return LEVEL_CONFIG[i];
  }
  return LEVEL_CONFIG[0];
}

export function getLevelProgress(totalFlights: number): number {
  const current = getLevel(totalFlights);
  const idx = LEVEL_CONFIG.findIndex((l) => l.name === current.name);
  const next = LEVEL_CONFIG[idx + 1];
  if (!next) return 1;
  const range = next.requiredFlights - current.requiredFlights;
  const earned = totalFlights - current.requiredFlights;
  return Math.min(1, earned / range);
}

export function flightsToNextLevel(totalFlights: number): number {
  const current = getLevel(totalFlights);
  const idx = LEVEL_CONFIG.findIndex((l) => l.name === current.name);
  const next = LEVEL_CONFIG[idx + 1];
  if (!next) return 0;
  return next.requiredFlights - totalFlights;
}

// ─── Default state ────────────────────────────────────────────────────────────

export const DEFAULT_PROFILE: UserProfile = {
  name: "Pilot",
  totalXP: 0,
  totalFlights: 0,
  currentStreak: 0,
  longestStreak: 0,
  lastFlightDate: null,
  visitedCityIds: [],
  totalFocusMinutes: 0,
  completedSessionIds: [],
};

// ─── Store interface ──────────────────────────────────────────────────────────

interface UserState {
  profile: UserProfile;
  history: CompletedFlight[];

  /**
   * Passport stamps earned by completing flights.
   * One stamp is added per completed flight (destination country).
   */
  stamps: Stamp[];

  // ── Actions ─────────────────────────────────────────────────────────────
  updateName: (name: string) => void;

  recordFlight: (params: {
    departureId: string;
    destinationId: string;
    durationMinutes: number;
    xpEarned: number;
  }) => void;

  /**
   * Add a passport stamp.  Typically called right after `recordFlight`.
   * Duplicate stamps (same city on the same day) are silently ignored.
   */
  addStamp: (stamp: Omit<Stamp, "id">) => void;

  /** Load a saved snapshot (on login). */
  loadSnapshot: (snap: { profile: UserProfile; history: CompletedFlight[]; stamps: Stamp[] }) => void;

  /** Export current state as a snapshot (for saving on logout/change). */
  exportSnapshot: () => { profile: UserProfile; history: CompletedFlight[]; stamps: Stamp[] };

  /** Reset to blank defaults (on logout). */
  resetToDefault: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      profile: DEFAULT_PROFILE,
      history: [],
      stamps: [],

      // ── updateName ───────────────────────────────────────────────────────
      updateName: (name) =>
        set((s) => ({ profile: { ...s.profile, name } })),

      // ── recordFlight ─────────────────────────────────────────────────────
      recordFlight: ({ departureId, destinationId, durationMinutes, xpEarned }) => {
        set((s) => {
          const today = todayISO();
          const last = s.profile.lastFlightDate;

          let newStreak = s.profile.currentStreak;
          if (!last) {
            newStreak = 1;
          } else if (last === today) {
            // Same day — streak unchanged
          } else if (isConsecutiveDay(last, today)) {
            newStreak = s.profile.currentStreak + 1;
          } else {
            newStreak = 1; // Streak broken
          }

          const visited = new Set(s.profile.visitedCityIds);
          visited.add(destinationId);
          visited.add(departureId);

          const newProfile: UserProfile = {
            ...s.profile,
            totalXP: s.profile.totalXP + xpEarned,
            totalFlights: s.profile.totalFlights + 1,
            currentStreak: newStreak,
            longestStreak: Math.max(newStreak, s.profile.longestStreak),
            lastFlightDate: today,
            visitedCityIds: Array.from(visited),
            totalFocusMinutes: s.profile.totalFocusMinutes + durationMinutes,
          };

          const newFlight: CompletedFlight = {
            id: generateId(),
            departureId,
            destinationId,
            durationMinutes,
            completedAt: new Date().toISOString(),
            xpEarned,
          };

          return {
            profile: newProfile,
            history: [newFlight, ...s.history].slice(0, 50),
          };
        });
      },

      // ── loadSnapshot ─────────────────────────────────────────────────────
      loadSnapshot: (snap) => set({ profile: snap.profile, history: snap.history, stamps: snap.stamps }),

      // ── exportSnapshot ────────────────────────────────────────────────────
      exportSnapshot: () => {
        const { profile, history, stamps } = get();
        return { profile, history, stamps };
      },

      // ── resetToDefault ────────────────────────────────────────────────────
      resetToDefault: () => set({ profile: DEFAULT_PROFILE, history: [], stamps: [] }),

      // ── addStamp ─────────────────────────────────────────────────────────
      addStamp: ({ countryCode, city, timestamp }) => {
        set((s) => {
          const today = new Date(timestamp).toDateString();

          // Deduplicate: skip if the same city was already stamped today
          const isDuplicate = s.stamps.some(
            (st) =>
              st.city === city &&
              new Date(st.timestamp).toDateString() === today
          );
          if (isDuplicate) return s;

          const newStamp: Stamp = {
            id: generateId(),
            countryCode,
            city,
            timestamp,
          };

          return { stamps: [newStamp, ...s.stamps].slice(0, 200) };
        });
      },
    }),
    { name: "airjen-user" }
  )
);

// ─── Derived selectors ────────────────────────────────────────────────────────
// Use these in components to avoid drilling into `profile` everywhere.

/**
 * Total flights completed.  Shorthand for `profile.totalFlights`.
 *
 * @example
 * const flights = useUserStore(selectTotalFlights);
 */
export const selectTotalFlights = (s: UserState): number =>
  s.profile.totalFlights;
