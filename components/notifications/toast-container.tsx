"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useToastStore, type AppToast } from "@/store/toast-store";
import { useAuthStore } from "@/store/auth-store";
import { useFlightSetup } from "@/store/flight-store";
import { acceptFriendRequest, rejectFriendRequest } from "@/lib/friends";
import { leaveGroup } from "@/lib/groups";
import { removeFlightInvite } from "@/lib/flight-invites";
import { joinLobby } from "@/lib/lobby";

const ICONS: Record<AppToast["type"], string> = {
  message:         "💬",
  invite:          "✈",
  friend_accepted: "👥",
  friend_request:  "🤝",
  group_invite:    "👥",
};

const COLORS: Record<AppToast["type"], { bg: string; border: string; accent: string }> = {
  message:         { bg: "rgba(30,58,138,0.85)",  border: "rgba(59,130,246,0.35)",  accent: "#3B82F6" },
  invite:          { bg: "rgba(46,16,101,0.85)",  border: "rgba(124,58,237,0.35)",  accent: "#7C3AED" },
  friend_accepted: { bg: "rgba(5,46,22,0.85)",    border: "rgba(34,197,94,0.35)",   accent: "#22C55E" },
  friend_request:  { bg: "rgba(120,53,15,0.85)",  border: "rgba(245,158,11,0.35)",  accent: "#F59E0B" },
  group_invite:    { bg: "rgba(6,78,59,0.85)",    border: "rgba(16,185,129,0.35)",  accent: "#10B981" },
};

function ToastCard({ toast }: { toast: AppToast }) {
  const { remove } = useToastStore();
  const { currentUsername } = useAuthStore();
  const { joinFlight, setDuration } = useFlightSetup();
  const router = useRouter();
  const colors = COLORS[toast.type];

  const hasActions =
    toast.type === "friend_request" ||
    toast.type === "group_invite" ||
    (toast.type === "invite" && !!toast.meta?.inviteId);

  // Action olmayan kartlar 5sn sonra otomatik kapanır
  // Action olan kartlar kullanıcı karar verene kadar durur (10sn)
  useEffect(() => {
    const timeout = hasActions ? 10_000 : 5_000;
    const t = setTimeout(() => remove(toast.id), timeout);
    return () => clearTimeout(t);
  }, [toast.id, remove, hasActions]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 60, scale: 0.92 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 360, damping: 28 }}
      className="relative flex flex-col rounded-2xl shadow-2xl select-none overflow-hidden"
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        backdropFilter: "blur(16px)",
        boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${colors.border}`,
        minWidth: 280,
        maxWidth: 340,
      }}
      onClick={hasActions ? undefined : () => remove(toast.id)}
    >
      {/* ── Üst içerik ──────────────────────────────────────────────────── */}
      <div className="relative flex items-start gap-3 px-4 py-3.5">
        {/* Accent bar */}
        <div
          className="absolute left-0 top-3 bottom-3 w-1 rounded-full"
          style={{ background: colors.accent }}
        />

        {/* Icon */}
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
          style={{
            background: `${colors.accent}22`,
            border: `1px solid ${colors.accent}44`,
          }}
        >
          {ICONS[toast.type]}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span
              className="text-sm font-semibold text-white truncate"
              style={{ fontFamily: "Space Grotesk, sans-serif" }}
            >
              {toast.from}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); remove(toast.id); }}
              className="text-slate-600 hover:text-slate-400 transition-colors text-xs shrink-0"
            >
              ✕
            </button>
          </div>
          <p className="text-xs text-slate-400 leading-snug line-clamp-2">
            {toast.preview}
          </p>
        </div>
      </div>

      {/* ── Action butonları ────────────────────────────────────────────── */}
      {toast.type === "invite" && toast.meta?.inviteId && (
        <div
          className="flex"
          style={{ borderTop: `1px solid ${colors.border}` }}
        >
          <button
            onClick={async (e) => {
              e.stopPropagation();
              const { inviteId, departure, destination, durationOption, lobbyId } = toast.meta!;
              if (currentUsername && inviteId) {
                await removeFlightInvite(currentUsername, inviteId);
              }
              if (lobbyId) {
                if (currentUsername) await joinLobby(lobbyId, currentUsername);
                remove(toast.id);
                router.push(`/lobby/${lobbyId}`);
              } else {
                if (departure && destination) joinFlight(departure, destination);
                if (durationOption) setDuration(durationOption);
                remove(toast.id);
                router.push("/new-flight");
              }
            }}
            className="flex-1 py-2 text-xs font-bold transition-colors hover:opacity-90"
            style={{ background: "rgba(124,58,237,0.2)", color: "#C084FC" }}
          >
            ✈ Kabul Et
          </button>
          <div style={{ width: 1, background: colors.border }} />
          <button
            onClick={async (e) => {
              e.stopPropagation();
              if (currentUsername && toast.meta?.inviteId) {
                await removeFlightInvite(currentUsername, toast.meta.inviteId);
              }
              remove(toast.id);
            }}
            className="flex-1 py-2 text-xs font-medium transition-colors hover:opacity-90"
            style={{ background: "rgba(239,68,68,0.1)", color: "#F87171" }}
          >
            ✕ Reddet
          </button>
        </div>
      )}

      {toast.type === "friend_request" && (
        <div
          className="flex"
          style={{ borderTop: `1px solid ${colors.border}` }}
        >
          <button
            onClick={async (e) => {
              e.stopPropagation();
              if (currentUsername) await acceptFriendRequest(currentUsername, toast.from);
              remove(toast.id);
            }}
            className="flex-1 py-2 text-xs font-bold transition-colors hover:opacity-90"
            style={{ background: "rgba(245,158,11,0.18)", color: "#FCD34D" }}
          >
            ✓ Kabul Et
          </button>
          <div style={{ width: 1, background: colors.border }} />
          <button
            onClick={async (e) => {
              e.stopPropagation();
              if (currentUsername) await rejectFriendRequest(currentUsername, toast.from);
              remove(toast.id);
            }}
            className="flex-1 py-2 text-xs font-medium transition-colors hover:opacity-90"
            style={{ background: "rgba(239,68,68,0.1)", color: "#F87171" }}
          >
            ✕ Reddet
          </button>
        </div>
      )}

      {toast.type === "group_invite" && toast.meta && (
        <div
          className="flex"
          style={{ borderTop: `1px solid ${colors.border}` }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              remove(toast.id); // zaten gruba ekli, sadece kapat
            }}
            className="flex-1 py-2 text-xs font-bold transition-colors hover:opacity-90"
            style={{ background: "rgba(16,185,129,0.18)", color: "#34D399" }}
          >
            ✓ Katıl
          </button>
          <div style={{ width: 1, background: colors.border }} />
          <button
            onClick={async (e) => {
              e.stopPropagation();
              if (currentUsername && toast.meta?.groupId) {
                await leaveGroup(toast.meta.groupId, currentUsername);
              }
              remove(toast.id);
            }}
            className="flex-1 py-2 text-xs font-medium transition-colors hover:opacity-90"
            style={{ background: "rgba(239,68,68,0.1)", color: "#F87171" }}
          >
            ✕ Reddet
          </button>
        </div>
      )}

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden">
        <motion.div
          className="h-full"
          style={{ background: colors.accent, opacity: 0.4 }}
          initial={{ width: "100%" }}
          animate={{ width: "0%" }}
          transition={{ duration: hasActions ? 10 : 5, ease: "linear" }}
        />
      </div>
    </motion.div>
  );
}

export function ToastContainer() {
  const { toasts } = useToastStore();

  return (
    <div
      className="fixed z-[100] flex flex-col gap-2.5 pointer-events-none"
      style={{ bottom: 24, right: 20 }}
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastCard toast={t} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
