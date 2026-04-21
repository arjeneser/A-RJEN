"use client";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { useFlightSetup } from "@/store/flight-store";
import { flagEmoji } from "@/data/cities";
import { generateFlightNumber } from "@/lib/utils";

export function StepBoardingPass() {
  const { departure, destination, duration, seat, passengerName, setPassengerName } =
    useFlightSetup();

  const flightNumber = useMemo(() => generateFlightNumber(), []);
  const now = new Date();
  const boardingTime = now.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateStr = now.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const fromCode = (departure?.id ?? "DEP").slice(0, 3).toUpperCase();
  const toCode = (destination?.id ?? "DST").slice(0, 3).toUpperCase();

  return (
    <div>
      <div className="mb-5">
        <h2
          className="text-2xl font-bold mb-1"
          style={{ fontFamily: "Space Grotesk, sans-serif" }}
        >
          Biniş Kartınız
        </h2>
        <p className="text-slate-400 text-sm">
          Bilgilerinizi inceleyin ve hazır olduğunuzda uçuşa geçin.
        </p>
      </div>

      {/* Passenger name input */}
      <div className="mb-6">
        <label className="text-xs text-slate-500 uppercase tracking-widest block mb-2">
          Yolcu Adı
        </label>
        <input
          type="text"
          value={passengerName}
          onChange={(e) => setPassengerName(e.target.value.toUpperCase())}
          className="w-full px-4 py-3 rounded-xl text-white font-semibold text-lg outline-none focus:border-brand-sky/50 transition-colors"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            fontFamily: "Space Grotesk, sans-serif",
          }}
          maxLength={30}
          placeholder="ADINIZ"
        />
      </div>

      {/* The Boarding Pass card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="rounded-3xl overflow-hidden select-none"
        style={{
          background: "linear-gradient(135deg, #0F1228, #1E2348)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 8px 32px rgba(14,165,233,0.08)",
        }}
      >
        {/* Top gradient stripe */}
        <div
          className="h-14 flex items-center justify-between px-6"
          style={{ background: "linear-gradient(135deg, #3B82F6, #1D4ED8)" }}
        >
          <span
            className="font-bold text-white text-lg tracking-widest"
            style={{ fontFamily: "Space Grotesk, sans-serif" }}
          >
            ✈ AIRJEN
          </span>
          <span className="text-white/70 text-xs tracking-[0.2em] font-medium">
            BINIŞ KARTI
          </span>
        </div>

        {/* Route section */}
        <div className="p-6 pb-4">
          <div className="flex items-center justify-between">
            {/* From */}
            <div className="space-y-1">
              <div className="text-3xl">
                {departure ? flagEmoji(departure.countryCode) : "🌍"}
              </div>
              <div
                className="text-5xl font-bold text-white"
                style={{ fontFamily: "Space Grotesk, sans-serif" }}
              >
                {fromCode}
              </div>
              <div className="text-sm text-slate-400 max-w-[100px] truncate">
                {departure?.name}
              </div>
            </div>

            {/* Flight icon */}
            <div className="flex flex-col items-center gap-1">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
                style={{
                  background: "rgba(14,165,233,0.15)",
                  border: "1px solid rgba(14,165,233,0.3)",
                }}
              >
                ✈️
              </div>
              <span className="text-brand-sky text-xs font-medium">
                {duration?.label}
              </span>
              <div className="flex items-center gap-1">
                <div className="w-12 h-px bg-slate-700" />
              </div>
            </div>

            {/* To */}
            <div className="space-y-1 text-right">
              <div className="text-3xl">
                {destination ? flagEmoji(destination.countryCode) : "🌏"}
              </div>
              <div
                className="text-5xl font-bold text-white"
                style={{ fontFamily: "Space Grotesk, sans-serif" }}
              >
                {toCode}
              </div>
              <div className="text-sm text-slate-400 max-w-[100px] truncate text-right">
                {destination?.name}
              </div>
            </div>
          </div>
        </div>

        {/* Perforated divider */}
        <div className="perforated mx-4">
          <div
            className="my-0 border-t"
            style={{ borderColor: "rgba(255,255,255,0.07)", borderStyle: "dashed" }}
          />
        </div>

        {/* Detail fields */}
        <div className="p-6 pt-5">
          <div className="grid grid-cols-3 gap-4 mb-4">
            {[
              { label: "YOLCU", value: passengerName },
              { label: "KOLTUK", value: seat ?? "—" },
              { label: "KAPI", value: "ODAK-01" },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="text-[10px] text-slate-600 font-medium tracking-[0.15em] mb-1">
                  {label}
                </div>
                <div
                  className="text-white font-bold text-base truncate"
                  style={{ fontFamily: "Space Grotesk, sans-serif" }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "BINIŞ", value: boardingTime },
              { label: "TARİH", value: dateStr },
              { label: "SINIF", value: "EKONOMİ" },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="text-[10px] text-slate-600 font-medium tracking-[0.15em] mb-1">
                  {label}
                </div>
                <div
                  className="text-white font-bold text-sm"
                  style={{ fontFamily: "Space Grotesk, sans-serif" }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Perforated divider */}
        <div className="perforated mx-4">
          <div
            className="border-t"
            style={{ borderColor: "rgba(255,255,255,0.07)", borderStyle: "dashed" }}
          />
        </div>

        {/* QR + flight number */}
        <div className="p-6 pt-5 flex items-end justify-between">
          <div>
            <div className="text-[10px] text-slate-600 tracking-[0.15em] mb-1">
              UÇUŞ NO
            </div>
            <div
              className="text-white font-bold text-xl"
              style={{ fontFamily: "Space Grotesk, sans-serif" }}
            >
              {flightNumber}
            </div>
            <div className="mt-3">
              <div className="text-[10px] text-slate-600 tracking-[0.15em] mb-1">
                ODAK MODU
              </div>
              <div
                className="font-bold text-sm"
                style={{ color: "#F59E0B", fontFamily: "Space Grotesk, sans-serif" }}
              >
                DERİN ÇALIŞMA
              </div>
            </div>
          </div>

          {/* QR code placeholder */}
          <div
            className="w-24 h-24 rounded-xl bg-white p-1.5 flex-shrink-0"
          >
            <QRPattern />
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/** SVG-based QR-like visual */
function QRPattern() {
  // Seeded random positions for a stable pattern
  const cells: { x: number; y: number }[] = [];
  const rng = (seed: number) => {
    let s = seed;
    return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  };
  const rand = rng(42);
  const SIZE = 9;

  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      // Always draw finder pattern corners
      const inTL = row < 3 && col < 3;
      const inTR = row < 3 && col >= SIZE - 3;
      const inBL = row >= SIZE - 3 && col < 3;

      if (inTL || inTR || inBL) {
        // Outer border
        if (row === 0 || row === 2 || col === 0 || col === 2) {
          cells.push({ x: col, y: row });
        } else if (row === 1 && col === 1) {
          cells.push({ x: col, y: row });
        }
      } else {
        if (rand() > 0.5) cells.push({ x: col, y: row });
      }
    }
  }

  const cellPx = 100 / SIZE;

  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      {cells.map(({ x, y }) => (
        <rect
          key={`${x}-${y}`}
          x={x * cellPx + 0.5}
          y={y * cellPx + 0.5}
          width={cellPx - 1}
          height={cellPx - 1}
          fill="#0A0E27"
        />
      ))}
    </svg>
  );
}
