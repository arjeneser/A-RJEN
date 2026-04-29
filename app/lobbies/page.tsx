"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/store/auth-store";
import { AuthGuard } from "@/components/auth/auth-guard";
import { subscribeToUserLobbies, leaveLobby, type Lobby } from "@/lib/lobby";
import { getDepartureCities, getReachableDestinations, FLIGHT_DURATIONS } from "@/data/cities";
import { createLobby } from "@/lib/lobby";
import type { City, FlightDurationOption } from "@/types";

export default function LobbiesPage() {
  const router            = useRouter();
  const { currentUsername } = useAuthStore();
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [creating, setCreating] = useState(false);

  // Lobi oluşturma formu
  const departureCities = getDepartureCities();
  const [departure, setDeparture]       = useState<City>(departureCities[0]);
  const [destination, setDestination]   = useState<City | null>(null);
  const [durationOpt, setDurationOpt]   = useState<FlightDurationOption>(FLIGHT_DURATIONS[0]);
  const [forming, setForming]           = useState(false);

  const destinations = departure ? getReachableDestinations(departure, durationOpt) : [];

  useEffect(() => {
    const dests = departure ? getReachableDestinations(departure, durationOpt) : [];
    if (dests.length > 0) setDestination(dests[0]);
    else setDestination(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departure, durationOpt]);

  useEffect(() => {
    if (!currentUsername) return;
    const unsub = subscribeToUserLobbies(currentUsername, setLobbies);
    return unsub;
  }, [currentUsername]);

  async function handleCreate() {
    if (!currentUsername || !departure || !destination) return;
    setCreating(true);
    const id = await createLobby(departure, destination, durationOpt, currentUsername);
    setCreating(false);
    setForming(false);
    if (id) router.push(`/lobby/${id}`);
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-[#070918] pt-20 pb-12 px-4">
        {/* Ambient glow */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-violet-900/10 rounded-full blur-[120px]" />
        </div>

        <div className="relative max-w-lg mx-auto space-y-6">

          {/* ── Başlık ───────────────────────────────────────────────── */}
          <div className="flex items-center justify-between">
            <div>
              <h1
                className="text-2xl font-bold text-white"
                style={{ fontFamily: "Space Grotesk, sans-serif" }}
              >
                🚀 Ortak Uçuş
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Arkadaşlarınla aynı uçuşta odaklan
              </p>
            </div>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => setForming((v) => !v)}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: forming
                  ? "rgba(239,68,68,0.1)"
                  : "linear-gradient(135deg, #7C3AED, #5B21B6)",
                border: forming
                  ? "1px solid rgba(239,68,68,0.25)"
                  : "1px solid rgba(124,58,237,0.4)",
                color: forming ? "#F87171" : "white",
                boxShadow: forming ? "none" : "0 4px 14px rgba(124,58,237,0.35)",
              }}
            >
              {forming ? "✕ İptal" : "+ Lobi Oluştur"}
            </motion.button>
          </div>

          {/* ── Lobi Oluşturma Formu ─────────────────────────────────── */}
          <AnimatePresence>
            {forming && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22 }}
                className="overflow-hidden"
              >
                <div
                  className="rounded-2xl p-5 space-y-4"
                  style={{
                    background: "rgba(124,58,237,0.06)",
                    border: "1px solid rgba(124,58,237,0.2)",
                  }}
                >
                  <div className="text-xs font-bold text-violet-400 uppercase tracking-widest">
                    Yeni Lobi
                  </div>

                  {/* Kalkış */}
                  <div>
                    <label className="block text-xs text-slate-500 mb-1.5">Kalkış Noktası</label>
                    <select
                      value={departure?.id ?? ""}
                      onChange={(e) => {
                        const c = departureCities.find((x) => x.id === e.target.value);
                        if (c) { setDeparture(c); setDestination(null); }
                      }}
                      className="w-full px-3 py-2.5 rounded-xl text-white text-sm outline-none appearance-none"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                    >
                      {departureCities.map((c) => (
                        <option key={c.id} value={c.id} style={{ background: "#0A0F1E" }}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Varış */}
                  <div>
                    <label className="block text-xs text-slate-500 mb-1.5">Varış Noktası</label>
                    <select
                      value={destination?.id ?? ""}
                      onChange={(e) => {
                        const c = destinations.find((x) => x.id === e.target.value);
                        if (c) setDestination(c);
                      }}
                      className="w-full px-3 py-2.5 rounded-xl text-white text-sm outline-none appearance-none"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                    >
                      {destinations.map((c) => (
                        <option key={c.id} value={c.id} style={{ background: "#0A0F1E" }}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Süre */}
                  <div>
                    <label className="block text-xs text-slate-500 mb-2">Uçuş Süresi</label>
                    <div className="flex flex-wrap gap-2">
                      {FLIGHT_DURATIONS.map((d) => (
                        <button
                          key={d.label}
                          onClick={() => setDurationOpt(d)}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                          style={
                            durationOpt.label === d.label
                              ? {
                                  background: "rgba(124,58,237,0.25)",
                                  border: "1px solid rgba(124,58,237,0.5)",
                                  color: "#C4B5FD",
                                }
                              : {
                                  background: "rgba(255,255,255,0.04)",
                                  border: "1px solid rgba(255,255,255,0.08)",
                                  color: "#64748B",
                                }
                          }
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleCreate}
                    disabled={creating || !destination}
                    className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all disabled:opacity-50"
                    style={{
                      background: "linear-gradient(135deg, #7C3AED, #5B21B6)",
                      boxShadow: "0 4px 16px rgba(124,58,237,0.35)",
                    }}
                  >
                    {creating ? "Oluşturuluyor…" : "✈ Lobi Oluştur & Gir"}
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Aktif Lobiler ────────────────────────────────────────── */}
          {lobbies.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-20 gap-4"
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
                const memberCount  = Object.keys(lobby.members ?? {}).length;
                const isCreator    = lobby.createdBy === currentUsername;
                const isStarting   = lobby.status === "starting";
                const readyCount   = Object.values(lobby.members ?? {}).filter((m) => m.ready).length;

                return (
                  <motion.div
                    key={lobby.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-2xl p-5 space-y-4"
                    style={{
                      background: isStarting
                        ? "rgba(74,222,128,0.05)"
                        : "rgba(255,255,255,0.03)",
                      border: isStarting
                        ? "1px solid rgba(74,222,128,0.18)"
                        : "1px solid rgba(255,255,255,0.07)",
                    }}
                  >
                    {/* Üst satır: rota + durum */}
                    <div className="flex items-start gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                        style={{
                          background: isStarting
                            ? "rgba(74,222,128,0.12)"
                            : "rgba(255,255,255,0.05)",
                          border: isStarting
                            ? "1px solid rgba(74,222,128,0.25)"
                            : "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        ✈
                      </div>
                      <div className="flex-1 min-w-0">
                        <div
                          className="font-semibold text-white text-sm truncate"
                          style={{ fontFamily: "Space Grotesk, sans-serif" }}
                        >
                          {lobby.departure?.name ?? "?"} → {lobby.destination?.name ?? "?"}
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-[10px] text-slate-500">
                            {lobby.durationOption?.label ?? ""}
                          </span>
                          <span className="text-[10px] text-slate-700">·</span>
                          <span className="text-[10px] text-slate-500">
                            {readyCount}/{memberCount} hazır
                          </span>
                          {isCreator && (
                            <>
                              <span className="text-[10px] text-slate-700">·</span>
                              <span
                                className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                style={{
                                  background: "rgba(99,102,241,0.15)",
                                  border: "1px solid rgba(99,102,241,0.25)",
                                  color: "#818CF8",
                                }}
                              >
                                Kaptan
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div
                        className="shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full"
                        style={
                          isStarting
                            ? { background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ADE80" }
                            : { background: "rgba(148,163,184,0.07)", border: "1px solid rgba(148,163,184,0.1)", color: "#64748B" }
                        }
                      >
                        {isStarting ? "✈ Kalkış" : "⏳ Bekleniyor"}
                      </div>
                    </div>

                    {/* Üyeler */}
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(lobby.members ?? {}).map(([uname, member]) => (
                        <div
                          key={uname}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium"
                          style={{
                            background: uname === currentUsername
                              ? "rgba(99,102,241,0.12)"
                              : "rgba(255,255,255,0.05)",
                            border: uname === currentUsername
                              ? "1px solid rgba(99,102,241,0.25)"
                              : "1px solid rgba(255,255,255,0.07)",
                            color: uname === currentUsername ? "#818CF8" : "#94A3B8",
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: member.ready ? "#4ADE80" : "#475569" }}
                          />
                          {uname === currentUsername ? "Sen" : uname}
                          {member.seat && (
                            <span className="opacity-50">· {member.seat}</span>
                          )}
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
                          background: "linear-gradient(135deg, rgba(124,58,237,0.2), rgba(59,130,246,0.12))",
                          border: "1px solid rgba(124,58,237,0.3)",
                          color: "#C4B5FD",
                        }}
                      >
                        Lobiye Git →
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={async () => {
                          if (!currentUsername) return;
                          await leaveLobby(lobby.id, currentUsername);
                        }}
                        className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                        style={{
                          background: "rgba(239,68,68,0.07)",
                          border: "1px solid rgba(239,68,68,0.15)",
                          color: "#F87171",
                        }}
                      >
                        Ayrıl
                      </motion.button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
