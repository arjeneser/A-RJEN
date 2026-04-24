// ─── City ─────────────────────────────────────────────────────────────────────

export interface City {
  id: string;
  name: string;
  country: string;
  countryCode: string; // ISO alpha-2 for flag emoji
  lat: number;
  lng: number;
  timezone?: string;
  description?: string;
  isDepartureHub?: boolean;
}

// ─── Flight ───────────────────────────────────────────────────────────────────

export type FlightDurationKey =
  | "1h" | "2h" | "3h" | "4h" | "5h" | "6h"
  | "7h" | "8h" | "9h" | "10h" | "11h" | "12h";

export interface FlightDurationOption {
  key: FlightDurationKey;
  label: string;
  subtitle: string;
  minutes: number;
  minDistanceKm: number; // x = v*t for previous tier (ring lower bound)
  maxDistanceKm: number; // x = v*t for this tier (ring upper bound)
  xpReward: number;
  icon: string;
}

export interface FlightSetup {
  departure: City | null;
  duration: FlightDurationOption | null;
  destination: City | null;
  seat: string | null;
  passengerName: string;
}

// ─── Session ──────────────────────────────────────────────────────────────────

export type SessionStatus = "idle" | "running" | "paused" | "completed" | "abandoned";

export interface FlightSession {
  id: string;
  departure: City;
  destination: City;
  durationMs: number; // total duration in milliseconds
  startTime: number;  // unix ms timestamp
  pausedAt?: number;  // unix ms when last paused
  totalPausedMs: number; // accumulated pause time
  seat: string;
  passengerName: string;
  status: SessionStatus;
  xpEarned?: number;
}

// ─── User / Gamification ──────────────────────────────────────────────────────

export type AirjenLevel =
  | "Stajyer"
  | "Öğrenci"
  | "Pilot"
  | "Kaptan"
  | "Efsane";

export interface AirjenLevelInfo {
  name: AirjenLevel;
  emoji: string;
  requiredFlights: number;
  color: string;
}

export interface UserProfile {
  name: string;
  totalXP: number;
  totalFlights: number;
  currentStreak: number;
  longestStreak: number;
  lastFlightDate: string | null; // ISO date string YYYY-MM-DD
  visitedCityIds: string[];
  totalFocusMinutes: number;
  completedSessionIds: string[];
}

export interface CompletedFlight {
  id: string;
  departureId: string;
  destinationId: string;
  durationMinutes: number;
  completedAt: string; // ISO
  xpEarned: number;
  notes?: string; // uçuş sırasında alınan notlar
}

// ─── Achievement ──────────────────────────────────────────────────────────────

export type AchievementRarity = "common" | "rare" | "epic" | "legendary";

export interface Achievement {
  id: string;
  emoji: string;
  name: string;
  description: string;
  rarity: AchievementRarity;
  unlockedAt?: number; // unix ms
}

// ─── Map ─────────────────────────────────────────────────────────────────────

export interface LatLng {
  lat: number;
  lng: number;
}

// ─── Passport Stamp ───────────────────────────────────────────────────────────

/**
 * A passport stamp earned by completing a flight to a destination.
 * Persisted in the user store so stamps accumulate across sessions.
 */
export interface Stamp {
  /** Unique stamp ID (UUID v4) */
  id: string;
  /** ISO 3166-1 alpha-2 country code, e.g. "TR", "FR", "JP" */
  countryCode: string;
  /** Destination city name, e.g. "İstanbul" */
  city: string;
  /** Unix timestamp (ms) when the stamp was earned */
  timestamp: number;
}

// ─── Premium ──────────────────────────────────────────────────────────────────

export interface PremiumFeature {
  id: string;
  name: string;
  description: string;
  icon: string;
  locked: boolean;
}
