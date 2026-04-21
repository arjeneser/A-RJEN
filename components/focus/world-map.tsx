"use client";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { ComposableMap, Geographies, Geography, Marker, Line, Sphere, Graticule } from "react-simple-maps";
import { useMemo } from "react";
import type { City } from "@/types";
import { greatCircleInterpolate, greatCirclePoints, calculateBearing } from "@/lib/geo";
import { WORLD_CITIES } from "@/data/world-cities";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

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

  // Zoom: kısa mesafede daha yakın, uzunda biraz daha uzak ama her zaman yüksek
  const routeKm = useMemo(() => {
    const R = 6371;
    const dLat = ((destination.lat - departure.lat) * Math.PI) / 180;
    const dLng = ((destination.lng - departure.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((departure.lat * Math.PI) / 180) *
        Math.cos((destination.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, [departure, destination]);

  const scale = routeKm < 1500 ? 700
              : routeKm < 3000 ? 550
              : routeKm < 6000 ? 420
              : routeKm < 9000 ? 340
              : 280;

  // Görünen alan tahmini (~görüntü penceresi genişliği / scale)
  const viewSpan = 18000 / scale; // derece cinsinden yaklaşık
  const lngMin = planePos.lng - viewSpan;
  const lngMax = planePos.lng + viewSpan;
  const latMin = planePos.lat - viewSpan * 0.6;
  const latMax = planePos.lat + viewSpan * 0.6;

  const visibleCities = useMemo(
    () =>
      WORLD_CITIES.filter(
        (wc) =>
          wc.lng >= lngMin &&
          wc.lng <= lngMax &&
          wc.lat >= latMin &&
          wc.lat <= latMax &&
          // kalkış/varış adlarını çakıştırma
          wc.name.toLowerCase() !== departure.name.toLowerCase() &&
          wc.name.toLowerCase() !== destination.name.toLowerCase()
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [departure.name, destination.name, lngMin, lngMax, latMin, latMax]
  );

  return (
    <div className="w-full h-full" style={{ background: "#070918" }}>
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ center, scale }}
        style={{ width: "100%", height: "100%" }}
      >
        <Sphere id="rsm-sphere" fill="#070918" stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
        <Graticule stroke="rgba(255,255,255,0.025)" strokeWidth={0.3} />

        {/* Countries */}
        <Geographies geography={GEO_URL}>
          {({ geographies }: { geographies: any[] }) =>
            geographies.map((geo: any) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="#0F1A30"
                stroke="#091020"
                strokeWidth={0.5}
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
          const dotR = wc.pop === "xl" ? 2 : 1.5;
          const fs   = wc.pop === "xl" ? 8 : 7;
          const fill = wc.pop === "xl"
            ? "rgba(148,163,184,0.55)"
            : "rgba(100,116,139,0.4)";

          return (
            <Marker key={wc.name} coordinates={[wc.lng, wc.lat]}>
              <circle r={dotR} fill={fill} />
              <text
                textAnchor="middle"
                y={-5}
                style={{
                  fontSize: fs,
                  fontWeight: 400,
                  fill,
                  pointerEvents: "none",
                  fontFamily: "system-ui, sans-serif",
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
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={1.2}
          strokeLinecap="round"
          strokeDasharray="5 7"
        />

        {/* Tamamlanan iz */}
        {trailDone.length > 1 && (
          <Line
            from={[departure.lng, departure.lat]}
            to={[planePos.lng, planePos.lat]}
            stroke="#60C8FF"
            strokeWidth={2}
            strokeLinecap="round"
            strokeOpacity={0.85}
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
            style={{ filter: "drop-shadow(0 0 10px rgba(14,165,233,0.9))" }}>
            <image
              href="/airplane-top.svg"
              x={-18} y={-18}
              width={36} height={36}
            />
          </g>
        </Marker>
      </ComposableMap>
    </div>
  );
}
