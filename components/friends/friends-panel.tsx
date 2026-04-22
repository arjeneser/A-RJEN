"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { useFlightSetup } from "@/store/flight-store";
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

interface FriendsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function FriendsPanel({ open, onClose }: FriendsPanelProps) {
  const { currentUsername } = useAuthStore();
  const { joinFlight } = useFlightSetup();
  const router = useRouter();

  const [searchInput, setSearchInput] = useState("");
  const [requestStatus, setRequestStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<FriendInfo[]>([]);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Firebase subscriptions
  useEffect(() => {
    if (!currentUsername || !open) return;
    const unsubIncoming = subscribeToIncomingRequests(currentUsername, setIncomingRequests);
    const unsubFriends = subscribeToFriends(currentUsername, setFriends);
    return () => {
      unsubIncoming();
      unsubFriends();
    };
  }, [currentUsername, open]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  async function handleSendRequest() {
    if (!currentUsername || !searchInput.trim() || sending) return;
    setSending(true);
    const target = searchInput.trim().toLowerCase();
    const result = await sendFriendRequest(currentUsername, target);
    setSending(false);

    const messages: Record<typeof result, { msg: string; ok: boolean }> = {
      ok:              { msg: `✓ ${target} kullanıcısına istek gönderildi`, ok: true },
      not_found:       { msg: `✗ "${target}" kullanıcısı bulunamadı`, ok: false },
      already_friends: { msg: `✓ ${target} zaten arkadaşınız`, ok: true },
      self:            { msg: `✗ Kendinize istek gönderemezsiniz`, ok: false },
    };
    setRequestStatus(messages[result]);
    if (result === "ok") setSearchInput("");
    setTimeout(() => setRequestStatus(null), 4000);
  }

  async function handleAccept(from: string) {
    if (!currentUsername) return;
    await acceptFriendRequest(currentUsername, from);
  }

  async function handleReject(from: string) {
    if (!currentUsername) return;
    await rejectFriendRequest(currentUsername, from);
  }

  async function handleRemoveFriend(friend: string) {
    if (!currentUsername) return;
    await removeFriend(currentUsername, friend);
  }

  function handleJoinFlight(friend: FriendInfo) {
    if (!friend.flight) return;
    joinFlight(friend.flight.departure, friend.flight.destination);
    router.push("/new-flight");
    onClose();
  }

  const flyingFriends    = friends.filter((f) => f.isFlying);
  const groundedFriends  = friends.filter((f) => !f.isFlying);

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
            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
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
              width: 340,
              background: "linear-gradient(180deg, #0A0F1E 0%, #070918 100%)",
              borderLeft: "1px solid rgba(255,255,255,0.07)",
              boxShadow: "-20px 0 60px rgba(0,0,0,0.5)",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4 shrink-0"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">👥</span>
                <span
                  className="font-bold text-white text-base"
                  style={{ fontFamily: "Space Grotesk, sans-serif" }}
                >
                  Arkadaşlar
                </span>
                {friends.length > 0 && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{
                      background: "rgba(14,165,233,0.15)",
                      border: "1px solid rgba(14,165,233,0.3)",
                      color: "#38BDF8",
                    }}
                  >
                    {friends.length}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-white transition-colors"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                ✕
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

              {/* ── Add Friend ───────────────────────────────────────── */}
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Arkadaş Ekle
                </div>
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendRequest()}
                    placeholder="Kullanıcı adı..."
                    className="flex-1 px-3 py-2 rounded-xl text-sm text-white placeholder-slate-600 outline-none focus:ring-1 focus:ring-sky-500/50"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.09)",
                    }}
                  />
                  <button
                    onClick={handleSendRequest}
                    disabled={!searchInput.trim() || sending}
                    className="px-3 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
                    style={{
                      background: "linear-gradient(135deg, #3B82F6, #1D4ED8)",
                      boxShadow: "0 2px 10px rgba(59,130,246,0.25)",
                    }}
                  >
                    {sending ? "..." : "➤"}
                  </button>
                </div>

                <AnimatePresence>
                  {requestStatus && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="mt-2 px-3 py-2 rounded-lg text-xs font-medium"
                      style={{
                        background: requestStatus.ok
                          ? "rgba(34,197,94,0.1)"
                          : "rgba(239,68,68,0.1)",
                        border: `1px solid ${requestStatus.ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                        color: requestStatus.ok ? "#4ADE80" : "#F87171",
                      }}
                    >
                      {requestStatus.msg}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Incoming Requests ─────────────────────────────────── */}
              {incomingRequests.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Gelen İstekler
                    </div>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                      style={{
                        background: "rgba(245,158,11,0.2)",
                        color: "#F59E0B",
                      }}
                    >
                      {incomingRequests.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {incomingRequests.map((req) => (
                      <motion.div
                        key={req.from}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="flex items-center justify-between p-3 rounded-xl"
                        style={{
                          background: "rgba(245,158,11,0.06)",
                          border: "1px solid rgba(245,158,11,0.2)",
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-sm"
                            style={{
                              background: "rgba(245,158,11,0.15)",
                              border: "1px solid rgba(245,158,11,0.3)",
                            }}
                          >
                            ✈
                          </div>
                          <span className="text-sm font-medium text-slate-200">{req.from}</span>
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleAccept(req.from)}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold text-white"
                            style={{ background: "rgba(34,197,94,0.3)", border: "1px solid rgba(34,197,94,0.4)" }}
                            title="Kabul Et"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => handleReject(req.from)}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold"
                            style={{
                              background: "rgba(239,68,68,0.15)",
                              border: "1px solid rgba(239,68,68,0.3)",
                              color: "#F87171",
                            }}
                            title="Reddet"
                          >
                            ✕
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Flying Friends ────────────────────────────────────── */}
              {flyingFriends.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    ✈ Şu An Uçuyor
                  </div>
                  <div className="space-y-2">
                    {flyingFriends.map((friend) => (
                      <motion.div
                        key={friend.username}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 rounded-xl"
                        style={{
                          background: "rgba(14,165,233,0.06)",
                          border: "1px solid rgba(14,165,233,0.2)",
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-sm"
                              style={{
                                background: "rgba(14,165,233,0.2)",
                                border: "1px solid rgba(14,165,233,0.4)",
                              }}
                            >
                              ✈
                            </div>
                            <span className="text-sm font-semibold text-white">{friend.username}</span>
                          </div>
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse"
                            style={{
                              background: "rgba(14,165,233,0.15)",
                              border: "1px solid rgba(14,165,233,0.35)",
                              color: "#38BDF8",
                            }}
                          >
                            UÇUYOR
                          </span>
                        </div>
                        {friend.flight && (
                          <>
                            <div className="text-xs text-slate-500 mb-2">
                              {friend.flight.departure.name} → {friend.flight.destination.name}
                            </div>
                            {/* Progress bar */}
                            <div
                              className="w-full h-1 rounded-full mb-2"
                              style={{ background: "rgba(255,255,255,0.06)" }}
                            >
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.round(friend.flight.progress * 100)}%`,
                                  background: "linear-gradient(90deg, #3B82F6, #0EA5E9)",
                                }}
                              />
                            </div>
                            <button
                              onClick={() => handleJoinFlight(friend)}
                              className="w-full py-2 rounded-lg text-xs font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
                              style={{
                                background: "linear-gradient(135deg, #7C3AED, #5B21B6)",
                                boxShadow: "0 2px 12px rgba(124,58,237,0.35)",
                              }}
                            >
                              👥 Aynı Rotada Uç
                            </button>
                          </>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Grounded / Offline Friends ────────────────────────── */}
              {groundedFriends.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Arkadaşlar
                  </div>
                  <div className="space-y-1.5">
                    {groundedFriends.map((friend) => (
                      <div
                        key={friend.username}
                        className="flex items-center justify-between p-3 rounded-xl group"
                        style={{
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs"
                            style={{
                              background: "rgba(255,255,255,0.05)",
                              border: "1px solid rgba(255,255,255,0.1)",
                              color: "#64748B",
                            }}
                          >
                            ✈
                          </div>
                          <span className="text-sm text-slate-300">{friend.username}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveFriend(friend.username)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 rounded-lg text-xs text-red-500/70 hover:text-red-400"
                          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}
                          title="Arkadaşlıktan Çıkar"
                        >
                          Çıkar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Empty state ───────────────────────────────────────── */}
              {friends.length === 0 && incomingRequests.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-slate-600">
                  <span className="text-4xl mb-3">✈</span>
                  <p className="text-sm text-center">Henüz arkadaşın yok.</p>
                  <p className="text-xs mt-1 text-slate-700 text-center">
                    Kullanıcı adıyla arkadaş ekle ve birlikte uç!
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
