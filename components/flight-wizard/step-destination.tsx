"use client";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { useFlightSetup } from "@/store/flight-store";
import { useUserStore } from "@/store/user-store";
import { getReachableDestinations, haversineKm, flagEmoji } from "@/data/cities";
import type { City } from "@/types";

// SSR-safe Leaflet map
const DestinationMap = dynamic(
  () => import("./destination-map").then((m) => m.DestinationMap),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full animate-pulse rounded-2xl"
        style={{
          height: "320px",
          background: "rgba(7,9,24,0.8)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      />
    ),
  }
);

// ── Single row in the destination list ───────────────────────────────────────
function DestRow({
  city,
  distKm,
  isSelected,
  visited,
  onSelect,
  index,
}: {
  city: City;
  distKm: number;
  isSelected: boolean;
  visited: boolean;
  onSelect: (c: City) => void;
  index: number;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.025, duration: 0.2 }}
      onClick={() => onSelect(city)}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 text-left"
      style={{
        background: isSelected
          ? "linear-gradient(135deg, rgba(29,78,216,0.35), rgba(14,165,233,0.18))"
          : "rgba(255,255,255,0.03)",
        border: isSelected
          ? "1px solid rgba(59,130,246,0.5)"
          : "1px solid rgba(255,255,255,0.05)",
        boxShadow: isSelected ? "0 0 16px rgba(59,130,246,0.15)" : undefined,
      }}
    >
      {/* Flag */}
      <span className="text-2xl shrink-0">{flagEmoji(city.countryCode)}</span>

      {/* City + country */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`font-semibold text-sm truncate ${isSelected ? "text-white" : "text-slate-200"}`}>
            {city.name}
          </span>
          {visited && (
            <span
              className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 whitespace-nowrap"
              style={{
                background: "rgba(16,185,129,0.12)",
                border: "1px solid rgba(16,185,129,0.25)",
                color: "#34D399",
              }}
            >
              Daha önce gidildi
            </span>
          )}
        </div>
        <div className="text-slate-500 text-xs truncate">{city.country}</div>
      </div>

      {/* Distance */}
      <div className="shrink-0 text-right">
        <div className="text-xs font-medium" style={{ color: isSelected ? "#60C8FF" : "#64748B" }}>
          {distKm.toLocaleString()} km
        </div>
      </div>

      {/* Check */}
      {isSelected && (
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg,#3B82F6,#1D4ED8)" }}
        >
          <span className="text-white text-[10px]">✓</span>
        </div>
      )}
    </motion.button>
  );
}

// ── Main step ─────────────────────────────────────────────────────────────────
export function StepDestination() {
  const { departure, duration, destination, setDestination } = useFlightSetup();
  const visitedCityIds = useUserStore((s) => s.profile.visitedCityIds);

  if (!departure || !duration) return null;

  const destinations = getReachableDestinations(departure, duration);

  const distKm = destination
    ? Math.round(haversineKm(departure.lat, departure.lng, destination.lat, destination.lng))
    : null;

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h2
          className="text-2xl font-bold mb-1"
          style={{ fontFamily: "Space Grotesk, sans-serif" }}
        >
          Varış Noktanızı Seçin
        </h2>
        <p className="text-slate-400 text-sm">
          <span className="text-white font-medium">{departure.name}</span>&apos;dan{" "}
          <span className="text-white font-medium">{duration.label}</span> sürede{" "}
          <span className="text-sky-400 font-medium">{destinations.length} destinasyon</span>a
          ulaşabilirsiniz.
        </p>
      </div>

      {/* Map */}
      <div className="mb-3">
        <DestinationMap
          departure={departure}
          destinations={destinations}
          selected={destination}
          minDistanceKm={duration.minDistanceKm}
          maxDistanceKm={duration.maxDistanceKm}
          onSelect={setDestination}
        />
      </div>

      {/* Selected city highlight card */}
      <AnimatePresence mode="wait">
        {destination ? (
          <motion.div
            key={destination.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-4 px-4 py-3 rounded-2xl mb-3"
            style={{
              background: "linear-gradient(135deg, rgba(29,78,216,0.3), rgba(14,165,233,0.15))",
              border: "1px solid rgba(59,130,246,0.5)",
              boxShadow: "0 0 24px rgba(59,130,246,0.15)",
            }}
          >
            <span className="text-3xl">{flagEmoji(destination.countryCode)}</span>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-white text-base leading-tight">{destination.name}</div>
              <div className="text-slate-400 text-xs">{destination.country}</div>
              {destination.description && (
                <div className="text-slate-500 text-[11px] truncate mt-0.5">{destination.description}</div>
              )}
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm font-bold" style={{ color: "#60C8FF" }}>
                {distKm?.toLocaleString()} km
              </div>
              <div className="text-slate-500 text-[11px]">direkt</div>
            </div>
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg,#3B82F6,#1D4ED8)", boxShadow: "0 0 10px rgba(59,130,246,0.5)" }}
            >
              <span className="text-white text-xs">✓</span>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="placeholder"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center py-2.5 rounded-xl mb-3"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)" }}
          >
            <span className="text-slate-500 text-sm">Haritadan veya listeden bir şehir seçin</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Destination list */}
      {destinations.length > 0 && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}
        >
          {/* List header */}
          <div
            className="flex items-center justify-between px-3 py-2"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.03)" }}
          >
            <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">
              Gidilebilecek Ülkeler
            </span>
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: "rgba(14,165,233,0.15)", color: "#38BDF8", border: "1px solid rgba(14,165,233,0.25)" }}
            >
              {destinations.length}
            </span>
          </div>

          {/* Scrollable list */}
          <div className="max-h-[260px] overflow-y-auto p-2 space-y-1">
            {destinations.map((city, i) => {
              const d = Math.round(haversineKm(departure.lat, departure.lng, city.lat, city.lng));
              return (
                <DestRow
                  key={city.id}
                  city={city}
                  distKm={d}
                  isSelected={destination?.id === city.id}
                  visited={visitedCityIds.includes(city.id)}
                  onSelect={setDestination}
                  index={i}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
