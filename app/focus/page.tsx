"use client";

import dynamic from "next/dynamic";
import { useEffect, useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useActiveSession } from "@/store/flight-store";
import { useTimer } from "@/hooks/use-timer";
import { formatDuration, formatMinutes } from "@/lib/utils";
import { flagEmoji } from "@/data/cities";

// ── Map is client-only ────────────────────────────────────────────────────────
const WorldMap = dynamic(
  () => import("@/components/focus/world-map").then((m) => m.WorldMap),
  { ssr: false, loading: () => <div className="w-full h-full bg-[#070918]" /> }
);

// ─────────────────────────────────────────────────────────────────────────────
// Focus Page
// ─────────────────────────────────────────────────────────────────────────────

export default function FocusPage() {
  const router = useRouter();
  const { session, abandonSession } = useActiveSession();
  const hasCompletedRef = useRef(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // ── Timer ─────────────────────────────────────────────────────────────────
  const onComplete = useCallback(() => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;
    router.push("/success");
  }, [router]);

  const { elapsedMs, remainingMs, progress, isPaused, pause, resume } =
    useTimer(onComplete);

  // ── Guards ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mounted && !session) router.push("/");
  }, [session, router, mounted]);

  useEffect(() => {
    if (mounted && session?.status === "completed" && !hasCompletedRef.current) {
      hasCompletedRef.current = true;
      router.push("/success");
    }
  }, [session, router, mounted]);

  if (!mounted || !session) return null;

  const { departure, destination, durationMs, seat } = session;
  const percent = Math.round(progress * 100);

  function handleAbandon() {
    if (!confirm("Bu uçuşu terk etmek istiyor musunuz? İlerlemeniz kaybolacak.")) return;
    abandonSession();
    router.push("/");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Outer wrapper ─────────────────────────────────────────────────── */}
      <div className="fixed inset-0 bg-[#070918] flex flex-col">

        {/* ── World Map ─────────────────────────────────────────────────── */}
        <div className="absolute inset-0">
          <WorldMap
            departure={departure}
            destination={destination}
            progress={progress}
          />
        </div>

        {/* ── Vignette overlays ─────────────────────────────────────────── */}
        <div
          className="absolute top-0 left-0 right-0 h-32 pointer-events-none z-10"
          style={{
            background:
              "linear-gradient(to bottom, rgba(7,9,24,0.92) 0%, transparent 100%)",
          }}
        />
        <div
          className="absolute bottom-0 left-0 right-0 h-64 pointer-events-none z-[15]"
          style={{
            background:
              "linear-gradient(to top, rgba(7,9,24,0.97) 0%, transparent 100%)",
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none z-[5]"
          style={{ background: "rgba(7,9,24,0.35)" }}
        />

        {/* ── Top HUD ───────────────────────────────────────────────────── */}
        <div className="relative z-20 p-4 pt-6 flex items-start justify-between">
          {/* Route chip */}
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium"
            style={{
              background: "rgba(22,26,53,0.85)",
              border: "1px solid rgba(255,255,255,0.1)",
              backdropFilter: "blur(12px)",
            }}
          >
            <span>{flagEmoji(departure.countryCode)}</span>
            <span className="text-white">{departure.name}</span>
            <span className="text-slate-500 text-xs">→</span>
            <span>{flagEmoji(destination.countryCode)}</span>
            <span className="text-white">{destination.name}</span>
          </motion.div>

          {/* Abandon button */}
          <motion.button
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={handleAbandon}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            style={{
              background: "rgba(22,26,53,0.85)",
              border: "1px solid rgba(255,255,255,0.1)",
              backdropFilter: "blur(12px)",
            }}
            title="Uçuşu terk et"
          >
            ✕
          </motion.button>
        </div>

        {/* ── Focus status pill ──────────────────────────────────────────── */}
        <div className="relative z-20 flex justify-center mt-2">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium"
            style={{
              background: "rgba(22,26,53,0.85)",
              border: isPaused
                ? "1px solid rgba(245,158,11,0.4)"
                : "1px solid rgba(34,197,94,0.4)",
              backdropFilter: "blur(8px)",
            }}
          >
            <span className={`relative flex h-2 w-2 ${isPaused ? "opacity-60" : ""}`}>
              {!isPaused && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isPaused ? "bg-yellow-500" : "bg-green-500"
                }`}
              />
            </span>
            <span style={{ color: isPaused ? "#F59E0B" : "#22C55E" }}>
              {isPaused ? "DURAKLATILDI" : "ODAK MODU AKTİF"}
            </span>
            <span className="text-slate-500">· Koltuk {seat}</span>
          </motion.div>
        </div>

      </div>

      {/* ── Bottom Timer Panel — fixed, always visible ────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-8 pointer-events-none">
        {/* Bottom fade */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(to top, rgba(7,9,24,1) 0%, rgba(7,9,24,0.85) 60%, transparent 100%)",
          }}
        />

        <div className="relative max-w-lg mx-auto pointer-events-auto">
          {/* Progress bar */}
          <div className="mb-4">
            <div className="progress-track h-1.5">
              <div
                className="progress-fill"
                style={{ width: `${percent}%`, transition: "width 1s linear" }}
              />
            </div>
          </div>

          {/* Timer display */}
          <div className="text-center mb-4">
            <div
              className="text-6xl sm:text-7xl font-bold text-white tracking-tight leading-none"
              style={{ fontFamily: "Space Grotesk, sans-serif" }}
            >
              {formatDuration(remainingMs)}
            </div>
            <div className="text-slate-500 text-sm mt-2">kalan süre</div>
          </div>

          {/* Stats row */}
          <div
            className="flex items-center justify-between px-6 py-3 rounded-2xl mb-4"
            style={{
              background: "rgba(14,18,42,0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }}
          >
            <div className="text-center">
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-0.5">
                Geçen Süre
              </div>
              <div className="text-sm font-semibold text-white">
                {formatDuration(elapsedMs)}
              </div>
            </div>
            <div className="w-px h-8 bg-white/[0.07]" />
            <div className="text-center">
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-0.5">
                İlerleme
              </div>
              <div className="text-sm font-semibold text-white">{percent}%</div>
            </div>
            <div className="w-px h-8 bg-white/[0.07]" />
            <div className="text-center">
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-0.5">
                Süre
              </div>
              <div className="text-sm font-semibold text-white">
                {formatMinutes(durationMs / 60000)}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 justify-center">
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={isPaused ? resume : pause}
              className="flex-1 max-w-[200px] py-3.5 rounded-2xl font-semibold text-white transition-all"
              style={{
                background: isPaused
                  ? "linear-gradient(135deg, #22C55E, #16A34A)"
                  : "linear-gradient(135deg, #F59E0B, #D97706)",
                boxShadow: isPaused
                  ? "0 4px 20px rgba(34,197,94,0.3)"
                  : "0 4px 20px rgba(245,158,11,0.3)",
              }}
            >
              {isPaused ? "▶ Devam Et" : "⏸ Duraklat"}
            </motion.button>

            <button
              onClick={handleAbandon}
              className="px-5 py-3.5 rounded-2xl text-sm text-slate-500 hover:text-slate-300 transition-colors"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              Terk Et
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
