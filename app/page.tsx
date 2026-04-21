"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { useUserStore, getLevel, getLevelProgress, flightsToNextLevel } from "@/store/user-store";
import { useActiveSession } from "@/store/flight-store";
import { getCityById, flagEmoji } from "@/data/cities";
import { formatMinutes } from "@/lib/utils";
import { AuthGuard } from "@/components/auth/auth-guard";

const FADE_UP = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" },
  }),
};

export default function HomePage() {
  const { profile, history } = useUserStore();
  const { session } = useActiveSession();
  const level = getLevel(profile.totalFlights);
  const levelProgress = getLevelProgress(profile.totalFlights);
  const toNext = flightsToNextLevel(profile.totalFlights);

  const isFlightActive =
    session?.status === "running" || session?.status === "paused";

  return (
    <AuthGuard>
    <div className="min-h-screen bg-[#070918] pt-16">
      {/* ── Hero background ──────────────────────────────────────────── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-900/20 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/4 w-[400px] h-[300px] bg-indigo-900/15 rounded-full blur-[100px]" />
        <div className="absolute top-1/3 right-1/4 w-[300px] h-[200px] bg-sky-900/10 rounded-full blur-[80px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-12">
        {/* ── Active flight banner ──────────────────────────────────── */}
        {isFlightActive && session && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Link href="/focus">
              <div className="glass rounded-2xl p-4 border border-brand-sky/30 bg-brand-sky/5 hover:bg-brand-sky/10 transition-colors cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-sky opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-brand-sky" />
                      </span>
                      <span className="text-brand-sky font-semibold">
                        Uçuş Devam Ediyor
                      </span>
                    </div>
                    <span className="text-slate-400 text-sm">
                      {session.departure.name} →{" "}
                      {session.destination.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-brand-sky text-sm font-medium">
                    Kokpite Dön →
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>
        )}

        {/* ── Hero section ─────────────────────────────────────────── */}
        <div className="text-center mb-16">
          <motion.div
            custom={0}
            initial="hidden"
            animate="visible"
            variants={FADE_UP}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-white/[0.08] text-sm text-slate-400 mb-8"
          >
            <span>✈</span>
            <span>
              {profile.totalFlights > 0
                ? `${profile.totalFlights} uçuş tamamlandı`
                : "Odak yolculuğun burada başlıyor"}
            </span>
          </motion.div>

          <motion.h1
            custom={1}
            initial="hidden"
            animate="visible"
            variants={FADE_UP}
            className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight"
            style={{ fontFamily: "Space Grotesk, sans-serif" }}
          >
            Pilot Gibi
            <br />
            <span className="gradient-text">Odaklan</span>
          </motion.h1>

          <motion.p
            custom={2}
            initial="hidden"
            animate="visible"
            variants={FADE_UP}
            className="text-lg text-slate-400 max-w-xl mx-auto mb-10"
          >
            Çalışma oturumlarını sanal uçuşlara dönüştür. Bir destinasyon rezerv et,
            koltuğunu seç ve odaklanırken uçağının uçtuğunu izle.
          </motion.p>

          <motion.div
            custom={3}
            initial="hidden"
            animate="visible"
            variants={FADE_UP}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="/new-flight">
              <button className="group relative px-8 py-4 rounded-2xl font-semibold text-white overflow-hidden transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: "linear-gradient(135deg, #3B82F6, #1D4ED8)",
                  boxShadow: "0 8px 32px rgba(59,130,246,0.35)",
                }}
              >
                <span className="relative flex items-center gap-2">
                  <span>✈</span>
                  Yeni Uçuş Başlat
                </span>
              </button>
            </Link>
            <Link href="/passport">
              <button className="px-8 py-4 rounded-2xl font-semibold text-slate-300 glass hover:bg-white/[0.08] transition-colors">
                Pasaportu Görüntüle
              </button>
            </Link>
          </motion.div>
        </div>

        {/* ── Stats Grid ────────────────────────────────────────────── */}
        <motion.div
          custom={4}
          initial="hidden"
          animate="visible"
          variants={FADE_UP}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12"
        >
          {[
            {
              icon: "⏱️",
              value: formatMinutes(profile.totalFocusMinutes),
              label: "Odak Süresi",
              color: "#0EA5E9",
            },
            {
              icon: "✈️",
              value: `${profile.totalFlights}`,
              label: "Uçuşlar",
              color: "#818CF8",
            },
            {
              icon: "⭐",
              value: `${profile.totalXP}`,
              label: "Kazanılan XP",
              color: "#F59E0B",
            },
            {
              icon: "🔥",
              value: `${profile.currentStreak}`,
              label: "Gün Serisi",
              color: "#F97316",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="glass rounded-2xl p-5 border border-white/[0.06] hover:border-white/[0.12] transition-colors"
            >
              <div className="text-2xl mb-2">{stat.icon}</div>
              <div
                className="text-2xl font-bold mb-1"
                style={{
                  fontFamily: "Space Grotesk, sans-serif",
                  color: stat.color,
                }}
              >
                {stat.value}
              </div>
              <div className="text-xs text-slate-500">{stat.label}</div>
            </div>
          ))}
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* ── Level Progress ─────────────────────────────────────── */}
          <motion.div
            custom={5}
            initial="hidden"
            animate="visible"
            variants={FADE_UP}
            className="lg:col-span-1 glass rounded-3xl p-6 border border-white/[0.06]"
          >
            <div className="flex items-center justify-between mb-6">
              <h2
                className="text-lg font-semibold"
                style={{ fontFamily: "Space Grotesk, sans-serif" }}
              >
                Seviyeniz
              </h2>
              <span className="text-2xl">{level.emoji}</span>
            </div>

            <div className="flex items-end gap-3 mb-4">
              <span
                className="text-4xl font-bold"
                style={{
                  fontFamily: "Space Grotesk, sans-serif",
                  color: level.color,
                }}
              >
                {level.name}
              </span>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-xs text-slate-500">
                <span>İlerleme</span>
                <span>
                  {toNext > 0
                    ? `Sonraki seviyeye ${toNext} uçuş`
                    : "MAKS SEVİYE"}
                </span>
              </div>
              <div className="progress-track h-2">
                <motion.div
                  className="progress-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${levelProgress * 100}%` }}
                  transition={{ duration: 1, delay: 0.5 }}
                />
              </div>
            </div>

            <div className="grid grid-cols-5 gap-1">
              {["Trainee","Cadet","Pilot","Captain","Legend"].map((l, i) => {
                const colors = ["#94A3B8","#60A5FA","#A78BFA","#F59E0B","#EF4444"];
                const req = [0, 10, 25, 50, 100];
                const unlocked = profile.totalFlights >= req[i];
                return (
                  <div key={l} className="text-center">
                    <div
                      className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center text-xs mb-1 border ${
                        unlocked
                          ? "border-opacity-50"
                          : "opacity-30 border-white/10"
                      }`}
                      style={{
                        background: unlocked
                          ? `${colors[i]}20`
                          : "rgba(255,255,255,0.03)",
                        borderColor: unlocked ? colors[i] : undefined,
                      }}
                    >
                      {["✈️","🎖️","👨‍✈️","⭐","🏆"][i]}
                    </div>
                    <div className="text-[9px] text-slate-600">{l}</div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* ── Recent Flights ─────────────────────────────────────── */}
          <motion.div
            custom={6}
            initial="hidden"
            animate="visible"
            variants={FADE_UP}
            className="lg:col-span-2 glass rounded-3xl p-6 border border-white/[0.06]"
          >
            <div className="flex items-center justify-between mb-6">
              <h2
                className="text-lg font-semibold"
                style={{ fontFamily: "Space Grotesk, sans-serif" }}
              >
                Son Uçuşlar
              </h2>
              <Link
                href="/passport"
                className="text-xs text-brand-sky hover:text-sky-300 transition-colors"
              >
                Tümünü Gör →
              </Link>
            </div>

            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-600">
                <span className="text-4xl mb-3">🌍</span>
                <p className="text-sm">Henüz uçuş yok.</p>
                <p className="text-xs mt-1">
                  Başlamak için ilk uçuşunu rezerv et.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.slice(0, 5).map((flight) => {
                  const dep = getCityById(flight.departureId);
                  const dst = getCityById(flight.destinationId);
                  return (
                    <div
                      key={flight.id}
                      className="flex items-center justify-between p-4 rounded-xl"
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-900/30 flex items-center justify-center text-base">
                          ✈️
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-200">
                            {dep
                              ? `${flagEmoji(dep.countryCode)} ${dep.name}`
                              : flight.departureId}{" "}
                            →{" "}
                            {dst
                              ? `${flagEmoji(dst.countryCode)} ${dst.name}`
                              : flight.destinationId}
                          </div>
                          <div className="text-xs text-slate-500">
                            {formatMinutes(flight.durationMinutes)} ·{" "}
                            {new Date(flight.completedAt).toLocaleDateString("tr-TR")}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20">
                        <span className="text-yellow-400 text-xs font-semibold">
                          +{flight.xpEarned}
                        </span>
                        <span className="text-yellow-500 text-xs">XP</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>

        {/* ── Premium Teaser ─────────────────────────────────────────── */}
        <motion.div
          custom={8}
          initial="hidden"
          animate="visible"
          variants={FADE_UP}
          className="mt-8 rounded-3xl p-6 border"
          style={{
            background: "linear-gradient(135deg, #1A1208, #2D1F06)",
            borderColor: "rgba(245,158,11,0.25)",
          }}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span>✨</span>
                <span
                  className="font-semibold text-yellow-400"
                  style={{ fontFamily: "Space Grotesk, sans-serif" }}
                >
                  AIRJEN Premium
                </span>
                <span className="text-[10px] bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full">
                  YAKINDA
                </span>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                {[
                  "🛋️ Business Class temaları",
                  "🔊 Kabin ortam sesleri",
                  "✈️ Özel uçaklar",
                  "📊 Gelişmiş analizler",
                  "🌍 Sınırsız güzergahlar",
                ].map((f) => (
                  <span key={f}>{f}</span>
                ))}
              </div>
            </div>
            <button
              disabled
              className="shrink-0 px-6 py-2.5 rounded-xl text-sm font-semibold text-yellow-900 opacity-60 cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #F59E0B, #D97706)" }}
            >
              Premium&apos;u Aç
            </button>
          </div>
        </motion.div>
      </div>
    </div>
    </AuthGuard>
  );
}
