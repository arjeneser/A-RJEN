"use client";
import { motion } from "framer-motion";
import { useFlightSetup } from "@/store/flight-store";

const ROWS = 24;
const COLS = ["A", "B", "C", "D", "E", "F"] as const;
type Col = (typeof COLS)[number];

// Tüm koltuklar boş
const TAKEN = new Set<string>();

export function StepSeat() {
  const { departure, destination, seat, setSeat } = useFlightSetup();

  const seatId = (row: number, col: Col) => `${row}${col}`;

  return (
    <div>
      <div className="mb-5">
        <h2
          className="text-2xl font-bold mb-1"
          style={{ fontFamily: "Space Grotesk, sans-serif" }}
        >
          Koltuğunuzu Seçin
        </h2>
        <p className="text-slate-400 text-sm">
          {departure?.name} → {destination?.name}
        </p>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 mb-5 text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-blue-800 border border-blue-600" />
          Uygun
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-yellow-500 border border-yellow-400" />
          Seçili
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded opacity-25 bg-slate-700 border border-slate-600" />
          Dolu
        </div>
      </div>

      {/* Selected seat label */}
      {seat && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 flex items-center gap-2 px-4 py-2 rounded-xl inline-flex"
          style={{
            background: "rgba(245,158,11,0.1)",
            border: "1px solid rgba(245,158,11,0.3)",
          }}
        >
          <span className="text-yellow-400 font-bold">Koltuk {seat}</span>
          <span className="text-slate-500 text-sm">seçildi</span>
        </motion.div>
      )}

      {/* Column headers */}
      <div className="overflow-x-auto">
        <div className="min-w-[320px]">
          <div className="flex items-center gap-1 mb-1 pl-10">
            {COLS.map((col) => (
              <div key={col} className="flex items-center gap-1">
                <div className="w-8 text-center text-[10px] text-slate-600 font-medium">
                  {col}
                </div>
                {col === "C" && <div className="w-5" />}
              </div>
            ))}
          </div>

          {/* Seat rows */}
          <div className="space-y-1 max-h-[360px] overflow-y-auto pr-1">
            {Array.from({ length: ROWS }, (_, i) => {
              const row = i + 1;
              return (
                <div key={row} className="flex items-center gap-1">
                  {/* Row number */}
                  <div className="w-9 text-center text-[10px] text-slate-600">
                    {row}
                  </div>
                  {/* Seats */}
                  {COLS.map((col) => {
                    const id = seatId(row, col);
                    const isTaken = TAKEN.has(id);
                    const isSelected = seat === id;
                    return (
                      <div key={col} className="flex items-center gap-1">
                        <button
                          disabled={isTaken}
                          onClick={() => setSeat(id)}
                          className={`
                            w-8 h-6 rounded text-[9px] font-medium transition-all duration-150 border
                            ${isTaken
                              ? "seat-taken cursor-not-allowed border-white/5 bg-slate-800/30 text-transparent"
                              : isSelected
                              ? "seat-selected bg-yellow-500 border-yellow-400 text-yellow-900 scale-110"
                              : "seat-available bg-blue-900/60 border-blue-700/60 text-slate-400 hover:bg-blue-700/80 hover:border-blue-500 hover:text-white"
                            }
                          `}
                        >
                          {!isTaken && col}
                        </button>
                        {col === "C" && <div className="w-5" />}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
