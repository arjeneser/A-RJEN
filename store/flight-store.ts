"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { City, FlightDurationOption, FlightSession, SessionStatus } from "@/types";
import { generateId } from "@/lib/utils";

// ─── Flight Setup (Booking Wizard) ───────────────────────────────────────────

interface FlightSetupState {
  step: number;           // 1–5 (continuation starts at 2)
  departure: City | null;
  duration: FlightDurationOption | null;
  destination: City | null;
  seat: string | null;
  passengerName: string;
  isContinuation: boolean; // true = coming from a previous flight
  lockedDestination: boolean; // true = joining a friend's flight (destination pre-set)
  journeyLeg: number;      // 1 = first flight, 2 = second, ...
  journeyCities: City[];   // full route so far
  // Pomodoro mola ayarları (0 = mola yok)
  breakIntervalMinutes: number;
  breakDurationMinutes: number;

  setStep: (step: number) => void;
  setDeparture: (city: City) => void;
  setDuration: (duration: FlightDurationOption) => void;
  setDestination: (city: City) => void;
  setSeat: (seat: string) => void;
  setPassengerName: (name: string) => void;
  setBreakSettings: (intervalMinutes: number, durationMinutes: number) => void;
  /** Continue journey from arrived destination — skips departure step */
  continueJourney: (fromCity: City, passengerName: string) => void;
  /** Join a friend's flight — pre-fills departure + destination + duration (locked) */
  joinFlight: (departure: City, destination: City, durationOption?: FlightDurationOption) => void;
  reset: () => void;
}

export const useFlightSetup = create<FlightSetupState>((set) => ({
  step: 1,
  departure: null,
  duration: null,
  destination: null,
  seat: null,
  passengerName: "FOCUS PILOT",
  isContinuation: false,
  lockedDestination: false,
  journeyLeg: 1,
  journeyCities: [],
  breakIntervalMinutes: 50,
  breakDurationMinutes: 15,

  setStep: (step) => set({ step }),
  setDeparture: (city) => set({ departure: city, destination: null, lockedDestination: false, step: 2 }),
  setDuration: (duration) =>
    set((s) => ({
      duration,
      destination: s.lockedDestination ? s.destination : null,
      step: s.lockedDestination ? 4 : 3,
    })),
  setDestination: (city) => set({ destination: city, step: 4 }),
  setSeat: (seat) => set({ seat, step: 5 }),
  setPassengerName: (passengerName) => set({ passengerName }),
  setBreakSettings: (intervalMinutes, durationMinutes) =>
    set({ breakIntervalMinutes: intervalMinutes, breakDurationMinutes: durationMinutes }),

  continueJourney: (fromCity, passengerName) =>
    set((s) => ({
      step: 2,
      departure: fromCity,
      duration: null,
      destination: null,
      seat: null,
      passengerName,
      isContinuation: true,
      lockedDestination: false,
      journeyLeg: s.journeyLeg + 1,
      journeyCities: [...s.journeyCities, fromCity],
    })),

  joinFlight: (departure, destination, durationOption) =>
    set({
      step: durationOption ? 4 : 2, // süre kilitliyse direkt koltuk seçimine
      departure,
      destination,
      duration: durationOption ?? null,
      seat: null,
      isContinuation: false,
      lockedDestination: true,
      journeyLeg: 1,
      journeyCities: [],
    }),

  reset: () =>
    set({
      step: 1,
      departure: null,
      duration: null,
      destination: null,
      seat: null,
      passengerName: "FOCUS PILOT",
      isContinuation: false,
      lockedDestination: false,
      journeyLeg: 1,
      journeyCities: [],
      breakIntervalMinutes: 50,
      breakDurationMinutes: 15,
    }),
}));

// ─── Active Session (Timer + Map) ─────────────────────────────────────────────

interface ActiveSessionState {
  session: FlightSession | null;
  _hasHydrated: boolean;
  _setHydrated: () => void;
  startSession: (params: {
    departure: City;
    destination: City;
    durationMs: number;
    seat: string;
    passengerName: string;
    breakIntervalMinutes?: number;
    breakDurationMinutes?: number;
  }) => void;
  pauseSession: () => void;
  resumeSession: () => void;
  completeSession: () => void;
  abandonSession: () => void;
  /** Acil iniş — destination'ı değiştirip completed olarak işaretle */
  emergencyLand: (landingCity: City, elapsedMs: number) => void;
  clearSession: () => void;

  /** Elapsed ms accounting for pauses. */
  getElapsedMs: () => number;
  /** Progress 0–1 */
  getProgress: () => number;
}

export const useActiveSession = create<ActiveSessionState>()(
  persist(
    (set, get) => ({
      session: null,
      _hasHydrated: false,
      _setHydrated: () => set({ _hasHydrated: true }),

      startSession: ({ departure, destination, durationMs, seat, passengerName, breakIntervalMinutes, breakDurationMinutes }) => {
        const session: FlightSession = {
          id: generateId(),
          departure,
          destination,
          durationMs,
          startTime: Date.now(),
          totalPausedMs: 0,
          pauseCount: 0,
          seat,
          passengerName,
          status: "running",
          breakIntervalMinutes: breakIntervalMinutes ?? 0,
          breakDurationMinutes: breakDurationMinutes ?? 0,
        };
        set({ session });
      },

      pauseSession: () => {
        set((s) => {
          if (!s.session || s.session.status !== "running") return s;
          return {
            session: {
              ...s.session,
              status: "paused",
              pausedAt: Date.now(),
              pauseCount: (s.session.pauseCount ?? 0) + 1,
            },
          };
        });
      },

      resumeSession: () => {
        set((s) => {
          if (!s.session || s.session.status !== "paused") return s;
          const pausedAt = s.session.pausedAt ?? Date.now();
          const addedPause = Date.now() - pausedAt;
          return {
            session: {
              ...s.session,
              status: "running",
              pausedAt: undefined,
              totalPausedMs: s.session.totalPausedMs + addedPause,
            },
          };
        });
      },

      completeSession: () => {
        set((s) => ({
          session: s.session ? { ...s.session, status: "completed" } : null,
        }));
      },

      abandonSession: () => {
        set((s) => ({
          session: s.session ? { ...s.session, status: "abandoned" } : null,
        }));
      },

      emergencyLand: (landingCity: City, elapsedMs: number) => {
        set((s) => ({
          session: s.session
            ? {
                ...s.session,
                destination: landingCity,
                durationMs: Math.max(elapsedMs, 60_000), // en az 1dk
                status: "completed",
              }
            : null,
        }));
      },

      clearSession: () => set({ session: null }),

      getElapsedMs: () => {
        const { session } = get();
        if (!session) return 0;
        if (session.status === "paused") {
          return (
            (session.pausedAt ?? Date.now()) -
            session.startTime -
            session.totalPausedMs
          );
        }
        return Date.now() - session.startTime - session.totalPausedMs;
      },

      getProgress: () => {
        const { session, getElapsedMs } = get();
        if (!session) return 0;
        return Math.min(1, getElapsedMs() / session.durationMs);
      },
    }),
    {
      name: "airjen-session",
      // Only persist fields needed for restoration
      partialize: (s) => ({ session: s.session }),
      onRehydrateStorage: () => (state) => {
        // set() ile React subscriber'ları bilgilendir — direkt mutasyon değil
        if (state) state._setHydrated();
      },
    }
  )
);
