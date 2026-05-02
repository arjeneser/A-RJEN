"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/auth/auth-guard";
import { motion } from "framer-motion";
import { useActiveSession, useFlightSetup } from "@/store/flight-store";
import { useUserStore } from "@/store/user-store";
import { checkNewAchievements } from "@/data/achievements";
import type { Achievement } from "@/types";
import { flagEmoji } from "@/data/cities";
import { formatMinutes } from "@/lib/utils";
import {
  getLevel,
  getLevelProgress,
  flightsToNextLevel,
} from "@/store/user-store";
import { useAuthStore } from "@/store/auth-store";
import { syncStats, syncFlightDetail } from "@/lib/friends";
import { saveUserSnapshot } from "@/lib/user-sync";

export default function SuccessPage() {
  const router = useRouter();
  const { session, clearSession } = useActiveSession();
  const { profile, history, stamps, achievements, recordFlight, addStamp, addAchievements } = useUserStore();
  const { continueJourney, passengerName, notes } = useFlightSetup();
  const { currentUsername } = useAuthStore();
  const recordedRef = useRef(false);
  const confettiRef = useRef(false);
  const [mounted, setMounted] = useState(false);
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([]);

  useEffect(() => { setMounted(true); }, []);

  // Guard: no session → home (only after hydration)
  useEffect(() => {
    if (mounted && !session) {
      router.replace("/");
    }
  }, [session, router, mounted]);

  // Record flight once — sessionStorage ile aynı oturumda tekrar kayıt engellenir
  useEffect(() => {
    if (!session || recordedRef.current) return;
    if (
      session.status === "completed" ||
      session.status === "running" // completed in bg, still "running" in store edge case
    ) {
      // Aynı uçuş daha önce kaydedilmişse atla (sayfa tekrar mount edilse bile)
      const storageKey = `airjen_recorded_${session.startTime}`;
      if (typeof window !== "undefined" && sessionStorage.getItem(storageKey)) {
        recordedRef.current = true;
        return;
      }
      recordedRef.current = true;
      if (typeof window !== "undefined") sessionStorage.setItem(storageKey, "1");
      const durationMinutes = Math.round(session.durationMs / 60000);
      const xpEarned = Math.round(durationMinutes / 5);
      recordFlight({
        departureId: session.departure.id,
        destinationId: session.destination.id,
        durationMinutes,
        xpEarned,
        notes: notes || undefined,
      });
      // Passport stamp — only for international flights
      if (session.destination.countryCode !== "TR") {
        addStamp({
          countryCode: session.destination.countryCode,
          city: session.destination.name,
          timestamp: Date.now(),
        });
      }
      // Check new achievements + sync stats (after profile update settled on next tick)
      setTimeout(() => {
        const updatedProfile     = useUserStore.getState().profile;
        const updatedHistory     = useUserStore.getState().history;
        const updatedStamps      = useUserStore.getState().stamps;
        const updatedAchievements = useUserStore.getState().achievements;
        const earnedIds          = updatedAchievements.map((a) => a.id);
        const newOnes = checkNewAchievements(updatedProfile, updatedHistory, updatedStamps, earnedIds);
        if (newOnes.length > 0) {
          addAchievements(newOnes);
          setNewAchievements(newOnes);
        }

        if (currentUsername) {
          // ── Firebase leaderboard stats ─────────────────────────────────────
          syncStats(currentUsername, {
            totalXP:       updatedProfile.totalXP,
            totalFlights:  updatedProfile.totalFlights,
            currentStreak: updatedProfile.currentStreak,
          });

          // ── Detaylı uçuş istatistiği ───────────────────────────────────────
          const durationKey   = `${Math.round(session!.durationMs / 3600000)}h`;
          const durationLabel = `${Math.round(session!.durationMs / 3600000)} Saat`;
          const actualMs      = Date.now() - session!.startTime;
          syncFlightDetail(
            currentUsername,
            durationKey,
            durationLabel,
            session!.pauseCount ?? 0,
            actualMs
          );

          // ── TAM SNAPSHOT Firebase'e kaydet (kritik — hemen senkronize) ─────
          // Başarımlar newOnes eklendikten SONRA kaydedebilmek için kısa bekleme
          const finalAchievements = newOnes.length > 0
            ? [...updatedAchievements, ...newOnes.map((a) => ({ ...a, unlockedAt: Date.now() }))]
            : updatedAchievements;

          saveUserSnapshot(currentUsername, {
            profile:      updatedProfile,
            history:      updatedHistory,
            stamps:       updatedStamps,
            achievements: finalAchievements,
          });
        }
      }, 200);
    }
  }, [session, recordFlight]);

  // ── Landing sound ────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const ctx = new AudioContext();
      const notes = [523, 659, 784, 1047]; // C E G C (iniş akoru)
      notes.forEach((freq, i) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = "sine";
        const t = ctx.currentTime + i * 0.18;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.22, t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
        osc.start(t);
        osc.stop(t + 0.7);
      });
    } catch { /* ses desteklenmiyorsa sessizce geç */ }
  }, []);

  // Confetti
  useEffect(() => {
    if (confettiRef.current) return;
    confettiRef.current = true;

    import("canvas-confetti").then((mod) => {
      const confetti = mod.default;
      const duration = 3500;
      const end = Date.now() + duration;

      const colors = ["#0EA5E9", "#818CF8", "#F59E0B", "#22C55E", "#ffffff"];

      const frame = () => {
        confetti({
          particleCount: 4,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors,
          gravity: 0.8,
          scalar: 0.9,
        });
        confetti({
          particleCount: 4,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors,
          gravity: 0.8,
          scalar: 0.9,
        });

        if (Date.now() < end) requestAnimationFrame(frame);
      };

      requestAnimationFrame(frame);
    });
  }, []);

  if (!mounted || !session) return null;

  const { departure, destination, durationMs } = session;
  const xpEarned = Math.round(durationMs / 60000 / 5); // display purposes
  const level = getLevel(profile.totalFlights);
  const levelProg = getLevelProgress(profile.totalFlights);
  const toNext = flightsToNextLevel(profile.totalFlights);

  function handleNewFlight() {
    clearSession();
    router.push("/new-flight");
  }

  function handleContinueJourney() {
    if (!session?.destination) return;
    clearSession();
    continueJourney(session.destination, passengerName);
    router.push("/new-flight");
  }

  return (
    <AuthGuard>
    <div className="min-h-screen bg-[#070918] pt-16 flex items-center justify-center">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-green-900/15 rounded-full blur-[120px]" />
        <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] bg-blue-900/15 rounded-full blur-[80px]" />
      </div>

      <div className="relative max-w-lg mx-auto px-4 py-12 text-center">
        {/* Landing plane animation */}
        <motion.div
          initial={{ y: -80, opacity: 0, scale: 0.5 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.1 }}
          className="mb-8 flex justify-center"
        >
          <div
            className="w-28 h-28 rounded-full flex items-center justify-center text-6xl"
            style={{
              background: "linear-gradient(135deg, #065F46, #047857)",
              boxShadow:
                "0 0 60px rgba(34,197,94,0.4), 0 0 120px rgba(34,197,94,0.15)",
            }}
          >
            🛬
          </div>
        </motion.div>

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-2"
        >
          <p className="text-slate-400 text-base mb-1">Hoş Geldiniz:</p>
          <h1
            className="text-4xl sm:text-5xl font-bold text-white"
            style={{ fontFamily: "Space Grotesk, sans-serif" }}
          >
            {flagEmoji(destination.countryCode)} {destination.name}
          </h1>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
          className="text-slate-400 mb-8"
        >
          {formatMinutes(durationMs / 60000)} dakikalık odak uçuşu başarıyla tamamlandı
        </motion.p>

        {/* XP Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.55, type: "spring", stiffness: 200 }}
          className="rounded-3xl p-6 mb-4"
          style={{
            background: "linear-gradient(135deg, #1E2348, #161A35)",
            border: "1px solid rgba(245,158,11,0.25)",
            boxShadow: "0 0 40px rgba(245,158,11,0.08)",
          }}
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <span
              className="text-6xl font-bold"
              style={{
                fontFamily: "Space Grotesk, sans-serif",
                color: "#F59E0B",
              }}
            >
              +{xpEarned}
            </span>
            <span
              className="text-2xl font-bold text-yellow-500/60"
              style={{ fontFamily: "Space Grotesk, sans-serif" }}
            >
              XP
            </span>
          </div>
          <p className="text-slate-500 text-sm">bu uçuşta kazanıldı</p>

          <div
            className="my-4 border-t"
            style={{ borderColor: "rgba(255,255,255,0.06)" }}
          />

          <div className="flex items-center justify-center gap-2 text-sm">
            <span className="text-slate-400">Toplam XP:</span>
            <span
              className="font-bold text-white"
              style={{ fontFamily: "Space Grotesk, sans-serif" }}
            >
              {profile.totalXP}
            </span>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="grid grid-cols-2 gap-3 mb-4"
        >
          <div
            className="rounded-2xl p-4"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div className="text-2xl mb-1">✈️</div>
            <div
              className="text-xl font-bold text-white"
              style={{ fontFamily: "Space Grotesk, sans-serif" }}
            >
              {profile.totalFlights}
            </div>
            <div className="text-xs text-slate-500">Toplam Uçuş</div>
          </div>
          <div
            className="rounded-2xl p-4"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div className="text-2xl mb-1">🔥</div>
            <div
              className="text-xl font-bold text-white"
              style={{ fontFamily: "Space Grotesk, sans-serif" }}
            >
              {profile.currentStreak}
            </div>
            <div className="text-xs text-slate-500">Gün Serisi</div>
          </div>
        </motion.div>

        {/* Level progress */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75 }}
          className="rounded-2xl p-4 mb-8"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">{level.emoji}</span>
              <span
                className="font-semibold"
                style={{ color: level.color, fontFamily: "Space Grotesk, sans-serif" }}
              >
                {level.name}
              </span>
            </div>
            <span className="text-xs text-slate-500">
              {toNext > 0 ? `Sonraki seviyeye ${toNext} uçuş` : "MAKS SEVİYE"}
            </span>
          </div>
          <div className="progress-track h-2">
            <motion.div
              className="progress-fill"
              initial={{ width: 0 }}
              animate={{ width: `${levelProg * 100}%` }}
              transition={{ duration: 1, delay: 0.9 }}
            />
          </div>
        </motion.div>

        {/* ── Yeni başarımlar ────────────────────────────────────────── */}
        {newAchievements.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.95, type: "spring", stiffness: 200 }}
            className="rounded-2xl p-4 mb-4"
            style={{
              background: "linear-gradient(135deg, rgba(245,158,11,0.1), rgba(234,179,8,0.06))",
              border: "1px solid rgba(245,158,11,0.3)",
            }}
          >
            <div className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-3">
              🏅 Yeni Başarım{newAchievements.length > 1 ? "lar" : ""} Kazanıldı!
            </div>
            <div className="flex flex-wrap gap-2">
              {newAchievements.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                  style={{
                    background: "rgba(245,158,11,0.12)",
                    border: "1px solid rgba(245,158,11,0.25)",
                  }}
                >
                  <span className="text-lg">{a.emoji}</span>
                  <div>
                    <div className="text-xs font-bold text-white">{a.name}</div>
                    <div className="text-[10px] text-slate-500">{a.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85 }}
          className="flex flex-col gap-3"
        >
          {/* ── CONTINUE JOURNEY (primary) ── */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleContinueJourney}
            className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2"
            style={{
              background: "linear-gradient(135deg, #059669, #047857)",
              boxShadow: "0 8px 32px rgba(5,150,105,0.4)",
            }}
          >
            <span>🌍</span>
            {flagEmoji(destination.countryCode)} {destination.name}&apos;dan Devam Et
          </motion.button>

          {/* ── NEW FLIGHT from Turkey ── */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleNewFlight}
            className="w-full py-3.5 rounded-2xl font-semibold text-white flex items-center justify-center gap-2"
            style={{
              background: "linear-gradient(135deg, #3B82F6, #1D4ED8)",
              boxShadow: "0 4px 20px rgba(59,130,246,0.25)",
            }}
          >
            <span>✈</span> Türkiye&apos;den Yeni Uçuş
          </motion.button>

          <Link href="/" onClick={() => clearSession()}>
            <button className="w-full py-3.5 rounded-2xl text-sm text-slate-400 hover:text-white transition-colors"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              Ana Sayfaya Dön
            </button>
          </Link>
        </motion.div>
      </div>
    </div>
    </AuthGuard>
  );
}
