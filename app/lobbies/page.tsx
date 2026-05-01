"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/store/auth-store";
import { useUserStore } from "@/store/user-store";
import { AuthGuard } from "@/components/auth/auth-guard";
import { subscribeToUserLobbies, leaveLobby, createLobby, type Lobby } from "@/lib/lobby";
import { subscribeToFriends, type FriendInfo } from "@/lib/friends";
import { sendFlightInvite } from "@/lib/flight-invites";
import {
  getDepartureCities,
  getReachableDestinations,
  haversineKm,
  flagEmoji,
  FLIGHT_DURATIONS,
} from "@/data/cities";
import type { City, FlightDurationOption } from "@/types";

// ── SSR-safe harita bileşeni ──────────────────────────────────────────────────
const DestinationMap = dynamic(
  () => import("@/components/flight-wizard/destination-map").then((m) => m.DestinationMap),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full animate-pulse rounded-2xl"
        style={{ height: 340, background: "rgba(7,9,24,0.8)", border: "1px solid rgba(255,255,255,0.06)" }}
      />
    ),
  }
);

// ── Adım tanımları ────────────────────────────────────────────────────────────
const WIZARD_STEPS = [
  { id: 1, label: "Kalkış" },
  { id: 2, label: "Süre"   },
  { id: 3, label: "Varış"  },
  { id: 4, label: "Davet"  },
];

export default function LobbiesPage() {
  const router              = useRouter();
  const { currentUsername } = useAuthStore();
  const visitedCityIds      = useUserStore((s) => s.profile.visitedCityIds);

  // ── Lobi listesi ─────────────────────────────────────────────────────────
  const [lobbies, setLobbies]   = useState<Lobby[]>([]);
  const [friends, setFriends]   = useState<FriendInfo[]>([]);
  const [forming, setForming]   = useState(false);
  const [creating, setCreating] = useState(false);

  // ── Wizard state ──────────────────────────────────────────────────────────
  const [step, setStep]             = useState(1);
  const [departure, setDeparture]   = useState<City | null>(null);
  const [duration, setDuration]     = useState<FlightDurationOption | null>(null);
  const [destination, setDest]      = useState<City | null>(null);
  const [invited, setInvited]       = useState<Set<string>>(new Set());
  const [depQuery, setDepQuery]     = useState("");

  const departureCities = getDepartureCities();
  const filteredCities  = depQuery.trim()
    ? departureCities.filter(
        (c) =>
          c.name.toLowerCase().includes(depQuery.toLowerCase()) ||
          c.country.toLowerCase().includes(depQuery.toLowerCase())
      )
    : departureCities;

  const destinations = departure && duration ? getReachableDestinations(departure, duration) : [];
  const distKm       = destination && departure
    ? Math.round(haversineKm(departure.lat, departure.lng, destination.lat, destination.lng))
    : null;

  const canAdvance =
    (step === 1 && !!departure) ||
    (step === 2 && !!duration) ||
    (step === 3 && !!destination) ||
    step === 4;

  useEffect(() => {
    if (!currentUsername) return;
    const u1 = subscribeToUserLobbies(currentUsername, setLobbies);
    const u2 = subscribeToFriends(currentUsername, setFriends);
    return () => { u1(); u2(); };
  }, [currentUsername]);

  // Kalkış değişince varışı sıfırla
  useEffect(() => { setDest(null); }, [departure, duration]);

  function resetWizard() {
    setStep(1);
    setDeparture(null);
    setDuration(null);
    setDest(null);
    setInvited(new Set());
    setDepQuery("");
  }

  function openWizard() { resetWizard(); setForming(true); }
  function closeWizard() { setForming(false); resetWizard(); }

  function toggleInvite(username: string) {
    setInvited((prev) => {
      const next = new Set(prev);
      if (next.has(username)) next.delete(username); else next.add(username);
      return next;
    });
  }

  async function handleCreate() {
    if (!currentUsername || !departure || !destination || !duration) return;
    setCreating(true);
    const lobbyId = await createLobby(departure, destination, duration, currentUsername);
    // Seçilen arkadaşlara davet gönder
    for (const friend of invited) {
      await sendFlightInvite(currentUsername, friend, departure, destination, duration, lobbyId);
    }
    setCreating(false);
    closeWizard();
    if (lobbyId) router.push(`/lobby/${lobbyId}`);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AuthGuard>
      <div className="min-h-screen bg-[#070918] pt-20 pb-16 px-4">
        {/* Ambient glow */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-violet-900/10 rounded-full blur-[120px]" />
        </div>

        <div className="relative max-w-2xl mx-auto space-y-6">

          {/* ── Başlık ──────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                🚀 Ortak Uçuş
              </h1>
              <p className="text-sm text-slate-500 mt-1">Arkadaşlarınla aynı uçuşta odaklan</p>
            </div>
            {!forming && (
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={openWizard}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                style={{
                  background: "linear-gradient(135deg, #7C3AED, #5B21B6)",
                  border: "1px solid rgba(124,58,237,0.4)",
                  boxShadow: "0 4px 16px rgba(124,58,237,0.35)",
                }}
              >
                + Lobi Oluştur
              </motion.button>
            )}
          </div>

          {/* ══════════════ WİZARD ══════════════ */}
          <AnimatePresence>
            {forming && (
              <motion.div
                key="wizard"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.25 }}
              >
                {/* Adım göstergesi */}
                <div className="flex items-center gap-2 mb-6">
                  {WIZARD_STEPS.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 flex-1">
                      <div className="flex flex-col items-center">
                        <div
                          className="flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border-2 transition-all duration-300"
                          style={
                            step === s.id
                              ? { background: "#7C3AED", borderColor: "#7C3AED", color: "white", transform: "scale(1.1)", boxShadow: "0 0 14px rgba(124,58,237,0.6)" }
                              : step > s.id
                              ? { background: "rgba(124,58,237,0.2)", borderColor: "rgba(124,58,237,0.5)", color: "#A78BFA" }
                              : { background: "transparent", borderColor: "rgba(255,255,255,0.12)", color: "#475569" }
                          }
                        >
                          {step > s.id ? "✓" : s.id}
                        </div>
                        <span
                          className="text-[10px] mt-1 hidden sm:block transition-colors"
                          style={{ color: step === s.id ? "#A78BFA" : step > s.id ? "#64748B" : "#334155" }}
                        >
                          {s.label}
                        </span>
                      </div>
                      {s.id < WIZARD_STEPS.length && (
                        <div
                          className="flex-1 h-0.5 transition-all duration-500 mb-4"
                          style={{ background: step > s.id ? "rgba(124,58,237,0.5)" : "rgba(255,255,255,0.06)" }}
                        />
                      )}
                    </div>
                  ))}
                </div>

                {/* Adım içeriği */}
                <div
                  className="rounded-3xl p-6 sm:p-8"
                  style={{
                    background: "rgba(255,255,255,0.025)",
                    border: "1px solid rgba(124,58,237,0.18)",
                    backdropFilter: "blur(12px)",
                  }}
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={step}
                      initial={{ opacity: 0, x: 18 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -18 }}
                      transition={{ duration: 0.22 }}
                    >
                      {/* ── ADIM 1: KALKIŞ ────────────────────────────── */}
                      {step === 1 && (
                        <div>
                          <div className="mb-5">
                            <h2 className="text-xl font-bold text-white mb-1" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                              Nereden Kalkıyorsunuz?
                            </h2>
                            <p className="text-slate-400 text-sm">Lobi için kalkış şehrinizi seçin.</p>
                          </div>
                          {/* Arama */}
                          <div className="relative mb-4">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
                            <input
                              type="text"
                              placeholder="Şehir ara..."
                              value={depQuery}
                              onChange={(e) => setDepQuery(e.target.value)}
                              className="w-full pl-11 pr-4 py-3 rounded-xl text-sm text-white placeholder-slate-500 outline-none transition-colors"
                              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                            />
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[360px] overflow-y-auto pr-1">
                            {filteredCities.map((city, i) => {
                              const isSel = departure?.id === city.id;
                              return (
                                <motion.button
                                  key={city.id}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: i * 0.03, duration: 0.25 }}
                                  onClick={() => setDeparture(city)}
                                  className="relative text-left p-4 rounded-2xl transition-all duration-200"
                                  style={{
                                    background: isSel ? "linear-gradient(135deg,#4C1D95,#3B0764)" : "rgba(255,255,255,0.03)",
                                    border: isSel ? "1px solid rgba(124,58,237,0.6)" : "1px solid rgba(255,255,255,0.07)",
                                    boxShadow: isSel ? "0 0 20px rgba(124,58,237,0.25)" : undefined,
                                    transform: isSel ? "scale(1.02)" : undefined,
                                  }}
                                >
                                  <div className="text-3xl mb-2">{flagEmoji(city.countryCode)}</div>
                                  <div className="font-semibold text-sm text-white mb-0.5 truncate">{city.name}</div>
                                  <div className="text-xs text-slate-500 truncate">{city.country}</div>
                                  {isSel && (
                                    <div className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center"
                                      style={{ background: "#7C3AED" }}>
                                      <span className="text-white text-xs">✓</span>
                                    </div>
                                  )}
                                </motion.button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* ── ADIM 2: SÜRE ──────────────────────────────── */}
                      {step === 2 && (
                        <div>
                          <div className="mb-5">
                            <h2 className="text-xl font-bold text-white mb-1" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                              Ne Kadar Odaklanacaksınız?
                            </h2>
                            <p className="text-slate-400 text-sm">
                              <span className="text-white font-medium">{departure?.name}</span>'dan kalkış · Sürenizi seçin.
                            </p>
                          </div>
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                            {FLIGHT_DURATIONS.map((opt, i) => {
                              const isSel = duration?.key === opt.key;
                              return (
                                <motion.button
                                  key={opt.key}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: i * 0.03 }}
                                  onClick={() => setDuration(opt)}
                                  className="relative text-center p-3.5 rounded-2xl transition-all duration-200"
                                  style={{
                                    background: isSel ? "linear-gradient(135deg,#4C1D95,#3B0764)" : "rgba(255,255,255,0.04)",
                                    border: isSel ? "1px solid rgba(124,58,237,0.6)" : "1px solid rgba(255,255,255,0.07)",
                                    boxShadow: isSel ? "0 0 20px rgba(124,58,237,0.3)" : undefined,
                                    transform: isSel ? "scale(1.05)" : undefined,
                                  }}
                                >
                                  <div className="text-2xl mb-1.5">{opt.icon}</div>
                                  <div className="font-bold text-sm text-white leading-tight" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                                    {opt.label}
                                  </div>
                                  <div className="text-[10px] text-slate-400 mt-0.5">{opt.subtitle}</div>
                                  <div className="mt-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                                    style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.2)", color: "#FCD34D" }}>
                                    +{opt.xpReward} XP
                                  </div>
                                  {isSel && (
                                    <div className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center"
                                      style={{ background: "#7C3AED" }}>
                                      <span className="text-white text-[9px]">✓</span>
                                    </div>
                                  )}
                                </motion.button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* ── ADIM 3: VARIŞ ─────────────────────────────── */}
                      {step === 3 && departure && duration && (
                        <div>
                          <div className="mb-4">
                            <h2 className="text-xl font-bold text-white mb-1" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                              Varış Noktanızı Seçin
                            </h2>
                            <p className="text-slate-400 text-sm">
                              <span className="text-white font-medium">{departure.name}</span>'dan{" "}
                              <span className="text-white font-medium">{duration.label}</span> sürede{" "}
                              <span className="text-violet-400 font-medium">{destinations.length} destinasyon</span>a ulaşabilirsiniz.
                            </p>
                          </div>

                          {/* Harita */}
                          <div className="mb-3">
                            <DestinationMap
                              departure={departure}
                              destinations={destinations}
                              selected={destination}
                              minDistanceKm={duration.minDistanceKm}
                              maxDistanceKm={duration.maxDistanceKm}
                              onSelect={setDest}
                            />
                          </div>

                          {/* Seçili şehir kartı */}
                          <AnimatePresence mode="wait">
                            {destination ? (
                              <motion.div
                                key={destination.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                className="flex items-center gap-4 px-4 py-3 rounded-2xl mb-3"
                                style={{
                                  background: "linear-gradient(135deg, rgba(76,29,149,0.3), rgba(91,33,182,0.15))",
                                  border: "1px solid rgba(124,58,237,0.5)",
                                  boxShadow: "0 0 20px rgba(124,58,237,0.15)",
                                }}
                              >
                                <span className="text-3xl">{flagEmoji(destination.countryCode)}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="font-bold text-white text-base leading-tight">{destination.name}</div>
                                  <div className="text-slate-400 text-xs">{destination.country}</div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="text-sm font-bold text-violet-300">{distKm?.toLocaleString()} km</div>
                                  <div className="text-slate-500 text-[11px]">direkt</div>
                                </div>
                                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                                  style={{ background: "linear-gradient(135deg,#7C3AED,#5B21B6)", boxShadow: "0 0 10px rgba(124,58,237,0.5)" }}>
                                  <span className="text-white text-xs">✓</span>
                                </div>
                              </motion.div>
                            ) : (
                              <motion.div
                                key="placeholder"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex items-center justify-center py-2.5 rounded-xl mb-3"
                                style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)" }}
                              >
                                <span className="text-slate-500 text-sm">Haritadan veya listeden bir şehir seçin</span>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Şehir listesi */}
                          {destinations.length > 0 && (
                            <div className="rounded-2xl overflow-hidden"
                              style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                              <div className="flex items-center justify-between px-3 py-2"
                                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.03)" }}>
                                <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">Gidilebilecek Ülkeler</span>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                  style={{ background: "rgba(124,58,237,0.15)", color: "#A78BFA", border: "1px solid rgba(124,58,237,0.25)" }}>
                                  {destinations.length}
                                </span>
                              </div>
                              <div className="max-h-[220px] overflow-y-auto p-2 space-y-1">
                                {destinations.map((city, i) => {
                                  const d = Math.round(haversineKm(departure.lat, departure.lng, city.lat, city.lng));
                                  const isSel = destination?.id === city.id;
                                  return (
                                    <motion.button
                                      key={city.id}
                                      initial={{ opacity: 0, x: -8 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      transition={{ delay: i * 0.02 }}
                                      onClick={() => setDest(city)}
                                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left"
                                      style={{
                                        background: isSel ? "linear-gradient(135deg,rgba(76,29,149,0.35),rgba(124,58,237,0.18))" : "rgba(255,255,255,0.03)",
                                        border: isSel ? "1px solid rgba(124,58,237,0.5)" : "1px solid rgba(255,255,255,0.05)",
                                      }}
                                    >
                                      <span className="text-2xl shrink-0">{flagEmoji(city.countryCode)}</span>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <span className={`font-semibold text-sm truncate ${isSel ? "text-white" : "text-slate-200"}`}>{city.name}</span>
                                          {visitedCityIds.includes(city.id) && (
                                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 whitespace-nowrap"
                                              style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)", color: "#34D399" }}>
                                              Daha önce gidildi
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-slate-500 text-xs truncate">{city.country}</div>
                                      </div>
                                      <div className="text-xs font-medium shrink-0" style={{ color: isSel ? "#A78BFA" : "#64748B" }}>
                                        {d.toLocaleString()} km
                                      </div>
                                      {isSel && (
                                        <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                                          style={{ background: "linear-gradient(135deg,#7C3AED,#5B21B6)" }}>
                                          <span className="text-white text-[10px]">✓</span>
                                        </div>
                                      )}
                                    </motion.button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── ADIM 4: ARKADAŞ DAVET ─────────────────────── */}
                      {step === 4 && (
                        <div>
                          <div className="mb-5">
                            <h2 className="text-xl font-bold text-white mb-1" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                              Arkadaşlarını Davet Et
                            </h2>
                            <p className="text-slate-400 text-sm">
                              Lobiye katılmalarını istediğin arkadaşları seç. İstersen atla.
                            </p>
                          </div>

                          {/* Özet kartı */}
                          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-5"
                            style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)" }}>
                            <span className="text-2xl">{departure ? flagEmoji(departure.countryCode) : "✈"}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-white truncate">
                                {departure?.name} → {destination?.name}
                              </div>
                              <div className="text-xs text-slate-500">{duration?.label} · +{duration?.xpReward} XP</div>
                            </div>
                            {destination && <span className="text-2xl">{flagEmoji(destination.countryCode)}</span>}
                          </div>

                          {friends.length === 0 ? (
                            <div className="flex flex-col items-center py-10 gap-3">
                              <span className="text-3xl opacity-30">👥</span>
                              <p className="text-slate-600 text-sm text-center">
                                Henüz arkadaşın yok.<br />
                                Arkadaşlar panelinden arkadaş ekleyebilirsin.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                              {friends.map((f, i) => {
                                const isInvited = invited.has(f.username);
                                return (
                                  <motion.button
                                    key={f.username}
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.04 }}
                                    onClick={() => toggleInvite(f.username)}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all text-left"
                                    style={{
                                      background: isInvited ? "rgba(124,58,237,0.12)" : "rgba(255,255,255,0.03)",
                                      border: isInvited ? "1px solid rgba(124,58,237,0.4)" : "1px solid rgba(255,255,255,0.07)",
                                    }}
                                  >
                                    {/* Avatar */}
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                                      style={{
                                        background: isInvited ? "rgba(124,58,237,0.25)" : "rgba(255,255,255,0.06)",
                                        border: isInvited ? "1px solid rgba(124,58,237,0.4)" : "1px solid rgba(255,255,255,0.08)",
                                        color: isInvited ? "#A78BFA" : "#94A3B8",
                                      }}>
                                      {f.username[0].toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="font-semibold text-sm text-white">{f.username}</div>
                                      <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                                        {f.isFlying ? (
                                          <><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />Şu an uçuşta</>
                                        ) : f.stats ? (
                                          <>{f.stats.totalFlights} uçuş · {f.stats.totalXP} XP</>
                                        ) : "Henüz uçuş yok"}
                                      </div>
                                    </div>
                                    {/* Checkbox */}
                                    <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all"
                                      style={{
                                        background: isInvited ? "linear-gradient(135deg,#7C3AED,#5B21B6)" : "rgba(255,255,255,0.05)",
                                        border: isInvited ? "1px solid #7C3AED" : "1px solid rgba(255,255,255,0.12)",
                                        boxShadow: isInvited ? "0 0 10px rgba(124,58,237,0.5)" : undefined,
                                      }}>
                                      {isInvited && (
                                        <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                                          <path d="M1 5L4.5 8.5L11 1.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                      )}
                                    </div>
                                  </motion.button>
                                );
                              })}
                            </div>
                          )}

                          {invited.size > 0 && (
                            <p className="text-xs text-violet-400 text-center mt-3">
                              {invited.size} arkadaşa davet gönderilecek
                            </p>
                          )}
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Navigasyon */}
                <div className="flex items-center justify-between mt-5">
                  <button
                    onClick={() => step > 1 ? setStep(step - 1) : closeWizard()}
                    className="px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "#64748B" }}
                  >
                    {step > 1 ? "← Geri" : "✕ İptal"}
                  </button>

                  {step < 4 ? (
                    <motion.button
                      onClick={() => setStep(step + 1)}
                      disabled={!canAdvance}
                      whileHover={canAdvance ? { scale: 1.02 } : {}}
                      whileTap={canAdvance ? { scale: 0.98 } : {}}
                      className="px-7 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{
                        background: canAdvance ? "linear-gradient(135deg,#7C3AED,#5B21B6)" : "rgba(255,255,255,0.06)",
                        boxShadow: canAdvance ? "0 4px 16px rgba(124,58,237,0.35)" : "none",
                      }}
                    >
                      Devam Et →
                    </motion.button>
                  ) : (
                    <motion.button
                      onClick={handleCreate}
                      disabled={creating}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      className="px-8 py-3 rounded-xl text-sm font-bold text-white flex items-center gap-2 disabled:opacity-60"
                      style={{
                        background: "linear-gradient(135deg,#7C3AED,#5B21B6)",
                        boxShadow: "0 4px 20px rgba(124,58,237,0.4)",
                      }}
                    >
                      {creating ? "⏳ Oluşturuluyor…" : <><span>🚀</span> Lobi Oluştur & Kalkış</>}
                    </motion.button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ══════════════ AKTİF LOBİLER ══════════════ */}
          {!forming && (
            <>
              {lobbies.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-24 gap-4"
                >
                  <span className="text-5xl opacity-20">🚀</span>
                  <p className="text-slate-600 text-sm text-center leading-relaxed">
                    Henüz aktif lobin yok.<br />
                    Bir lobi oluştur ve arkadaşlarını davet et!
                  </p>
                </motion.div>
              ) : (
                <div className="space-y-3">
                  <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                    Aktif Lobiler — {lobbies.length}
                  </div>
                  {lobbies.map((lobby, i) => {
                    const memberCount = Object.keys(lobby.members ?? {}).length;
                    const isCreator   = lobby.createdBy === currentUsername;
                    const isStarting  = lobby.status === "starting";
                    const readyCount  = Object.values(lobby.members ?? {}).filter((m) => m.ready).length;

                    return (
                      <motion.div
                        key={lobby.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="rounded-2xl p-5 space-y-4"
                        style={{
                          background: isStarting ? "rgba(74,222,128,0.05)" : "rgba(255,255,255,0.03)",
                          border: isStarting ? "1px solid rgba(74,222,128,0.18)" : "1px solid rgba(255,255,255,0.07)",
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                            style={{
                              background: isStarting ? "rgba(74,222,128,0.12)" : "rgba(255,255,255,0.05)",
                              border: isStarting ? "1px solid rgba(74,222,128,0.25)" : "1px solid rgba(255,255,255,0.08)",
                            }}>
                            ✈
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-white text-sm truncate" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                              {lobby.departure?.name ?? "?"} → {lobby.destination?.name ?? "?"}
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-[10px] text-slate-500">{lobby.durationOption?.label ?? ""}</span>
                              <span className="text-[10px] text-slate-700">·</span>
                              <span className="text-[10px] text-slate-500">{readyCount}/{memberCount} hazır</span>
                              {isCreator && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                  style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.25)", color: "#A78BFA" }}>
                                  Kaptan
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0"
                            style={isStarting
                              ? { background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ADE80" }
                              : { background: "rgba(148,163,184,0.07)", border: "1px solid rgba(148,163,184,0.1)", color: "#64748B" }}>
                            {isStarting ? "✈ Kalkış" : "⏳ Bekleniyor"}
                          </div>
                        </div>

                        {/* Üyeler */}
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(lobby.members ?? {}).map(([uname, member]) => (
                            <div key={uname}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium"
                              style={{
                                background: uname === currentUsername ? "rgba(124,58,237,0.12)" : "rgba(255,255,255,0.05)",
                                border: uname === currentUsername ? "1px solid rgba(124,58,237,0.25)" : "1px solid rgba(255,255,255,0.07)",
                                color: uname === currentUsername ? "#A78BFA" : "#94A3B8",
                              }}>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: member.ready ? "#4ADE80" : "#475569" }} />
                              {uname === currentUsername ? "Sen" : uname}
                              {member.seat && <span className="opacity-50">· {member.seat}</span>}
                            </div>
                          ))}
                        </div>

                        {/* Butonlar */}
                        <div className="flex items-center gap-2.5">
                          <motion.button
                            whileTap={{ scale: 0.97 }}
                            onClick={() => router.push(`/lobby/${lobby.id}`)}
                            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                            style={{
                              background: "linear-gradient(135deg,rgba(124,58,237,0.2),rgba(91,33,182,0.12))",
                              border: "1px solid rgba(124,58,237,0.3)",
                              color: "#C4B5FD",
                            }}>
                            Lobiye Git →
                          </motion.button>
                          <motion.button
                            whileTap={{ scale: 0.97 }}
                            onClick={async () => { if (currentUsername) await leaveLobby(lobby.id, currentUsername); }}
                            className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                            style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.15)", color: "#F87171" }}>
                            Ayrıl
                          </motion.button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
