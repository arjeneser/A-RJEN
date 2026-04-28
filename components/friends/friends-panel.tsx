"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { useFlightSetup, useActiveSession } from "@/store/flight-store";
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
import {
  sendMessage,
  sendVoiceMessage,
  sendFlightCardMessage,
  toggleReaction,
  setTyping,
  subscribeToMessages,
  subscribeToTyping,
  markConversationRead,
  subscribeToReadCursor,
  conversationId,
  type ChatMessage,
  type ReplyRef,
} from "@/lib/messages";
import { subscribeToPresence, subscribeToMultiplePresences, type UserPresence } from "@/lib/presence";
import {
  createGroup,
  sendGroupMessage,
  subscribeToUserGroups,
  subscribeToGroupMessages,
  leaveGroup,
  type Group,
  type GroupMessage,
} from "@/lib/groups";
import {
  sendFlightInvite,
  removeFlightInvite,
  subscribeToFlightInvites,
  type FlightInvite,
} from "@/lib/flight-invites";
import { createLobby, joinLobby } from "@/lib/lobby";
import {
  getDepartureCities,
  getReachableDestinations,
  FLIGHT_DURATIONS,
} from "@/data/cities";
import type { City, FlightDurationOption } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type View = "main" | "chat" | "propose" | "leaderboard" | "group" | "create-group";

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
  const { session: activeSession } = useActiveSession();
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
  const [messages, setMessages]         = useState<ChatMessage[]>([]);
  const [msgInput, setMsgInput]         = useState("");
  const [partnerReadAt, setPartnerReadAt]   = useState<number>(0);
  const [partnerTyping, setPartnerTyping]   = useState(false);
  const [partnerPresence, setPartnerPresence] = useState<UserPresence | null>(null);
  const [replyingTo, setReplyingTo]         = useState<ReplyRef | null>(null);
  const [emojiPickerMsgId, setEmojiPickerMsgId] = useState<string | null>(null);
  const [isRecording, setIsRecording]       = useState(false);
  const [recordingSecs, setRecordingSecs]   = useState(0);
  const [friendPresences, setFriendPresences] = useState<Record<string, UserPresence>>({});
  const mediaRecorderRef  = useRef<MediaRecorder | null>(null);
  const audioChunksRef    = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef        = useRef<Record<string, number>>({});
  const chatEndRef        = useRef<HTMLDivElement>(null);
  const msgInputRef       = useRef<HTMLInputElement>(null);

  // ── group state ───────────────────────────────────────────────────────────────
  const [groups, setGroups]               = useState<Group[]>([]);
  const [activeGroup, setActiveGroup]     = useState<Group | null>(null);
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [groupMsgInput, setGroupMsgInput] = useState("");
  const [leaveConfirm, setLeaveConfirm]   = useState(false);
  const groupChatEndRef                   = useRef<HTMLDivElement>(null);
  const groupMsgInputRef                  = useRef<HTMLInputElement>(null);

  // ── create-group state ────────────────────────────────────────────────────────
  const [newGroupName, setNewGroupName]         = useState("");
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);
  const [creatingGroup, setCreatingGroup]       = useState(false);

  // ── propose view state ───────────────────────────────────────────────────────
  const departureCities            = getDepartureCities();
  const [propDeparture, setPropDeparture] = useState<City | null>(null);
  const [propDuration, setPropDuration]   = useState<FlightDurationOption | null>(null);
  const [propDestination, setPropDestination] = useState<City | null>(null);
  const [propSending, setPropSending]     = useState(false);
  const [propSent, setPropSent]           = useState(false);
  // Step wizard: 1=departure 2=duration 3=destination 4=group+send
  const [propStep, setPropStep]           = useState<1 | 2 | 3 | 4>(1);
  // Multi-invite: extra friends to send same invite to (besides activeFriend)
  const [extraInvitees, setExtraInvitees] = useState<string[]>([]);

  const reachable = propDeparture && propDuration
    ? getReachableDestinations(propDeparture, propDuration)
    : [];

  // ── Her zaman açık: bildirim sayısı için (panel kapalıyken de çalışır) ────────
  useEffect(() => {
    if (!currentUsername) return;
    const u1 = subscribeToIncomingRequests(currentUsername, setIncomingReqs);
    const u2 = subscribeToFlightInvites(currentUsername, setFlightInvites);
    return () => { u1(); u2(); };
  }, [currentUsername]);

  // ── Panel açıkken: arkadaş listesi + gruplar ─────────────────────────────────
  useEffect(() => {
    if (!currentUsername || !open) return;
    const u1 = subscribeToFriends(currentUsername, setFriends);
    const u2 = subscribeToUserGroups(currentUsername, setGroups);
    return () => { u1(); u2(); };
  }, [currentUsername, open]);

  // ── Arkadaşların online durumlarını dinle ────────────────────────────────────
  useEffect(() => {
    if (!open || friends.length === 0) return;
    const usernames = friends.map((f) => f.username);
    const unsub = subscribeToMultiplePresences(usernames, setFriendPresences);
    return unsub;
  }, [friends, open]);

  // ── Notify parent of badge count ─────────────────────────────────────────────
  useEffect(() => {
    onNotificationCount?.(incomingReqs.length + flightInvites.length);
  }, [incomingReqs, flightInvites, onNotificationCount]);

  // ── Chat subscription + okundu bilgisi + typing + presence ──────────────────
  useEffect(() => {
    if (!currentUsername || !activeFriend || view !== "chat") return;
    const cId = conversationId(currentUsername, activeFriend);
    markConversationRead(cId, currentUsername);
    const u1 = subscribeToMessages(currentUsername, activeFriend, setMessages);
    const u2 = subscribeToReadCursor(cId, activeFriend, setPartnerReadAt);
    const u3 = subscribeToTyping(cId, currentUsername, (users) => setPartnerTyping(users.length > 0));
    const u4 = subscribeToPresence(activeFriend, setPartnerPresence);
    return () => { u1(); u2(); u3(); u4(); };
  }, [currentUsername, activeFriend, view]);

  // Yeni mesaj gelince okundu imlecini güncelle (chat açıkken)
  useEffect(() => {
    if (view === "chat" && currentUsername && activeFriend && messages.length > 0) {
      const cId = conversationId(currentUsername, activeFriend);
      markConversationRead(cId, currentUsername);
    }
  }, [messages, view]);

  // ── Group message subscription ────────────────────────────────────────────────
  useEffect(() => {
    if (!activeGroup || view !== "group") return;
    const unsub = subscribeToGroupMessages(activeGroup.id, setGroupMessages);
    return unsub;
  }, [activeGroup, view]);

  // ── Auto-scroll group chat ────────────────────────────────────────────────────
  useEffect(() => {
    groupChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [groupMessages]);

  // ── Focus group input when group chat opens ───────────────────────────────────
  useEffect(() => {
    if (view === "group") setTimeout(() => groupMsgInputRef.current?.focus(), 150);
  }, [view]);

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
    if (!open) {
      setView("main");
      setActiveFriend(null);
      setActiveGroup(null);
      setPartnerReadAt(0);
      setPartnerTyping(false);
      setPartnerPresence(null);
      setReplyingTo(null);
      setEmojiPickerMsgId(null);
      setNewGroupName("");
      setSelectedGroupMembers([]);
      setLeaveConfirm(false);
    }
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
    setReplyingTo(null);
    // Yazıyor durumunu temizle
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    const cId = conversationId(currentUsername, activeFriend);
    setTyping(cId, currentUsername, false).catch(() => {});
    await sendMessage(currentUsername, activeFriend, text, replyingTo ?? undefined);
  }

  function handleMsgInputChange(val: string) {
    setMsgInput(val);
    if (!currentUsername || !activeFriend) return;
    const cId = conversationId(currentUsername, activeFriend);
    // Yazıyor sinyali gönder
    setTyping(cId, currentUsername, true).catch(() => {});
    // 3sn sonra yazıyor durumunu kaldır
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      setTyping(cId, currentUsername, false).catch(() => {});
    }, 3000);
  }

  async function handleSendFlightCard() {
    if (!currentUsername || !activeFriend || !activeSession) return;
    await sendFlightCardMessage(currentUsername, activeFriend, {
      departureName: activeSession.departure.name,
      destinationName: activeSession.destination.name,
      durationLabel: `${Math.round(activeSession.durationMs / 60000)} dk`,
      xp: Math.round(activeSession.durationMs / 60000 / 5),
      countryCode: activeSession.destination.countryCode,
    });
  }

  async function handleToggleReaction(msgId: string, emoji: string) {
    if (!currentUsername || !activeFriend || !msgId) return;
    const cId = conversationId(currentUsername, activeFriend);
    setEmojiPickerMsgId(null);
    await toggleReaction(cId, msgId, emoji, currentUsername);
  }

  async function handleStartRecording() {
    if (!navigator.mediaDevices) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm" });
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const b64 = (reader.result as string).split(",")[1];
          if (currentUsername && activeFriend && b64) {
            await sendVoiceMessage(currentUsername, activeFriend, b64, recordingSecs);
          }
          setIsRecording(false);
          setRecordingSecs(0);
        };
        reader.readAsDataURL(blob);
      };
      mr.start(200);
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setRecordingSecs(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSecs((s) => {
          if (s >= 59) { handleStopRecording(); return s; }
          return s + 1;
        });
      }, 1000);
    } catch { /* izin reddedildi */ }
  }

  function handleStopRecording() {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    mediaRecorderRef.current?.stop();
  }

  function handleMessageDoubleTap(msgId: string) {
    const now = Date.now();
    const last = lastTapRef.current[msgId] ?? 0;
    if (now - last < 400) {
      setEmojiPickerMsgId((prev) => (prev === msgId ? null : msgId));
    }
    lastTapRef.current[msgId] = now;
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
    setPropStep(1);
    setExtraInvitees([]);
    setView("propose");
  }

  async function handleSendInvite() {
    if (!currentUsername || !activeFriend || !propDeparture || !propDuration || !propDestination) return;
    setPropSending(true);
    const allRecipients = [activeFriend, ...extraInvitees];
    const isGroupInvite = allRecipients.length > 1;

    // Grup daveti ise lobi oluştur, herkese lobbyId ile davet gönder
    if (isGroupInvite) {
      const lobbyId = await createLobby(propDeparture, propDestination, propDuration, currentUsername);
      await Promise.all(
        allRecipients.map((r) =>
          sendFlightInvite(currentUsername, r, propDeparture, propDestination, propDuration, lobbyId)
        )
      );
      setPropSending(false);
      setPropSent(true);
      setTimeout(() => {
        setPropSent(false);
        onClose();
        router.push(`/lobby/${lobbyId}`);
      }, 1200);
    } else {
      await sendFlightInvite(currentUsername, activeFriend, propDeparture, propDestination, propDuration);
      setPropSending(false);
      setPropSent(true);
      setTimeout(() => { setView("chat"); setPropSent(false); }, 1800);
    }
  }

  async function handleAcceptInvite(invite: FlightInvite) {
    if (!currentUsername) return;
    await removeFlightInvite(currentUsername, invite.id);
    if (invite.lobbyId) {
      // Grup uçuşu — lobiye katıl
      await joinLobby(invite.lobbyId, currentUsername);
      onClose();
      router.push(`/lobby/${invite.lobbyId}`);
    } else {
      // Tekli davet — doğrudan uçuşa başla
      joinFlight(invite.departure, invite.destination);
      setDuration(invite.durationOption);
      router.push("/new-flight");
      onClose();
    }
  }

  function handleJoinFlight(friend: FriendInfo) {
    if (!friend.flight) return;
    joinFlight(friend.flight.departure, friend.flight.destination);
    router.push("/new-flight");
    onClose();
  }

  function openGroup(group: Group) {
    setActiveGroup(group);
    setGroupMessages([]);
    setView("group");
  }

  async function handleSendGroupMessage() {
    if (!currentUsername || !activeGroup || !groupMsgInput.trim()) return;
    const text = groupMsgInput.trim();
    setGroupMsgInput("");
    await sendGroupMessage(activeGroup.id, currentUsername, text);
  }

  async function handleCreateGroup() {
    if (!currentUsername || !newGroupName.trim() || selectedGroupMembers.length === 0 || creatingGroup) return;
    setCreatingGroup(true);
    const groupId = await createGroup(newGroupName.trim(), selectedGroupMembers, currentUsername);
    setCreatingGroup(false);
    if (groupId) {
      const newGroup: Group = {
        id: groupId,
        name: newGroupName.trim(),
        members: Object.fromEntries(
          [...selectedGroupMembers, currentUsername].map((m) => [m, true as const])
        ),
        createdBy: currentUsername,
        createdAt: Date.now(),
      };
      setNewGroupName("");
      setSelectedGroupMembers([]);
      setActiveGroup(newGroup);
      setGroupMessages([]);
      setView("group");
    }
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
                {view === "main"          && <span className="text-base">👥</span>}
                {view === "chat"          && <span className="text-base">💬</span>}
                {view === "propose"       && <span className="text-base">✈</span>}
                {view === "leaderboard"   && <span className="text-base">🏆</span>}
                {view === "group"         && <span className="text-base">👥</span>}
                {view === "create-group"  && <span className="text-base">➕</span>}

                {view === "chat" ? (
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span
                      className="font-bold text-white text-sm truncate"
                      style={{ fontFamily: "Space Grotesk, sans-serif" }}
                    >
                      {activeFriend}
                    </span>
                    {partnerPresence?.online ? (
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: "#4ADE80", boxShadow: "0 0 6px #4ade80" }}
                      />
                    ) : partnerPresence ? (
                      <span className="text-[10px] text-slate-600 shrink-0 truncate">
                        {timeAgo(partnerPresence.lastSeen)} önce
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <span
                    className="font-bold text-white text-sm truncate"
                    style={{ fontFamily: "Space Grotesk, sans-serif" }}
                  >
                    {view === "main"           ? "Arkadaşlar"
                      : view === "leaderboard" ? "Sıralama"
                      : view === "group"       ? (activeGroup?.name ?? "Grup")
                      : view === "create-group" ? "Grup Oluştur"
                      : `${activeFriend}'a Uçuş Teklif Et`}
                  </span>
                )}

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
              {view === "group" && activeGroup && (
                <div
                  className="text-[10px] px-2 py-1 rounded-full shrink-0"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.09)",
                    color: "#64748B",
                  }}
                >
                  {Object.keys(activeGroup.members).length} üye
                </div>
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
                              <div className="relative shrink-0">
                                <div
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-slate-600"
                                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                                >
                                  ✈
                                </div>
                                {friendPresences[f.username]?.online && (
                                  <div
                                    className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#070918]"
                                    style={{ background: "#4ADE80" }}
                                  />
                                )}
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

                  {/* ── Gruplar ────────────────────────────────────── */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                        Gruplar {groups.length > 0 && `(${groups.length})`}
                      </div>
                      <button
                        onClick={() => { setNewGroupName(""); setSelectedGroupMembers([]); setView("create-group"); }}
                        disabled={friends.length === 0}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all hover:opacity-80 disabled:opacity-30"
                        style={{
                          background: "rgba(99,102,241,0.12)",
                          border: "1px solid rgba(99,102,241,0.25)",
                          color: "#818CF8",
                        }}
                      >
                        ➕ Yeni Grup
                      </button>
                    </div>
                    {groups.length === 0 ? (
                      <div className="text-xs text-slate-700 text-center py-3">
                        Henüz grup yok — arkadaşlarınla bir tane oluştur!
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {groups.map((g) => (
                          <div
                            key={g.id}
                            onClick={() => openGroup(g)}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-white/[0.03] transition-colors"
                            style={{ border: "1px solid rgba(255,255,255,0.05)" }}
                          >
                            <div
                              className="w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0 font-bold"
                              style={{
                                background: "rgba(99,102,241,0.12)",
                                border: "1px solid rgba(99,102,241,0.2)",
                                color: "#818CF8",
                              }}
                            >
                              {g.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-slate-200 truncate">{g.name}</div>
                              {g.lastMessage ? (
                                <div className="text-xs text-slate-600 truncate">
                                  {g.lastMessage.from}: {g.lastMessage.text}
                                </div>
                              ) : (
                                <div className="text-xs text-slate-700">
                                  {Object.keys(g.members).length} üye
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

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
                      className="mx-3 mt-3 px-3 py-2 rounded-xl flex items-center justify-between shrink-0"
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
                  <div
                    className="flex-1 overflow-y-auto px-3 py-3 space-y-2"
                    onClick={() => setEmojiPickerMsgId(null)}
                  >
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
                      const reactions = msg.reactions ?? {};
                      const reactionEntries = Object.entries(reactions).filter(([, users]) => users.length > 0);
                      const isPickerOpen = emojiPickerMsgId === msg.id;

                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${isOwn ? "items-end" : "items-start"} group`}
                        >
                          {/* Row: reply button + bubble */}
                          <div className={`flex items-end gap-1.5 max-w-[82%] ${isOwn ? "flex-row-reverse" : "flex-row"}`}>

                            {/* Reply button — visible on group hover */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (msg.id) {
                                  setReplyingTo({ id: msg.id, from: msg.from, text: msg.text.slice(0, 80) });
                                  msgInputRef.current?.focus();
                                }
                              }}
                              className="w-6 h-6 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mb-1"
                              style={{
                                background: "rgba(255,255,255,0.06)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                color: "#64748B",
                              }}
                              title="Yanıtla"
                            >
                              ↩
                            </button>

                            {/* Bubble */}
                            <div
                              className="flex flex-col"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (msg.id) handleMessageDoubleTap(msg.id);
                              }}
                            >
                              {/* Quoted message preview */}
                              {msg.replyTo && (
                                <div
                                  className="px-3 pt-2 pb-1.5 rounded-t-2xl text-[10px]"
                                  style={
                                    isOwn
                                      ? {
                                          background: "rgba(255,255,255,0.18)",
                                          borderBottom: "1px solid rgba(255,255,255,0.12)",
                                        }
                                      : {
                                          background: "rgba(255,255,255,0.04)",
                                          borderBottom: "1px solid rgba(255,255,255,0.07)",
                                        }
                                  }
                                >
                                  <div className="font-bold mb-0.5" style={{ color: isOwn ? "#93C5FD" : "#A78BFA" }}>
                                    {msg.replyTo.from}
                                  </div>
                                  <div className="opacity-60 truncate">{msg.replyTo.text}</div>
                                </div>
                              )}

                              {/* Main bubble */}
                              <div
                                className="px-3 py-2 text-sm leading-snug"
                                style={
                                  isOwn
                                    ? {
                                        background: "linear-gradient(135deg, #1D4ED8, #2563EB)",
                                        color: "white",
                                        borderRadius: msg.replyTo ? "0 0 16px 16px" : "16px",
                                        borderBottomRightRadius: msg.replyTo ? 4 : 4,
                                        borderTopLeftRadius: msg.replyTo ? 0 : 16,
                                        borderTopRightRadius: msg.replyTo ? 0 : 16,
                                      }
                                    : {
                                        background: "rgba(255,255,255,0.07)",
                                        border: "1px solid rgba(255,255,255,0.09)",
                                        color: "#CBD5E1",
                                        borderRadius: msg.replyTo ? "0 0 16px 16px" : "16px",
                                        borderBottomLeftRadius: msg.replyTo ? 4 : 4,
                                        borderTopLeftRadius: msg.replyTo ? 0 : 16,
                                        borderTopRightRadius: msg.replyTo ? 0 : 16,
                                      }
                                }
                              >
                                {/* Flight card */}
                                {msg.type === "flight_card" && msg.flightCard && (
                                  <div
                                    className="mb-2 p-2.5 rounded-xl"
                                    style={{
                                      background: isOwn ? "rgba(255,255,255,0.1)" : "rgba(124,58,237,0.12)",
                                      border: isOwn ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(124,58,237,0.25)",
                                    }}
                                  >
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <img
                                        src={`https://flagcdn.com/w40/${msg.flightCard.countryCode.toLowerCase()}.png`}
                                        alt=""
                                        className="w-5 h-3 object-cover rounded-sm shrink-0"
                                      />
                                      <span className="text-xs font-bold truncate">
                                        {msg.flightCard.departureName} → {msg.flightCard.destinationName}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] opacity-70 mb-1.5">
                                      <span>⏱ {msg.flightCard.durationLabel}</span>
                                      <span>+{msg.flightCard.xp} XP</span>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        router.push("/new-flight");
                                        onClose();
                                      }}
                                      className="w-full py-1 rounded-lg text-[10px] font-bold transition-all active:scale-95"
                                      style={{
                                        background: isOwn ? "rgba(255,255,255,0.15)" : "rgba(124,58,237,0.25)",
                                        color: isOwn ? "white" : "#C4B5FD",
                                      }}
                                    >
                                      ✈ Aynı Rotada Uç
                                    </button>
                                  </div>
                                )}

                                {/* Voice message */}
                                {msg.type === "voice" && msg.audioBase64 ? (
                                  <div className="flex items-center gap-2">
                                    <audio
                                      controls
                                      src={`data:audio/webm;base64,${msg.audioBase64}`}
                                      className="h-8"
                                      style={{ maxWidth: 180 }}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    {msg.audioDuration !== undefined && (
                                      <span className="text-[10px] opacity-60 shrink-0">{msg.audioDuration}s</span>
                                    )}
                                  </div>
                                ) : msg.type !== "flight_card" ? (
                                  <span>{msg.text}</span>
                                ) : null}

                                {/* Timestamp + read receipt */}
                                <div className="flex items-center justify-end gap-1 mt-0.5">
                                  <span className="text-[9px] opacity-50">{timeAgo(msg.timestamp)}</span>
                                  {isOwn && (
                                    <svg
                                      width="14" height="10" viewBox="0 0 14 10" fill="none"
                                      strokeLinecap="round" strokeLinejoin="round"
                                      style={{
                                        stroke: partnerReadAt >= msg.timestamp ? "#60A5FA" : "rgba(255,255,255,0.25)",
                                        transition: "stroke 0.3s",
                                      }}
                                    >
                                      <path d="M1 5C1 5 3 1 7 1C11 1 13 5 13 5C13 5 11 9 7 9C3 9 1 5 1 5Z" strokeWidth="1.1" />
                                      <circle cx="7" cy="5" r="1.8" strokeWidth="1.1" />
                                      {partnerReadAt >= msg.timestamp && (
                                        <circle cx="8.2" cy="3.8" r="0.5" fill="#60A5FA" stroke="none" />
                                      )}
                                    </svg>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Emoji picker popup */}
                          <AnimatePresence>
                            {isPickerOpen && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.85, y: -4 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.85, y: -4 }}
                                transition={{ duration: 0.12 }}
                                className="flex gap-1.5 p-2 rounded-2xl mt-1"
                                style={{
                                  background: "rgba(15,23,42,0.97)",
                                  border: "1px solid rgba(255,255,255,0.1)",
                                  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {["❤️", "😂", "👏", "🔥", "✈️", "👍", "😍", "🎉"].map((emoji) => (
                                  <button
                                    key={emoji}
                                    onClick={() => msg.id && handleToggleReaction(msg.id, emoji)}
                                    className="text-lg hover:scale-125 transition-transform active:scale-95"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Reactions row */}
                          {reactionEntries.length > 0 && (
                            <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? "justify-end" : "justify-start"}`}>
                              {reactionEntries.map(([emoji, users]) => {
                                const didReact = users.includes(currentUsername ?? "");
                                return (
                                  <button
                                    key={emoji}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (msg.id) handleToggleReaction(msg.id, emoji);
                                    }}
                                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs transition-all active:scale-95"
                                    style={{
                                      background: didReact ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.06)",
                                      border: didReact ? "1px solid rgba(59,130,246,0.4)" : "1px solid rgba(255,255,255,0.1)",
                                      color: didReact ? "#93C5FD" : "#94A3B8",
                                    }}
                                  >
                                    <span>{emoji}</span>
                                    <span className="text-[10px] font-semibold">{users.length}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Typing indicator */}
                    <AnimatePresence>
                      {partnerTyping && (
                        <motion.div
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 4 }}
                          className="flex justify-start"
                        >
                          <div
                            className="px-3 py-2.5 rounded-2xl rounded-bl-sm flex items-center gap-1"
                            style={{
                              background: "rgba(255,255,255,0.07)",
                              border: "1px solid rgba(255,255,255,0.09)",
                            }}
                          >
                            {[0, 1, 2].map((i) => (
                              <motion.div
                                key={i}
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ background: "#64748B" }}
                                animate={{ y: [-2, 2, -2] }}
                                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                              />
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div ref={chatEndRef} />
                  </div>

                  {/* Reply preview bar */}
                  <AnimatePresence>
                    {replyingTo && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mx-3 mb-1 px-3 py-1.5 rounded-xl flex items-center gap-2 shrink-0"
                        style={{
                          background: "rgba(59,130,246,0.08)",
                          border: "1px solid rgba(59,130,246,0.2)",
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-bold text-blue-400">{replyingTo.from}&apos;a yanıt</div>
                          <div className="text-[10px] text-slate-500 truncate">{replyingTo.text}</div>
                        </div>
                        <button
                          onClick={() => setReplyingTo(null)}
                          className="text-slate-600 hover:text-slate-400 text-xs shrink-0 transition-colors"
                        >
                          ✕
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Input area */}
                  <div
                    className="px-3 py-3 flex gap-2 items-center shrink-0"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    {/* Flight card share button */}
                    {activeSession && !isRecording && (
                      <button
                        onClick={handleSendFlightCard}
                        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all hover:opacity-80 active:scale-90"
                        style={{
                          background: "rgba(124,58,237,0.15)",
                          border: "1px solid rgba(124,58,237,0.3)",
                        }}
                        title="Uçuşumu Paylaş"
                      >
                        <span className="text-sm">✈</span>
                      </button>
                    )}

                    {/* Mic button */}
                    {isRecording ? (
                      <button
                        onClick={handleStopRecording}
                        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all active:scale-90"
                        style={{
                          background: "rgba(239,68,68,0.2)",
                          border: "1px solid rgba(239,68,68,0.4)",
                        }}
                        title="Kaydı Durdur ve Gönder"
                      >
                        <motion.div
                          className="w-3 h-3 rounded-sm"
                          style={{ background: "#F87171" }}
                          animate={{ opacity: [1, 0.3, 1] }}
                          transition={{ duration: 0.8, repeat: Infinity }}
                        />
                      </button>
                    ) : (
                      <button
                        onClick={handleStartRecording}
                        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all hover:opacity-80 active:scale-90"
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.09)",
                        }}
                        title="Sesli Mesaj"
                      >
                        🎤
                      </button>
                    )}

                    {/* Input / recording indicator */}
                    {isRecording ? (
                      <div
                        className="flex-1 px-3 py-2 rounded-xl text-xs text-red-400 flex items-center gap-2"
                        style={{
                          background: "rgba(239,68,68,0.06)",
                          border: "1px solid rgba(239,68,68,0.2)",
                        }}
                      >
                        <motion.div
                          className="w-2 h-2 rounded-full bg-red-400 shrink-0"
                          animate={{ opacity: [1, 0, 1] }}
                          transition={{ duration: 0.8, repeat: Infinity }}
                        />
                        Kayıt: {recordingSecs}s — durdur &amp; gönder
                      </div>
                    ) : (
                      <input
                        ref={msgInputRef}
                        value={msgInput}
                        onChange={(e) => handleMsgInputChange(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                        placeholder="Mesaj yaz..."
                        className="flex-1 px-3 py-2 rounded-xl text-sm text-white placeholder-slate-600 outline-none focus:ring-1 focus:ring-sky-500/40"
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.09)",
                        }}
                      />
                    )}

                    {!isRecording && (
                      <button
                        onClick={handleSendMessage}
                        disabled={!msgInput.trim()}
                        className="px-3.5 py-2 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-30 active:scale-95"
                        style={{ background: "linear-gradient(135deg, #3B82F6, #1D4ED8)" }}
                      >
                        ➤
                      </button>
                    )}
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
                      <p className="text-white font-semibold text-center">Davet gönderildi!</p>
                      <p className="text-slate-500 text-xs text-center">
                        {extraInvitees.length > 0
                          ? "Lobi oluşturuldu, yönlendiriliyorsunuz…"
                          : `${activeFriend} kabul edince birlikte kalkarsınız.`}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">

                      {/* ── Tamamlanan adımların chip'leri ── */}
                      <div className="space-y-1.5">
                        {propDeparture && (
                          <motion.button
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            onClick={() => { setPropStep(1); }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all"
                            style={{
                              background: "rgba(59,130,246,0.08)",
                              border: "1px solid rgba(59,130,246,0.25)",
                            }}
                          >
                            <span className="text-[10px] font-bold text-blue-400/70 uppercase tracking-widest w-16 shrink-0">Kalkış</span>
                            <span className="text-xs text-white font-semibold flex-1 truncate">{propDeparture.name}</span>
                            <span className="text-[10px] text-slate-600">← değiştir</span>
                          </motion.button>
                        )}
                        {propDuration && (
                          <motion.button
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            onClick={() => { setPropStep(2); }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all"
                            style={{
                              background: "rgba(59,130,246,0.08)",
                              border: "1px solid rgba(59,130,246,0.25)",
                            }}
                          >
                            <span className="text-[10px] font-bold text-blue-400/70 uppercase tracking-widest w-16 shrink-0">Süre</span>
                            <span className="text-xs text-white font-semibold flex-1">{propDuration.label}</span>
                            <span className="text-[10px] text-slate-600">← değiştir</span>
                          </motion.button>
                        )}
                        {propDestination && (
                          <motion.button
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            onClick={() => { setPropStep(3); }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all"
                            style={{
                              background: "rgba(59,130,246,0.08)",
                              border: "1px solid rgba(59,130,246,0.25)",
                            }}
                          >
                            <span className="text-[10px] font-bold text-blue-400/70 uppercase tracking-widest w-16 shrink-0">Varış</span>
                            <span className="text-xs text-white font-semibold flex-1 truncate">{propDestination.name}</span>
                            <span className="text-[10px] text-slate-600">← değiştir</span>
                          </motion.button>
                        )}
                      </div>

                      {/* ── Aktif adım ── */}
                      <AnimatePresence mode="wait">

                        {/* ADIM 1: Kalkış */}
                        {propStep === 1 && (
                          <motion.div
                            key="step1"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.15 }}
                          >
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                              Kalkış Havalimanı
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {departureCities.map((city) => (
                                <button
                                  key={city.id}
                                  onClick={() => {
                                    setPropDeparture(city);
                                    setPropDuration(null);
                                    setPropDestination(null);
                                    setPropStep(2);
                                  }}
                                  className="p-2.5 rounded-xl text-left transition-all active:scale-95"
                                  style={
                                    propDeparture?.id === city.id
                                      ? { background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.45)", color: "white" }
                                      : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "#94A3B8" }
                                  }
                                >
                                  <div className="text-xs font-semibold leading-tight">{city.name}</div>
                                  <div className="text-[10px] opacity-60">{city.country}</div>
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}

                        {/* ADIM 2: Süre */}
                        {propStep === 2 && propDeparture && (
                          <motion.div
                            key="step2"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.15 }}
                          >
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                              Uçuş Süresi
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {FLIGHT_DURATIONS.map((d) => (
                                <button
                                  key={d.key}
                                  onClick={() => {
                                    setPropDuration(d);
                                    setPropDestination(null);
                                    setPropStep(3);
                                  }}
                                  className="py-3 px-3 rounded-xl text-left transition-all active:scale-95"
                                  style={
                                    propDuration?.key === d.key
                                      ? { background: "rgba(59,130,246,0.18)", border: "1px solid rgba(59,130,246,0.45)", color: "white" }
                                      : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "#64748B" }
                                  }
                                >
                                  <div className="text-sm font-bold">{d.label}</div>
                                  <div className="text-[10px] opacity-60">+{d.xpReward} XP</div>
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}

                        {/* ADIM 3: Varış */}
                        {propStep === 3 && propDeparture && propDuration && (
                          <motion.div
                            key="step3"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.15 }}
                          >
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                              Varış ({reachable.length} şehir)
                            </div>
                            {reachable.length === 0 ? (
                              <p className="text-xs text-slate-600">Bu süre için uygun varış bulunamadı.</p>
                            ) : (
                              <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                                {reachable.map((city) => (
                                  <button
                                    key={city.id}
                                    onClick={() => { setPropDestination(city); setPropStep(4); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all active:scale-[0.98]"
                                    style={
                                      propDestination?.id === city.id
                                        ? { background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.4)" }
                                        : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }
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
                          </motion.div>
                        )}

                        {/* ADIM 4: Grup + Gönder */}
                        {propStep === 4 && propDeparture && propDuration && propDestination && (
                          <motion.div
                            key="step4"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.15 }}
                            className="space-y-4"
                          >
                            {/* Gruba ekle */}
                            {(() => {
                              const otherFriends = friends.filter((f) => f.username !== activeFriend);
                              if (otherFriends.length === 0) return null;
                              return (
                                <div>
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
                                              ? { background: "rgba(124,58,237,0.25)", border: "1px solid rgba(124,58,237,0.5)", color: "#C4B5FD" }
                                              : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", color: "#64748B" }
                                          }
                                        >
                                          {selected ? "✓ " : "+ "}{f.username}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  {extraInvitees.length > 0 && (
                                    <p className="text-[10px] text-purple-400/60 mt-1.5">
                                      Grup daveti lobi oluşturur — herkes hazır olmadan uçuş başlamaz.
                                    </p>
                                  )}
                                </div>
                              );
                            })()}

                            {/* Gönder butonu */}
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
                                ? `✈ ${1 + extraInvitees.length} Kişiye Lobi Daveti Gönder`
                                : `✈ ${activeFriend}'a Davet Gönder`}
                            </button>
                          </motion.div>
                        )}

                      </AnimatePresence>
                    </div>
                  )}
                </motion.div>
              )}
              {/* ════════════ GROUP CHAT VIEW ════════════ */}
              {view === "group" && activeGroup && (
                <motion.div
                  key="group"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.18 }}
                  className="flex-1 flex flex-col min-h-0"
                >
                  {/* Member chips */}
                  <div
                    className="px-3 pt-2 pb-2 flex flex-wrap gap-1 shrink-0"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    {Object.keys(activeGroup.members).map((m) => (
                      <span
                        key={m}
                        className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{
                          background: m === currentUsername
                            ? "rgba(99,102,241,0.2)"
                            : "rgba(255,255,255,0.05)",
                          border: m === currentUsername
                            ? "1px solid rgba(99,102,241,0.35)"
                            : "1px solid rgba(255,255,255,0.08)",
                          color: m === currentUsername ? "#818CF8" : "#64748B",
                        }}
                      >
                        {m === currentUsername ? "Sen" : m}
                      </span>
                    ))}
                    <button
                      onClick={() => setLeaveConfirm(true)}
                      className="text-[10px] px-2 py-0.5 rounded-full ml-auto"
                      style={{
                        background: "rgba(239,68,68,0.08)",
                        border: "1px solid rgba(239,68,68,0.2)",
                        color: "#F87171",
                      }}
                    >
                      Ayrıl
                    </button>
                  </div>

                  {/* ── Ayrıl onay dialog ────────────────────────────── */}
                  <AnimatePresence>
                    {leaveConfirm && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.15 }}
                        className="mx-3 mt-2 mb-1 p-4 rounded-2xl shrink-0"
                        style={{
                          background: "rgba(239,68,68,0.08)",
                          border: "1px solid rgba(239,68,68,0.25)",
                        }}
                      >
                        <p className="text-sm font-semibold text-white mb-1">
                          Gruptan çıkmak istiyor musunuz?
                        </p>
                        <p className="text-xs text-slate-400 mb-3">
                          <span className="text-red-400 font-medium">{activeGroup?.name}</span> grubundan
                          ayrılırsanız tekrar davet edilmeniz gerekir.
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              if (currentUsername && activeGroup) {
                                await leaveGroup(activeGroup.id, currentUsername);
                              }
                              setLeaveConfirm(false);
                              setActiveGroup(null);
                              setGroupMessages([]);
                              setView("main");
                            }}
                            className="flex-1 py-2 rounded-xl text-xs font-bold text-white transition-all active:scale-95"
                            style={{
                              background: "linear-gradient(135deg, #DC2626, #B91C1C)",
                              boxShadow: "0 2px 8px rgba(220,38,38,0.35)",
                            }}
                          >
                            Evet, ayrıl
                          </button>
                          <button
                            onClick={() => setLeaveConfirm(false)}
                            className="flex-1 py-2 rounded-xl text-xs font-medium transition-all active:scale-95"
                            style={{
                              background: "rgba(255,255,255,0.05)",
                              border: "1px solid rgba(255,255,255,0.1)",
                              color: "#94A3B8",
                            }}
                          >
                            İptal
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
                    {groupMessages.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-full text-slate-700 py-12">
                        <span className="text-3xl mb-2">💬</span>
                        <p className="text-xs text-center">
                          Henüz mesaj yok.<br />İlk mesajı sen at!
                        </p>
                      </div>
                    )}
                    {groupMessages.map((msg) => {
                      const isOwn = msg.from === currentUsername;
                      return (
                        <div key={msg.id} className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
                          {/* Sender label for others */}
                          {!isOwn && (
                            <span className="text-[10px] text-slate-600 px-1 mb-0.5">{msg.from}</span>
                          )}
                          <div
                            className="max-w-[78%] px-3 py-2 rounded-2xl text-sm leading-snug"
                            style={
                              isOwn
                                ? {
                                    background: "linear-gradient(135deg, #4F46E5, #6366F1)",
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
                            <div className="text-[9px] mt-0.5 opacity-50 text-right">
                              {timeAgo(msg.timestamp)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={groupChatEndRef} />
                  </div>

                  {/* Input */}
                  <div
                    className="px-3 py-3 flex gap-2 shrink-0"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <input
                      ref={groupMsgInputRef}
                      value={groupMsgInput}
                      onChange={(e) => setGroupMsgInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendGroupMessage()}
                      placeholder="Gruba mesaj yaz..."
                      className="flex-1 px-3 py-2 rounded-xl text-sm text-white placeholder-slate-600 outline-none focus:ring-1 focus:ring-indigo-500/40"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.09)",
                      }}
                    />
                    <button
                      onClick={handleSendGroupMessage}
                      disabled={!groupMsgInput.trim()}
                      className="px-3.5 py-2 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-30 active:scale-95"
                      style={{ background: "linear-gradient(135deg, #4F46E5, #6366F1)" }}
                    >
                      ➤
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ════════════ CREATE GROUP VIEW ════════════ */}
              {view === "create-group" && (
                <motion.div
                  key="create-group"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.18 }}
                  className="flex-1 overflow-y-auto px-4 py-4 space-y-5"
                >
                  {/* Group name */}
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                      Grup Adı
                    </div>
                    <input
                      autoFocus
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()}
                      placeholder="Örn: Odak Takımı ✈"
                      maxLength={30}
                      className="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-slate-600 outline-none focus:ring-1 focus:ring-indigo-500/40"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.09)",
                      }}
                    />
                  </div>

                  {/* Member selection */}
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                      Üyeler Seç ({selectedGroupMembers.length} seçildi)
                    </div>
                    {friends.length === 0 ? (
                      <p className="text-xs text-slate-600">Grup için önce arkadaş ekle.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {friends.map((f) => {
                          const selected = selectedGroupMembers.includes(f.username);
                          return (
                            <button
                              key={f.username}
                              onClick={() =>
                                setSelectedGroupMembers((prev) =>
                                  selected
                                    ? prev.filter((u) => u !== f.username)
                                    : [...prev, f.username]
                                )
                              }
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
                              style={
                                selected
                                  ? {
                                      background: "rgba(99,102,241,0.12)",
                                      border: "1px solid rgba(99,102,241,0.35)",
                                    }
                                  : {
                                      background: "rgba(255,255,255,0.03)",
                                      border: "1px solid rgba(255,255,255,0.07)",
                                    }
                              }
                            >
                              <div
                                className="w-5 h-5 rounded-md flex items-center justify-center text-xs shrink-0 transition-all"
                                style={
                                  selected
                                    ? { background: "#6366F1", border: "none", color: "white" }
                                    : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "transparent" }
                                }
                              >
                                {selected && "✓"}
                              </div>
                              <div
                                className="w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0"
                                style={{
                                  background: f.isFlying ? "rgba(14,165,233,0.2)" : "rgba(255,255,255,0.05)",
                                  border: f.isFlying ? "1px solid rgba(14,165,233,0.4)" : "1px solid rgba(255,255,255,0.08)",
                                }}
                              >
                                {f.isFlying ? "✈" : "👤"}
                              </div>
                              <span className="text-sm text-slate-200">{f.username}</span>
                              {f.isFlying && (
                                <span className="text-[9px] text-sky-400 ml-auto">uçuyor</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Create button */}
                  <button
                    onClick={handleCreateGroup}
                    disabled={!newGroupName.trim() || selectedGroupMembers.length === 0 || creatingGroup}
                    className="w-full py-3 rounded-2xl font-bold text-white transition-all active:scale-[0.98] disabled:opacity-40"
                    style={{
                      background: "linear-gradient(135deg, #4F46E5, #6366F1)",
                      boxShadow: "0 4px 20px rgba(99,102,241,0.35)",
                    }}
                  >
                    {creatingGroup
                      ? "Oluşturuluyor…"
                      : `👥 ${newGroupName.trim() || "Grup"} Oluştur (${selectedGroupMembers.length + 1} kişi)`}
                  </button>
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
