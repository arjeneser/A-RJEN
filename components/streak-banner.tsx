"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/user-store";
import { todayISO } from "@/lib/utils";

export function StreakBanner() {
  const router = useRouter();
  const { profile, buyStreakFreeze, applyStreakFreeze } = useUserStore();
  const [dismissed, setDismissed] = useState(false);
  const [freezeUsed, setFreezeUsed] = useState(false);

  const today = todayISO();

  // Gösterme koşulları
  const hasStreak      = profile.currentStreak > 0;
  const flewToday      = profile.lastFlightDate === today;
  const frozenToday    = (profile.frozenDates ?? []).includes(today);
  const shouldShow     = hasStreak && !flewToday && !frozenToday && !dismissed && !freezeUsed;

  function handleFreeze() {
    const freezes = profile.streakFreezes ?? 0;
    if (freezes > 0) {
      applyStreakFreeze();
      setFreezeUsed(true);
    } else {
      // 20 XP harcanacak — onay iste
      if (profile.totalXP < 20) return;
      const ok = window.confirm(`20 XP harcayarak bugünkü seriyi dondurmak istiyor musunuz?\nMevcut XP: ${profile.totalXP}`);
      if (!ok) return;
      const bought = buyStreakFreeze();
      if (bought) {
        applyStreakFreeze();
        setFreezeUsed(true);
      }
    }
  }

  const canFreeze = (profile.streakFreezes ?? 0) > 0 || profile.totalXP >= 20;
  const freezeLabel = (profile.streakFreezes ?? 0) > 0
    ? `Dondur (${profile.streakFreezes} hakkın var)`
    : `Dondur — 20 XP`;

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ opacity: 0, y: -12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.97 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="mb-6 rounded-2xl px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3"
          style={{
            background: "linear-gradient(135deg, rgba(239,68,68,0.10), rgba(251,146,60,0.08))",
            border: "1px solid rgba(239,68,68,0.25)",
          }}
        >
          {/* İkon + Mesaj */}
          <div className="flex items-center gap-3 flex-1">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
              style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)" }}
            >
              🔥
            </div>
            <div>
              <div className="text-sm font-bold text-white" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                {profile.currentStreak} günlük seriniz tehlikede!
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                Bugün uçmazsanız sıfırlanır. Şimdi harekete geçin.
              </div>
            </div>
          </div>

          {/* Butonlar */}
          <div className="flex items-center gap-2 shrink-0">
            <motion.button
              onClick={() => router.push("/new-flight")}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{
                background: "linear-gradient(135deg, #EF4444, #DC2626)",
                boxShadow: "0 4px 14px rgba(239,68,68,0.35)",
              }}
            >
              ✈ Şimdi Uç
            </motion.button>

            {canFreeze && (
              <motion.button
                onClick={handleFreeze}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#94A3B8",
                }}
              >
                🧊 {freezeLabel}
              </motion.button>
            )}

            <button
              onClick={() => setDismissed(true)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-400 transition-colors text-lg"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              ×
            </button>
          </div>
        </motion.div>
      )}

      {/* Freeze başarılı mesajı */}
      {freezeUsed && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="mb-6 rounded-2xl px-4 py-3 flex items-center gap-3"
          style={{
            background: "rgba(14,165,233,0.07)",
            border: "1px solid rgba(14,165,233,0.2)",
          }}
        >
          <span className="text-xl">🧊</span>
          <div>
            <span className="text-sm font-semibold text-white">Seri donduruldu!</span>
            <span className="text-xs text-slate-400 ml-2">{profile.currentStreak} günlük seriniz bugün için korunuyor.</span>
          </div>
          <button
            onClick={() => setFreezeUsed(false)}
            className="ml-auto text-slate-600 hover:text-slate-400 text-lg"
          >
            ×
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
