import type { City, LatLng } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const EARTH_RADIUS_KM = 6371;

// ─── Primitive helpers ────────────────────────────────────────────────────────

/** Convert decimal degrees → radians. */
export function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/** Convert radians → decimal degrees. */
export function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

// ─── Distance & Bearing ──────────────────────────────────────────────────────

/**
 * Haversine great-circle distance between two lat/lng points.
 * Works with any object that has { lat, lng } — including City and LatLng.
 */
export function calculateDistanceKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) *
      Math.cos(toRadians(to.lat)) *
      Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Initial compass bearing (degrees, 0 = north, clockwise) from `from` to `to`.
 * Works with any { lat, lng } object.
 */
export function calculateBearing(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const dLng = toRadians(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

// ─── Spherical Interpolation (core great-circle primitive) ───────────────────

/**
 * Spherical linear interpolation (Slerp) between two points on Earth.
 * t ∈ [0, 1].  Returns exactly the great-circle path — NOT a straight line.
 */
function sphericalInterpolate(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  t: number
): { lat: number; lng: number } {
  const lat1 = toRadians(from.lat);
  const lng1 = toRadians(from.lng);
  const lat2 = toRadians(to.lat);
  const lng2 = toRadians(to.lng);

  // Central angle between the two points
  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat2 - lat1) / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin((lng2 - lng1) / 2) ** 2
      )
    );

  // Points are coincident — avoid division by zero
  if (d < 0.0001) return { lat: from.lat, lng: from.lng };

  const A = Math.sin((1 - t) * d) / Math.sin(d);
  const B = Math.sin(t * d) / Math.sin(d);

  // Cartesian intermediary (unit sphere)
  const x =
    A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2);
  const y =
    A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2);
  const z = A * Math.sin(lat1) + B * Math.sin(lat2);

  return {
    lat: toDegrees(Math.atan2(z, Math.sqrt(x * x + y * y))),
    lng: toDegrees(Math.atan2(y, x)),
  };
}

// ─── Primary API ─────────────────────────────────────────────────────────────

/**
 * Generate an array of waypoints along the great-circle route from `start` to
 * `end`, spaced approximately `stepKm` kilometres apart.
 *
 * @param start  - Origin  { lat, lng }
 * @param end    - Destination { lat, lng }
 * @param stepKm - Approximate spacing between waypoints in km (default 100)
 * @returns Array of { lat, lng } waypoints including start and end
 *
 * The path follows Earth's curvature via spherical interpolation — NOT a
 * Mercator straight line — so long-haul routes (e.g. Istanbul → Tokyo) arc
 * over the poles as they do in reality.
 */
export function generateGreatCirclePath(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  stepKm: number = 100
): { lat: number; lng: number }[] {
  const totalKm = calculateDistanceKm(start, end);

  // Guarantee at least 2 points even for very short routes
  const segments = Math.max(2, Math.ceil(totalKm / stepKm));

  const path: { lat: number; lng: number }[] = [];
  for (let i = 0; i <= segments; i++) {
    path.push(sphericalInterpolate(start, end, i / segments));
  }
  return path;
}

// ─── Legacy helpers (kept for backward compatibility) ────────────────────────

/** @deprecated Use calculateDistanceKm instead. */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  return calculateDistanceKm({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 });
}

/**
 * Interpolate a great-circle position between two City objects at fraction
 * t ∈ [0, 1].  Kept for backward compat with existing map components.
 */
export function greatCircleInterpolate(from: City, to: City, t: number): LatLng {
  return sphericalInterpolate(from, to, t);
}

/** Returns an array of LatLng points along the great-circle arc (City API). */
export function greatCirclePoints(
  from: City,
  to: City,
  segments: number = 64
): LatLng[] {
  return Array.from({ length: segments + 1 }, (_, i) =>
    sphericalInterpolate(from, to, i / segments)
  );
}

/**
 * Compass bearing from City `from` to City `to` (0 = north, clockwise).
 * Kept for backward compat.
 */
export function bearing(from: City, to: City): number {
  return calculateBearing(from, to);
}

/** Midpoint between two cities (geographic average, not great-circle). */
export function midpoint(from: City, to: City): LatLng {
  return {
    lat: (from.lat + to.lat) / 2,
    lng: (from.lng + to.lng) / 2,
  };
}

// ─── Emergency Landing ────────────────────────────────────────────────────────

export interface NearestCityResult {
  city: City;
  distanceKm: number;  // uçak pozisyonundan km
  minutesAway: number; // tahmini dakika (ortalama hıza göre)
  isNearby: boolean;   // < 150km → "semalarındasınız"
  planePos: { lat: number; lng: number }; // C noktası (harita pin'i için)
}

/**
 * Uçağın şu anki konumuna (C) en yakın havalimanını bulur.
 * Rota dışında da olabilir — sadece düz mesafeye bakar.
 * Süre tahmini: toplam rota km / toplam süre = ortalama hız.
 */
export function findNearestAirport(
  departure: City,
  destination: City,
  progress: number,
  durationMs: number,    // toplam planlanan süre
  elapsedMs: number,     // şimdiye kadar geçen süre
  allCities: City[]
): NearestCityResult | null {
  const planePos = greatCircleInterpolate(departure, destination, progress);

  // Ortalama hız (km/sa) — toplam rota / toplam süre
  const routeKm    = calculateDistanceKm(departure, destination);
  const durationH  = durationMs / 3_600_000;
  const avgSpeedKmh = durationH > 0 ? routeKm / durationH : 800;

  const NEARBY_KM = 150;

  let best: NearestCityResult | null = null;

  for (const city of allCities) {
    if (city.id === departure.id) continue; // kalkışı önerme

    const distKm = calculateDistanceKm(planePos, city);
    const minutesAway = distKm < NEARBY_KM ? 0 : (distKm / avgSpeedKmh) * 60;

    if (!best || distKm < best.distanceKm) {
      best = {
        city,
        distanceKm: distKm,
        minutesAway,
        isNearby: distKm < NEARBY_KM,
        planePos,
      };
    }
  }

  return best;
}

/** @deprecated findNearestCityAhead yerine findNearestAirport kullan */
export function findNearestCityAhead(
  departure: City,
  destination: City,
  progress: number,
  remainingMs: number,
  allCities: City[]
): NearestCityResult | null {
  const durationMs = remainingMs / Math.max(0.001, 1 - progress);
  return findNearestAirport(departure, destination, progress, durationMs, 0, allCities);
}

/**
 * Suggest a map zoom level that comfortably fits both endpoints.
 * Calibrated for a ~375px-wide viewport (mobile-first).
 */
export function fitZoom(from: City, to: City): number {
  const km = calculateDistanceKm(from, to);
  if (km < 200) return 8;
  if (km < 500) return 6;
  if (km < 1200) return 5;
  if (km < 3000) return 4;
  if (km < 6000) return 3;
  return 2;
}
