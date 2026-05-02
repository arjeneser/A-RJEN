"use client";

import dynamic from "next/dynamic";
import { useEffect, useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useActiveSession, useFlightSetup } from "@/store/flight-store";
import { useAuthStore } from "@/store/auth-store";
import { useTimer } from "@/hooks/use-timer";
import { formatDuration, formatMinutes } from "@/lib/utils";
import { flagEmoji } from "@/data/cities";
import { broadcastFlight, clearFlight, subscribeToFlights, type LiveFlight } from "@/lib/flight-sync";

// ── Map is client-only ────────────────────────────────────────────────────────
const WorldMap = dynamic(
  () => import("@/components/focus/world-map").then((m) => m.WorldMap),
  { ssr: false, loading: () => <div className="w-full h-full bg-[#070918]" /> }
);

// ─────────────────────────────────────────────────────────────────────────────
// Mola kronometresi — mount anından itibaren sayar
// ─────────────────────────────────────────────────────────────────────────────

function BreakTimer() {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const fmt = (n: number) => String(n).padStart(2, "0");
  return (
    <div
      className="px-6 py-3 rounded-2xl text-center"
      style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.25)" }}
    >
      <div
        className="text-4xl font-bold tabular-nums"
        style={{ color: "#F87171", fontFamily: "Space Grotesk, sans-serif", letterSpacing: 2 }}
      >
        {h > 0 ? `${fmt(h)}:${fmt(m)}:${fmt(s)}` : `${fmt(m)}:${fmt(s)}`}
      </div>
      <div className="text-[10px] text-slate-600 mt-1 uppercase tracking-widest">mola süresi</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Focus Page
// ─────────────────────────────────────────────────────────────────────────────

export default function FocusPage() {
  const router = useRouter();
  const { session, abandonSession } = useActiveSession();
  const { currentUsername } = useAuthStore();
  const { notes, setNotes } = useFlightSetup();
  const hasCompletedRef = useRef(false);
  const [mounted, setMounted] = useState(false);
  const [otherFlights, setOtherFlights] = useState<LiveFlight[]>([]);
  const [notesOpen, setNotesOpen] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // ── Timer ─────────────────────────────────────────────────────────────────
  const onComplete = useCallback(() => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;
    router.push("/success");
  }, [router]);

  const { elapsedMs, remainingMs, progress, isPaused, pause, resume } =
    useTimer(onComplete);

  // ── Sekme başlığı: arka plandaysa "Odağını kaybetme" ────────────────────
  useEffect(() => {
    function updateTitle() {
      if (document.hidden) {
        document.title = "✈ Odağını kaybetme — AIRJEN";
        return;
      }
      if (session?.status === "completed") {
        document.title = "✅ TAMAMLANDI — AIRJEN";
        return;
      }
      if (!session || session.status === "abandoned") {
        document.title = "AIRJEN";
        return;
      }
      document.title = `⏱ ${formatDuration(remainingMs)} — AIRJEN`;
    }

    updateTitle();
    document.addEventListener("visibilitychange", updateTitle);
    return () => document.removeEventListener("visibilitychange", updateTitle);
  }, [remainingMs, session]);

  // Sayfa unmount olunca başlığı sıfırla
  useEffect(() => {
    return () => { document.title = "AIRJEN"; };
  }, []);

  // ── Firebase: kendi konumunu yayınla (her progress değişiminde + 5s interval)
  useEffect(() => {
    if (!session || !currentUsername) return;
    broadcastFlight(currentUsername, session.departure, session.destination, progress);
  }, [progress, session, currentUsername]);

  useEffect(() => {
    if (!session || !currentUsername) return;
    const id = setInterval(() => {
      const prog = session ? Math.min(1, (Date.now() - session.startTime) / session.durationMs) : 0;
      broadcastFlight(currentUsername, session.departure, session.destination, prog);
    }, 5000);
    return () => clearInterval(id);
  }, [session, currentUsername]);

  // ── Firebase: diğer kullanıcıları dinle ──────────────────────────────────
  useEffect(() => {
    if (!currentUsername) return;
    const unsub = subscribeToFlights(currentUsername, setOtherFlights);
    return () => {
      unsub();
      if (currentUsername) clearFlight(currentUsername);
    };
  }, [currentUsername]);

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
      {/* ── Outer wrapper — pointer-events-none so the friends panel above can receive clicks ── */}
      <div className="fixed inset-0 bg-[#070918] flex flex-col pointer-events-none">

        {/* ── World Map ─────────────────────────────────────────────────── */}
        <div className="absolute inset-0 pointer-events-none">
          <WorldMap
            departure={departure}
            destination={destination}
            progress={progress}
            otherFlights={otherFlights}
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
        <div className="relative z-20 p-4 pt-6 flex items-start justify-between pointer-events-auto">
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

            {/* Notes button */}
            <button
              onClick={() => setNotesOpen(true)}
              className="relative px-4 py-3.5 rounded-2xl text-sm transition-colors"
              style={{
                background: notes ? "rgba(251,191,36,0.1)" : "rgba(255,255,255,0.04)",
                border: notes ? "1px solid rgba(251,191,36,0.3)" : "1px solid rgba(255,255,255,0.07)",
                color: notes ? "#FCD34D" : "#64748B",
              }}
              title="Uçuş notları"
            >
              📝
              {notes && (
                <span
                  className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full"
                  style={{ background: "#FCD34D" }}
                />
              )}
            </button>

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

      {/* ── Mola Overlay (duraklatılınca) ────────────────────────────────────── */}
      <AnimatePresence>
        {isPaused && (
          <motion.div
            key="pause-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[55] flex items-center justify-center"
            style={{ background: "rgba(7,9,24,0.88)", backdropFilter: "blur(8px)" }}
          >
            <motion.div
              initial={{ scale: 0.88, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.88, y: 20 }}
              transition={{ type: "spring", stiffness: 340, damping: 26 }}
              className="flex flex-col items-center gap-5 px-8 py-10 rounded-3xl"
              style={{
                background: "linear-gradient(160deg, rgba(220,38,38,0.12) 0%, rgba(7,9,24,0.95) 100%)",
                border: "1px solid rgba(239,68,68,0.3)",
                boxShadow: "0 0 60px rgba(239,68,68,0.15), 0 24px 64px rgba(0,0,0,0.6)",
                minWidth: 280,
              }}
            >
              {/* Uçak ikonu (kırmızı arka plan) */}
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl"
                style={{
                  background: "linear-gradient(135deg, #DC2626, #991B1B)",
                  boxShadow: "0 8px 32px rgba(220,38,38,0.5)",
                }}
              >
                ✈
              </div>

              {/* Başlık */}
              <div className="text-center">
                <div
                  className="text-xl font-bold text-white mb-1"
                  style={{ fontFamily: "Space Grotesk, sans-serif" }}
                >
                  Mola Zamanı
                </div>
                <div className="text-sm text-slate-500">
                  Uçuşun duraklatıldı
                </div>
              </div>

              {/* Mola kronometresi */}
              <BreakTimer />

              {/* Devam Et butonu */}
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={resume}
                className="w-full py-3.5 rounded-2xl font-bold text-white text-base"
                style={{
                  background: "linear-gradient(135deg, #22C55E, #16A34A)",
                  boxShadow: "0 4px 20px rgba(34,197,94,0.4)",
                }}
              >
                ▶ Devam Et
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Notes Drawer ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {notesOpen && (
          <>
            <motion.div
              key="notes-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60]"
              style={{ background: "rgba(0,0,0,0.4)" }}
              onClick={() => setNotesOpen(false)}
            />
            <motion.div
              key="notes-drawer"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 350, damping: 32 }}
              className="fixed bottom-0 left-0 right-0 z-[61] rounded-t-3xl p-5 pb-8"
              style={{
                background: "linear-gradient(180deg, #111827 0%, #0A0F1E 100%)",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 -20px 60px rgba(0,0,0,0.5)",
                maxHeight: "70vh",
              }}
            >
              {/* Handle */}
              <div className="flex justify-center mb-4">
                <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
              </div>

              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📝</span>
                  <span className="font-bold text-white text-sm" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                    Uçuş Notları
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600">{notes.length} karakter</span>
                  <button
                    onClick={() => setNotesOpen(false)}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-slate-500 hover:text-white"
                    style={{ background: "rgba(255,255,255,0.05)" }}
                  >
                    ✕
                  </button>
                </div>
              </div>

              <textarea
                autoFocus
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Bu uçuşta neler düşündün? Görevler, fikirler, hedefler..."
                className="w-full rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none resize-none"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  minHeight: 140,
                  maxHeight: 300,
                  lineHeight: 1.6,
                }}
              />

              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setNotesOpen(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
                  style={{
                    background: "linear-gradient(135deg, #3B82F6, #1D4ED8)",
                    boxShadow: "0 4px 16px rgba(59,130,246,0.25)",
                  }}
                >
                  ✓ Kaydet
                </button>
                {notes && (
                  <button
                    onClick={() => setNotes("")}
                    className="px-4 py-2.5 rounded-xl text-xs text-slate-600 hover:text-red-400 transition-colors"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    Temizle
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
