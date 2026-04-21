"use client";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { ComposableMap, Geographies, Geography, Marker, Sphere, Graticule } from "react-simple-maps";
import { useMemo } from "react";
import type { City } from "@/types";
import { haversineKm } from "@/data/cities";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface DestinationMapProps {
  departure: City;
  destinations: City[];
  selected: City | null;
  minDistanceKm: number;
  maxDistanceKm: number;
  onSelect: (city: City) => void;
}

export function DestinationMap({
  departure,
  destinations,
  selected,
  minDistanceKm,
  maxDistanceKm,
  onSelect,
}: DestinationMapProps) {
  const center: [number, number] = [departure.lng, departure.lat];

  // Dinamik zoom: destinasyonların maksimum uzaklığına göre
  const scale = useMemo(() => {
    if (destinations.length === 0) return 200;
    const maxDist = Math.max(
      ...destinations.map((d) =>
        haversineKm(departure.lat, departure.lng, d.lat, d.lng)
      )
    );
    const span = maxDist / 111;
    return Math.max(200, Math.min(1800, 18000 / (span + 5)));
  }, [departure, destinations]);

  // Çember yarıçapları (km → SVG piksel: km / 6371 * scale)
  const maxR = (maxDistanceKm / 6371) * scale;
  const minR = minDistanceKm > 0 ? (minDistanceKm / 6371) * scale : 0;

  return (
    <div
      className="w-full rounded-2xl overflow-hidden"
      style={{ background: "#080D1C", height: 360 }}
    >
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ center, scale }}
        style={{ width: "100%", height: "100%" }}
      >
        <Sphere id="rsm-sphere" fill="#080D1C" stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />
        <Graticule stroke="rgba(255,255,255,0.025)" strokeWidth={0.3} />

        {/* Countries */}
        <Geographies geography={GEO_URL}>
          {({ geographies }: { geographies: any[] }) =>
            geographies.map((geo: any) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="#111D35"
                stroke="#0A1222"
                strokeWidth={0.5}
                style={{
                  default: { outline: "none" },
                  hover:   { outline: "none", fill: "#162240" },
                  pressed: { outline: "none" },
                }}
              />
            ))
          }
        </Geographies>

        {/* ── Ulaşım menzili çemberleri ──────────────────────────────────────── */}
        <Marker coordinates={[departure.lng, departure.lat]}>
          {/* Maksimum menzil */}
          <circle
            r={maxR}
            fill="rgba(14,165,233,0.04)"
            stroke="rgba(14,165,233,0.35)"
            strokeWidth={1}
            strokeDasharray="6 4"
            style={{ pointerEvents: "none" }}
          />
          {/* Minimum menzil */}
          {minR > 4 && (
            <circle
              r={minR}
              fill="rgba(0,0,0,0.15)"
              stroke="rgba(100,116,139,0.3)"
              strokeWidth={0.8}
              strokeDasharray="4 3"
              style={{ pointerEvents: "none" }}
            />
          )}
        </Marker>

        {/* ── Destination markers ──────────────────────────────────────────────── */}
        {destinations.map((city) => {
          const isSel = selected?.id === city.id;
          const labelW = 64;
          const labelH = isSel ? 18 : 16;
          const labelY = isSel ? -38 : -33;
          const flagW  = 16;
          const flagH  = 11;

          return (
            <Marker
              key={city.id}
              coordinates={[city.lng, city.lat]}
              onClick={() => onSelect(city)}
            >
              {isSel && (
                <circle
                  r={14}
                  fill="rgba(245,158,11,0.15)"
                  stroke="rgba(245,158,11,0.4)"
                  strokeWidth={1}
                />
              )}

              <circle
                r={isSel ? 7 : 5}
                fill={isSel ? "#F59E0B" : "#0EA5E9"}
                stroke={isSel ? "white" : "rgba(255,255,255,0.7)"}
                strokeWidth={isSel ? 2 : 1.2}
                style={{
                  cursor: "pointer",
                  filter: isSel
                    ? "drop-shadow(0 0 6px rgba(245,158,11,1))"
                    : "drop-shadow(0 0 4px rgba(14,165,233,0.9))",
                }}
              />

              {/* Etiket arka planı */}
              <rect
                x={-labelW / 2}
                y={labelY}
                width={labelW}
                height={labelH}
                rx={4}
                fill={isSel ? "rgba(30,20,0,0.92)" : "rgba(8,13,28,0.88)"}
                stroke={isSel ? "rgba(245,158,11,0.6)" : "rgba(14,165,233,0.4)"}
                strokeWidth={0.8}
                style={{ pointerEvents: "none" }}
              />

              {/* Bayrak PNG */}
              <image
                href={`https://flagcdn.com/${flagW}x${flagH}/${city.countryCode.toLowerCase()}.png`}
                x={-labelW / 2 + 3}
                y={labelY + (labelH - flagH) / 2}
                width={flagW}
                height={flagH}
                style={{ pointerEvents: "none" }}
              />

              {/* Şehir adı */}
              <text
                x={-labelW / 2 + flagW + 5}
                y={labelY + labelH / 2 + 1}
                dominantBaseline="middle"
                style={{
                  fontSize: isSel ? 10 : 9,
                  fontWeight: isSel ? 700 : 600,
                  fill: isSel ? "#FCD34D" : "#E2E8F0",
                  pointerEvents: "none",
                  fontFamily: "system-ui, sans-serif",
                }}
              >
                {city.name}
              </text>
            </Marker>
          );
        })}

        {/* ── Kalkış noktası ──────────────────────────────────────────────────── */}
        <Marker coordinates={[departure.lng, departure.lat]}>
          <circle
            r={8}
            fill="#3B82F6"
            stroke="white"
            strokeWidth={2}
            style={{ filter: "drop-shadow(0 0 8px rgba(59,130,246,0.9))" }}
          />
          <rect
            x={-32} y={-36} width={64} height={16} rx={4}
            fill="rgba(10,20,50,0.92)"
            stroke="rgba(59,130,246,0.6)"
            strokeWidth={1}
            style={{ pointerEvents: "none" }}
          />
          <text
            textAnchor="middle" y={-23}
            style={{
              fontSize: 12, fontWeight: 800, fill: "white",
              pointerEvents: "none", fontFamily: "system-ui, sans-serif",
            }}
          >
            ✈ {departure.name}
          </text>
        </Marker>
      </ComposableMap>
    </div>
  );
}
