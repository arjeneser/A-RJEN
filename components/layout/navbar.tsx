"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useUserStore, getLevel } from "@/store/user-store";
import { useActiveSession } from "@/store/flight-store";
import { useAuthStore } from "@/store/auth-store";

const NAV_LINKS = [
  { href: "/", label: "Ana Sayfa" },
  { href: "/new-flight", label: "Yeni Uçuş" },
  { href: "/passport", label: "Pasaport" },
];

export function Navbar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { profile } = useUserStore();
  const { session } = useActiveSession();
  const { currentUsername, logout } = useAuthStore();
  const level = getLevel(profile.totalFlights);

  function handleLogout() {
    logout();
    router.push("/login");
  }

  const isFlightActive =
    session?.status === "running" || session?.status === "paused";

  return (
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
            {/* Active flight indicator */}
            {isFlightActive && (
              <Link href="/focus">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-sky/10 border border-brand-sky/30 text-brand-sky text-xs font-medium cursor-pointer hover:bg-brand-sky/20 transition-colors"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-sky opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-sky" />
                  </span>
                  Uçuş Aktif
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
                  <span
                    className="text-xs font-semibold"
                    style={{ color: level.color }}
                  >
                    {level.name}
                  </span>
                </div>
              </Link>
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
  );
}
