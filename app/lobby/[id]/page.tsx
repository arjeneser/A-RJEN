"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/store/auth-store";
import { useFlightSetup } from "@/store/flight-store";
import { AuthGuard } from "@/components/auth/auth-guard";
import {
  subscribeToLobby,
  joinLobby,
  pickLobbySeat,
  setLobbyReady,
  startLobby,
  type Lobby,
} from "@/lib/lobby";

// ── Seat grid constants ────────────────────────────────────────────────────────
const ROWS = 24;
const COLS = ["A", "B", "C", "D", "E", "F"] as const;
type Col = (typeof COLS)[number];

// Renkler per member (deterministic by index)
const MEMBER_COLORS = [
  "#3B82F6", "#A855F7", "#EC4899", "#F59E0B",
  "#10B981", "#EF4444", "#06B6D4", "#8B5CF6",
];

function seatId(row: number, col: Col) {
  return `${row}${col}`;
}

export default function LobbyPage() {
  const params   = useParams<{ id: string }>();
  const lobbyId  = params.id;
  const router   = useRouter();
  const { currentUsername }      = useAuthStore();
  const { joinFlight, setDuration, setSeat } = useFlightSetup();

  const [lobby, setLobby]     = useState<Lobby | null>(null);
  const [loading, setLoading] = useState(true);
  const startedRef            = useRef(false);

  // Join + subscribe
  useEffect(() => {
    if (!currentUsername || !lobbyId) return;

    joinLobby(lobbyId, currentUsername).catch(() => {});

    const unsub = subscribeToLobby(lobbyId, (data) => {
      setLobby(data);
      setLoading(false);
    });

    return unsub;
  }, [lobbyId, currentUsername]);

  // Uçuş başlayınca tüm üyeler /focus'a git
  useEffect(() => {
    if (!lobby || startedRef.current) return;
    if (lobby.status === "starting") {
      startedRef.current = true;
      const mySeat = currentUsername ? lobby.members[currentUsername]?.seat ?? null : null;
      joinFlight(lobby.departure, lobby.destination);
      setDuration(lobby.durationOption);
      if (mySeat) setSeat(mySeat);
      router.push("/focus");
    }
  }, [lobby?.status]);

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-slate-500 text-sm animate-pulse">Lobi yükleniyor…</div>
        </div>
      </AuthGuard>
    );
  }

  if (!lobby) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-slate-500 text-sm">Lobi bulunamadı.</div>
        </div>
      </AuthGuard>
    );
  }

  const members      = Object.entries(lobby.members);
  const memberNames  = members.map(([n]) => n);
  const colorOf      = (name: string) => MEMBER_COLORS[memberNames.indexOf(name) % MEMBER_COLORS.length];

  // Alınan koltuklar (başkaları tarafından)
  const takenByOthers = new Map<string, string>(); // seatId → username
  members.forEach(([name, info]) => {
    if (name !== currentUsername && info.seat) takenByOthers.set(info.seat, name);
  });

  const myInfo       = currentUsername ? lobby.members[currentUsername] : null;
  const mySeat       = myInfo?.seat ?? null;
  const myReady      = myInfo?.ready ?? false;
  const isCreator    = lobby.createdBy === currentUsername;
  const allReady     = members.every(([, info]) => info.ready);
  const allHaveSeats = members.every(([, info]) => !!info.seat);

  async function handleSeatClick(id: string) {
    if (!currentUsername) return;
    if (takenByOthers.has(id)) return; // başkasının koltuğu
    const next = mySeat === id ? null : id;
    await pickLobbySeat(lobbyId, currentUsername, next ?? "");
    // ready state'i sıfırla koltuk değişince
    if (myReady) await setLobbyReady(lobbyId, currentUsername, false);
  }

  async function handleToggleReady() {
    if (!currentUsername || !mySeat) return;
    await setLobbyReady(lobbyId, currentUsername, !myReady);
  }

  async function handleStart() {
    if (!isCreator || !allReady || !allHaveSeats) return;
    await startLobby(lobbyId);
  }

  return (
    <AuthGuard>
    <div className="min-h-screen pt-20 pb-10 px-4">
      <div className="max-w-lg mx-auto space-y-5">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-5"
          style={{
            background: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(59,130,246,0.08))",
            border: "1px solid rgba(124,58,237,0.3)",
          }}
        >
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">✈</span>
            <div>
              <div
                className="text-white font-bold text-lg"
                style={{ fontFamily: "Space Grotesk, sans-serif" }}
              >
                {lobby.departure.name} → {lobby.destination.name}
              </div>
              <div className="text-slate-400 text-sm">
                {lobby.durationOption.label} · +{lobby.durationOption.xpReward} XP
              </div>
            </div>
          </div>

          {/* Members row */}
          <div className="flex flex-wrap gap-2">
            {members.map(([name, info]) => (
              <div
                key={name}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{
                  background: `${colorOf(name)}18`,
                  border: `1px solid ${colorOf(name)}44`,
                  color: colorOf(name),
                }}
              >
                {name === currentUsername ? "Sen" : name}
                {info.seat && (
                  <span className="opacity-70">· {info.seat}</span>
                )}
                {info.ready && (
                  <span className="ml-0.5">✓</span>
                )}
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Legend ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-3.5 rounded bg-blue-900/60 border border-blue-700/60" />
            Uygun
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-3.5 rounded bg-yellow-500 border border-yellow-400" />
            Senin koltuğun
          </div>
          {members.filter(([n]) => n !== currentUsername).slice(0, 4).map(([name]) => (
            <div key={name} className="flex items-center gap-1.5">
              <div
                className="w-4 h-3.5 rounded border opacity-70"
                style={{ background: `${colorOf(name)}44`, borderColor: colorOf(name) }}
              />
              {name}
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-3.5 rounded bg-slate-800/50 border border-white/5 opacity-40" />
            Dolu
          </div>
        </div>

        {/* ── Seat grid ───────────────────────────────────────────────── */}
        <div className="overflow-x-auto">
          <div className="min-w-[320px]">
            {/* Column headers */}
            <div className="flex items-center gap-1 mb-1 pl-10">
              {COLS.map((col) => (
                <div key={col} className="flex items-center gap-1">
                  <div className="w-8 text-center text-[10px] text-slate-600 font-medium">{col}</div>
                  {col === "C" && <div className="w-5" />}
                </div>
              ))}
            </div>

            <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
              {Array.from({ length: ROWS }, (_, i) => {
                const row = i + 1;
                return (
                  <div key={row} className="flex items-center gap-1">
                    <div className="w-9 text-center text-[10px] text-slate-600">{row}</div>
                    {COLS.map((col) => {
                      const id        = seatId(row, col);
                      const takenBy   = takenByOthers.get(id);
                      const isMine    = mySeat === id;
                      const isTaken   = !!takenBy;

                      let btnStyle: React.CSSProperties = {};
                      let cls = "w-8 h-6 rounded text-[9px] font-medium transition-all duration-150 border ";

                      if (isMine) {
                        cls += "scale-110";
                        btnStyle = { background: "#EAB308", borderColor: "#FACC15", color: "#78350F" };
                      } else if (isTaken) {
                        cls += "cursor-not-allowed";
                        btnStyle = {
                          background: `${colorOf(takenBy!)}33`,
                          borderColor: colorOf(takenBy!),
                          opacity: 0.7,
                        };
                      } else {
                        cls += "hover:scale-105";
                        btnStyle = {
                          background: "rgba(30,58,138,0.6)",
                          borderColor: "rgba(59,130,246,0.5)",
                          color: "#94A3B8",
                        };
                      }

                      return (
                        <div key={col} className="flex items-center gap-1">
                          <button
                            disabled={isTaken}
                            onClick={() => handleSeatClick(id)}
                            className={cls}
                            style={btnStyle}
                            title={isTaken ? takenBy : undefined}
                          >
                            {isTaken ? "" : col}
                          </button>
                          {col === "C" && <div className="w-5" />}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Actions ─────────────────────────────────────────────────── */}
        <div className="space-y-3 pt-1">
          {/* Ready toggle */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleToggleReady}
            disabled={!mySeat}
            className="w-full py-3 rounded-2xl font-bold text-white transition-all disabled:opacity-40"
            style={
              myReady
                ? {
                    background: "linear-gradient(135deg, #16A34A, #15803D)",
                    boxShadow: "0 4px 16px rgba(22,163,74,0.4)",
                  }
                : {
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }
            }
          >
            {myReady ? "✓ Hazırım — iptal et" : mySeat ? `Hazırım (Koltuk ${mySeat})` : "Önce koltuk seç"}
          </motion.button>

          {/* Start button (only creator) */}
          <AnimatePresence>
            {isCreator && (
              <motion.button
                key="start"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleStart}
                disabled={!allReady || !allHaveSeats}
                className="w-full py-3 rounded-2xl font-bold text-white transition-all disabled:opacity-35"
                style={{
                  background: allReady && allHaveSeats
                    ? "linear-gradient(135deg, #7C3AED, #5B21B6)"
                    : "rgba(124,58,237,0.12)",
                  border: "1px solid rgba(124,58,237,0.35)",
                  boxShadow: allReady && allHaveSeats ? "0 4px 20px rgba(124,58,237,0.45)" : "none",
                }}
              >
                {allReady && allHaveSeats
                  ? "✈ Uçuşu Başlat"
                  : `Bekleniyor (${members.filter(([, i]) => i.ready).length}/${members.length} hazır)`}
              </motion.button>
            )}
          </AnimatePresence>

          {/* Non-creator waiting message */}
          {!isCreator && (
            <div className="text-center text-xs text-slate-600 py-1">
              {allReady
                ? `${lobby.createdBy} uçuşu başlatacak…`
                : `${lobby.createdBy}'nin uçuşu başlatması bekleniyor`}
            </div>
          )}
        </div>
      </div>
    </div>
    </AuthGuard>
  );
}
