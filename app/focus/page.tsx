"use client";

import dynamic from "next/dynamic";
import { useEffect, useCallback, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useActiveSession } from "@/store/flight-store";
import { useAuthStore } from "@/store/auth-store";
import { useTimer } from "@/hooks/use-timer";
import { formatDuration, formatMinutes } from "@/lib/utils";
import { flagEmoji, CITIES } from "@/data/cities";
import { broadcastFlight, clearFlight, subscribeToFlights, type LiveFlight } from "@/lib/flight-sync";
import { useWeatherPair } from "@/hooks/use-weather";
import { findNearestCityAhead, type NearestCityResult } from "@/lib/geo";

// ── Map is client-only ────────────────────────────────────────────────────────
const WorldMap = dynamic(
  () => import("@/components/focus/world-map").then((m) => m.WorldMap),
  { ssr: false, loading: () => <div className="w-full h-full bg-[#070918]" /> }
);

// ── Kronometre (sıfırdan sayar) ───────────────────────────────────────────────
function Stopwatch({ label, color = "#F87171", bg = "rgba(220,38,38,0.1)", border = "rgba(220,38,38,0.25)" }: {
  label: string;
  color?: string;
  bg?: string;
  border?: string;
}) {
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
      style={{ background: bg, border: `1px solid ${border}` }}
    >
      <div
        className="text-4xl font-bold tabular-nums"
        style={{ color, fontFamily: "Space Grotesk, sans-serif", letterSpacing: 2 }}
      >
        {h > 0 ? `${fmt(h)}:${fmt(m)}:${fmt(s)}` : `${fmt(m)}:${fmt(s)}`}
      </div>
      <div className="text-[10px] text-slate-600 mt-1 uppercase tracking-widest">{label}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Focus Page
// ─────────────────────────────────────────────────────────────────────────────

export default function FocusPage() {
  const router                              = useRouter();
  const { session, abandonSession, emergencyLand } = useActiveSession();
  const { currentUsername }                 = useAuthStore();
  const hasCompletedRef                     = useRef(false);
  const [mounted, setMounted]               = useState(false);
  const [otherFlights, setOtherFlights]     = useState<LiveFlight[]>([]);

  // ── Abandon modal ────────────────────────────────────────────────────────
  const [abandonModalOpen, setAbandonModalOpen] = useState(false);
  const [nearestCity, setNearestCity]           = useState<NearestCityResult | null>(null);

  // ── Break state ───────────────────────────────────────────────────────────
  const [nextBreakMs, setNextBreakMs]       = useState<number | null>(null);
  const [breakWarning, setBreakWarning]     = useState(false); // 4dk önce uyarı
  const [breakModalOpen, setBreakModalOpen] = useState(false); // "Mola vermek ister misin?"
  const [isOnBreak, setIsOnBreak]           = useState(false); // planlı mola
  const breakInitRef                        = useRef(false);
  // Atla sonrası uyarıyı bastır — break zamanına kadar tekrar gösterme
  const suppressWarnUntilRef               = useRef<number>(0);

  useEffect(() => { setMounted(true); }, []);

  // ── Weather (session null olsa da hook her zaman çalışmalı) ──────────────
  const { departure: depWeather, destination: dstWeather } = useWeatherPair(
    session?.departure,
    session?.destination
  );

  // ── Timer ─────────────────────────────────────────────────────────────────
  const onComplete = useCallback(() => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;
    router.push("/success");
  }, [router]);

  const { elapsedMs, remainingMs, progress, isPaused, pause, resume } =
    useTimer(onComplete);

  // ── nextBreakMs ilk değeri ────────────────────────────────────────────────
  useEffect(() => {
    if (!session || breakInitRef.current) return;
    breakInitRef.current = true;
    if ((session.breakIntervalMinutes ?? 0) > 0) {
      setNextBreakMs((session.breakIntervalMinutes ?? 0) * 60 * 1000);
    }
  }, [session]);

  // ── Mola kontrol ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session || !nextBreakMs || (session.breakIntervalMinutes ?? 0) === 0) return;
    if (isPaused) return; // durakken kontrol etme
    if (breakModalOpen || isOnBreak) return;

    const warnAt = nextBreakMs - 4 * 60 * 1000; // 4dk önce

    // Atla sonrası: suppressWarnUntilRef doluysa uyarıyı bastır
    if (elapsedMs >= warnAt && !breakWarning && elapsedMs >= suppressWarnUntilRef.current) {
      setBreakWarning(true);
    }
    if (elapsedMs >= nextBreakMs) {
      setBreakModalOpen(true);
      setBreakWarning(false);
    }
  }, [elapsedMs, nextBreakMs, isPaused, breakWarning, breakModalOpen, isOnBreak, session]);

  // Mola ver
  function handleTakeBreak() {
    setBreakModalOpen(false);
    setBreakWarning(false);
    setIsOnBreak(true);
    pause();
  }

  // Mola atla — bir sonraki mola zamanına kadar (tam interval) bir daha sorma
  function handleSkipBreak() {
    const interval = (session?.breakIntervalMinutes ?? 0) * 60 * 1000;
    const newBreak = elapsedMs + (interval > 0 ? interval : 30 * 60 * 1000);
    setBreakModalOpen(false);
    setBreakWarning(false);
    setNextBreakMs(newBreak);
    suppressWarnUntilRef.current = newBreak;
  }

  // Mola bitti — devam et
  function handleResumeFromBreak() {
    setIsOnBreak(false);
    resume();
    if (session && (session.breakIntervalMinutes ?? 0) > 0) {
      setNextBreakMs(elapsedMs + (session.breakIntervalMinutes ?? 0) * 60 * 1000);
    }
  }

  // Acil mola
  function handleEmergencyBreak() {
    setIsOnBreak(true);
    pause();
    if (session && (session.breakIntervalMinutes ?? 0) > 0) {
      setNextBreakMs(elapsedMs + (session.breakIntervalMinutes ?? 0) * 60 * 1000);
    }
  }

  // Manuel duraklat
  function handleManualPause() {
    setIsOnBreak(false);
    pause();
  }

  // Manuel devam
  function handleManualResume() {
    resume();
  }

  // ── Sekme başlığı ─────────────────────────────────────────────────────────
  useEffect(() => {
    function updateTitle() {
      if (document.hidden) { document.title = "✈ Odağını kaybetme — AIRJEN"; return; }
      if (session?.status === "completed") { document.title = "✅ TAMAMLANDI — AIRJEN"; return; }
      if (!session || session.status === "abandoned") { document.title = "AIRJEN"; return; }
      document.title = `⏱ ${formatDuration(remainingMs)} — AIRJEN`;
    }
    updateTitle();
    document.addEventListener("visibilitychange", updateTitle);
    return () => document.removeEventListener("visibilitychange", updateTitle);
  }, [remainingMs, session]);

  useEffect(() => { return () => { document.title = "AIRJEN"; }; }, []);

  // ── Firebase broadcast ────────────────────────────────────────────────────
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

  useEffect(() => {
    if (!currentUsername) return;
    const unsub = subscribeToFlights(currentUsername, setOtherFlights);
    return () => { unsub(); if (currentUsername) clearFlight(currentUsername); };
  }, [currentUsername]);

  // ── Guards ────────────────────────────────────────────────────────────────
  useEffect(() => { if (mounted && !session) router.push("/"); }, [session, router, mounted]);
  useEffect(() => {
    if (mounted && session?.status === "completed" && !hasCompletedRef.current) {
      hasCompletedRef.current = true;
      router.push("/success");
    }
  }, [session, router, mounted]);

  // En yakın havalimanı — hooks erken return'den ÖNCE olmalı
  const nearestAirportInfo = useMemo(() => {
    if (!session) return null;
    const { departure, destination } = session;
    const found = findNearestCityAhead(departure, destination, progress, remainingMs, CITIES);
    if (found) return found;
    const minsToDestination = Math.round(remainingMs / 60000);
    return {
      city: destination,
      distanceKm: 0,
      minutesAway: minsToDestination,
      isNearby: minsToDestination <= 5,
      routeT: 1 as const,
    };
  }, [session, progress, remainingMs]);

  if (!mounted || !session) return null;

  const { departure, destination, durationMs, seat } = session;
  const breakIntervalMinutes = session.breakIntervalMinutes ?? 0;
  const breakDurationMinutes = session.breakDurationMinutes ?? 0;

  // Aynı rotada uçanlar → tek uçakta göster; farklı rotadakiler → ayrı uçak
  const crewFlights      = otherFlights.filter(
    (f) => f.departure.id === departure.id && f.destination.id === destination.id
  );
  const crewmates        = crewFlights.map((f) => f.username);
  const differentRoutes  = otherFlights.filter(
    (f) => !(f.departure.id === departure.id && f.destination.id === destination.id)
  );

  const percent = Math.round(progress * 100);

  // Kalan mola süresini göstermek için (bilgi amaçlı)
  const minsUntilBreak = nextBreakMs !== null
    ? Math.max(0, Math.ceil((nextBreakMs - elapsedMs) / 60000))
    : null;

  function handleAbandon() {
    setNearestCity(nearestAirportInfo);
    setAbandonModalOpen(true);
  }

  function handleEmergencyLand() {
    if (!nearestCity) return;
    setAbandonModalOpen(false);
    hasCompletedRef.current = true;
    emergencyLand(nearestCity.city, elapsedMs);
    router.push("/success");
  }

  function handleForceAbandon() {
    setAbandonModalOpen(false);
    abandonSession();
    router.push("/");
  }

  // Overlay kinds
  const showBreakOverlay    = isPaused && isOnBreak;
  const showPausedOverlay   = isPaused && !isOnBreak;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="fixed inset-0 bg-[#070918] flex flex-col pointer-events-none">

        {/* World Map */}
        <div className="absolute inset-0 pointer-events-none">
          <WorldMap departure={departure} destination={destination} progress={progress} otherFlights={differentRoutes} crewmates={crewmates} />
        </div>

        {/* Vignette */}
        <div className="absolute top-0 left-0 right-0 h-32 pointer-events-none z-10"
          style={{ background: "linear-gradient(to bottom, rgba(7,9,24,0.92) 0%, transparent 100%)" }} />
        <div className="absolute bottom-0 left-0 right-0 h-64 pointer-events-none z-[15]"
          style={{ background: "linear-gradient(to top, rgba(7,9,24,0.97) 0%, transparent 100%)" }} />
        <div className="absolute inset-0 pointer-events-none z-[5]"
          style={{ background: "rgba(7,9,24,0.35)" }} />

        {/* Top HUD */}
        <div className="relative z-20 p-3 pt-safe sm:p-4 sm:pt-6 flex items-start justify-between pointer-events-auto gap-2">
          {/* Route chip */}
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-xs sm:text-sm font-medium min-w-0 max-w-[55vw] sm:max-w-none"
            style={{ background: "rgba(22,26,53,0.85)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(12px)" }}
          >
            <span className="shrink-0">{flagEmoji(departure.countryCode)}</span>
            <span className="text-white truncate">{departure.name}</span>
            <span className="text-slate-500 text-xs shrink-0">→</span>
            <span className="shrink-0">{flagEmoji(destination.countryCode)}</span>
            <span className="text-white truncate">{destination.name}</span>
          </motion.div>

          {/* Weather + Abandon */}
          <div className="flex items-center gap-2">
            {/* Weather chips */}
            {(depWeather.weather || dstWeather.weather) && (
              <motion.div
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs"
                style={{ background: "rgba(22,26,53,0.85)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(12px)" }}
              >
                {depWeather.weather && (
                  <span className="flex items-center gap-1">
                    <span>{depWeather.weather.icon}</span>
                    <span className="text-slate-300 font-semibold">{depWeather.weather.temp}°</span>
                  </span>
                )}
                {depWeather.weather && dstWeather.weather && (
                  <span className="text-slate-700">·</span>
                )}
                {dstWeather.weather && (
                  <span className="flex items-center gap-1">
                    <span>{dstWeather.weather.icon}</span>
                    <span className="text-slate-300 font-semibold">{dstWeather.weather.temp}°</span>
                  </span>
                )}
              </motion.div>
            )}

            {/* Abandon */}
            <motion.button
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={handleAbandon}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-colors"
              style={{ background: "rgba(22,26,53,0.85)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(12px)" }}
              title="Uçuşu terk et"
            >
              ✕
            </motion.button>
          </div>
        </div>

        {/* Status pill */}
        <div className="relative z-20 flex justify-center mt-2 flex-col items-center gap-2 pointer-events-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium"
            style={{
              background: "rgba(22,26,53,0.85)",
              border: showBreakOverlay
                ? "1px solid rgba(245,158,11,0.4)"
                : showPausedOverlay
                  ? "1px solid rgba(239,68,68,0.4)"
                  : "1px solid rgba(34,197,94,0.4)",
              backdropFilter: "blur(8px)",
            }}
          >
            <span className="relative flex h-2 w-2">
              {!isPaused && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                showBreakOverlay ? "bg-yellow-500"
                : showPausedOverlay ? "bg-red-500"
                : "bg-green-500"
              }`} />
            </span>
            <span style={{
              color: showBreakOverlay ? "#F59E0B"
                : showPausedOverlay ? "#EF4444"
                : "#22C55E",
            }}>
              {showBreakOverlay ? "MOLADA"
                : showPausedOverlay ? "DURDURULDU"
                : "ODAK MODU AKTİF"}
            </span>
            <span className="text-slate-500">· Koltuk {seat}</span>
          </motion.div>

          {/* Mola yaklaşıyor uyarısı */}
          <AnimatePresence>
            {breakWarning && !isPaused && !breakModalOpen && (
              <motion.div
                key="break-warning"
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{
                  background: "rgba(245,158,11,0.15)",
                  border: "1px solid rgba(245,158,11,0.35)",
                  color: "#FCD34D",
                }}
              >
                ⏰ Mola zamanı yaklaşıyor
                {minsUntilBreak !== null && minsUntilBreak > 0 && (
                  <span className="text-yellow-500/70">· {minsUntilBreak} dk</span>
                )}
              </motion.div>
            )}
          </AnimatePresence>

        </div>

      </div>

      {/* ── Mola zamanı pill — fixed, pointer-events-auto, root dışında ─────── */}
      <AnimatePresence>
        {breakModalOpen && (
          <div className="fixed left-1/2 -translate-x-1/2 z-[60] w-[92vw] sm:w-auto flex justify-center" style={{ top: "118px", pointerEvents: "auto" }}>
          <motion.div
            key="break-pill"
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            className="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl text-xs sm:text-sm font-semibold w-full sm:w-auto justify-center"
            style={{
              background: "linear-gradient(135deg, rgba(217,119,6,0.75), rgba(180,83,9,0.65))",
              border: "1px solid rgba(251,191,36,0.7)",
              color: "#FEF3C7",
              backdropFilter: "blur(14px)",
              boxShadow: "0 4px 24px rgba(245,158,11,0.4)",
              whiteSpace: "nowrap",
            }}
          >
            <span className="text-base">☕</span>
            <span>Ufak bir mola vermek ister misin?{breakDurationMinutes > 0 ? ` · ${breakDurationMinutes} dk` : ""}</span>
            <button
              onClick={handleTakeBreak}
              className="px-3 py-1 rounded-xl text-xs font-bold transition-all hover:opacity-90 active:scale-95"
              style={{ background: "rgba(255,255,255,0.28)", color: "#FEF3C7" }}
            >
              Ver
            </button>
            <button
              onClick={handleSkipBreak}
              className="px-3 py-1 rounded-xl text-xs font-medium transition-all hover:opacity-80 active:scale-95"
              style={{ background: "rgba(255,255,255,0.12)", color: "#FDE68A" }}
            >
              Atla
            </button>
          </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Bottom Timer Panel ─────────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-safe-focus pointer-events-none">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(to top, rgba(7,9,24,1) 0%, rgba(7,9,24,0.85) 60%, transparent 100%)" }} />

        <div className="relative max-w-lg mx-auto pointer-events-auto">
          {/* Progress bar */}
          <div className="mb-4">
            <div className="progress-track h-1.5">
              <div className="progress-fill" style={{ width: `${percent}%`, transition: "width 1s linear" }} />
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

            {/* En yakın havalimanı */}
            {!isPaused && nearestAirportInfo && (
              <div className="text-[11px] text-slate-600 mt-1">
                {nearestAirportInfo.isNearby
                  ? <span>🛬 <span className="text-slate-500">{flagEmoji(nearestAirportInfo.city.countryCode)} {nearestAirportInfo.city.name}</span> semalarındasınız</span>
                  : <span>🛬 <span className="text-slate-500">{flagEmoji(nearestAirportInfo.city.countryCode)} {nearestAirportInfo.city.name}</span> · <span className="text-slate-500">{Math.round(nearestAirportInfo.minutesAway)} dk</span></span>
                }
              </div>
            )}

            {/* Sonraki mola bilgisi */}
            {breakIntervalMinutes > 0 && !isPaused && minsUntilBreak !== null && minsUntilBreak > 0 && (
              <div className="text-[11px] text-slate-600 mt-1">
                Sonraki mola: <span className="text-slate-500">{minsUntilBreak} dk sonra</span>
              </div>
            )}
          </div>

          {/* Crewmate ilerleme şeridi */}
          <AnimatePresence>
            {crewFlights.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="flex items-center gap-2 mb-3 px-3 py-2 sm:py-2.5 rounded-2xl flex-wrap"
                style={{
                  background: "rgba(124,58,237,0.07)",
                  border: "1px solid rgba(124,58,237,0.2)",
                  backdropFilter: "blur(12px)",
                }}
              >
                <span className="text-[10px] text-violet-400 font-semibold uppercase tracking-wider shrink-0">
                  ✈ Mürettebat
                </span>
                {crewFlights.map((f) => {
                  const pct = Math.round(f.progress * 100);
                  return (
                    <div key={f.username} className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-300 font-medium">{f.username}</span>
                      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                        <div
                          className="h-full rounded-full transition-all duration-1000"
                          style={{
                            width: `${pct}%`,
                            background: "linear-gradient(90deg, #7C3AED, #3B82F6)",
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500">{pct}%</span>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stats row */}
          <div
            className="flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3 rounded-2xl mb-3 sm:mb-4"
            style={{ background: "rgba(14,18,42,0.95)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
          >
            <div className="text-center">
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-0.5">Geçen Süre</div>
              <div className="text-sm font-semibold text-white">{formatDuration(elapsedMs)}</div>
            </div>
            <div className="w-px h-8 bg-white/[0.07]" />
            <div className="text-center">
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-0.5">İlerleme</div>
              <div className="text-sm font-semibold text-white">{percent}%</div>
            </div>
            <div className="w-px h-8 bg-white/[0.07]" />
            <div className="text-center">
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-0.5">Süre</div>
              <div className="text-sm font-semibold text-white">{formatMinutes(durationMs / 60000)}</div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 justify-center">
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={isPaused ? (isOnBreak ? handleResumeFromBreak : handleManualResume) : handleManualPause}
              className="flex-1 max-w-[200px] py-3 sm:py-3.5 rounded-2xl font-semibold text-white transition-all"
              style={{
                background: isPaused
                  ? "linear-gradient(135deg, #22C55E, #16A34A)"
                  : "linear-gradient(135deg, #EF4444, #DC2626)",
                boxShadow: isPaused
                  ? "0 4px 20px rgba(34,197,94,0.3)"
                  : "0 4px 20px rgba(239,68,68,0.3)",
              }}
            >
              {isPaused ? "▶ Devam Et" : "⏹ Durdur"}
            </motion.button>

            {/* Acil Mola butonu */}
            {!isPaused && (
              <button
                onClick={handleEmergencyBreak}
                className="flex flex-col items-center gap-1 px-4 py-2.5 rounded-2xl transition-all"
                style={{
                  background: "rgba(245,158,11,0.1)",
                  border: "1px solid rgba(245,158,11,0.25)",
                  color: "#FCD34D",
                }}
                title="Acil mola"
              >
                <span className="text-lg leading-none">☕</span>
                <span className="text-[10px] font-semibold leading-none">Acil Mola</span>
              </button>
            )}

            <button
              onClick={handleAbandon}
              className="px-5 py-3.5 rounded-2xl text-sm text-slate-500 hover:text-slate-300 transition-colors"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              Terk Et
            </button>
          </div>
        </div>
      </div>


      {/* ── Mola (planlı) Overlay ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {showBreakOverlay && (
          <motion.div
            key="break-overlay"
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
                background: "linear-gradient(160deg, rgba(217,119,6,0.12) 0%, rgba(7,9,24,0.95) 100%)",
                border: "1px solid rgba(245,158,11,0.3)",
                boxShadow: "0 0 60px rgba(245,158,11,0.12), 0 24px 64px rgba(0,0,0,0.6)",
                minWidth: 280,
              }}
            >
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl"
                style={{ background: "linear-gradient(135deg, #D97706, #92400E)", boxShadow: "0 8px 32px rgba(217,119,6,0.45)" }}
              >
                ☕
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-white mb-1" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                  Mola Zamanı
                </div>
                <div className="text-sm text-slate-500">
                  Uçuşun duraklatıldı · dinlen biraz
                </div>
              </div>

              <Stopwatch
                label="mola süresi"
                color="#FCD34D"
                bg="rgba(217,119,6,0.1)"
                border="rgba(217,119,6,0.3)"
              />

              {breakDurationMinutes > 0 && (
                <div className="text-xs text-slate-600 text-center">
                  Önerilen mola: <span className="text-slate-400">{breakDurationMinutes} dakika</span>
                </div>
              )}

              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={handleResumeFromBreak}
                className="w-full py-3.5 rounded-2xl font-bold text-white text-base"
                style={{ background: "linear-gradient(135deg, #22C55E, #16A34A)", boxShadow: "0 4px 20px rgba(34,197,94,0.4)" }}
              >
                ▶ Devam Et
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Durduruldu Overlay (manuel duraklat) ─────────────────────────────── */}
      <AnimatePresence>
        {showPausedOverlay && (
          <motion.div
            key="paused-overlay"
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
                background: "linear-gradient(160deg, rgba(239,68,68,0.1) 0%, rgba(7,9,24,0.95) 100%)",
                border: "1px solid rgba(239,68,68,0.25)",
                boxShadow: "0 0 60px rgba(239,68,68,0.1), 0 24px 64px rgba(0,0,0,0.6)",
                minWidth: 280,
              }}
            >
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl"
                style={{ background: "linear-gradient(135deg, #DC2626, #991B1B)", boxShadow: "0 8px 32px rgba(220,38,38,0.45)" }}
              >
                ⏹
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-white mb-1" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                  Durduruldu
                </div>
                <div className="text-sm text-slate-500">Uçuşun durduruldu</div>
              </div>

              <Stopwatch
                label="durduruldu süresi"
                color="#F87171"
                bg="rgba(220,38,38,0.1)"
                border="rgba(220,38,38,0.25)"
              />

              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={handleManualResume}
                className="w-full py-3.5 rounded-2xl font-bold text-white text-base"
                style={{ background: "linear-gradient(135deg, #22C55E, #16A34A)", boxShadow: "0 4px 20px rgba(34,197,94,0.4)" }}
              >
                ▶ Devam Et
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Acil İniş / Terk Et Modal ──────────────────────────────────────── */}
      <AnimatePresence>
        {abandonModalOpen && (
          <motion.div
            key="abandon-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex items-center justify-center px-4"
            style={{ background: "rgba(7,9,24,0.92)", backdropFilter: "blur(10px)" }}
          >
            <motion.div
              initial={{ scale: 0.88, y: 24 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.88, y: 24 }}
              transition={{ type: "spring", stiffness: 340, damping: 28 }}
              className="w-full max-w-sm rounded-3xl p-6 flex flex-col gap-5"
              style={{
                background: "linear-gradient(160deg, rgba(30,40,80,0.98) 0%, rgba(10,14,40,0.99) 100%)",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
              }}
            >
              {/* İkon + başlık */}
              <div className="flex flex-col items-center gap-3 text-center">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                  style={{ background: nearestCity ? "rgba(245,158,11,0.15)" : "rgba(239,68,68,0.12)", border: nearestCity ? "1px solid rgba(245,158,11,0.3)" : "1px solid rgba(239,68,68,0.25)" }}
                >
                  {nearestCity ? "🛬" : "⚠️"}
                </div>
                <div>
                  {nearestCity ? (
                    <>
                      <h2 className="text-lg font-bold text-white mb-1" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                        {nearestCity.isNearby
                          ? `${flagEmoji(nearestCity.city.countryCode)} ${nearestCity.city.name} semalarındasınız`
                          : `${flagEmoji(nearestCity.city.countryCode)} ${nearestCity.city.name} havalimanına iniş`}
                      </h2>
                      <p className="text-sm text-slate-400">
                        {nearestCity.isNearby
                          ? `Acil iniş ile ${nearestCity.city.name}'ye inmek ister misiniz?`
                          : `${Math.round(nearestCity.minutesAway)} dk sonra ${nearestCity.city.name} havalimanına iniş yapabilirsiniz. ${nearestCity.city.name}'ye iniş yapalım mı?`}
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-lg font-bold text-white mb-1" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                        Uçuşu terk et
                      </h2>
                      <p className="text-sm text-slate-400">
                        Yakında uygun bir havalimanı bulunamadı.
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Butonlar */}
              <div className="flex flex-col gap-2.5">
                {nearestCity && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleEmergencyLand}
                    className="w-full py-3.5 rounded-2xl font-bold text-white text-sm"
                    style={{
                      background: "linear-gradient(135deg, #D97706, #B45309)",
                      boxShadow: "0 4px 20px rgba(217,119,6,0.4)",
                    }}
                  >
                    ✈ Evet, {nearestCity.isNearby ? "acil iniş yap" : "devam edelim"}
                  </motion.button>
                )}

                <div className="flex flex-col gap-1">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleForceAbandon}
                    className="w-full py-3 rounded-2xl font-semibold text-sm"
                    style={{
                      background: "rgba(239,68,68,0.1)",
                      border: "1px solid rgba(239,68,68,0.25)",
                      color: "#F87171",
                    }}
                  >
                    Hayır, hemen çıkış yap
                  </motion.button>
                  <p className="text-center text-[11px] text-slate-600">İlerlemeniz kaybolur</p>
                </div>

                <button
                  onClick={() => setAbandonModalOpen(false)}
                  className="w-full py-2.5 rounded-2xl text-sm text-slate-500 hover:text-slate-300 transition-colors"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  Geri dön
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </>
  );
}
