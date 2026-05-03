"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FLIGHT_DURATIONS } from "@/data/cities";
import type { FlightDurationOption } from "@/types";

// ── Hour groups ───────────────────────────────────────────────────────────────
// Group 0 = "30 Dk" (solo), Group 1..12 = "N Saat" pairs
function buildGroups() {
  const groups: Array<{
    hour: number;
    label: string;
    icon: string;
    options: FlightDurationOption[];
  }> = [];

  groups.push({
    hour:    0,
    label:   "30 Dk",
    icon:    FLIGHT_DURATIONS[0].icon,
    options: [FLIGHT_DURATIONS[0]],
  });

  for (let h = 1; h <= 12; h++) {
    const base = 1 + (h - 1) * 2;
    groups.push({
      hour:    h,
      label:   `${h} Saat`,
      icon:    FLIGHT_DURATIONS[base].icon,
      options: [FLIGHT_DURATIONS[base], FLIGHT_DURATIONS[base + 1]],
    });
  }
  return groups;
}

export const HOUR_GROUPS = buildGroups();

// Returns the group index for a given duration key (null if not found)
export function groupIndexForKey(key: string | undefined): number | null {
  if (!key) return null;
  for (let gi = 0; gi < HOUR_GROUPS.length; gi++) {
    if (HOUR_GROUPS[gi].options.some((o) => o.key === key)) return gi;
  }
  return null;
}

interface DurationPickerProps {
  value:     FlightDurationOption | null;
  onChange:  (opt: FlightDurationOption) => void;
  accentColor?: string; // e.g. "#1D4ED8" (blue) or "#4C1D95" (purple)
}

export function DurationPicker({ value, onChange, accentColor = "#1D4ED8" }: DurationPickerProps) {
  const [expandedGroup, setExpandedGroup] = useState<number | null>(
    () => groupIndexForKey(value?.key)
  );

  const accentGradient = `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`;

  function handleGroupClick(gi: number) {
    const group = HOUR_GROUPS[gi];
    if (expandedGroup === gi) {
      setExpandedGroup(null);
    } else {
      setExpandedGroup(gi);
      if (group.options.length === 1) onChange(group.options[0]);
    }
  }

  function groupHasSelection(gi: number) {
    return HOUR_GROUPS[gi].options.some((o) => o.key === value?.key);
  }

  return (
    <div>
      {/* ── Primary hour buttons ─────────────────────────────────────────── */}
      <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
        {HOUR_GROUPS.map((group, gi) => {
          const active = expandedGroup === gi || groupHasSelection(gi);
          return (
            <motion.button
              key={group.hour}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: gi * 0.025, duration: 0.2 }}
              onClick={() => handleGroupClick(gi)}
              className="relative text-center py-2.5 px-1 rounded-2xl transition-all duration-200"
              style={{
                background: active ? accentGradient : "rgba(255,255,255,0.04)",
                border:     active ? `1px solid ${accentColor}99` : "1px solid rgba(255,255,255,0.07)",
                boxShadow:  active ? `0 0 14px ${accentColor}44` : undefined,
                transform:  active ? "scale(1.04)" : undefined,
              }}
            >
              <div className="text-xl mb-0.5">{group.icon}</div>
              <div
                className="font-bold text-xs text-white leading-tight"
                style={{ fontFamily: "Space Grotesk, sans-serif" }}
              >
                {group.label}
              </div>
              {groupHasSelection(gi) && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                  style={{ background: accentColor }}
                >
                  <span className="text-white text-[8px]">✓</span>
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* ── Sub-options ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {expandedGroup !== null && HOUR_GROUPS[expandedGroup].options.length > 1 && (
          <motion.div
            key={`sub-${expandedGroup}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="mt-3 grid grid-cols-2 gap-3">
              {HOUR_GROUPS[expandedGroup].options.map((opt, oi) => {
                const isSelected = value?.key === opt.key;
                return (
                  <motion.button
                    key={opt.key}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: oi * 0.07, duration: 0.2 }}
                    onClick={() => onChange(opt)}
                    className="relative text-center p-4 rounded-2xl transition-all duration-200"
                    style={{
                      background: isSelected ? accentGradient : "rgba(255,255,255,0.06)",
                      border:     isSelected ? `1px solid ${accentColor}bb` : "1px solid rgba(255,255,255,0.1)",
                      boxShadow:  isSelected ? `0 0 22px ${accentColor}55` : undefined,
                      transform:  isSelected ? "scale(1.03)" : undefined,
                    }}
                  >
                    <div className="text-3xl mb-2">{opt.icon}</div>
                    <div
                      className="font-bold text-base text-white leading-tight mb-0.5"
                      style={{ fontFamily: "Space Grotesk, sans-serif" }}
                    >
                      {opt.label}
                    </div>
                    <div className="text-[11px] text-slate-400 mb-2">{opt.subtitle}</div>
                    <div className="text-[10px] text-slate-500 mb-2">
                      {opt.minDistanceKm}–{opt.maxDistanceKm} km
                    </div>
                    <div
                      className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                      style={{
                        background: "rgba(245,158,11,0.12)",
                        border:     "1px solid rgba(245,158,11,0.2)",
                        color:      "#FCD34D",
                      }}
                    >
                      +{opt.xpReward} XP
                    </div>
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ background: accentColor }}
                      >
                        <span className="text-white text-[10px]">✓</span>
                      </motion.div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selection summary */}
      {value && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 flex items-center gap-2 text-sm text-slate-400"
        >
          <span className="text-green-400">✓</span>
          <span>
            <span className="text-white font-medium">{value.label}</span> seçildi
            {" · "}
            {value.minDistanceKm}–{value.maxDistanceKm} km arası destinasyonlar
          </span>
        </motion.div>
      )}
    </div>
  );
}
