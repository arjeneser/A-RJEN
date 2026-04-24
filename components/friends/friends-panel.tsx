"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { useFlightSetup } from "@/store/flight-store";
import { useUserStore } from "@/store/user-store";
import {
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  subscribeToIncomingRequests,
  subscribeToFriends,
  type FriendRequest,
  type FriendInfo,
} from "@/lib/friends";
import { sendMessage, subscribeToMessages, type ChatMessage } from "@/lib/messages";
import {
  sendFlightInvite,
  removeFlightInvite,
  subscribeToFlightInvites,
  type FlightInvite,
} from "@/lib/flight-invites";
import {
  getDepartureCities,
  getReachableDestinations,
  FLIGHT_DURATIONS,
} from "@/data/cities";
import type { City, FlightDurationOption } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type View = "main" | "chat" | "propose" | "leaderboard";

interface FriendsPanelProps {
  open: boolean;
  onClose: () => void;
  onNotificationCount?: (n: number) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "şimdi";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}dk`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}sa`;
  return `${Math.floor(diff / 86_400_000)}g`;
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function FriendsPanel({ open, onClose, onNotificationCount }: FriendsPanelProps) {
  const { currentUsername } = useAuthStore();
  const { joinFlight, setDuration } = useFlightSetup();
  const { profile: myProfile } = useUserStore();
  const router = useRouter();

  // ── views & selected friend ──────────────────────────────────────────────────
  const [view, setView]               = useState<View>("main");
  const [activeFriend, setActiveFriend] = useState<string | null>(null);

  // ── main view state ──────────────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState("");
  const [reqStatus, setReqStatus]     = useState<{ msg: string; ok: boolean } | null>(null);
  const [sending, setSending]         = useState(false);
  const [incomingReqs, setIncomingReqs]   = useState<FriendRequest[]>([]);
  const [friends, setFriends]             = useState<FriendInfo[]>([]);
  const [flightInvites, setFlightInvites] = useState<FlightInvite[]>([]);

  // ── chat view state ──────────────────────────────────────────────────────────
  const [messages, setMessages]   = useState<ChatMessage[]>([]);
  const [msgInput, setMsgInput]   = useState("");
  const chatEndRef                = useRef<HTMLDivElement>(null);
  const msgInputRef               = useRef<HTMLInputElement>(null);

  // ── propose view state ───────────────────────────────────────────────────────
  const departureCities            = getDepartureCities();
  const [propDeparture, setPropDeparture] = useState<City | null>(null);
  const [propDuration, setPropDuration]   = useState<FlightDurationOption | null>(null);
  const [propDestination, setPropDestination] = useState<City | null>(null);
  const [propSending, setPropSending]     = useState(false);
  const [propSent, setPropSent]           = useState(false);
  // Multi-invite: extra friends to send same invite to (besides activeFriend)
  const [extraInvitees, setExtraInvitees] = useState<string[]>([]);

  const reachable = propDeparture && propDuration
    ? getReachableDestinations(propDeparture, propDuration)
    : [];

  // ── Firebase subscriptions ───────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUsername || !open) return;
    const u1 = subscribeToIncomingRequests(currentUsername, setIncomingReqs);
    const u2 = subscribeToFriends(currentUsername, setFriends);
    const u3 = subscribeToFlightInvites(currentUsername, setFlightInvites);
    return () => { u1(); u2(); u3(); };
  }, [currentUsername, open]);

  // ── Notify parent of badge count ─────────────────────────────────────────────
  useEffect(() => {
    onNotificationCount?.(incomingReqs.length + flightInvites.length);
  }, [incomingReqs, flightInvites, onNotificationCount]);

  // ── Chat subscription ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUsername || !activeFriend || view !== "chat") return;
    const unsub = subscribeToMessages(currentUsername, activeFriend, setMessages);
    return unsub;
  }, [currentUsername, activeFriend, view]);

  // ── Auto-scroll chat to bottom ────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Focus message input when chat opens ───────────────────────────────────────
  useEffect(() => {
    if (view === "chat") setTimeout(() => msgInputRef.current?.focus(), 150);
  }, [view]);

  // ── Reset to main when panel closes ─────────────────────────────────────────
  useEffect(() => {
    if (!open) { setView("main"); setActiveFriend(null); }
  }, [open]);

  // ─── Actions ──────────────────────────────────────────────────────────────────

  async function handleSendFriendRequest() {
    if (!currentUsername || !searchInput.trim() || sending) return;
    setSending(true);
    const target = searchInput.trim().toLowerCase();
    const result = await sendFriendRequest(currentUsername, target);
    setSending(false);
    const map = {
      ok:              { msg: `✓ ${target} kullanıcısına istek gönderildi`, ok: true },
      not_found:       { msg: `✗ "${target}" kullanıcısı bulunamadı`, ok: false },
      already_friends: { msg: `✓ ${target} zaten arkadaşınız`, ok: true },
      self:            { msg: `✗ Kendinize istek gönderemezsiniz`, ok: false },
    };
    setReqStatus(map[result]);
    if (result === "ok") setSearchInput("");
    setTimeout(() => setReqStatus(null), 4000);
  }

  async function handleSendMessage() {
    if (!currentUsername || !activeFriend || !msgInput.trim()) return;
    const text = msgInput.trim();
    setMsgInput("");
    await sendMessage(currentUsername, activeFriend, text);
  }

  function openChat(username: string) {
    setActiveFriend(username);
    setMessages([]);
    setView("chat");
  }

  function openPropose(username: string) {
    setActiveFriend(username);
    setPropDeparture(null);
    setPropDuration(null);
    setPropDestination(null);
    setPropSent(false);
    setExtraInvitees([]);
    setView("propose");
  }

  async function handleSendInvite() {
    if (!currentUsername || !activeFriend || !propDeparture || !propDuration || !propDestination) return;
    setPropSending(true);
    // Send to activeFriend + any extra group members
    const allRecipients = [activeFriend, ...extraInvitees];
    await Promise.all(
      allRecipients.map((r) =>
        sendFlightInvite(currentUsername, r, propDeparture, propDestination, propDuration)
      )
    );
    setPropSending(false);
    setPropSent(true);
    setTimeout(() => { setView("chat"); setPropSent(false); }, 1800);
  }

  async function handleAcceptInvite(invite: FlightInvite) {
    if (!currentUsername) return;
    joinFlight(invite.departure, invite.destination);
    setDuration(invite.durationOption);
    await removeFlightInvite(currentUsername, invite.id);
    router.push("/new-flight");
    onClose();
  }

  function handleJoinFlight(friend: FriendInfo) {
    if (!friend.flight) return;
    joinFlight(friend.flight.departure, friend.flight.destination);
    router.push("/new-flight");
    onClose();
  }

  // ─── Derived ─────────────────────────────────────────────────────────────────

  const flyingFriends   = friends.filter((f) => f.isFlying);
  const groundedFriends = friends.filter((f) => !f.isFlying);
  const activeFriendInfo = friends.find((f) => f.username === activeFriend);
  const totalNotifs = incomingReqs.length + flightInvites.length;

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed top-0 right-0 bottom-0 z-50 flex flex-col"
            style={{
              width: 360,
              background: "linear-gradient(180deg, #0A0F1E 0%, #070918 100%)",
              borderLeft: "1px solid rgba(255,255,255,0.07)",
              boxShadow: "-20px 0 60px rgba(0,0,0,0.5)",
            }}
          >
            {/* ── Header ──────────────────────────────────────────────── */}
            <div
              className="flex items-center gap-3 px-4 py-3.5 shrink-0"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >
              {view !== "main" && (
                <button
                  onClick={() => setView("main")}
                  className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-white transition-colors shrink-0"
                  style={{ background: "rgba(255,255,255,0.05)" }}
                >
                  ←
                </button>
              )}

              <div className="flex-1 flex items-center gap-2 min-w-0">
                {view === "main"        && <span className="text-base">👥</span>}
                {view === "chat"        && <span className="text-base">💬</span>}
                {view === "propose"     && <span className="text-base">✈</span>}
                {view === "leaderboard" && <span className="text-base">🏆</span>}

                <span
                  className="font-bold text-white text-sm truncate"
                  style={{ fontFamily: "Space Grotesk, sans-serif" }}
                >
                  {view === "main"
                    ? "Arkadaşlar"
                    : view === "chat"
                    ? activeFriend
                    : view === "leaderboard"
                    ? "Sıralama"
                    : `${activeFriend}'a Uçuş Teklif Et`}
                </span>

                {view === "main" && totalNotifs > 0 && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0"
                    style={{ background: "rgba(239,68,68,0.25)", color: "#F87171" }}
                  >
                    {totalNotifs}
                  </span>
                )}
              </div>

              {view === "chat" && (
                <button
                  onClick={() => openPropose(activeFriend!)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white shrink-0 transition-all hover:opacity-90"
                  style={{
                    background: "linear-gradient(135deg, #7C3AED, #5B21B6)",
                    boxShadow: "0 2px 10px rgba(124,58,237,0.3)",
                  }}
                  title="Uçuş Teklif Et"
                >
                  ✈ Teklif Et
                </button>
              )}

              <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded-full text-slate-500 hover:text-white transition-colors shrink-0"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                ✕
              </button>
            </div>

            {/* ── View content ────────────────────────────────────────── */}
            <AnimatePresence mode="wait">

              {/* ════════════ MAIN VIEW ════════════ */}
              {view === "main" && (
                <motion.div
                  key="main"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.18 }}
                  className="flex-1 overflow-y-auto px-4 py-3 space-y-4"
                >
                  {/* ── Top actions row ────────────────────────────── */}
                  <div className="flex justify-between items-center">
                    <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                      Arkadaş Ekle
                    </div>
                    <button
                      onClick={() => setView("leaderboard")}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                      style={{
                        background: "rgba(245,158,11,0.1)",
                        border: "1px solid rgba(245,158,11,0.2)",
                        color: "#F59E0B",
                      }}
                    >
                      🏆 Sıralama
                    </button>
                  </div>

                  {/* ── Add Friend ─────────────────────────────────── */}
                  <div>
                    <div className="sr-only">Arkadaş Ekle</div>
                    <div className="flex gap-2">
                      <input
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSendFriendRequest()}
                        placeholder="Kullanıcı adı..."
                        className="flex-1 px-3 py-2 rounded-xl text-sm text-white placeholder-slate-600 outline-none focus:ring-1 focus:ring-sky-500/40"
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.09)",
                        }}
                      />
                      <button
                        onClick={handleSendFriendRequest}
                        disabled={!searchInput.trim() || sending}
                        className="px-3.5 py-2 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40 active:scale-95"
                        style={{
                          background: "linear-gradient(135deg, #3B82F6, #1D4ED8)",
                        }}
                      >
                        {sending ? "…" : "➤"}
                      </button>
                    </div>
                    <AnimatePresence>
                      {reqStatus && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="mt-2 px-3 py-1.5 rounded-lg text-xs font-medium"
                          style={{
                            background: reqStatus.ok ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                            border: `1px solid ${reqStatus.ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                            color: reqStatus.ok ? "#4ADE80" : "#F87171",
                          }}
                        >
                          {reqStatus.msg}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* ── Flight Invites ─────────────────────────────── */}
                  {flightInvites.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold text-purple-400/70 uppercase tracking-widest mb-2">
                        ✈ Uçuş Davetleri
                      </div>
                      <div className="space-y-2">
                        {flightInvites.map((inv) => (
                          <motion.div
                            key={inv.id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-3 rounded-xl"
                            style={{
                              background: "rgba(124,58,237,0.08)",
                              border: "1px solid rgba(124,58,237,0.25)",
                            }}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-semibold text-purple-300">{inv.from}</span>
                              <span className="text-[10px] text-slate-600">{timeAgo(inv.timestamp)}</span>
                            </div>
                            <div className="text-xs text-slate-400 mb-1">
                              {inv.departure.name} → {inv.destination.name}
                            </div>
                            <div className="text-[10px] text-slate-600 mb-2.5">
                              {inv.durationOption.label} · +{inv.durationOption.xpReward} XP
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleAcceptInvite(inv)}
                                className="flex-1 py-1.5 rounded-lg text-xs font-bold text-white"
                                style={{
                                  background: "linear-gradient(135deg, #7C3AED, #5B21B6)",
                                  boxShadow: "0 2px 8px rgba(124,58,237,0.35)",
                                }}
                              >
                                ✓ Kabul Et
                              </button>
                              <button
                                onClick={() => removeFlightInvite(currentUsername!, inv.id)}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                                style={{
                                  background: "rgba(255,255,255,0.05)",
                                  border: "1px solid rgba(255,255,255,0.08)",
                                  color: "#64748B",
                                }}
                              >
                                Reddet
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Incoming Friend Requests ───────────────────── */}
                  {incomingReqs.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold text-amber-400/70 uppercase tracking-widest mb-2">
                        Arkadaşlık İstekleri
                      </div>
                      <div className="space-y-2">
                        {incomingReqs.map((req) => (
                          <div
                            key={req.from}
                            className="flex items-center justify-between p-3 rounded-xl"
                            style={{
                              background: "rgba(245,158,11,0.06)",
                              border: "1px solid rgba(245,158,11,0.18)",
                            }}
                          >
                            <span className="text-sm font-medium text-slate-200">{req.from}</span>
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => acceptFriendRequest(currentUsername!, req.from)}
                                className="px-2.5 py-1 rounded-lg text-xs font-bold text-white"
                                style={{ background: "rgba(34,197,94,0.25)", border: "1px solid rgba(34,197,94,0.35)" }}
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => rejectFriendRequest(currentUsername!, req.from)}
                                className="px-2.5 py-1 rounded-lg text-xs"
                                style={{
                                  background: "rgba(239,68,68,0.1)",
                                  border: "1px solid rgba(239,68,68,0.25)",
                                  color: "#F87171",
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Flying Friends ─────────────────────────────── */}
                  {flyingFriends.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold text-sky-400/70 uppercase tracking-widest mb-2">
                        ✈ Şu An Uçuyor
                      </div>
                      <div className="space-y-2">
                        {flyingFriends.map((f) => (
                          <div
                            key={f.username}
                            className="p-3 rounded-xl"
                            style={{
                              background: "rgba(14,165,233,0.06)",
                              border: "1px solid rgba(14,165,233,0.2)",
                            }}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <button
                                onClick={() => openChat(f.username)}
                                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                              >
                                <div
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
                                  style={{
                                    background: "rgba(14,165,233,0.2)",
                                    border: "1px solid rgba(14,165,233,0.4)",
                                  }}
                                >✈</div>
                                <span className="text-sm font-semibold text-white">{f.username}</span>
                              </button>
                              <span
                                className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                                style={{
                                  background: "rgba(14,165,233,0.15)",
                                  border: "1px solid rgba(14,165,233,0.3)",
                                  color: "#38BDF8",
                                }}
                              >
                                UÇUYOR
                              </span>
                            </div>
                            {f.flight && (
                              <>
                                <div className="text-xs text-slate-500 mb-1.5">
                                  {f.flight.departure.name} → {f.flight.destination.name}
                                </div>
                                <div
                                  className="w-full h-1 rounded-full mb-2"
                                  style={{ background: "rgba(255,255,255,0.06)" }}
                                >
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${Math.round(f.flight.progress * 100)}%`,
                                      background: "linear-gradient(90deg, #3B82F6, #0EA5E9)",
                                    }}
                                  />
                                </div>
                                <button
                                  onClick={() => handleJoinFlight(f)}
                                  className="w-full py-1.5 rounded-lg text-xs font-bold text-white active:scale-[0.98] transition-all"
                                  style={{
                                    background: "linear-gradient(135deg, #7C3AED, #5B21B6)",
                                    boxShadow: "0 2px 8px rgba(124,58,237,0.3)",
                                  }}
                                >
                                  👥 Aynı Rotada Uç
                                </button>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Grounded Friends ───────────────────────────── */}
                  {groundedFriends.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2">
                        Arkadaşlar
                      </div>
                      <div className="space-y-1">
                        {groundedFriends.map((f) => (
                          <div
                            key={f.username}
                            className="flex items-center justify-between px-3 py-2.5 rounded-xl group cursor-pointer hover:bg-white/[0.03] transition-colors"
                            style={{ border: "1px solid rgba(255,255,255,0.05)" }}
                            onClick={() => openChat(f.username)}
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-slate-600"
                                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                              >
                                ✈
                              </div>
                              <span className="text-sm text-slate-300">{f.username}</span>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="text-[10px] text-slate-600">💬</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeFriend(currentUsername!, f.username);
                                }}
                                className="text-[10px] text-red-500/50 hover:text-red-400 transition-colors px-1.5 py-0.5 rounded"
                                style={{ background: "rgba(239,68,68,0.08)" }}
                              >
                                Çıkar
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Empty state ─────────────────────────────────── */}
                  {friends.length === 0 && incomingReqs.length === 0 && flightInvites.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-14 text-slate-600">
                      <span className="text-4xl mb-3">✈</span>
                      <p className="text-sm">Henüz arkadaşın yok.</p>
                      <p className="text-xs mt-1 text-slate-700 text-center">
                        Kullanıcı adıyla arkadaş ekle ve birlikte uç!
                      </p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ════════════ CHAT VIEW ════════════ */}
              {view === "chat" && (
                <motion.div
                  key="chat"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.18 }}
                  className="flex-1 flex flex-col min-h-0"
                >
                  {/* Flying banner */}
                  {activeFriendInfo?.isFlying && activeFriendInfo.flight && (
                    <div
                      className="mx-3 mt-3 px-3 py-2 rounded-xl flex items-center justify-between"
                      style={{
                        background: "rgba(14,165,233,0.07)",
                        border: "1px solid rgba(14,165,233,0.18)",
                      }}
                    >
                      <span className="text-xs text-sky-400 font-medium">
                        ✈ {activeFriendInfo.flight.departure.name} → {activeFriendInfo.flight.destination.name}
                      </span>
                      <button
                        onClick={() => handleJoinFlight(activeFriendInfo)}
                        className="text-[10px] px-2 py-1 rounded-lg font-bold text-white"
                        style={{ background: "rgba(124,58,237,0.4)", border: "1px solid rgba(124,58,237,0.5)" }}
                      >
                        Katıl
                      </button>
                    </div>
                  )}

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
                    {messages.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-full text-slate-700 py-12">
                        <span className="text-3xl mb-2">💬</span>
                        <p className="text-xs text-center">
                          Henüz mesaj yok.<br />Bir şeyler yaz!
                        </p>
                      </div>
                    )}
                    {messages.map((msg) => {
                      const isOwn = msg.from === currentUsername;
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className="max-w-[78%] px-3 py-2 rounded-2xl text-sm leading-snug"
                            style={
                              isOwn
                                ? {
                                    background: "linear-gradient(135deg, #1D4ED8, #2563EB)",
                                    color: "white",
                                    borderBottomRightRadius: 4,
                                  }
                                : {
                                    background: "rgba(255,255,255,0.07)",
                                    border: "1px solid rgba(255,255,255,0.09)",
                                    color: "#CBD5E1",
                                    borderBottomLeftRadius: 4,
                                  }
                            }
                          >
                            {msg.text}
                            <div
                              className="text-[9px] mt-0.5 opacity-50 text-right"
                            >
                              {timeAgo(msg.timestamp)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Input */}
                  <div
                    className="px-3 py-3 flex gap-2 shrink-0"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <input
                      ref={msgInputRef}
                      value={msgInput}
                      onChange={(e) => setMsgInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                      placeholder="Mesaj yaz..."
                      className="flex-1 px-3 py-2 rounded-xl text-sm text-white placeholder-slate-600 outline-none focus:ring-1 focus:ring-sky-500/40"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.09)",
                      }}
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!msgInput.trim()}
                      className="px-3.5 py-2 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-30 active:scale-95"
                      style={{ background: "linear-gradient(135deg, #3B82F6, #1D4ED8)" }}
                    >
                      ➤
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ════════════ PROPOSE VIEW ════════════ */}
              {view === "propose" && (
                <motion.div
                  key="propose"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.18 }}
                  className="flex-1 overflow-y-auto px-4 py-4"
                >
                  {propSent ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                      <span className="text-5xl">✈</span>
                      <p className="text-white font-semibold text-center">
                        Davet gönderildi!
                      </p>
                      <p className="text-slate-500 text-xs text-center">
                        {activeFriend} kabul edince birlikte kalkar siniz.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {/* Departure */}
                      <div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                          Kalkış Havalimanı
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {departureCities.map((city) => (
                            <button
                              key={city.id}
                              onClick={() => { setPropDeparture(city); setPropDuration(null); setPropDestination(null); }}
                              className="p-2.5 rounded-xl text-left transition-all active:scale-95"
                              style={
                                propDeparture?.id === city.id
                                  ? {
                                      background: "rgba(59,130,246,0.15)",
                                      border: "1px solid rgba(59,130,246,0.45)",
                                      color: "white",
                                    }
                                  : {
                                      background: "rgba(255,255,255,0.03)",
                                      border: "1px solid rgba(255,255,255,0.07)",
                                      color: "#94A3B8",
                                    }
                              }
                            >
                              <div className="text-xs font-semibold leading-tight">{city.name}</div>
                              <div className="text-[10px] opacity-60">{city.country}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Duration */}
                      {propDeparture && (
                        <div>
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                            Uçuş Süresi
                          </div>
                          <div className="grid grid-cols-4 gap-1.5">
                            {FLIGHT_DURATIONS.map((d) => (
                              <button
                                key={d.key}
                                onClick={() => { setPropDuration(d); setPropDestination(null); }}
                                className="py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
                                style={
                                  propDuration?.key === d.key
                                    ? {
                                        background: "rgba(59,130,246,0.18)",
                                        border: "1px solid rgba(59,130,246,0.45)",
                                        color: "white",
                                      }
                                    : {
                                        background: "rgba(255,255,255,0.03)",
                                        border: "1px solid rgba(255,255,255,0.07)",
                                        color: "#64748B",
                                      }
                                }
                              >
                                {d.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Destination */}
                      {propDeparture && propDuration && (
                        <div>
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                            Varış ({reachable.length} şehir)
                          </div>
                          {reachable.length === 0 ? (
                            <p className="text-xs text-slate-600">Bu süre için uygun varış bulunamadı.</p>
                          ) : (
                            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                              {reachable.map((city) => (
                                <button
                                  key={city.id}
                                  onClick={() => setPropDestination(city)}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all active:scale-[0.98]"
                                  style={
                                    propDestination?.id === city.id
                                      ? {
                                          background: "rgba(59,130,246,0.15)",
                                          border: "1px solid rgba(59,130,246,0.4)",
                                        }
                                      : {
                                          background: "rgba(255,255,255,0.03)",
                                          border: "1px solid rgba(255,255,255,0.06)",
                                        }
                                  }
                                >
                                  <img
                                    src={`https://flagcdn.com/w40/${city.countryCode.toLowerCase()}.png`}
                                    alt=""
                                    className="w-5 h-3 object-cover rounded-sm shrink-0"
                                  />
                                  <span className="text-xs text-slate-300 font-medium truncate">{city.name}</span>
                                  <span className="text-[10px] text-slate-600 ml-auto shrink-0">{city.country}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Group invite: select other friends */}
                      {propDeparture && propDuration && propDestination && (() => {
                        const otherFriends = friends.filter((f) => f.username !== activeFriend);
                        if (otherFriends.length === 0) return null;
                        return (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                              👥 Gruba Ekle (opsiyonel)
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {otherFriends.map((f) => {
                                const selected = extraInvitees.includes(f.username);
                                return (
                                  <button
                                    key={f.username}
                                    onClick={() =>
                                      setExtraInvitees((prev) =>
                                        selected
                                          ? prev.filter((u) => u !== f.username)
                                          : [...prev, f.username]
                                      )
                                    }
                                    className="px-2.5 py-1 rounded-full text-xs font-semibold transition-all"
                                    style={
                                      selected
                                        ? {
                                            background: "rgba(124,58,237,0.25)",
                                            border: "1px solid rgba(124,58,237,0.5)",
                                            color: "#C4B5FD",
                                          }
                                        : {
                                            background: "rgba(255,255,255,0.04)",
                                            border: "1px solid rgba(255,255,255,0.09)",
                                            color: "#64748B",
                                          }
                                    }
                                  >
                                    {selected ? "✓ " : "+ "}{f.username}
                                  </button>
                                );
                              })}
                            </div>
                          </motion.div>
                        );
                      })()}

                      {/* Send button */}
                      {propDeparture && propDuration && propDestination && (
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                          <div
                            className="p-3 rounded-xl mb-3 text-xs text-slate-400"
                            style={{
                              background: "rgba(124,58,237,0.07)",
                              border: "1px solid rgba(124,58,237,0.2)",
                            }}
                          >
                            <div className="font-semibold text-purple-300 mb-1">Özet</div>
                            <div>{propDeparture.name} → {propDestination.name}</div>
                            <div className="text-slate-500">{propDuration.label} · +{propDuration.xpReward} XP</div>
                            {extraInvitees.length > 0 && (
                              <div className="mt-1 text-purple-400/70">
                                👥 {[activeFriend, ...extraInvitees].join(", ")} kişiye gönderilecek
                              </div>
                            )}
                          </div>
                          <button
                            onClick={handleSendInvite}
                            disabled={propSending}
                            className="w-full py-3 rounded-2xl font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50"
                            style={{
                              background: "linear-gradient(135deg, #7C3AED, #5B21B6)",
                              boxShadow: "0 4px 20px rgba(124,58,237,0.4)",
                            }}
                          >
                            {propSending
                              ? "Gönderiliyor…"
                              : extraInvitees.length > 0
                              ? `✈ ${1 + extraInvitees.length} Kişiye Davet Gönder`
                              : `✈ ${activeFriend}'a Davet Gönder`}
                          </button>
                        </motion.div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
              {/* ════════════ LEADERBOARD VIEW ════════════ */}
              {view === "leaderboard" && (
                <motion.div
                  key="leaderboard"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.18 }}
                  className="flex-1 overflow-y-auto px-4 py-4"
                >
                  {/* Build combined list: self + friends with stats */}
                  {(() => {
                    const entries: { username: string; totalXP: number; totalFlights: number; currentStreak: number; isSelf: boolean }[] = [
                      {
                        username: currentUsername ?? "Sen",
                        totalXP: myProfile.totalXP,
                        totalFlights: myProfile.totalFlights,
                        currentStreak: myProfile.currentStreak,
                        isSelf: true,
                      },
                      ...friends
                        .filter((f) => f.stats)
                        .map((f) => ({
                          username: f.username,
                          totalXP: f.stats!.totalXP,
                          totalFlights: f.stats!.totalFlights,
                          currentStreak: f.stats!.currentStreak,
                          isSelf: false,
                        })),
                    ];

                    // Sort by XP descending
                    entries.sort((a, b) => b.totalXP - a.totalXP);

                    const medals = ["🥇", "🥈", "🥉"];

                    return (
                      <div className="space-y-2">
                        <div className="text-[10px] font-bold text-amber-400/70 uppercase tracking-widest mb-3">
                          XP Sıralaması
                        </div>
                        {entries.map((entry, i) => (
                          <motion.div
                            key={entry.username}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="flex items-center gap-3 p-3 rounded-xl"
                            style={{
                              background: entry.isSelf
                                ? "rgba(245,158,11,0.08)"
                                : "rgba(255,255,255,0.025)",
                              border: entry.isSelf
                                ? "1px solid rgba(245,158,11,0.2)"
                                : "1px solid rgba(255,255,255,0.05)",
                            }}
                          >
                            {/* Rank */}
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                              style={{
                                background: i < 3
                                  ? "rgba(245,158,11,0.15)"
                                  : "rgba(255,255,255,0.04)",
                                border: i < 3
                                  ? "1px solid rgba(245,158,11,0.3)"
                                  : "1px solid rgba(255,255,255,0.07)",
                                color: i < 3 ? "#F59E0B" : "#64748B",
                              }}
                            >
                              {i < 3 ? medals[i] : `#${i + 1}`}
                            </div>
                            {/* Name */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="text-sm font-semibold truncate"
                                  style={{ color: entry.isSelf ? "#F59E0B" : "#F1F5F9" }}
                                >
                                  {entry.username}
                                </span>
                                {entry.isSelf && (
                                  <span
                                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                                    style={{
                                      background: "rgba(245,158,11,0.15)",
                                      border: "1px solid rgba(245,158,11,0.3)",
                                      color: "#F59E0B",
                                    }}
                                  >
                                    SEN
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-600 mt-0.5">
                                {entry.totalFlights} uçuş · 🔥 {entry.currentStreak} gün
                              </div>
                            </div>
                            {/* XP */}
                            <div
                              className="text-sm font-bold shrink-0"
                              style={{ color: "#F59E0B", fontFamily: "Space Grotesk, sans-serif" }}
                            >
                              {entry.totalXP.toLocaleString()} XP
                            </div>
                          </motion.div>
                        ))}

                        {friends.filter((f) => !f.stats).length > 0 && (
                          <p className="text-center text-xs text-slate-700 pt-2">
                            {friends.filter((f) => !f.stats).length} arkadaşın henüz uçuşu yok
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </motion.div>
              )}

            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
