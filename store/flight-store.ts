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
  journeyLeg: number;      // 1 = first flight, 2 = second, ...
  journeyCities: City[];   // full route so far

  setStep: (step: number) => void;
  setDeparture: (city: City) => void;
  setDuration: (duration: FlightDurationOption) => void;
  setDestination: (city: City) => void;
  setSeat: (seat: string) => void;
  setPassengerName: (name: string) => void;
  /** Continue journey from arrived destination — skips departure step */
  continueJourney: (fromCity: City, passengerName: string) => void;
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
  journeyLeg: 1,
  journeyCities: [],

  setStep: (step) => set({ step }),
  setDeparture: (city) => set({ departure: city, destination: null, step: 2 }),
  setDuration: (duration) => set({ duration, destination: null, step: 3 }),
  setDestination: (city) => set({ destination: city, step: 4 }),
  setSeat: (seat) => set({ seat, step: 5 }),
  setPassengerName: (passengerName) => set({ passengerName }),

  continueJourney: (fromCity, passengerName) =>
    set((s) => ({
      step: 2, // skip departure selection
      departure: fromCity,
      duration: null,
      destination: null,
      seat: null,
      passengerName,
      isContinuation: true,
      journeyLeg: s.journeyLeg + 1,
      journeyCities: [...s.journeyCities, fromCity],
    })),

  reset: () =>
    set({
      step: 1,
      departure: null,
      duration: null,
      destination: null,
      seat: null,
      passengerName: "FOCUS PILOT",
      isContinuation: false,
      journeyLeg: 1,
      journeyCities: [],
    }),
}));

// ─── Active Session (Timer + Map) ─────────────────────────────────────────────

interface ActiveSessionState {
  session: FlightSession | null;
  startSession: (params: {
    departure: City;
    destination: City;
    durationMs: number;
    seat: string;
    passengerName: string;
  }) => void;
  pauseSession: () => void;
  resumeSession: () => void;
  completeSession: () => void;
  abandonSession: () => void;
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

      startSession: ({ departure, destination, durationMs, seat, passengerName }) => {
        const session: FlightSession = {
          id: generateId(),
          departure,
          destination,
          durationMs,
          startTime: Date.now(),
          totalPausedMs: 0,
          seat,
          passengerName,
          status: "running",
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
    }
  )
);
