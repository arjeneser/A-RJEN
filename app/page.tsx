"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useUserStore, getLevel, getLevelProgress, flightsToNextLevel } from "@/store/user-store";
import { useActiveSession } from "@/store/flight-store";
import { useAuthStore } from "@/store/auth-store";
import { getCityById, flagEmoji, FLIGHT_DURATIONS, getDepartureCities, getReachableDestinations } from "@/data/cities";
import { formatMinutes } from "@/lib/utils";
import { AuthGuard } from "@/components/auth/auth-guard";
import { StreakBanner } from "@/components/streak-banner";
import { createLobby } from "@/lib/lobby";
import {
  createAnnouncement,
  deleteAnnouncement,
  subscribeToAnnouncements,
  type Announcement,
} from "@/lib/announcements";
import type { City, FlightDurationOption } from "@/types";

const FADE_UP = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" },
  }),
};

// ── Hızlı süre seçenekleri ────────────────────────────────────────────────────
const QUICK_DURATIONS = [
  FLIGHT_DURATIONS.find((d) => d.key === "30m")!,
  FLIGHT_DURATIONS.find((d) => d.key === "1h")!,
  FLIGHT_DURATIONS.find((d) => d.key === "1h30")!,
  FLIGHT_DURATIONS.find((d) => d.key === "2h")!,
  FLIGHT_DURATIONS.find((d) => d.key === "3h")!,
  FLIGHT_DURATIONS.find((d) => d.key === "4h")!,
].filter(Boolean) as FlightDurationOption[];

// ── Hızlı saat seçenekleri ────────────────────────────────────────────────────
const QUICK_TIMES = ["08:00", "10:00", "14:00", "18:00", "20:00", "21:00", "22:00", "23:00"];

// ── Geri sayım bileşeni ───────────────────────────────────────────────────────
function Countdown({ scheduledAt, expiresAt }: { scheduledAt: number; expiresAt: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  if (now >= expiresAt) return null; // Kart zaten kaybolacak

  if (now >= scheduledAt) {
    // Uçuş devam ediyor
    const remaining = expiresAt - now - 5 * 60 * 1000; // buffer düşülmeden kalan süre
    const h = Math.floor(remaining / 3_600_000);
    const m = Math.floor((remaining % 3_600_000) / 60_000);
    return (
      <span className="flex items-center gap-1" style={{ color: "#4ADE80" }}>
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
        Şu an aktif{h > 0 ? ` · ${h} sa ${m} dk kaldı` : m > 0 ? ` · ${m} dk kaldı` : ""}
      </span>
    );
  }

  const diff = scheduledAt - now;
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const urgent = diff < 30 * 60_000; // 30 dk'dan az

  return (
    <span style={{ color: urgent ? "#FCD34D" : "#94A3B8" }}>
      {urgent && "⚡ "}
      {h > 0 ? `${h} sa ${m} dk sonra başlıyor` : `${m} dk sonra başlıyor`}
    </span>
  );
}

// ── "Bugün saat HH:MM" formatı ────────────────────────────────────────────────
function formatScheduled(scheduledAt: number): string {
  const d = new Date(scheduledAt);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const hm = d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

  if (d.toDateString() === today.toDateString()) return `Bugün ${hm}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Yarın ${hm}`;
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" }) + " " + hm;
}

// ── scheduledAt hesaplayıcı ───────────────────────────────────────────────────
function buildScheduledAt(timeStr: string, dateStr: string): number {
  // timeStr: "HH:MM", dateStr: "YYYY-MM-DD"
  const [h, min] = timeStr.split(":").map(Number);
  const d = new Date(dateStr);
  d.setHours(h, min, 0, 0);
  return d.getTime();
}

// ── Duyuru Oluşturma Modalı ───────────────────────────────────────────────────
function AnnouncementModal({
  onClose,
  onCreated,
  username,
}: {
  onClose: () => void;
  onCreated: () => void;
  username: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [message, setMessage] = useState("");
  const [scheduledTime, setScheduledTime] = useState("20:00");
  const [scheduledDate, setScheduledDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [duration, setDuration] = useState<FlightDurationOption | null>(null);
  const [departure, setDeparture] = useState<City | null>(null);
  const [depQuery, setDepQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [timeError, setTimeError] = useState("");

  const departureCities = getDepartureCities();

  function trNorm(s: string) {
    return s.toLocaleLowerCase("tr").normalize("NFC");
  }
  const filteredCities = depQuery.trim()
    ? departureCities.filter((c) => {
        const q = trNorm(depQuery);
        return trNorm(c.name).includes(q) || trNorm(c.country).includes(q);
      })
    : departureCities;

  // Seçilen scheduledAt
  const scheduledAt = buildScheduledAt(scheduledTime, scheduledDate);
  const isTimeValid = scheduledAt > Date.now() + 60_000; // en az 1 dk gelecekte

  const canNext =
    (step === 1 && message.trim().length >= 5 && isTimeValid) ||
    (step === 2 && !!duration) ||
    (step === 3 && !!departure);

  function handleTimeChange(val: string) {
    setScheduledTime(val);
    const ts = buildScheduledAt(val, scheduledDate);
    setTimeError(ts <= Date.now() + 60_000 ? "Gelecekte bir saat seçmelisin" : "");
  }

  function handleQuickTime(t: string) {
    setScheduledTime(t);
    const ts = buildScheduledAt(t, scheduledDate);
    setTimeError(ts <= Date.now() + 60_000 ? "Gelecekte bir saat seçmelisin" : "");
  }

  async function handleCreate() {
    if (!departure || !duration || !message.trim() || !isTimeValid) return;
    setCreating(true);
    try {
      const destinations = getReachableDestinations(departure, duration);
      if (destinations.length === 0) { setCreating(false); return; }
      const destination = destinations[Math.floor(destinations.length / 2)];

      const lobbyId = await createLobby(departure, destination, duration, username, 0, 0);
      if (!lobbyId) { setCreating(false); return; }

      await createAnnouncement(
        message.trim(),
        username,
        departure,
        destination,
        duration,
        lobbyId,
        scheduledAt,
      );

      onCreated();
      router.push(`/lobby/${lobbyId}`);
    } finally {
      setCreating(false);
    }
  }

  const STEP_LABELS = ["Mesaj & Saat", "Süre", "Nereden"];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
      style={{ background: "rgba(7,9,24,0.88)", backdropFilter: "blur(12px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="w-full max-w-md rounded-3xl overflow-hidden"
        style={{
          background: "linear-gradient(160deg, rgba(20,16,40,0.99) 0%, rgba(8,10,28,0.99) 100%)",
          border: "1px solid rgba(124,58,237,0.25)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div>
            <div className="text-base font-bold text-white" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
              📣 Uçuş Duyurusu Yap
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Molasız · Herkes katılabilir</div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-500 hover:text-white transition-colors"
            style={{ background: "rgba(255,255,255,0.05)" }}>✕</button>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-0 px-6 pt-4">
          {STEP_LABELS.map((label, i) => (
            <div key={label} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all"
                  style={
                    step === i + 1
                      ? { background: "#7C3AED", borderColor: "#7C3AED", color: "white" }
                      : step > i + 1
                      ? { background: "rgba(124,58,237,0.15)", borderColor: "rgba(124,58,237,0.4)", color: "#A78BFA" }
                      : { background: "transparent", borderColor: "rgba(255,255,255,0.1)", color: "#475569" }
                  }
                >
                  {step > i + 1 ? "✓" : i + 1}
                </div>
                <span className="text-[9px] mt-1 whitespace-nowrap transition-colors"
                  style={{ color: step === i + 1 ? "#A78BFA" : "#334155" }}>
                  {label}
                </span>
              </div>
              {i < 2 && (
                <div className="flex-1 h-0.5 mb-4 mx-1 transition-all"
                  style={{ background: step > i + 1 ? "rgba(124,58,237,0.4)" : "rgba(255,255,255,0.05)" }} />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="px-6 pb-6 pt-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.18 }}
            >
              {/* ── Step 1: Mesaj + Saat ── */}
              {step === 1 && (
                <div className="space-y-4">
                  {/* Mesaj */}
                  <div>
                    <div className="text-xs font-semibold text-slate-300 mb-2">Mesajın</div>
                    <textarea
                      autoFocus
                      value={message}
                      onChange={(e) => setMessage(e.target.value.slice(0, 120))}
                      placeholder="Bu gece 2 saat çalışacağız, sen de katılır mısın? 🚀"
                      rows={3}
                      className="w-full px-4 py-3 rounded-2xl text-sm text-white placeholder-slate-600 outline-none resize-none"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                    />
                    <div className="text-right text-[10px] text-slate-600 mt-1">{message.length}/120</div>
                  </div>

                  {/* Tarih */}
                  <div>
                    <div className="text-xs font-semibold text-slate-300 mb-2">Hangi Gün?</div>
                    <div className="flex gap-2">
                      {[0, 1, 2].map((offset) => {
                        const d = new Date();
                        d.setDate(d.getDate() + offset);
                        const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                        const label = offset === 0 ? "Bugün" : offset === 1 ? "Yarın" : d.toLocaleDateString("tr-TR", { weekday: "short" });
                        const sel = scheduledDate === val;
                        return (
                          <button
                            key={val}
                            onClick={() => setScheduledDate(val)}
                            className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
                            style={sel
                              ? { background: "rgba(124,58,237,0.3)", border: "1px solid rgba(124,58,237,0.5)", color: "#E9D5FF" }
                              : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#64748B" }
                            }
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Saat */}
                  <div>
                    <div className="text-xs font-semibold text-slate-300 mb-2">Başlangıç Saati</div>
                    {/* Hızlı saat butonları */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {QUICK_TIMES.map((t) => {
                        const ts = buildScheduledAt(t, scheduledDate);
                        const past = ts <= Date.now() + 60_000;
                        const sel = scheduledTime === t;
                        return (
                          <button
                            key={t}
                            disabled={past}
                            onClick={() => handleQuickTime(t)}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-30"
                            style={sel
                              ? { background: "rgba(124,58,237,0.3)", border: "1px solid rgba(124,58,237,0.5)", color: "#E9D5FF" }
                              : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#64748B" }
                            }
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>
                    {/* Manuel saat girişi */}
                    <input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => handleTimeChange(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl text-sm text-white outline-none"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: timeError ? "1px solid rgba(239,68,68,0.5)" : "1px solid rgba(255,255,255,0.1)",
                        colorScheme: "dark",
                      }}
                    />
                    {timeError && (
                      <div className="text-xs text-red-400 mt-1">{timeError}</div>
                    )}
                    {!timeError && isTimeValid && (
                      <div className="text-[11px] text-violet-400 mt-1">
                        ✓ {formatScheduled(scheduledAt)}'da başlayacak
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Step 2: Süre ── */}
              {step === 2 && (
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-slate-300 mb-2">Çalışma Süresi</div>
                  <div className="grid grid-cols-3 gap-2">
                    {QUICK_DURATIONS.map((opt) => {
                      const sel = duration?.key === opt.key;
                      return (
                        <button
                          key={opt.key}
                          onClick={() => setDuration(opt)}
                          className="py-3 px-2 rounded-2xl text-center transition-all"
                          style={sel
                            ? { background: "linear-gradient(135deg,#4C1D95,#3B0764)", border: "1px solid rgba(124,58,237,0.6)", boxShadow: "0 0 16px rgba(124,58,237,0.3)" }
                            : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }
                          }
                        >
                          <div className="text-lg mb-0.5">{opt.icon}</div>
                          <div className="text-xs font-semibold" style={{ color: sel ? "#E9D5FF" : "#94A3B8" }}>{opt.label}</div>
                          <div className="text-[9px] mt-0.5" style={{ color: sel ? "#A78BFA" : "#475569" }}>+{opt.xpReward} XP</div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Bitiş saati önizlemesi */}
                  {duration && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                      style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.18)" }}
                    >
                      <span className="text-violet-400">🕗</span>
                      <span className="text-slate-400">
                        {formatScheduled(scheduledAt)}
                        <span className="text-slate-600 mx-1">→</span>
                        {formatScheduled(scheduledAt + duration.minutes * 60_000)}
                        <span className="text-red-400/70 ml-1.5">· Molasız</span>
                      </span>
                    </motion.div>
                  )}
                </div>
              )}

              {/* ── Step 3: Nereden ── */}
              {step === 3 && (
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-slate-300 mb-2">Kalkış Şehri</div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
                    <input
                      autoFocus
                      type="text"
                      placeholder="Şehir ara..."
                      value={depQuery}
                      onChange={(e) => setDepQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-slate-500 outline-none"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                    {filteredCities.map((city) => {
                      const sel = departure?.id === city.id;
                      return (
                        <button
                          key={city.id}
                          onClick={() => setDeparture(city)}
                          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-all"
                          style={sel
                            ? { background: "linear-gradient(135deg,rgba(76,29,149,0.4),rgba(124,58,237,0.2))", border: "1px solid rgba(124,58,237,0.5)" }
                            : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }
                          }
                        >
                          <span className="text-xl shrink-0">{flagEmoji(city.countryCode)}</span>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold truncate" style={{ color: sel ? "white" : "#CBD5E1" }}>{city.name}</div>
                            <div className="text-[9px] text-slate-600 truncate">{city.country}</div>
                          </div>
                          {sel && <span className="ml-auto text-violet-400 shrink-0">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-5 pt-4"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <button
              onClick={() => step > 1 ? setStep((step - 1) as 1 | 2 | 3) : onClose()}
              className="px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "#64748B" }}
            >
              {step > 1 ? "← Geri" : "İptal"}
            </button>

            {step < 3 ? (
              <button
                onClick={() => setStep((step + 1) as 2 | 3)}
                disabled={!canNext}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
                style={{
                  background: canNext ? "linear-gradient(135deg,#7C3AED,#5B21B6)" : "rgba(255,255,255,0.06)",
                  boxShadow: canNext ? "0 4px 16px rgba(124,58,237,0.35)" : "none",
                }}
              >
                Devam →
              </button>
            ) : (
              <button
                onClick={handleCreate}
                disabled={!canNext || creating}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40 flex items-center gap-2"
                style={{
                  background: "linear-gradient(135deg,#7C3AED,#5B21B6)",
                  boxShadow: "0 4px 16px rgba(124,58,237,0.35)",
                }}
              >
                {creating ? "⏳ Oluşturuluyor…" : "📣 Duyuruyu Yayınla"}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Home Page
// ─────────────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();
  const { profile, history } = useUserStore();
  const { session } = useActiveSession();
  const { currentUsername } = useAuthStore();
  const level = getLevel(profile.totalFlights);
  const levelProgress = getLevelProgress(profile.totalFlights);
  const toNext = flightsToNextLevel(profile.totalFlights);

  const isFlightActive =
    session?.status === "running" || session?.status === "paused";

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [annModalOpen, setAnnModalOpen] = useState(false);

  useEffect(() => {
    return subscribeToAnnouncements(setAnnouncements);
  }, []);

  return (
    <AuthGuard>
    <div className="min-h-screen bg-[#070918] pt-16">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-900/20 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/4 w-[400px] h-[300px] bg-indigo-900/15 rounded-full blur-[100px]" />
        <div className="absolute top-1/3 right-1/4 w-[300px] h-[200px] bg-sky-900/10 rounded-full blur-[80px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <StreakBanner />

        {/* Active flight banner */}
        {isFlightActive && session && (
          <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <Link href="/focus">
              <div className="glass rounded-2xl p-4 border border-brand-sky/30 bg-brand-sky/5 hover:bg-brand-sky/10 transition-colors cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-sky opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-brand-sky" />
                      </span>
                      <span className="text-brand-sky font-semibold">Uçuş Devam Ediyor</span>
                    </div>
                    <span className="text-slate-400 text-sm">{session.departure.name} → {session.destination.name}</span>
                  </div>
                  <div className="text-brand-sky text-sm font-medium">Kokpite Dön →</div>
                </div>
              </div>
            </Link>
          </motion.div>
        )}

        {/* Hero */}
        <div className="text-center mb-16">
          <motion.div custom={0} initial="hidden" animate="visible" variants={FADE_UP}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-white/[0.08] text-sm text-slate-400 mb-8">
            <span>✈</span>
            <span>{profile.totalFlights > 0 ? `${profile.totalFlights} uçuş tamamlandı` : "Odak yolculuğun burada başlıyor"}</span>
          </motion.div>

          <motion.h1 custom={1} initial="hidden" animate="visible" variants={FADE_UP}
            className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight"
            style={{ fontFamily: "Space Grotesk, sans-serif" }}>
            Uçuşa<br /><span className="gradient-text">Hazır mısın?</span>
          </motion.h1>

          <motion.p custom={2} initial="hidden" animate="visible" variants={FADE_UP}
            className="text-lg text-slate-400 max-w-xl mx-auto mb-10">
            Çalışma oturumlarını sanal uçuşlara dönüştür. Bir destinasyon rezerv et,
            koltuğunu seç ve odaklanırken uçağının uçtuğunu izle.
          </motion.p>

          <motion.div custom={3} initial="hidden" animate="visible" variants={FADE_UP}
            className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/new-flight">
              <button className="px-8 py-4 rounded-2xl font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: "linear-gradient(135deg,#3B82F6,#1D4ED8)", boxShadow: "0 8px 32px rgba(59,130,246,0.35)" }}>
                <span className="flex items-center gap-2"><span>✈</span>Yeni Uçuş Başlat</span>
              </button>
            </Link>
            <button
              onClick={() => setAnnModalOpen(true)}
              className="px-8 py-4 rounded-2xl font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg,#7C3AED,#5B21B6)", boxShadow: "0 8px 32px rgba(124,58,237,0.3)" }}>
              <span className="flex items-center gap-2"><span>📣</span>Ortak Uçuş Duyur</span>
            </button>
            <Link href="/passport">
              <button className="px-8 py-4 rounded-2xl font-semibold text-slate-300 glass hover:bg-white/[0.08] transition-colors">
                Pasaportu Görüntüle
              </button>
            </Link>
          </motion.div>
        </div>

        {/* ── Uçuş Duyuruları ──────────────────────────────────────── */}
        <AnimatePresence>
          {announcements.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-10"
            >
              <div className="flex items-center gap-2 mb-4">
                <span className="text-base">📣</span>
                <span className="text-sm font-semibold text-white" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                  Uçuş Duyuruları
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.3)", color: "#A78BFA" }}>
                  {announcements.length}
                </span>
              </div>

              <div className="space-y-3">
                {announcements.map((ann, i) => {
                  const isOwn = ann.createdBy === currentUsername;
                  const isActive = Date.now() >= ann.scheduledAt;
                  return (
                    <motion.div
                      key={ann.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="rounded-2xl p-4"
                      style={{
                        background: isActive
                          ? "linear-gradient(135deg,rgba(34,197,94,0.06),rgba(16,185,129,0.03))"
                          : isOwn
                          ? "linear-gradient(135deg,rgba(124,58,237,0.08),rgba(91,33,182,0.04))"
                          : "rgba(255,255,255,0.025)",
                        border: isActive
                          ? "1px solid rgba(34,197,94,0.2)"
                          : isOwn
                          ? "1px solid rgba(124,58,237,0.25)"
                          : "1px solid rgba(255,255,255,0.07)",
                      }}
                    >
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                          style={{
                            background: "linear-gradient(135deg,rgba(124,58,237,0.3),rgba(59,130,246,0.2))",
                            border: "1px solid rgba(124,58,237,0.3)",
                            color: "#C4B5FD",
                          }}>
                          {ann.createdBy[0].toUpperCase()}
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Creator + badges */}
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs font-semibold text-violet-300">
                              {isOwn ? "Sen" : ann.createdBy}
                            </span>
                            {/* Scheduled time badge */}
                            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.2)", color: "#93C5FD" }}>
                              🕗 {formatScheduled(ann.scheduledAt)}
                            </span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)", color: "#FCA5A5" }}>
                              Molasız
                            </span>
                          </div>

                          {/* Message */}
                          <p className="text-sm text-slate-200 leading-relaxed mb-2">{ann.message}</p>

                          {/* Route + duration + countdown */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium"
                              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#94A3B8" }}>
                              {flagEmoji(ann.departure.countryCode)} {ann.departure.name}
                              <span className="text-slate-600">→</span>
                              {flagEmoji(ann.destination.countryCode)} {ann.destination.name}
                            </div>
                            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold"
                              style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.2)", color: "#A78BFA" }}>
                              {ann.durationOption.icon} {ann.durationOption.label}
                            </div>
                            <div className="text-[10px]">
                              <Countdown scheduledAt={ann.scheduledAt} expiresAt={ann.expiresAt} />
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2 shrink-0">
                          {isOwn ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => router.push(`/lobby/${ann.lobbyId}`)}
                                className="px-3 py-2 rounded-xl text-xs font-bold transition-all"
                                style={{ background: "linear-gradient(135deg,#7C3AED,#5B21B6)", color: "white", boxShadow: "0 4px 12px rgba(124,58,237,0.3)" }}>
                                Lobiye Git
                              </button>
                              <button
                                onClick={() => deleteAnnouncement(ann.id)}
                                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-600 hover:text-red-400 transition-colors text-sm"
                                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                                title="Duyuruyu sil">
                                🗑
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => router.push(`/lobby/${ann.lobbyId}`)}
                              className="px-4 py-2 rounded-xl text-xs font-bold transition-all hover:scale-[1.02]"
                              style={{ background: "linear-gradient(135deg,#7C3AED,#5B21B6)", color: "white", boxShadow: "0 4px 12px rgba(124,58,237,0.3)" }}>
                              Katıl →
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats Grid */}
        <motion.div custom={4} initial="hidden" animate="visible" variants={FADE_UP}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {[
            { icon: "⏱️", value: formatMinutes(profile.totalFocusMinutes), label: "Odak Süresi", color: "#0EA5E9" },
            { icon: "✈️", value: `${profile.totalFlights}`, label: "Uçuşlar", color: "#818CF8" },
            { icon: "⭐", value: `${profile.totalXP}`, label: "Kazanılan XP", color: "#F59E0B" },
            { icon: "🔥", value: `${profile.currentStreak}`, label: "Gün Serisi", color: "#F97316" },
          ].map((stat) => (
            <div key={stat.label} className="glass rounded-2xl p-5 border border-white/[0.06] hover:border-white/[0.12] transition-colors">
              <div className="text-2xl mb-2">{stat.icon}</div>
              <div className="text-2xl font-bold mb-1" style={{ fontFamily: "Space Grotesk, sans-serif", color: stat.color }}>{stat.value}</div>
              <div className="text-xs text-slate-500">{stat.label}</div>
            </div>
          ))}
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Level Progress */}
          <motion.div custom={5} initial="hidden" animate="visible" variants={FADE_UP}
            className="lg:col-span-1 glass rounded-3xl p-6 border border-white/[0.06]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold" style={{ fontFamily: "Space Grotesk, sans-serif" }}>Seviyeniz</h2>
              <span className="text-2xl">{level.emoji}</span>
            </div>
            <div className="flex items-end gap-3 mb-4">
              <span className="text-4xl font-bold" style={{ fontFamily: "Space Grotesk, sans-serif", color: level.color }}>{level.name}</span>
            </div>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-xs text-slate-500">
                <span>İlerleme</span>
                <span>{toNext > 0 ? `Sonraki seviyeye ${toNext} uçuş` : "MAKS SEVİYE"}</span>
              </div>
              <div className="progress-track h-2">
                <motion.div className="progress-fill" initial={{ width: 0 }} animate={{ width: `${levelProgress * 100}%` }} transition={{ duration: 1, delay: 0.5 }} />
              </div>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {["Trainee","Cadet","Pilot","Captain","Legend"].map((l, i) => {
                const colors = ["#94A3B8","#60A5FA","#A78BFA","#F59E0B","#EF4444"];
                const req = [0, 10, 25, 50, 100];
                const unlocked = profile.totalFlights >= req[i];
                return (
                  <div key={l} className="text-center">
                    <div className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center text-xs mb-1 border ${unlocked ? "border-opacity-50" : "opacity-30 border-white/10"}`}
                      style={{ background: unlocked ? `${colors[i]}20` : "rgba(255,255,255,0.03)", borderColor: unlocked ? colors[i] : undefined }}>
                      {["✈️","🎖️","👨‍✈️","⭐","🏆"][i]}
                    </div>
                    <div className="text-[9px] text-slate-600">{l}</div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Recent Flights */}
          <motion.div custom={6} initial="hidden" animate="visible" variants={FADE_UP}
            className="lg:col-span-2 glass rounded-3xl p-6 border border-white/[0.06]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold" style={{ fontFamily: "Space Grotesk, sans-serif" }}>Son Uçuşlar</h2>
              <Link href="/passport" className="text-xs text-brand-sky hover:text-sky-300 transition-colors">Tümünü Gör →</Link>
            </div>
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-600">
                <span className="text-4xl mb-3">🌍</span>
                <p className="text-sm">Henüz uçuş yok.</p>
                <p className="text-xs mt-1">Başlamak için ilk uçuşunu rezerv et.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.slice(0, 5).map((flight) => {
                  const dep = getCityById(flight.departureId);
                  const dst = getCityById(flight.destinationId);
                  return (
                    <div key={flight.id} className="flex items-center justify-between p-4 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-900/30 flex items-center justify-center text-base">✈️</div>
                        <div>
                          <div className="text-sm font-medium text-slate-200">
                            {dep ? `${flagEmoji(dep.countryCode)} ${dep.name}` : flight.departureId}{" "}→{" "}
                            {dst ? `${flagEmoji(dst.countryCode)} ${dst.name}` : flight.destinationId}
                          </div>
                          <div className="text-xs text-slate-500">
                            {formatMinutes(flight.durationMinutes)} · {new Date(flight.completedAt).toLocaleDateString("tr-TR")}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20">
                        <span className="text-yellow-400 text-xs font-semibold">+{flight.xpEarned}</span>
                        <span className="text-yellow-500 text-xs">XP</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>

        {/* Premium Teaser */}
        <motion.div custom={8} initial="hidden" animate="visible" variants={FADE_UP}
          className="mt-8 rounded-3xl p-6 border"
          style={{ background: "linear-gradient(135deg,#1A1208,#2D1F06)", borderColor: "rgba(245,158,11,0.25)" }}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span>✨</span>
                <span className="font-semibold text-yellow-400" style={{ fontFamily: "Space Grotesk, sans-serif" }}>AIRJEN Premium</span>
                <span className="text-[10px] bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full">YAKINDA</span>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                {["🛋️ Business Class temaları","🔊 Kabin ortam sesleri","✈️ Özel uçaklar","📊 Gelişmiş analizler","🌍 Sınırsız güzergahlar"].map((f) => (
                  <span key={f}>{f}</span>
                ))}
              </div>
            </div>
            <button disabled className="shrink-0 px-6 py-2.5 rounded-xl text-sm font-semibold text-yellow-900 opacity-60 cursor-not-allowed"
              style={{ background: "linear-gradient(135deg,#F59E0B,#D97706)" }}>
              Premium&apos;u Aç
            </button>
          </div>
        </motion.div>
      </div>
    </div>

    {/* Duyuru oluşturma modalı */}
    <AnimatePresence>
      {annModalOpen && currentUsername && (
        <AnnouncementModal
          onClose={() => setAnnModalOpen(false)}
          onCreated={() => setAnnModalOpen(false)}
          username={currentUsername}
        />
      )}
    </AnimatePresence>

    </AuthGuard>
  );
}
