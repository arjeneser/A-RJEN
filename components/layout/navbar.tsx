"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useUserStore, getLevel } from "@/store/user-store";
import { useActiveSession } from "@/store/flight-store";
import { useAuthStore } from "@/store/auth-store";
import { formatDuration } from "@/lib/utils";
import { FriendsPanel } from "@/components/friends/friends-panel";
import { useToastStore, type AppToast } from "@/store/toast-store";

const NAV_LINKS = [
  { href: "/", label: "Ana Sayfa" },
  { href: "/new-flight", label: "Yeni Uçuş" },
  { href: "/passport", label: "Pasaport" },
];

const POPUP_ICONS: Record<AppToast["type"], string> = {
  message:         "💬",
  invite:          "✈",
  friend_accepted: "👥",
  friend_request:  "🤝",
};

const POPUP_LABELS: Record<AppToast["type"], string> = {
  message:         "Yeni mesaj",
  invite:          "Uçuş daveti",
  friend_accepted: "Arkadaşlık kabul edildi",
  friend_request:  "Arkadaşlık isteği",
};

export function Navbar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { profile } = useUserStore();
  const { session, getElapsedMs } = useActiveSession();
  const { currentUsername, logout } = useAuthStore();
  const level = getLevel(profile.totalFlights);

  const [remainingMs, setRemainingMs]         = useState(0);
  const [friendsPanelOpen, setFriendsPanelOpen] = useState(false);
  const [friendsNotifCount, setFriendsNotifCount] = useState(0);

  // ── Arkadaş butonu popup ───────────────────────────────────────────────────
  const { toasts, remove } = useToastStore();
  const [popupToast, setPopupToast] = useState<AppToast | null>(null);
  const prevToastCountRef           = useRef(0);

  // Yeni toast gelince popup'ı tetikle
  useEffect(() => {
    if (toasts.length > prevToastCountRef.current) {
      const newest = toasts[toasts.length - 1];
      setPopupToast(newest);
    }
    prevToastCountRef.current = toasts.length;
  }, [toasts]);

  // 5 saniye sonra popup'ı otomatik kapat
  useEffect(() => {
    if (!popupToast) return;
    const t = setTimeout(() => setPopupToast(null), 5000);
    return () => clearTimeout(t);
  }, [popupToast?.id]);

  function dismissPopup() {
    if (popupToast) remove(popupToast.id);
    setPopupToast(null);
  }

  function openPanelFromPopup() {
    dismissPopup();
    setFriendsPanelOpen(true);
  }

  // ── Timer ──────────────────────────────────────────────────────────────────
  const isFlightActive = session?.status === "running" || session?.status === "paused";
  const isCompleted    = session?.status === "completed";

  useEffect(() => {
    if (!session || (!isFlightActive && !isCompleted)) return;
    const update = () => {
      const elapsed = getElapsedMs();
      setRemainingMs(Math.max(0, session.durationMs - elapsed));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [session, isFlightActive, isCompleted, getElapsedMs]);

  function handleLogout() {
    logout();
    router.push("/login");
  }

  const showTimer = (isFlightActive || isCompleted) && pathname !== "/focus";

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50">
        <div className="glass border-b border-white/[0.06]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">

            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group">
              <span className="text-xl">✈</span>
              <span
                className="font-display font-bold text-lg tracking-widest text-brand-sky"
                style={{ fontFamily: "Space Grotesk, sans-serif" }}
              >
                AIRJEN
              </span>
            </Link>

            {/* Nav links */}
            <nav className="hidden md:flex items-center gap-1">
              {NAV_LINKS.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "relative px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200",
                      isActive
                        ? "text-white"
                        : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
                    )}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="navbar-active"
                        className="absolute inset-0 bg-white/[0.08] rounded-lg"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                      />
                    )}
                    <span className="relative">{link.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-3">

              {/* ── Uçuş timer / TAMAMLANDI ──────────────────────── */}
              {showTimer && (
                <Link href="/focus">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold cursor-pointer transition-colors"
                    style={
                      isCompleted
                        ? { background: "rgba(34,197,94,0.15)", borderColor: "rgba(34,197,94,0.4)", color: "#22C55E" }
                        : session?.status === "paused"
                        ? { background: "rgba(245,158,11,0.1)", borderColor: "rgba(245,158,11,0.35)", color: "#F59E0B" }
                        : { background: "rgba(14,165,233,0.1)", borderColor: "rgba(14,165,233,0.3)", color: "#38BDF8" }
                    }
                  >
                    {isCompleted ? (
                      <>
                        <span>🛬</span>
                        <span className="tracking-widest" style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 11 }}>
                          TAMAMLANDI
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="relative flex h-2 w-2">
                          {session?.status === "running" && (
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                          )}
                          <span
                            className="relative inline-flex rounded-full h-2 w-2"
                            style={{ background: session?.status === "paused" ? "#F59E0B" : "#38BDF8" }}
                          />
                        </span>
                        <span style={{ fontFamily: "Space Grotesk, sans-serif", letterSpacing: 1 }}>
                          {formatDuration(remainingMs)}
                        </span>
                      </>
                    )}
                  </motion.div>
                </Link>
              )}

              {/* User level pill */}
              {currentUsername && (
                <Link href="/passport">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-colors cursor-pointer">
                    <span className="text-sm">{level.emoji}</span>
                    <span className="text-xs font-medium text-slate-300">{currentUsername}</span>
                    <span className="text-xs font-semibold" style={{ color: level.color }}>{level.name}</span>
                  </div>
                </Link>
              )}

              {/* ── Friends button + popup ──────────────────────── */}
              {currentUsername && (
                <div className="relative">
                  {/* Button */}
                  <button
                    onClick={() => { setFriendsPanelOpen(true); dismissPopup(); }}
                    className="relative px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                    style={{
                      background: popupToast
                        ? "rgba(168,85,247,0.18)"
                        : "rgba(168,85,247,0.08)",
                      border: `1px solid ${popupToast ? "rgba(168,85,247,0.5)" : "rgba(168,85,247,0.2)"}`,
                      color: "#C084FC",
                      boxShadow: popupToast ? "0 0 12px rgba(168,85,247,0.35)" : "none",
                    }}
                    title="Arkadaşlar"
                  >
                    👥
                    {/* Kırmızı badge */}
                    {friendsNotifCount > 0 && !popupToast && (
                      <span
                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center"
                        style={{ background: "#EF4444", color: "white" }}
                      >
                        {friendsNotifCount > 9 ? "9+" : friendsNotifCount}
                      </span>
                    )}
                    {/* Animasyonlu halka (popup varken) */}
                    {popupToast && (
                      <span
                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full animate-ping"
                        style={{ background: "rgba(168,85,247,0.6)" }}
                      />
                    )}
                  </button>

                  {/* ── Popup ──────────────────────────────────────── */}
                  <AnimatePresence>
                    {popupToast && (
                      <motion.div
                        key={popupToast.id}
                        initial={{ opacity: 0, y: -8, scale: 0.92 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.94 }}
                        transition={{ type: "spring", stiffness: 400, damping: 28 }}
                        className="absolute right-0 top-[calc(100%+10px)] z-50"
                        style={{ width: 260 }}
                      >
                        {/* Ok işareti */}
                        <div
                          className="absolute -top-1.5 right-3.5 w-3 h-3 rotate-45"
                          style={{
                            background: "#1A0A2E",
                            border: "1px solid rgba(168,85,247,0.4)",
                            borderBottomColor: "transparent",
                            borderRightColor: "transparent",
                          }}
                        />

                        {/* Kart */}
                        <div
                          className="rounded-2xl overflow-hidden"
                          style={{
                            background: "linear-gradient(135deg, #1A0A2E 0%, #0F0720 100%)",
                            border: "1px solid rgba(168,85,247,0.35)",
                            boxShadow: "0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(168,85,247,0.15)",
                          }}
                        >
                          {/* İçerik */}
                          <div className="px-4 pt-4 pb-3">
                            <div className="flex items-start gap-3">
                              {/* İkon */}
                              <div
                                className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
                                style={{
                                  background: "rgba(168,85,247,0.2)",
                                  border: "1px solid rgba(168,85,247,0.35)",
                                }}
                              >
                                {POPUP_ICONS[popupToast.type]}
                              </div>

                              {/* Metin */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1 mb-0.5">
                                  <span
                                    className="text-[10px] font-bold uppercase tracking-wider"
                                    style={{ color: "rgba(192,132,252,0.7)" }}
                                  >
                                    {POPUP_LABELS[popupToast.type]}
                                  </span>
                                  <button
                                    onClick={dismissPopup}
                                    className="text-slate-700 hover:text-slate-400 transition-colors text-xs shrink-0"
                                  >
                                    ✕
                                  </button>
                                </div>
                                <div
                                  className="text-sm font-semibold text-white truncate"
                                  style={{ fontFamily: "Space Grotesk, sans-serif" }}
                                >
                                  {popupToast.from}
                                </div>
                                <p className="text-xs text-slate-400 mt-0.5 line-clamp-2 leading-snug">
                                  {popupToast.preview}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Aç butonu */}
                          <button
                            onClick={openPanelFromPopup}
                            className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold transition-colors"
                            style={{
                              background: "rgba(168,85,247,0.12)",
                              borderTop: "1px solid rgba(168,85,247,0.2)",
                              color: "#C084FC",
                            }}
                          >
                            <span>
                              {popupToast?.type === "message"
                                ? "Mesaja Git"
                                : popupToast?.type === "friend_request"
                                ? "İsteği Gör"
                                : popupToast?.type === "invite"
                                ? "Daveti Gör"
                                : "Arkadaşlar"}
                            </span>
                            <span>→</span>
                          </button>

                          {/* Progress bar */}
                          <div className="h-0.5" style={{ background: "rgba(168,85,247,0.1)" }}>
                            <motion.div
                              className="h-full"
                              style={{ background: "rgba(168,85,247,0.5)" }}
                              initial={{ width: "100%" }}
                              animate={{ width: "0%" }}
                              transition={{ duration: 5, ease: "linear" }}
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Logout */}
              {currentUsername && (
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 rounded-full text-xs text-slate-500 hover:text-slate-300 transition-colors"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}
                  title="Çıkış Yap"
                >
                  ⏏
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Friends panel */}
      <FriendsPanel
        open={friendsPanelOpen}
        onClose={() => setFriendsPanelOpen(false)}
        onNotificationCount={setFriendsNotifCount}
      />
    </>
  );
}
