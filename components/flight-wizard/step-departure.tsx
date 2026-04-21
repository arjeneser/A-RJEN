"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { useFlightSetup } from "@/store/flight-store";
import { getDepartureCities, flagEmoji } from "@/data/cities";
import type { City } from "@/types";

export function StepDeparture() {
  const { departure, setDeparture } = useFlightSetup();
  const [query, setQuery] = useState("");
  const allCities = getDepartureCities();

  const filtered = query.trim()
    ? allCities.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.country.toLowerCase().includes(query.toLowerCase())
      )
    : allCities;

  return (
    <div>
      <div className="mb-6">
        <h2
          className="text-2xl font-bold mb-1"
          style={{ fontFamily: "Space Grotesk, sans-serif" }}
        >
          Nereden Kalkıyorsunuz?
        </h2>
        <p className="text-slate-400 text-sm">
          Odak uçuşunuza başlamak için kalkış şehrinizi seçin.
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-lg">
          🔍
        </span>
        <input
          type="text"
          placeholder="Şehir ara..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-11 pr-4 py-3 rounded-xl text-sm text-white placeholder-slate-500 outline-none focus:border-brand-sky/50 transition-colors"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        />
      </div>

      {/* City grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-1">
        {filtered.map((city, i) => {
          const isSelected = departure?.id === city.id;
          return (
            <motion.button
              key={city.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3 }}
              onClick={() => setDeparture(city)}
              className={`relative text-left p-4 rounded-2xl transition-all duration-200 ${
                isSelected ? "scale-[1.02]" : "hover:scale-[1.01]"
              }`}
              style={{
                background: isSelected
                  ? "linear-gradient(135deg, #1D4ED8, #1E3A8A)"
                  : "rgba(255,255,255,0.04)",
                border: isSelected
                  ? "1px solid rgba(59,130,246,0.6)"
                  : "1px solid rgba(255,255,255,0.07)",
                boxShadow: isSelected
                  ? "0 0 24px rgba(59,130,246,0.25)"
                  : undefined,
              }}
            >
              <div className="text-3xl mb-2">{flagEmoji(city.countryCode)}</div>
              <div className="font-semibold text-sm text-white mb-0.5 truncate">
                {city.name}
              </div>
              <div className="text-xs text-slate-500 truncate">
                {city.country}
              </div>
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-3 right-3 w-5 h-5 rounded-full bg-brand-sky flex items-center justify-center"
                >
                  <span className="text-white text-xs">✓</span>
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
