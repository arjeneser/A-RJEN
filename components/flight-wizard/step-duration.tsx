"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useFlightSetup } from "@/store/flight-store";
import { DurationPicker } from "./duration-picker";

// ── Motivasyon mesajı + önerilen mola ayarları ────────────────────────────────
function getBreakConfig(minutes: number): {
  message: string;
  defaultWork: number;
  defaultBreak: number;
} | null {
  if (minutes <= 30) return null; // 30 dk için mola gerekmez

  const label = minutes === 60 ? "1 saat"
    : minutes === 90  ? "1.5 saat"
    : minutes % 60 === 0 ? `${minutes / 60} saat`
    : `${Math.floor(minutes / 60)} saat 30 dk`;

  if (minutes <= 90) {
    return {
      message: `${label} ha, kolay gelisin! Yine de küçük bir mola eklersek daha verimli olabilir, ayarlayalım mı?`,
      defaultWork:  45,
      defaultBreak: 10,
    };
  }
  if (minutes <= 150) {
    return {
      message: `${label}! Güzel bir odak oturumu. Her 45 dk bir 10 dk mola öneririm, ister misin?`,
      defaultWork:  45,
      defaultBreak: 10,
    };
  }
  if (minutes <= 270) {
    return {
      message: `${label} ha, kolay gelisin! Hiç ara vermeden çalışmak zor olabilir, her 50 dk bir 15 dk mola ayarlayalım mı?`,
      defaultWork:  50,
      defaultBreak: 15,
    };
  }
  return {
    message: `${label}! Bu gerçek bir maraton. Düzenli molalar olmadan odağı korumak çok zor, her 60 dk bir 20 dk mola öneririm.`,
    defaultWork:  60,
    defaultBreak: 20,
  };
}

// ── Sayı arttır/azalt butonu ──────────────────────────────────────────────────
function Stepper({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div
      className="flex flex-col items-center gap-2 p-4 rounded-2xl"
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <span className="text-xs text-slate-400 font-medium">{label}</span>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(Math.max(min, value - step))}
          className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-white transition-colors text-lg font-bold"
          style={{ background: "rgba(255,255,255,0.07)" }}
        >
          −
        </button>
        <span
          className="text-2xl font-bold text-white w-12 text-center tabular-nums"
          style={{ fontFamily: "Space Grotesk, sans-serif" }}
        >
          {value}
        </span>
        <button
          onClick={() => onChange(Math.min(max, value + step))}
          className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-white transition-colors text-lg font-bold"
          style={{ background: "rgba(255,255,255,0.07)" }}
        >
          +
        </button>
      </div>
      <span className="text-[11px] text-slate-500">dakika</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function StepDuration() {
  const {
    departure, duration, setDuration,
    breakIntervalMinutes, breakDurationMinutes, setBreakSettings,
  } = useFlightSetup();

  const [breakEnabled, setBreakEnabled] = useState(() => {
    // Only enable breaks if duration is already set and >= 60 min
    if (!duration) return false;
    return duration.minutes > 30;
  });

  // Süre değişince mola varsayılanlarını güncelle
  useEffect(() => {
    if (!duration) return;
    const config = getBreakConfig(duration.minutes);
    if (config) {
      setBreakSettings(config.defaultWork, config.defaultBreak);
      setBreakEnabled(true);
    } else {
      setBreakSettings(0, 0);
      setBreakEnabled(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration?.key]);

  const breakConfig = duration ? getBreakConfig(duration.minutes) : null;

  return (
    <div>
      <div className="mb-6">
        <h2
          className="text-2xl font-bold mb-1"
          style={{ fontFamily: "Space Grotesk, sans-serif" }}
        >
          Ne Kadar Odaklanacaksınız?
        </h2>
        <p className="text-slate-400 text-sm">
          <span className="text-white font-medium">{departure?.name}</span>&apos;dan
          kalkış. Oturum sürenizi seçin.
        </p>
      </div>

      <DurationPicker
        value={duration}
        onChange={setDuration}
        accentColor="#1D4ED8"
      />

      {/* ── Mola ayarları ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {duration && breakConfig && (
          <motion.div
            key={duration.key + "-break"}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="mt-5 rounded-2xl p-4"
            style={{
              background: "rgba(59,130,246,0.06)",
              border: "1px solid rgba(59,130,246,0.15)",
            }}
          >
            {/* Mesaj */}
            <p className="text-sm text-slate-300 leading-relaxed mb-4">
              <span className="text-blue-400 text-base mr-1">✈️</span>
              {breakConfig.message}
            </p>

            {/* Evet/Hayır toggle */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => {
                  setBreakEnabled(true);
                  setBreakSettings(breakIntervalMinutes || breakConfig.defaultWork, breakDurationMinutes || breakConfig.defaultBreak);
                }}
                className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
                style={{
                  background: breakEnabled
                    ? "linear-gradient(135deg, #1D4ED8, #1E3A8A)"
                    : "rgba(255,255,255,0.05)",
                  border: breakEnabled
                    ? "1px solid rgba(59,130,246,0.5)"
                    : "1px solid rgba(255,255,255,0.08)",
                  color: breakEnabled ? "#fff" : "#94a3b8",
                }}
              >
                Evet, mola ekle
              </button>
              <button
                onClick={() => {
                  setBreakEnabled(false);
                  setBreakSettings(0, 0);
                }}
                className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
                style={{
                  background: !breakEnabled
                    ? "rgba(255,255,255,0.1)"
                    : "rgba(255,255,255,0.05)",
                  border: !breakEnabled
                    ? "1px solid rgba(255,255,255,0.2)"
                    : "1px solid rgba(255,255,255,0.08)",
                  color: !breakEnabled ? "#e2e8f0" : "#64748b",
                }}
              >
                Gerek yok
              </button>
            </div>

            {/* Stepper'lar */}
            <AnimatePresence>
              {breakEnabled && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <Stepper
                      label="Çalışma Süresi"
                      value={breakIntervalMinutes}
                      min={10}
                      max={120}
                      step={5}
                      onChange={(v) => setBreakSettings(v, breakDurationMinutes)}
                    />
                    <Stepper
                      label="Mola Süresi"
                      value={breakDurationMinutes}
                      min={5}
                      max={60}
                      step={5}
                      onChange={(v) => setBreakSettings(breakIntervalMinutes, v)}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 text-center mt-3">
                    Her <span className="text-slate-300">{breakIntervalMinutes} dk</span> çalışmanın ardından{" "}
                    <span className="text-slate-300">{breakDurationMinutes} dk</span> mola verilecek
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
