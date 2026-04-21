"use client";
import { motion } from "framer-motion";
import { useFlightSetup } from "@/store/flight-store";
import { FLIGHT_DURATIONS } from "@/data/cities";
import type { FlightDurationOption } from "@/types";

export function StepDuration() {
  const { departure, duration, setDuration } = useFlightSetup();

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

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
        {FLIGHT_DURATIONS.map((opt, i) => {
          const isSelected = duration?.key === opt.key;
          return (
            <motion.button
              key={opt.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.25 }}
              onClick={() => setDuration(opt)}
              className={`relative text-center p-3.5 rounded-2xl transition-all duration-200 ${
                isSelected ? "scale-[1.05]" : "hover:scale-[1.02]"
              }`}
              style={{
                background: isSelected
                  ? "linear-gradient(135deg, #1D4ED8, #1E3A8A)"
                  : "rgba(255,255,255,0.04)",
                border: isSelected
                  ? "1px solid rgba(59,130,246,0.6)"
                  : "1px solid rgba(255,255,255,0.07)",
                boxShadow: isSelected
                  ? "0 0 20px rgba(59,130,246,0.3)"
                  : undefined,
              }}
            >
              <div className="text-2xl mb-1.5">{opt.icon}</div>
              <div
                className="font-bold text-base text-white leading-tight"
                style={{ fontFamily: "Space Grotesk, sans-serif" }}
              >
                {opt.label}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                {opt.subtitle}
              </div>
              <div className="mt-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-yellow-500/15 border border-yellow-500/20 text-[10px] font-semibold text-yellow-400">
                +{opt.xpReward} XP
              </div>
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-2 right-2 w-4 h-4 rounded-full bg-brand-sky flex items-center justify-center"
                >
                  <span className="text-white text-[9px]">✓</span>
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
