"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useUserStore, getLevel } from "@/store/user-store";
import { useActiveSession } from "@/store/flight-store";
import { useAuthStore } from "@/store/auth-store";
import { formatDuration } from "@/lib/utils";
import { FriendsPanel } from "@/components/friends/friends-panel";

const NAV_LINKS = [
  { href: "/", label: "Ana Sayfa" },
  { href: "/new-flight", label: "Yeni Uçuş" },
  { href: "/passport", label: "Pasaport" },
];

export function Navbar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { profile } = useUserStore();
  const { session, getElapsedMs } = useActiveSession();
  const { currentUsername, logout } = useAuthStore();
  const level = getLevel(profile.totalFlights);

  const [remainingMs, setRemainingMs] = useState(0);
  const [friendsPanelOpen, setFriendsPanelOpen] = useState(false);

  const isFlightActive =
    session?.status === "running" || session?.status === "paused";
  const isCompleted = session?.status === "completed";

  // Kalan süreyi her saniye güncelle (focus dışı sayfalarda)
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

  // Focus sayfasındayken timer gösterme (zaten orada var)
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

            {/* ── Uçuş timer / TAMAMLANDI ────────────────────────────── */}
            {showTimer && (
              <Link href="/focus">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold cursor-pointer transition-colors"
                  style={
                    isCompleted
                      ? {
                          background: "rgba(34,197,94,0.15)",
                          borderColor: "rgba(34,197,94,0.4)",
                          color: "#22C55E",
                        }
                      : session?.status === "paused"
                      ? {
                          background: "rgba(245,158,11,0.1)",
                          borderColor: "rgba(245,158,11,0.35)",
                          color: "#F59E0B",
                        }
                      : {
                          background: "rgba(14,165,233,0.1)",
                          borderColor: "rgba(14,165,233,0.3)",
                          color: "#38BDF8",
                        }
                  }
                >
                  {isCompleted ? (
                    <>
                      <span>🛬</span>
                      <span
                        className="tracking-widest"
                        style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 11 }}
                      >
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
                  <span className="text-xs font-medium text-slate-300">
                    {currentUsername}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: level.color }}>
                    {level.name}
                  </span>
                </div>
              </Link>
            )}

            {/* Friends button */}
            {currentUsername && (
              <button
                onClick={() => setFriendsPanelOpen(true)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
                style={{
                  background: "rgba(168,85,247,0.08)",
                  border: "1px solid rgba(168,85,247,0.2)",
                  color: "#C084FC",
                }}
                title="Arkadaşlar"
              >
                👥
              </button>
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

    {/* Friends panel (outside header so it overlays everything) */}
    <FriendsPanel open={friendsPanelOpen} onClose={() => setFriendsPanelOpen(false)} />
  </>
  );
}
