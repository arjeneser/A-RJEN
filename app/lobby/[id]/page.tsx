"use client";
import { useEffect, useRef, useState, useCallback } from "react";
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
  sendLobbyMessage,
  subscribeToLobbyMessages,
  type Lobby,
  type LobbyMessage,
} from "@/lib/lobby";

// ── Seat grid constants ────────────────────────────────────────────────────────
const ROWS = 24;
const COLS = ["A", "B", "C", "D", "E", "F"] as const;
type Col = (typeof COLS)[number];

const MEMBER_COLORS = [
  "#3B82F6", "#A855F7", "#EC4899", "#F59E0B",
  "#10B981", "#EF4444", "#06B6D4", "#8B5CF6",
];

function seatId(row: number, col: Col) { return `${row}${col}`; }

// ── Web Audio bip sesi ────────────────────────────────────────────────────────
function playBeep(freq = 880, duration = 0.18, vol = 0.25) {
  try {
    const ctx  = new AudioContext();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch { /* ses izni yoksa sessizce geç */ }
}

function playLaunchSound() {
  // Kalkış fanfarı: yükselen 3 nota
  [440, 554, 659].forEach((f, i) => {
    setTimeout(() => playBeep(f, 0.22, 0.3), i * 180);
  });
}

export default function LobbyPage() {
  const params   = useParams<{ id: string }>();
  const lobbyId  = params.id;
  const router   = useRouter();
  const { currentUsername }                   = useAuthStore();
  const { joinFlight, setSeat, setBreakSettings } = useFlightSetup();

  const [lobby, setLobby]         = useState<Lobby | null>(null);
  const [loading, setLoading]     = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Chat
  const [messages, setMessages]   = useState<LobbyMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatOpen, setChatOpen]   = useState(false);
  const chatEndRef                = useRef<HTMLDivElement>(null);

  const startedRef     = useRef(false);
  const prevReadyRef   = useRef<Set<string>>(new Set());

  // ── Join + subscribe lobby ────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUsername || !lobbyId) return;
    joinLobby(lobbyId, currentUsername).catch(() => {});
    const unsub = subscribeToLobby(lobbyId, (data) => {
      setLobby(data);
      setLoading(false);
    });
    return unsub;
  }, [lobbyId, currentUsername]);

  // ── Subscribe chat ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!lobbyId) return;
    return subscribeToLobbyMessages(lobbyId, setMessages);
  }, [lobbyId]);

  // Chat scroll-to-bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Sesli bildirim: biri hazır olunca bip ────────────────────────────────
  useEffect(() => {
    if (!lobby) return;
    const currentReady = new Set(
      Object.entries(lobby.members)
        .filter(([, m]) => m.ready)
        .map(([n]) => n)
    );
    const prev = prevReadyRef.current;
    currentReady.forEach((name) => {
      if (!prev.has(name) && name !== currentUsername) {
        playBeep(660, 0.15, 0.2);
      }
    });
    prevReadyRef.current = currentReady;
  }, [lobby, currentUsername]);

  // ── Uçuş başlayınca geri sayım başlat ────────────────────────────────────
  useEffect(() => {
    if (!lobby || startedRef.current) return;
    if (lobby.status === "starting") {
      startedRef.current = true;
      const mySeat = currentUsername ? lobby.members[currentUsername]?.seat ?? null : null;
      // Uçuş verilerini hemen set et (geri sayım bitmeden hazır olsun)
      joinFlight(lobby.departure, lobby.destination, lobby.durationOption);
      setBreakSettings(0, 0); // lobi uçuşlarında mola yok (sonradan ayarlanabilir)
      if (mySeat) setSeat(mySeat);
      playLaunchSound();
      setCountdown(3);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobby?.status]);

  // ── Geri sayım tick ───────────────────────────────────────────────────────
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      router.push("/focus");
      return;
    }
    const t = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, router]);

  // ── Copy link ─────────────────────────────────────────────────────────────
  function copyLink() {
    const url = `${window.location.origin}/lobby/${lobbyId}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  }

  // ── Chat submit ───────────────────────────────────────────────────────────
  async function handleChatSend(e: React.FormEvent) {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || !currentUsername) return;
    setChatInput("");
    await sendLobbyMessage(lobbyId, currentUsername, text);
  }

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

  const members     = Object.entries(lobby.members);
  const memberNames = members.map(([n]) => n);
  const colorOf     = (name: string) => MEMBER_COLORS[memberNames.indexOf(name) % MEMBER_COLORS.length];

  const takenByOthers = new Map<string, string>();
  members.forEach(([name, info]) => {
    if (name !== currentUsername && info.seat) takenByOthers.set(info.seat, name);
  });

  const myInfo       = currentUsername ? lobby.members[currentUsername] : null;
  const mySeat       = myInfo?.seat ?? null;
  const myReady      = myInfo?.ready ?? false;
  const isCreator    = lobby.createdBy === currentUsername;
  const allReady     = members.every(([, info]) => info.ready);
  const allHaveSeats = members.every(([, info]) => !!info.seat);
  const readyCount   = members.filter(([, i]) => i.ready).length;
  const unreadCount  = chatOpen ? 0 : messages.length;

  async function handleSeatClick(id: string) {
    if (!currentUsername) return;
    if (takenByOthers.has(id)) return;
    const next = mySeat === id ? null : id;
    await pickLobbySeat(lobbyId, currentUsername, next ?? "");
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
      {/* ── Geri sayım overlay ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {countdown !== null && (
          <motion.div
            key="countdown"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center"
            style={{ background: "rgba(7,9,24,0.95)", backdropFilter: "blur(12px)" }}
          >
            <motion.div
              key={countdown}
              initial={{ scale: 2.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="text-center"
            >
              {countdown > 0 ? (
                <>
                  <div
                    className="text-[120px] font-black leading-none"
                    style={{
                      fontFamily: "Space Grotesk, sans-serif",
                      background: "linear-gradient(135deg, #7C3AED, #3B82F6)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    {countdown}
                  </div>
                  <div className="text-slate-400 text-lg mt-2 tracking-widest uppercase">
                    Kalkışa hazırlan
                  </div>
                </>
              ) : (
                <>
                  <div className="text-8xl mb-4">🛫</div>
                  <div
                    className="text-3xl font-bold text-white"
                    style={{ fontFamily: "Space Grotesk, sans-serif" }}
                  >
                    KALKIŞ!
                  </div>
                </>
              )}
            </motion.div>

            <div className="flex gap-2 mt-12">
              {members.map(([name]) => (
                <motion.div
                  key={name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{ background: `${colorOf(name)}20`, border: `1px solid ${colorOf(name)}60`, color: colorOf(name) }}
                >
                  ✈ {name === currentUsername ? "Sen" : name}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">✈</span>
                <div>
                  <div className="text-white font-bold text-lg" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                    {lobby.departure.name} → {lobby.destination.name}
                  </div>
                  <div className="text-slate-400 text-sm">
                    {lobby.durationOption.label} · +{lobby.durationOption.xpReward} XP
                  </div>
                </div>
              </div>

              {/* Copy link */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={copyLink}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all"
                style={linkCopied
                  ? { background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.35)", color: "#4ADE80" }
                  : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#94A3B8" }
                }
              >
                {linkCopied ? "✓ Kopyalandı" : "🔗 Link Kopyala"}
              </motion.button>
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
                  {info.seat && <span className="opacity-70">· {info.seat}</span>}
                  {info.ready && <span className="ml-0.5">✓</span>}
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
                <div className="w-4 h-3.5 rounded border opacity-70"
                  style={{ background: `${colorOf(name)}44`, borderColor: colorOf(name) }} />
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
                        const id      = seatId(row, col);
                        const takenBy = takenByOthers.get(id);
                        const isMine  = mySeat === id;
                        const isTaken = !!takenBy;

                        let btnStyle: React.CSSProperties = {};
                        let cls = "w-8 h-6 rounded text-[9px] font-medium transition-all duration-150 border ";

                        if (isMine) {
                          cls += "scale-110";
                          btnStyle = { background: "#EAB308", borderColor: "#FACC15", color: "#78350F" };
                        } else if (isTaken) {
                          cls += "cursor-not-allowed";
                          btnStyle = { background: `${colorOf(takenBy!)}33`, borderColor: colorOf(takenBy!), opacity: 0.7 };
                        } else {
                          cls += "hover:scale-105";
                          btnStyle = { background: "rgba(30,58,138,0.6)", borderColor: "rgba(59,130,246,0.5)", color: "#94A3B8" };
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
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleToggleReady}
              disabled={!mySeat}
              className="w-full py-3 rounded-2xl font-bold text-white transition-all disabled:opacity-40"
              style={myReady
                ? { background: "linear-gradient(135deg, #16A34A, #15803D)", boxShadow: "0 4px 16px rgba(22,163,74,0.4)" }
                : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }
              }
            >
              {myReady ? "✓ Hazırım — iptal et" : mySeat ? `Hazırım (Koltuk ${mySeat})` : "Önce koltuk seç"}
            </motion.button>

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
                    : `Bekleniyor (${readyCount}/${members.length} hazır)`}
                </motion.button>
              )}
            </AnimatePresence>

            {!isCreator && (
              <div className="text-center text-xs text-slate-600 py-1">
                {allReady
                  ? `${lobby.createdBy} uçuşu başlatacak…`
                  : `${lobby.createdBy}'nin uçuşu başlatması bekleniyor`}
              </div>
            )}
          </div>

          {/* ── Chat ────────────────────────────────────────────────────── */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(124,58,237,0.2)", background: "rgba(255,255,255,0.02)" }}
          >
            {/* Chat header */}
            <button
              onClick={() => setChatOpen(!chatOpen)}
              className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/[0.02]"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-300">💬 Lobi Sohbeti</span>
                {messages.length > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.3)", color: "#A78BFA" }}>
                    {messages.length}
                  </span>
                )}
              </div>
              <span className="text-slate-600 text-xs">{chatOpen ? "▲" : "▼"}</span>
            </button>

            <AnimatePresence>
              {chatOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  {/* Messages */}
                  <div
                    className="max-h-[220px] overflow-y-auto px-3 py-2 space-y-2"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    {messages.length === 0 ? (
                      <div className="text-center text-xs text-slate-600 py-4">
                        Henüz mesaj yok. İlk sen yaz!
                      </div>
                    ) : (
                      messages.map((msg) => {
                        const isMe = msg.username === currentUsername;
                        const color = colorOf(msg.username);
                        return (
                          <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                            <div
                              className="max-w-[80%] px-3 py-2 rounded-2xl text-sm"
                              style={isMe
                                ? { background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.3)", color: "#E2E8F0" }
                                : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#CBD5E1" }
                              }
                            >
                              {!isMe && (
                                <div className="text-[10px] font-bold mb-0.5" style={{ color }}>
                                  {msg.username}
                                </div>
                              )}
                              <div className="break-words">{msg.text}</div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Input */}
                  <form
                    onSubmit={handleChatSend}
                    className="flex gap-2 px-3 py-2.5"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Mesaj yaz…"
                      maxLength={200}
                      className="flex-1 px-3 py-2 rounded-xl text-sm text-white placeholder-slate-500 outline-none"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim()}
                      className="px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                      style={{
                        background: "linear-gradient(135deg, #7C3AED, #5B21B6)",
                        color: "white",
                      }}
                    >
                      ↑
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Boşluk ──────────────────────────────────────────────────── */}
          <div className="h-4" />
        </div>
      </div>
    </AuthGuard>
  );
}
