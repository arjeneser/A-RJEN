"use client";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { ComposableMap, Geographies, Geography, Marker, Line, Sphere, Graticule } from "react-simple-maps";
import { useMemo } from "react";
import type { City } from "@/types";
import { greatCircleInterpolate, greatCirclePoints, calculateBearing } from "@/lib/geo";
import { WORLD_CITIES } from "@/data/world-cities";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json";

interface WorldMapProps {
  departure: City;
  destination: City;
  progress: number; // 0–1
}

export function WorldMap({ departure, destination, progress }: WorldMapProps) {
  const t = Math.max(0, Math.min(1, progress));

  // Uçağın anlık konumu
  const planePos  = greatCircleInterpolate(departure, destination, t);
  const nextPos   = greatCircleInterpolate(departure, destination, Math.min(1, t + 0.015));
  const bearing   = calculateBearing(planePos, nextPos);

  // Tamamlanan iz noktaları
  const allPoints = useMemo(
    () => greatCirclePoints(departure, destination, 80),
    [departure, destination]
  );
  const doneCount  = Math.floor(t * allPoints.length);
  const trailDone  = allPoints.slice(0, doneCount + 1);

  // Harita merkezi: uçağın anlık konumu
  const center: [number, number] = [planePos.lng, planePos.lat];

  // Çok yakın zoom — uçak her zaman merkezdedir
  const scale = 2400;

  const visibleCities = useMemo(
    () =>
      WORLD_CITIES.filter(
        (wc) =>
          wc.name.toLowerCase() !== departure.name.toLowerCase() &&
          wc.name.toLowerCase() !== destination.name.toLowerCase()
      ),
    [departure.name, destination.name]
  );

  return (
    <div className="w-full h-full" style={{ background: "#0A1F14" }}>
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ center, scale }}
        style={{ width: "100%", height: "100%" }}
      >
        <Sphere id="rsm-sphere" fill="#0A2A3A" stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
        <Graticule stroke="rgba(255,255,255,0.025)" strokeWidth={0.3} />

        {/* Countries */}
        <Geographies geography={GEO_URL}>
          {({ geographies }: { geographies: any[] }) =>
            geographies.map((geo: any) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="#1C3A2A"
                stroke="#0A2018"
                strokeWidth={0.3}
                style={{
                  default: { outline: "none" },
                  hover:   { outline: "none" },
                  pressed: { outline: "none" },
                }}
              />
            ))
          }
        </Geographies>

        {/* ── Arka plan dünya şehirleri ──────────────────────────────────────── */}
        {visibleCities.map((wc) => {
          const dotR = wc.pop === "xl" ? 3 : wc.pop === "lg" ? 2.5 : 2;
          const fs   = wc.pop === "xl" ? 12 : wc.pop === "lg" ? 10 : 9;
          const fill = wc.pop === "xl"
            ? "rgba(203,213,225,0.9)"
            : wc.pop === "lg"
            ? "rgba(148,163,184,0.8)"
            : "rgba(100,116,139,0.7)";
          const dotFill = wc.pop === "xl"
            ? "rgba(148,163,184,0.85)"
            : "rgba(100,116,139,0.7)";

          return (
            <Marker key={wc.name} coordinates={[wc.lng, wc.lat]}>
              <circle r={dotR} fill={dotFill} />
              <text
                textAnchor="middle"
                y={-6}
                style={{
                  fontSize: fs,
                  fontWeight: wc.pop === "xl" ? 600 : 400,
                  fill,
                  pointerEvents: "none",
                  fontFamily: "system-ui, sans-serif",
                  textShadow: "0 1px 4px rgba(0,0,0,0.9)",
                }}
              >
                {wc.name}
              </text>
            </Marker>
          );
        })}

        {/* Dashed route */}
        <Line
          from={[departure.lng, departure.lat]}
          to={[destination.lng, destination.lat]}
          stroke="rgba(255,255,255,0.35)"
          strokeWidth={0.6}
          strokeLinecap="round"
          strokeDasharray="3 5"
        />

        {/* Tamamlanan iz */}
        {trailDone.length > 1 && (
          <Line
            from={[departure.lng, departure.lat]}
            to={[planePos.lng, planePos.lat]}
            stroke="#60C8FF"
            strokeWidth={1.2}
            strokeLinecap="round"
            strokeOpacity={0.7}
          />
        )}

        {/* Kalkış */}
        <Marker coordinates={[departure.lng, departure.lat]}>
          <circle r={5} fill="#3B82F6"
            style={{ filter: "drop-shadow(0 0 6px rgba(59,130,246,0.9))" }}
            stroke="rgba(255,255,255,0.9)" strokeWidth={1.5} />
          <text textAnchor="middle" y={-11}
            style={{ fontSize: 9, fontWeight: 700, fill: "white", pointerEvents: "none", fontFamily: "system-ui, sans-serif" }}>
            {departure.name}
          </text>
        </Marker>

        {/* Varış */}
        <Marker coordinates={[destination.lng, destination.lat]}>
          <circle r={5} fill="#F59E0B"
            style={{ filter: "drop-shadow(0 0 6px rgba(245,158,11,0.9))" }}
            stroke="rgba(255,255,255,0.9)" strokeWidth={1.5} />
          <text textAnchor="middle" y={-11}
            style={{ fontSize: 9, fontWeight: 700, fill: "white", pointerEvents: "none", fontFamily: "system-ui, sans-serif" }}>
            {destination.name}
          </text>
        </Marker>

        {/* Uçak */}
        <Marker coordinates={[planePos.lng, planePos.lat]}>
          <g transform={`rotate(${bearing})`}
            style={{ filter: "drop-shadow(0 0 12px rgba(255,255,255,0.5))" }}>
            <image
              href="/airplane-top.png"
              x={-32} y={-32}
              width={64} height={64}
              style={{ mixBlendMode: "screen" } as React.CSSProperties}
            />
          </g>
        </Marker>
      </ComposableMap>
    </div>
  );
}
