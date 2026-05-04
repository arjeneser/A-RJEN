"use client";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useFlightSetup, useActiveSession } from "@/store/flight-store";
import { StepDeparture } from "./step-departure";
import { StepDuration } from "./step-duration";
import { StepDestination } from "./step-destination";
import { StepSeat } from "./step-seat";
import { StepBoardingPass } from "./step-boarding-pass";
import { flagEmoji } from "@/data/cities";

const STEPS = [
  { id: 1, label: "Kalkış" },
  { id: 2, label: "Süre" },
  { id: 3, label: "Varış" },
  { id: 4, label: "Koltuk" },
  { id: 5, label: "Biniş" },
];

export function WizardShell() {
  const router = useRouter();
  const {
    step, setStep,
    departure, duration, destination, seat, passengerName,
    isContinuation, lockedDestination, journeyLeg, journeyCities,
    breakIntervalMinutes, breakDurationMinutes,
  } = useFlightSetup();
  const { startSession } = useActiveSession();

  // Continuation: step 1 is locked (departure pre-set), minimum step is 2
  const minStep = isContinuation ? 2 : 1;

  const canAdvance = (): boolean => {
    if (step === 1) return !!departure;
    if (step === 2) return !!duration;
    if (step === 3) return !!destination;
    if (step === 4) return !!seat;
    return true;
  };

  function handleNext() {
    if (step < 5) setStep(step + 1);
  }

  function handleBack() {
    if (step > minStep) setStep(step - 1);
  }

  function handleBoard() {
    if (!departure || !destination || !duration || !seat) return;
    startSession({
      departure,
      destination,
      durationMs: duration.minutes * 60 * 1000,
      seat,
      passengerName: passengerName || "FOCUS PILOT",
      breakIntervalMinutes,
      breakDurationMinutes,
    });
    router.push("/focus");
  }

  return (
    <div className="max-w-2xl mx-auto">

      {/* ── Join flight banner ─────────────────────────────────────── */}
      {lockedDestination && departure && destination && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 px-4 py-3 rounded-2xl flex items-center gap-2 flex-wrap"
          style={{
            background: "rgba(168,85,247,0.08)",
            border: "1px solid rgba(168,85,247,0.25)",
          }}
        >
          <span className="text-purple-400 text-xs font-semibold uppercase tracking-wider shrink-0">
            👥 Arkadaşınla Uç
          </span>
          <span className="text-xs text-slate-400">
            {departure.name} → {destination.name} güzergahı seçildi
            {duration && <span className="text-purple-300 font-semibold"> · {duration.label}</span>}
            {duration ? " · Koltuk seç ve uçuşa katıl!" : " · Süre seç ve uçuşa katıl!"}
          </span>
        </motion.div>
      )}

      {/* ── Journey breadcrumb (continuation mode) ─────────────────── */}
      {isContinuation && journeyCities.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 px-4 py-3 rounded-2xl flex items-center gap-2 flex-wrap"
          style={{
            background: "rgba(14,165,233,0.08)",
            border: "1px solid rgba(14,165,233,0.2)",
          }}
        >
          <span className="text-sky-400 text-xs font-semibold uppercase tracking-wider shrink-0">
            ✈ Yolculuk #{journeyLeg}
          </span>
          <div className="flex items-center gap-1 flex-wrap">
            {journeyCities.map((c, i) => (
              <span key={i} className="flex items-center gap-1 text-xs text-slate-400">
                {i > 0 && <span className="text-slate-600 mx-0.5">→</span>}
                <span>{flagEmoji(c.countryCode)}</span>
                <span>{c.name}</span>
              </span>
            ))}
            {departure && !journeyCities.find(c => c.id === departure.id) && (
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <span className="text-slate-600 mx-0.5">→</span>
                <span>{flagEmoji(departure.countryCode)}</span>
                <span className="text-sky-400 font-medium">{departure.name}</span>
              </span>
            )}
            <span className="text-slate-600 mx-0.5 text-xs">→ ?</span>
          </div>
        </motion.div>
      )}

      {/* ── Step indicator ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s) => {
          const isLocked = isContinuation && s.id === 1;
          return (
            <div key={s.id} className="flex items-center gap-2 flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={`
                    flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border-2 transition-all duration-300
                    ${isLocked
                      ? "bg-slate-800 border-slate-700 text-slate-600"
                      : step === s.id
                      ? "bg-brand-sky border-brand-sky text-white scale-110 shadow-sky-glow"
                      : step > s.id
                      ? "bg-brand-sky/20 border-brand-sky/50 text-brand-sky"
                      : "bg-transparent border-slate-700 text-slate-600"
                    }
                  `}
                >
                  {isLocked ? "🔒" : step > s.id ? "✓" : s.id}
                </div>
                <span
                  className={`text-[10px] mt-1 hidden sm:block transition-colors ${
                    isLocked ? "text-slate-700"
                    : step === s.id ? "text-brand-sky"
                    : step > s.id ? "text-slate-500"
                    : "text-slate-700"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {s.id < STEPS.length && (
                <div
                  className="flex-1 h-0.5 transition-all duration-500 mb-4"
                  style={{
                    background:
                      step > s.id
                        ? "rgba(14,165,233,0.5)"
                        : "rgba(255,255,255,0.06)",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Step content ───────────────────────────────────────────── */}
      <div
        className="rounded-3xl p-6 sm:p-8"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          backdropFilter: "blur(12px)",
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
          >
            {step === 1 && <StepDeparture />}
            {step === 2 && <StepDuration />}
            {step === 3 && <StepDestination />}
            {step === 4 && <StepSeat />}
            {step === 5 && <StepBoardingPass />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Navigation ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mt-6">
        <button
          onClick={handleBack}
          disabled={step <= minStep}
          className="px-6 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-white transition-colors disabled:opacity-0 disabled:pointer-events-none"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          ← Geri
        </button>

        {step < 5 ? (
          <motion.button
            onClick={handleNext}
            disabled={!canAdvance()}
            whileHover={canAdvance() ? { scale: 1.02 } : {}}
            whileTap={canAdvance() ? { scale: 0.98 } : {}}
            className="px-8 py-3 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: canAdvance()
                ? "linear-gradient(135deg, #3B82F6, #1D4ED8)"
                : "rgba(255,255,255,0.06)",
              boxShadow: canAdvance()
                ? "0 4px 20px rgba(59,130,246,0.3)"
                : "none",
            }}
          >
            Devam Et →
          </motion.button>
        ) : (
          <motion.button
            onClick={handleBoard}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="px-10 py-4 rounded-2xl text-base font-bold text-white flex items-center gap-2"
            style={{
              background: "linear-gradient(135deg, #3B82F6, #1D4ED8)",
              boxShadow: "0 8px 32px rgba(59,130,246,0.4)",
            }}
          >
            <span>🛫</span>
            UÇUŞA GEÇ
          </motion.button>
        )}
      </div>
    </div>
  );
}
