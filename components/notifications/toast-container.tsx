"use client";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToastStore, type AppToast } from "@/store/toast-store";

const ICONS: Record<AppToast["type"], string> = {
  message:         "💬",
  invite:          "✈",
  friend_accepted: "👥",
};

const COLORS: Record<AppToast["type"], { bg: string; border: string; accent: string }> = {
  message:         { bg: "rgba(30,58,138,0.85)", border: "rgba(59,130,246,0.35)", accent: "#3B82F6" },
  invite:          { bg: "rgba(46,16,101,0.85)", border: "rgba(124,58,237,0.35)", accent: "#7C3AED" },
  friend_accepted: { bg: "rgba(5,46,22,0.85)",   border: "rgba(34,197,94,0.35)",  accent: "#22C55E" },
};

function ToastCard({ toast }: { toast: AppToast }) {
  const { remove } = useToastStore();
  const colors = COLORS[toast.type];

  // Otomatik kapat (5 saniye)
  useEffect(() => {
    const t = setTimeout(() => remove(toast.id), 5000);
    return () => clearTimeout(t);
  }, [toast.id, remove]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 60, scale: 0.92 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 360, damping: 28 }}
      className="relative flex items-start gap-3 px-4 py-3.5 rounded-2xl shadow-2xl cursor-pointer select-none"
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        backdropFilter: "blur(16px)",
        boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${colors.border}`,
        minWidth: 280,
        maxWidth: 340,
      }}
      onClick={() => remove(toast.id)}
    >
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

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl overflow-hidden">
        <motion.div
          className="h-full"
          style={{ background: colors.accent, opacity: 0.4 }}
          initial={{ width: "100%" }}
          animate={{ width: "0%" }}
          transition={{ duration: 5, ease: "linear" }}
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
