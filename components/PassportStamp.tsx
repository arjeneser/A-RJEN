"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { Stamp } from "@/types";

// ─── Country icon mapping ──────────────────────────────────────────────────────
//  Extend this object to support new countries — no other code needs touching.

const COUNTRY_ICONS: Record<string, string> = {
  TR: "🕌",
  FR: "🗼",
  US: "🗽",
  GB: "🎡",
  JP: "🏯",
  IT: "🏛️",
  DE: "🏰",
  ES: "💃",
  CN: "🏮",
  RU: "🎭",
  AU: "🦘",
  BR: "🌴",
  IN: "🕍",
  EG: "🏺",
  GR: "⛩️",
  AE: "🌙",
  SA: "🌙",
  GE: "⛪",
  AZ: "🔥",
  MA: "🌿",
  KE: "🦁",
  ZA: "💎",
  TH: "🛕",
  SG: "🦁",
  MY: "🌺",
  ID: "🌴",
  PH: "🌊",
  KR: "🏯",
  TW: "🧋",
  HK: "🌆",
  PK: "🌙",
  BD: "🌿",
  NP: "🏔️",
  LK: "🍃",
  KZ: "🦅",
  UZ: "🕌",
  IR: "🕌",
  IQ: "🏺",
  JO: "🏜️",
  LB: "🌲",
  CY: "🌊",
  UA: "🌻",
  PL: "🦅",
  CZ: "🏰",
  HU: "🌉",
  RO: "🧛",
  BG: "🌹",
  RS: "🎻",
  HR: "⛵",
  AT: "🎼",
  CH: "🏔️",
  NL: "🌷",
  BE: "🍺",
  SE: "🫙",
  NO: "🌊",
  DK: "🧜",
  FI: "🦌",
  PT: "🐓",
  IE: "🍀",
  IS: "🌋",
  CA: "🍁",
  MX: "🌮",
  CU: "🎷",
  AR: "🥩",
  CL: "🍷",
  PE: "🦙",
  CO: "☕",
  VE: "🌺",
  NG: "🦅",
  ET: "☕",
  GH: "🥁",
  SN: "🥁",
  CM: "🌿",
  NZ: "🥝",
  FJ: "🌊",
};

const DEFAULT_ICON = "✈️";

/** Returns the icon for a given ISO-3166-1 alpha-2 country code. */
export function getCountryIcon(countryCode: string): string {
  return COUNTRY_ICONS[countryCode.toUpperCase()] ?? DEFAULT_ICON;
}

// ─── Stamp color palette ───────────────────────────────────────────────────────
// Assign a deterministic color family to each country based on its code hash.

const STAMP_PALETTES = [
  { ink: "#1D4ED8", bg: "rgba(29,78,216,0.08)", border: "#3B82F6" },  // blue
  { ink: "#DC2626", bg: "rgba(220,38,38,0.08)",  border: "#EF4444" },  // red
  { ink: "#065F46", bg: "rgba(6,95,70,0.08)",    border: "#10B981" },  // green
  { ink: "#7C3AED", bg: "rgba(124,58,237,0.08)", border: "#8B5CF6" },  // purple
  { ink: "#B45309", bg: "rgba(180,83,9,0.08)",   border: "#F59E0B" },  // amber
  { ink: "#0E7490", bg: "rgba(14,116,144,0.08)", border: "#06B6D4" },  // cyan
] as const;

function getPalette(countryCode: string) {
  let hash = 0;
  for (let i = 0; i < countryCode.length; i++) {
    hash = (hash * 31 + countryCode.charCodeAt(i)) & 0xffffffff;
  }
  return STAMP_PALETTES[Math.abs(hash) % STAMP_PALETTES.length];
}

/** Deterministic rotation ±14° seeded by city name — stable across re-renders. */
function getRotation(city: string): number {
  let hash = 0;
  for (let i = 0; i < city.length; i++) {
    hash = (hash * 31 + city.charCodeAt(i)) & 0xffffffff;
  }
  return ((Math.abs(hash) % 29) - 14); // –14 … +14 deg
}

function formatStampDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ─── PassportStamp component ──────────────────────────────────────────────────

interface PassportStampProps {
  /** ISO-3166-1 alpha-2 country code */
  countryCode: string;
  /** City name displayed inside the stamp */
  city?: string;
  /** Unix timestamp (ms) — shown as date inside stamp */
  timestamp?: number;
  /** Override automatic sizing */
  size?: "sm" | "md" | "lg";
  /** Animation entry delay in seconds */
  delay?: number;
  /** Show the stamp as dimmed / not-yet-earned */
  locked?: boolean;
}

const SIZE_MAP = {
  sm: { outer: "w-20 h-16",  icon: "text-xl",  city: "text-[9px]",  label: "text-[7px]"  },
  md: { outer: "w-28 h-20",  icon: "text-3xl", city: "text-[10px]", label: "text-[8px]"  },
  lg: { outer: "w-36 h-28",  icon: "text-4xl", city: "text-xs",     label: "text-[10px]" },
};

export function PassportStamp({
  countryCode,
  city = "",
  timestamp,
  size = "md",
  delay = 0,
  locked = false,
}: PassportStampProps) {
  const icon     = getCountryIcon(countryCode);
  const palette  = useMemo(() => getPalette(countryCode), [countryCode]);
  const rotation = useMemo(() => getRotation(city || countryCode), [city, countryCode]);
  const sz       = SIZE_MAP[size];
  const date     = timestamp ? formatStampDate(timestamp) : null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6, rotate: rotation - 10 }}
      animate={{ opacity: locked ? 0.22 : 1, scale: 1, rotate: rotation }}
      transition={{ type: "spring", stiffness: 260, damping: 20, delay }}
      className="inline-flex items-center justify-center select-none"
      style={{ filter: locked ? "grayscale(1)" : undefined }}
      title={city || countryCode}
    >
      {/* Outer oval */}
      <div
        className={`relative flex flex-col items-center justify-center gap-0.5 px-4 py-3 rounded-[50%] ${sz.outer}`}
        style={{
          background: palette.bg,
          border: `2px solid ${palette.border}`,
          boxShadow: `0 0 0 1px ${palette.ink}22, inset 0 0 12px ${palette.ink}10`,
          opacity: 0.9,
        }}
      >
        {/* Inner oval ring */}
        <div
          className="absolute inset-[3px] rounded-[50%] pointer-events-none"
          style={{ border: `1px solid ${palette.border}55` }}
        />

        {/* Top label */}
        <span
          className={`${sz.label} font-bold tracking-[0.15em] uppercase leading-none`}
          style={{ color: palette.ink, opacity: 0.7 }}
        >
          AIRJEN AIR
        </span>

        {/* Country icon */}
        <span className={`${sz.icon} leading-none`}>{icon}</span>

        {/* City name */}
        {city && (
          <span
            className={`${sz.city} font-bold tracking-wide uppercase leading-none text-center`}
            style={{ color: palette.ink }}
          >
            {city}
          </span>
        )}

        {/* Date */}
        {date && (
          <span
            className={`${sz.label} tracking-widest leading-none`}
            style={{ color: palette.ink, opacity: 0.55 }}
          >
            {date}
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ─── StampGrid ────────────────────────────────────────────────────────────────
// Convenience wrapper used on the Passport page.

interface StampGridProps {
  stamps: Stamp[];
  /** Show empty placeholder slots up to this count */
  placeholders?: number;
}

export function StampGrid({ stamps, placeholders = 0 }: StampGridProps) {
  const emptySlots = Math.max(0, placeholders - stamps.length);

  return (
    <div className="flex flex-wrap gap-4">
      {stamps.map((s, i) => (
        <PassportStamp
          key={s.id}
          countryCode={s.countryCode}
          city={s.city}
          timestamp={s.timestamp}
          size="md"
          delay={Math.min(i * 0.05, 0.4)}
        />
      ))}

      {/* Ghost placeholder slots */}
      {Array.from({ length: emptySlots }).map((_, i) => (
        <div
          key={`ghost-${i}`}
          className="w-28 h-20 rounded-[50%] border border-dashed border-white/10 opacity-30"
        />
      ))}
    </div>
  );
}

// ─── GoldPassportOverlay ──────────────────────────────────────────────────────
// Wrap this around the passport card when totalFlights >= 100.

interface GoldPassportOverlayProps {
  children: React.ReactNode;
  active: boolean;
}

export function GoldPassportOverlay({ children, active }: GoldPassportOverlayProps) {
  if (!active) return <>{children}</>;

  return (
    <div className="relative rounded-3xl overflow-hidden">
      {/* Deep gold gradient background */}
      <div
        className="absolute inset-0 pointer-events-none rounded-3xl"
        style={{
          background:
            "linear-gradient(135deg, #78350F 0%, #92400E 20%, #B45309 40%, #D97706 55%, #92400E 70%, #78350F 100%)",
          opacity: 0.18,
        }}
      />

      {/* Animated shimmer sweep */}
      <div
        className="absolute inset-0 pointer-events-none rounded-3xl animate-gold-shimmer"
        style={{
          background:
            "linear-gradient(105deg, transparent 30%, rgba(251,191,36,0.25) 50%, transparent 70%)",
          backgroundSize: "200% 100%",
        }}
      />

      {/* Glowing border */}
      <div
        className="absolute inset-0 rounded-3xl pointer-events-none"
        style={{
          border: "1.5px solid rgba(251,191,36,0.45)",
          boxShadow:
            "0 0 32px rgba(245,158,11,0.20), 0 0 80px rgba(245,158,11,0.08), inset 0 0 24px rgba(245,158,11,0.06)",
        }}
      />

      {/* Noise texture overlay for that premium tactile feel */}
      <div
        className="absolute inset-0 pointer-events-none rounded-3xl opacity-[0.04]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E\")",
          backgroundRepeat: "repeat",
          backgroundSize: "128px 128px",
          mixBlendMode: "overlay",
        }}
      />

      {/* Glassmorphism inner surface */}
      <div
        className="relative rounded-3xl"
        style={{ backdropFilter: "blur(1px)" }}
      >
        {/* GOLD PASSPORT badge */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 py-1 rounded-full"
          style={{
            background: "linear-gradient(135deg, #92400E, #D97706, #92400E)",
            border: "1px solid rgba(251,191,36,0.6)",
            boxShadow: "0 2px 12px rgba(245,158,11,0.35)",
          }}
        >
          <span className="text-xs">👑</span>
          <span
            className="text-[10px] font-bold tracking-[0.2em] uppercase"
            style={{ color: "#FEF3C7" }}
          >
            Gold Passport
          </span>
        </motion.div>

        {children}
      </div>
    </div>
  );
}
