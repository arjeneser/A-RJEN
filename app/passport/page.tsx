"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AuthGuard } from "@/components/auth/auth-guard";
import { motion, AnimatePresence } from "framer-motion";
import {
  useUserStore,
  getLevel,
  getLevelProgress,
  flightsToNextLevel,
  LEVEL_CONFIG,
} from "@/store/user-store";
import { getCityById, flagEmoji } from "@/data/cities";
import { formatMinutes } from "@/lib/utils";
import { ALL_ACHIEVEMENTS } from "@/data/achievements";
import type { AchievementRarity } from "@/types";

const VisitedMap = dynamic(
  () => import("@/components/passport/visited-map").then((m) => m.VisitedMap),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full rounded-2xl animate-pulse"
        style={{ height: 220, background: "rgba(255,255,255,0.03)" }}
      />
    ),
  }
);

// ── Turkish Crescent + Star SVG ───────────────────────────────────────────────
function TurkishEmblem({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none">
      {/* Crescent */}
      <circle cx="26" cy="28" r="14" fill="#E30A17" />
      <circle cx="31" cy="28" r="11" fill="#C8102E" />
      {/* Star */}
      <g transform="translate(37,22) rotate(0)">
        <polygon
          points="0,-6 1.4,-2 5.7,-2 2.3,0.9 3.5,5.1 0,2.5 -3.5,5.1 -2.3,0.9 -5.7,-2 -1.4,-2"
          fill="#E30A17"
        />
      </g>
    </svg>
  );
}

// ── Passport cover ────────────────────────────────────────────────────────────
function PassportCover({ name }: { name: string }) {
  return (
    <div
      className="relative rounded-2xl overflow-hidden flex flex-col items-center justify-between p-6 select-none"
      style={{
        background: "linear-gradient(160deg, #6B0F1A 0%, #8B1A2A 40%, #4A0A11 100%)",
        border: "2px solid rgba(212,160,80,0.4)",
        boxShadow:
          "0 0 0 1px rgba(212,160,80,0.15) inset, 0 20px 60px rgba(0,0,0,0.6)",
        minHeight: 220,
      }}
    >
      {/* Gold decorative lines top */}
      <div className="w-full" style={{ borderTop: "1px solid rgba(212,160,80,0.35)" }} />

      <div className="flex flex-col items-center gap-2">
        {/* Emblem circle */}
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{
            background: "rgba(212,160,80,0.15)",
            border: "1.5px solid rgba(212,160,80,0.5)",
          }}
        >
          <span style={{ fontSize: 34 }}>🌙</span>
        </div>

        <div className="text-center">
          <div
            className="text-xs font-bold tracking-[0.25em] uppercase"
            style={{ color: "#D4A050", fontFamily: "Space Grotesk, sans-serif" }}
          >
            TÜRKİYE CUMHURİYETİ
          </div>
          <div
            className="text-2xl font-bold mt-0.5"
            style={{ color: "#F5D08A", fontFamily: "Space Grotesk, sans-serif", letterSpacing: "0.06em" }}
          >
            PASAPORT
          </div>
          <div
            className="text-[10px] tracking-widest mt-0.5"
            style={{ color: "rgba(212,160,80,0.6)" }}
          >
            PASSPORT · PASSEPORT
          </div>
        </div>

        <div
          className="text-sm font-semibold mt-1 px-4 py-1 rounded-full"
          style={{
            color: "#F5D08A",
            background: "rgba(212,160,80,0.12)",
            border: "1px solid rgba(212,160,80,0.3)",
            fontFamily: "Space Grotesk, sans-serif",
          }}
        >
          ✈ {name}
        </div>
      </div>

      {/* Gold decorative lines bottom */}
      <div className="w-full" style={{ borderTop: "1px solid rgba(212,160,80,0.35)" }} />
    </div>
  );
}

// ── Single stamp tile ─────────────────────────────────────────────────────────
function StampTile({
  countryCode,
  city,
  timestamp,
  index,
}: {
  countryCode: string;
  city: string;
  timestamp: number;
  index: number;
}) {
  const date = new Date(timestamp);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(2);

  // Rotate slightly for "inked stamp" effect
  const rotate = ((index * 7 + countryCode.charCodeAt(0)) % 7) - 3;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7, rotate: rotate - 5 }}
      animate={{ opacity: 1, scale: 1, rotate }}
      transition={{ delay: index * 0.04, type: "spring", stiffness: 250, damping: 20 }}
      className="relative flex flex-col items-center justify-center p-2 rounded-xl cursor-default group"
      style={{
        background: "rgba(212,160,80,0.05)",
        border: "1.5px solid rgba(212,160,80,0.2)",
        aspectRatio: "1",
      }}
    >
      {/* Outer ring */}
      <div
        className="absolute inset-1.5 rounded-lg pointer-events-none"
        style={{ border: "1px solid rgba(212,160,80,0.15)" }}
      />
      {/* "GIRIŞ" arc-like text */}
      <div
        className="text-[7px] font-bold tracking-widest uppercase mb-0.5"
        style={{ color: "rgba(212,160,80,0.5)" }}
      >
        GİRİŞ
      </div>
      {/* Flag */}
      <div className="text-2xl leading-none">{flagEmoji(countryCode)}</div>
      {/* City */}
      <div
        className="text-[9px] font-semibold text-center leading-tight mt-1 truncate w-full px-1"
        style={{ color: "#D4A050" }}
      >
        {city}
      </div>
      {/* Date */}
      <div
        className="text-[8px] mt-0.5 font-mono"
        style={{ color: "rgba(212,160,80,0.45)" }}
      >
        {dd}.{mm}.{yy}
      </div>
    </motion.div>
  );
}

// ── Rarity badge ──────────────────────────────────────────────────────────────
const RARITY_STYLE: Record<AchievementRarity, { border: string; bg: string; color: string; label: string }> = {
  common:    { border: "rgba(148,163,184,0.3)",  bg: "rgba(148,163,184,0.07)", color: "#94A3B8", label: "Yaygın"    },
  rare:      { border: "rgba(96,165,250,0.35)",  bg: "rgba(96,165,250,0.08)",  color: "#60A5FA", label: "Nadir"     },
  epic:      { border: "rgba(167,139,250,0.4)",  bg: "rgba(167,139,250,0.09)", color: "#A78BFA", label: "Epik"      },
  legendary: { border: "rgba(245,158,11,0.45)",  bg: "rgba(245,158,11,0.1)",   color: "#F59E0B", label: "Efsanevi"  },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "stamps" | "history" | "achievements";

export default function PassportPage() {
  const { profile, history, stamps, achievements: earnedAchievements, updateName } = useUserStore();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(profile.name);
  const [tab, setTab] = useState<Tab>("stamps");

  const level = getLevel(profile.totalFlights);
  const levelProg = getLevelProgress(profile.totalFlights);
  const toNext = flightsToNextLevel(profile.totalFlights);

  function saveName() {
    updateName(nameInput.trim() || "Pilot");
    setEditingName(false);
  }

  return (
    <AuthGuard>
    <div className="min-h-screen bg-[#070918] pt-16">
      {/* Ambient bg */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 right-1/4 w-[400px] h-[300px] bg-red-950/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/4 w-[350px] h-[250px] bg-amber-900/10 rounded-full blur-[80px]" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-12">
        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-10">
          <div>
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs mb-3"
              style={{
                background: "rgba(212,160,80,0.08)",
                border: "1px solid rgba(212,160,80,0.2)",
                color: "#D4A050",
              }}
            >
              📖 Uçuş Pasaportu
            </div>
            <h1
              className="text-3xl font-bold text-white"
              style={{ fontFamily: "Space Grotesk, sans-serif" }}
            >
              {profile.name}&apos;nın Pasaportu
            </h1>
          </div>
          <Link href="/new-flight">
            <button
              className="px-6 py-3 rounded-2xl text-sm font-semibold text-white"
              style={{
                background: "linear-gradient(135deg, #3B82F6, #1D4ED8)",
                boxShadow: "0 4px 20px rgba(59,130,246,0.25)",
              }}
            >
              ✈ Yeni Uçuş
            </button>
          </Link>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* ── Left: Passport cover + stats ─────────────────────── */}
          <div className="lg:col-span-1 space-y-4">
            {/* Passport cover */}
            <PassportCover name={profile.name} />

            {/* Profile card */}
            <div
              className="rounded-3xl p-5"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              {/* Avatar + level */}
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-2xl shrink-0"
                  style={{
                    background: `${level.color}20`,
                    border: `1.5px solid ${level.color}60`,
                  }}
                >
                  {level.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  {editingName ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        autoFocus
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && saveName()}
                        className="flex-1 bg-white/[0.06] border border-white/[0.12] rounded-lg px-2 py-1 text-white text-sm outline-none focus:border-brand-sky/50"
                        maxLength={24}
                      />
                      <button
                        onClick={saveName}
                        className="text-green-400 hover:text-green-300 transition-colors"
                      >
                        ✓
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setNameInput(profile.name); setEditingName(true); }}
                      className="group flex items-center gap-1.5"
                    >
                      <span
                        className="font-bold text-white text-base"
                        style={{ fontFamily: "Space Grotesk, sans-serif" }}
                      >
                        {profile.name}
                      </span>
                      <span className="text-slate-600 group-hover:text-slate-400 transition-colors text-xs">✏</span>
                    </button>
                  )}
                  <div className="text-xs font-semibold" style={{ color: level.color }}>
                    {level.name}
                  </div>
                </div>
              </div>

              {/* Level progress */}
              <div className="space-y-1.5 mb-4">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Seviye İlerlemesi</span>
                  <span>{toNext > 0 ? `${toNext} uçuş kaldı` : "MAKS SEVİYE"}</span>
                </div>
                <div className="progress-track h-1.5">
                  <motion.div
                    className="progress-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${levelProg * 100}%` }}
                    transition={{ duration: 1, delay: 0.3 }}
                  />
                </div>
              </div>

              {/* Level milestones */}
              <div className="flex justify-between">
                {LEVEL_CONFIG.map((l) => {
                  const unlocked = profile.totalFlights >= l.requiredFlights;
                  return (
                    <div key={l.name} className="flex flex-col items-center gap-1">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs border transition-all"
                        style={{
                          background: unlocked ? `${l.color}22` : "rgba(255,255,255,0.03)",
                          borderColor: unlocked ? l.color : "rgba(255,255,255,0.08)",
                          opacity: unlocked ? 1 : 0.3,
                        }}
                      >
                        {l.emoji}
                      </div>
                      <span className="text-[8px]" style={{ color: unlocked ? l.color : "#334155" }}>
                        {l.requiredFlights}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: "✈️", value: profile.totalFlights, label: "Uçuşlar" },
                { icon: "🌍", value: stamps.length, label: "Damgalar" },
                { icon: "⭐", value: profile.totalXP, label: "Toplam XP" },
                { icon: "🔥", value: profile.currentStreak, label: "Gün Serisi" },
                { icon: "⏱️", value: formatMinutes(profile.totalFocusMinutes), label: "Odak Süresi" },
                { icon: "🏆", value: profile.longestStreak, label: "En İyi Seri" },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-2xl p-3"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div className="text-xl mb-0.5">{s.icon}</div>
                  <div
                    className="text-lg font-bold text-white"
                    style={{ fontFamily: "Space Grotesk, sans-serif" }}
                  >
                    {s.value}
                  </div>
                  <div className="text-[10px] text-slate-600">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: Stamps / History ───────────────────────────── */}
          <div className="lg:col-span-2">

            {/* ── World map ─────────────────────────────────────────── */}
            <div className="mb-4">
              <VisitedMap
                visitedCountryCodes={Array.from(new Set(stamps.map((s) => s.countryCode)))}
              />
            </div>

            {/* Tab bar */}
            <div
              className="flex gap-1 p-1 rounded-2xl mb-4"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              {(["stamps", "history", "achievements"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
                  style={
                    tab === t
                      ? {
                          background: "linear-gradient(135deg, rgba(212,160,80,0.2), rgba(212,120,40,0.12))",
                          border: "1px solid rgba(212,160,80,0.35)",
                          color: "#D4A050",
                        }
                      : { color: "#64748B" }
                  }
                >
                  {t === "stamps"
                    ? `📖 Damgalar (${stamps.length})`
                    : t === "history"
                    ? `🛫 Geçmiş (${history.length})`
                    : `🏅 Başarımlar (${earnedAchievements.length})`}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {tab === "stamps" ? (
                <motion.div
                  key="stamps"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-3xl p-6"
                  style={{
                    background:
                      "linear-gradient(160deg, rgba(30,10,10,0.95) 0%, rgba(15,8,8,0.98) 100%)",
                    border: "1px solid rgba(212,160,80,0.2)",
                    boxShadow: "0 0 60px rgba(139,26,42,0.12) inset",
                    minHeight: 420,
                  }}
                >
                  {/* Passport page header */}
                  <div
                    className="flex items-center justify-between mb-4 pb-3"
                    style={{ borderBottom: "1px solid rgba(212,160,80,0.15)" }}
                  >
                    <div>
                      <div
                        className="text-xs font-bold tracking-[0.2em] uppercase"
                        style={{ color: "rgba(212,160,80,0.5)" }}
                      >
                        TÜRKİYE CUMHURİYETİ
                      </div>
                      <div
                        className="font-bold"
                        style={{ color: "#D4A050", fontFamily: "Space Grotesk, sans-serif" }}
                      >
                        Giriş / Çıkış Damgaları
                      </div>
                    </div>
                    <div
                      className="text-xs px-2 py-1 rounded-full"
                      style={{
                        background: "rgba(212,160,80,0.1)",
                        border: "1px solid rgba(212,160,80,0.25)",
                        color: "#D4A050",
                      }}
                    >
                      {stamps.length} ülke
                    </div>
                  </div>

                  {stamps.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-600">
                      <span className="text-5xl mb-4">📖</span>
                      <p className="text-sm">Henüz yurt dışı damgası yok.</p>
                      <p className="text-xs mt-1 text-slate-700">
                        Yurt dışına uçuşları tamamla ve pasaportunu doldurmaya başla!
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                      {stamps.map((stamp, i) => (
                        <StampTile
                          key={stamp.id}
                          countryCode={stamp.countryCode}
                          city={stamp.city}
                          timestamp={stamp.timestamp}
                          index={i}
                        />
                      ))}
                    </div>
                  )}

                  {/* Decorative watermark */}
                  {stamps.length > 0 && (
                    <div
                      className="mt-6 pt-3 text-center text-[9px] tracking-widest uppercase"
                      style={{
                        borderTop: "1px solid rgba(212,160,80,0.1)",
                        color: "rgba(212,160,80,0.2)",
                      }}
                    >
                      TÜRKİYE CUMHURİYETİ · REPUBLIC OF TURKEY
                    </div>
                  )}
                </motion.div>
              ) : tab === "history" ? (
                <motion.div
                  key="history"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-3xl p-6 space-y-2"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    minHeight: 420,
                  }}
                >
                  {history.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-600">
                      <span className="text-4xl mb-3">🌍</span>
                      <p className="text-sm">Henüz uçuş yok.</p>
                    </div>
                  ) : (
                    history.map((flight, i) => {
                      const dep = getCityById(flight.departureId);
                      const dst = getCityById(flight.destinationId);
                      const isIntl = dst && dst.countryCode !== "TR";
                      return (
                        <motion.div
                          key={flight.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className="rounded-xl overflow-hidden"
                          style={{
                            background: "rgba(255,255,255,0.025)",
                            border: "1px solid rgba(255,255,255,0.05)",
                          }}
                        >
                          <div className="flex items-center justify-between p-3.5">
                            <div className="flex items-center gap-3">
                              {/* Badge */}
                              <div
                                className="w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0"
                                style={{
                                  background: isIntl
                                    ? "rgba(212,160,80,0.12)"
                                    : "rgba(59,130,246,0.12)",
                                  border: isIntl
                                    ? "1px solid rgba(212,160,80,0.25)"
                                    : "1px solid rgba(59,130,246,0.2)",
                                }}
                              >
                                {isIntl ? "🌍" : "🇹🇷"}
                              </div>
                              <div>
                                <div className="text-sm font-medium text-slate-200">
                                  {dep
                                    ? `${flagEmoji(dep.countryCode)} ${dep.name}`
                                    : flight.departureId}
                                  {" → "}
                                  {dst
                                    ? `${flagEmoji(dst.countryCode)} ${dst.name}`
                                    : flight.destinationId}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs text-slate-600">
                                    {formatMinutes(flight.durationMinutes)} ·{" "}
                                    {new Date(flight.completedAt).toLocaleDateString("tr-TR")}
                                  </span>
                                  <span
                                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                    style={
                                      isIntl
                                        ? {
                                            background: "rgba(212,160,80,0.1)",
                                            border: "1px solid rgba(212,160,80,0.25)",
                                            color: "#D4A050",
                                          }
                                        : {
                                            background: "rgba(59,130,246,0.1)",
                                            border: "1px solid rgba(59,130,246,0.2)",
                                            color: "#60A5FA",
                                          }
                                    }
                                  >
                                    {isIntl ? "ULUSLARARASI" : "YURTİÇİ"}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div
                              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0"
                              style={{
                                background: "rgba(245,158,11,0.1)",
                                border: "1px solid rgba(245,158,11,0.2)",
                                color: "#F59E0B",
                              }}
                            >
                              +{flight.xpEarned} XP
                            </div>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="achievements"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-3xl p-6"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    minHeight: 420,
                  }}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <div className="text-base font-bold text-white" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                        Başarım Rozetleri
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">
                        {earnedAchievements.length} / {ALL_ACHIEVEMENTS.length} kazanıldı
                      </div>
                    </div>
                    {/* Progress ring label */}
                    <div
                      className="px-3 py-1.5 rounded-full text-xs font-bold"
                      style={{
                        background: "rgba(245,158,11,0.1)",
                        border: "1px solid rgba(245,158,11,0.2)",
                        color: "#F59E0B",
                      }}
                    >
                      🏅 {Math.round((earnedAchievements.length / ALL_ACHIEVEMENTS.length) * 100)}%
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="progress-track h-1.5 mb-6">
                    <motion.div
                      className="progress-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${(earnedAchievements.length / ALL_ACHIEVEMENTS.length) * 100}%` }}
                      transition={{ duration: 1, delay: 0.2 }}
                    />
                  </div>

                  {/* Achievement grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {ALL_ACHIEVEMENTS.map((ach, i) => {
                      const earned = earnedAchievements.find((e) => e.id === ach.id);
                      const rs = RARITY_STYLE[ach.rarity];
                      return (
                        <motion.div
                          key={ach.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.025 }}
                          className="flex items-center gap-3 p-3 rounded-xl"
                          style={{
                            background: earned ? rs.bg : "rgba(255,255,255,0.02)",
                            border: `1px solid ${earned ? rs.border : "rgba(255,255,255,0.04)"}`,
                            opacity: earned ? 1 : 0.45,
                          }}
                        >
                          {/* Emoji with glow when earned */}
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                            style={{
                              background: earned ? `${rs.bg}` : "rgba(255,255,255,0.03)",
                              border: `1px solid ${earned ? rs.border : "rgba(255,255,255,0.06)"}`,
                              filter: earned ? `drop-shadow(0 0 6px ${rs.color}60)` : "grayscale(1)",
                            }}
                          >
                            {ach.emoji}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="text-sm font-bold truncate"
                                style={{
                                  color: earned ? "#F1F5F9" : "#475569",
                                  fontFamily: "Space Grotesk, sans-serif",
                                }}
                              >
                                {ach.name}
                              </span>
                              <span
                                className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                                style={{
                                  background: `${rs.bg}`,
                                  border: `1px solid ${rs.border}`,
                                  color: rs.color,
                                }}
                              >
                                {rs.label.toUpperCase()}
                              </span>
                            </div>
                            <div className="text-xs text-slate-600 truncate">{ach.description}</div>
                            {earned?.unlockedAt && (
                              <div className="text-[10px] mt-0.5" style={{ color: rs.color + "99" }}>
                                {new Date(earned.unlockedAt).toLocaleDateString("tr-TR")} tarihinde kazanıldı
                              </div>
                            )}
                          </div>
                          {/* Lock icon when not earned */}
                          {!earned && (
                            <div className="text-slate-700 text-base shrink-0">🔒</div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
    </AuthGuard>
  );
}
