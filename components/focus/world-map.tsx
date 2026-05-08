"use client";
import { useEffect, useRef, useMemo } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { City } from "@/types";
import { greatCircleInterpolate, greatCirclePoints, calculateBearing } from "@/lib/geo";
import type { LiveFlight } from "@/lib/flight-sync";

const OTHER_COLORS = ["#F97316", "#A855F7", "#22C55E", "#EC4899", "#EAB308"];

// Güncelleme aralıkları (ms)
const TRAIL_UPDATE_INTERVAL  = 20_000; // trail her 20 saniyede bir
const CAMERA_UPDATE_INTERVAL = 30_000; // kamera her 30 saniyede bir

interface WorldMapProps {
  departure: City;
  destination: City;
  progress: number;
  otherFlights?: LiveFlight[];
  crewmates?: string[];
}

export function WorldMap({ departure, destination, progress, otherFlights = [], crewmates = [] }: WorldMapProps) {
  const containerRef      = useRef<HTMLDivElement>(null);
  const mapRef            = useRef<maplibregl.Map | null>(null);
  const markerRef         = useRef<maplibregl.Marker | null>(null);
  const planeElRef        = useRef<HTMLDivElement | null>(null);
  const crewBadgeElRef    = useRef<HTMLDivElement | null>(null);
  const initRef           = useRef(false);
  const mapLoadedRef      = useRef(false);
  const otherFlightsRef   = useRef<LiveFlight[]>([]);
  const otherMarkersRef   = useRef<Map<string, { marker: maplibregl.Marker; innerEl: HTMLDivElement }>>(new Map());

  // Throttle ref'leri
  const lastTrailUpdateRef  = useRef<number>(0);
  const lastCameraUpdateRef = useRef<number>(0);

  const t        = Math.max(0, Math.min(1, progress));
  const planePos = greatCircleInterpolate(departure, destination, t);
  const nextPos  = greatCircleInterpolate(departure, destination, Math.min(1, t + 0.015));
  const bearing  = calculateBearing(planePos, nextPos);

  const routeCoords = useMemo(
    () => greatCirclePoints(departure, destination, 80).map((p) => [p.lng, p.lat] as [number, number]),
    [departure, destination]
  );

  // Trail hesabı — sadece throttle geçince kullanılacak
  function buildTrailCoords(tVal: number): [number, number][] {
    const pos      = greatCircleInterpolate(departure, destination, tVal);
    const doneCount = Math.floor(tVal * routeCoords.length);
    return [
      ...routeCoords.slice(0, Math.max(1, doneCount)),
      [pos.lng, pos.lat],
    ];
  }

  // ── Diğer uçakları haritaya uygula ───────────────────────────────────────
  function applyOtherFlights(flights: LiveFlight[]) {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;

    const currentUsernames = new Set(flights.map((f) => f.username));
    otherMarkersRef.current.forEach((entry, username) => {
      if (!currentUsernames.has(username)) {
        entry.marker.remove();
        otherMarkersRef.current.delete(username);
      }
    });

    flights.forEach((flight, i) => {
      const color = OTHER_COLORS[i % OTHER_COLORS.length];
      const t2    = Math.max(0, Math.min(1, flight.progress));
      const pos   = greatCircleInterpolate(flight.departure, flight.destination, t2);
      const nxt   = greatCircleInterpolate(flight.departure, flight.destination, Math.min(1, t2 + 0.015));
      const brng  = calculateBearing(pos, nxt);

      const existing = otherMarkersRef.current.get(flight.username);
      if (existing) {
        existing.marker.setLngLat([pos.lng, pos.lat]);
        existing.innerEl.style.transform = `rotate(${brng + 45}deg)`;
      } else {
        const outer = document.createElement("div");
        outer.style.cssText = "display:flex;flex-direction:column;align-items:center;background:transparent;position:relative;";

        const label = document.createElement("div");
        label.style.cssText = `background:${color};color:white;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;margin-bottom:3px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.6);font-family:system-ui,sans-serif;`;
        label.textContent = flight.username;

        const ring = document.createElement("div");
        ring.style.cssText = `position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:72px;height:72px;border-radius:50%;border:3px solid ${color};box-shadow:0 0 12px ${color}, inset 0 0 12px ${color}33;pointer-events:none;`;

        const inner = document.createElement("div");
        inner.style.cssText = `width:72px;height:72px;background:transparent;transform:rotate(${brng + 45}deg);transition:transform 1.5s ease;filter:drop-shadow(0 2px 8px rgba(0,0,0,0.7));position:relative;z-index:1;will-change:transform;`;
        inner.innerHTML = `<img src="/airplane-top.png" style="width:100%;height:100%;object-fit:contain;display:block;mix-blend-mode:multiply;" />`;

        outer.appendChild(label);
        outer.appendChild(ring);
        outer.appendChild(inner);

        const marker = new maplibregl.Marker({ element: outer, anchor: "center" })
          .setLngLat([pos.lng, pos.lat])
          .addTo(map);

        otherMarkersRef.current.set(flight.username, { marker, innerEl: inner });
      }
    });
  }

  // ── Map init ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || initRef.current) return;
    initRef.current = true;

    // Rotanın orta noktasını hesapla — dünya görünümü
    const midT   = 0.5;
    const midPos = greatCircleInterpolate(departure, destination, midT);

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          "carto-voyager": {
            type: "raster",
            tiles: [
              "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
              "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
              "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
            ],
            tileSize: 256,
            maxzoom: 6, // ← tile detayını sınırla (daha az tile = daha az GPU)
            attribution: "© OpenStreetMap contributors © CARTO",
          },
        },
        layers: [{ id: "carto-voyager-layer", type: "raster", source: "carto-voyager" }],
      },
      center: [midPos.lng, midPos.lat],
      zoom: 3,            // ← zoom 10 → 3: rota tamamı görünsün, az tile
      maxZoom: 5,         // ← yakınlaşmayı sınırla
      bearing: 0,
      pitch: 0,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,    // ← tile fade animasyonu kapat
    });

    mapRef.current = map;

    map.on("load", () => {
      mapLoadedRef.current = true;

      map.addSource("route-full", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: routeCoords } },
      });
      map.addLayer({
        id: "route-full", type: "line", source: "route-full",
        paint: { "line-color": "rgba(30,30,30,0.5)", "line-width": 2, "line-dasharray": [4, 6] },
      });

      const initTrail = buildTrailCoords(t);
      map.addSource("trail", {
        type: "geojson",
        data: {
          type: "Feature", properties: {},
          geometry: {
            type: "LineString",
            coordinates: initTrail.length > 1 ? initTrail : [[planePos.lng, planePos.lat], [planePos.lng, planePos.lat]],
          },
        },
      });
      map.addLayer({
        id: "trail", type: "line", source: "trail",
        paint: { "line-color": "#2563EB", "line-width": 3, "line-opacity": 0.9 },
      });

      // Kalkış marker
      const depEl = document.createElement("div");
      depEl.innerHTML = `<div style="background:rgba(59,130,246,0.9);border:2px solid white;border-radius:50%;width:14px;height:14px;box-shadow:0 0 10px rgba(59,130,246,0.8)"></div>`;
      new maplibregl.Marker({ element: depEl, anchor: "center" })
        .setLngLat([departure.lng, departure.lat])
        .setPopup(new maplibregl.Popup({ closeButton: false, offset: 12 })
          .setHTML(`<div style="color:white;font-weight:700;font-size:12px;background:rgba(20,30,60,0.95);padding:4px 8px;border-radius:6px;">${departure.name}</div>`))
        .addTo(map);

      // Varış marker
      const dstEl = document.createElement("div");
      dstEl.innerHTML = `<div style="background:rgba(245,158,11,0.9);border:2px solid white;border-radius:50%;width:14px;height:14px;box-shadow:0 0 10px rgba(245,158,11,0.8)"></div>`;
      new maplibregl.Marker({ element: dstEl, anchor: "center" })
        .setLngLat([destination.lng, destination.lat])
        .setPopup(new maplibregl.Popup({ closeButton: false, offset: 12 })
          .setHTML(`<div style="color:white;font-weight:700;font-size:12px;background:rgba(20,30,60,0.95);padding:4px 8px;border-radius:6px;">${destination.name}</div>`))
        .addTo(map);

      // Kendi uçak — will-change ile GPU katmanı ayrı tutulur
      const outerEl = document.createElement("div");
      outerEl.style.cssText = "width:72px;height:72px;background:transparent;position:relative;";

      const crewBadge = document.createElement("div");
      crewBadge.style.cssText = [
        "position:absolute;bottom:76px;left:50%;transform:translateX(-50%);",
        "background:rgba(10,14,40,0.95);border:1px solid rgba(139,92,246,0.5);",
        "border-radius:12px;padding:5px 10px;white-space:nowrap;",
        "pointer-events:none;display:none;z-index:20;",
        "box-shadow:0 4px 16px rgba(0,0,0,0.7);",
      ].join("");
      crewBadgeElRef.current = crewBadge;
      outerEl.appendChild(crewBadge);

      outerEl.addEventListener("mouseenter", () => {
        if (crewBadgeElRef.current && crewBadgeElRef.current.dataset.count !== "0")
          crewBadgeElRef.current.style.display = "block";
      });
      outerEl.addEventListener("mouseleave", () => {
        if (crewBadgeElRef.current) crewBadgeElRef.current.style.display = "none";
      });

      const innerEl = document.createElement("div");
      // will-change: transform → GPU kompozisyon katmanına alır, JS tread'ini rahatlatır
      innerEl.style.cssText = `width:72px;height:72px;background:transparent;transform:rotate(${bearing + 45}deg);transition:transform 1.5s ease;filter:drop-shadow(0 2px 8px rgba(0,0,0,0.7));will-change:transform;`;
      innerEl.innerHTML = `<img src="/airplane-top.png" style="width:100%;height:100%;object-fit:contain;display:block;mix-blend-mode:multiply;" />`;
      outerEl.appendChild(innerEl);
      planeElRef.current = innerEl;
      markerRef.current = new maplibregl.Marker({ element: outerEl, anchor: "center" })
        .setLngLat([planePos.lng, planePos.lat])
        .addTo(map);

      applyOtherFlights(otherFlightsRef.current);
    });

    return () => {
      mapLoadedRef.current = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        initRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Kendi uçağı güncelle (throttled) ──────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;

    const now = Date.now();

    // Uçak marker pozisyonu + rotasyon — her zaman güncelle (DOM işlemi, ucuz)
    markerRef.current?.setLngLat([planePos.lng, planePos.lat]);
    if (planeElRef.current) {
      planeElRef.current.style.transform = `rotate(${bearing + 45}deg)`;
    }

    // Trail — 20 saniyede bir (GeoJSON parse = ağır)
    if (now - lastTrailUpdateRef.current > TRAIL_UPDATE_INTERVAL) {
      lastTrailUpdateRef.current = now;
      const trailSrc = map.getSource("trail") as maplibregl.GeoJSONSource | undefined;
      const coords   = buildTrailCoords(t);
      trailSrc?.setData({
        type: "Feature", properties: {},
        geometry: {
          type: "LineString",
          coordinates: coords.length > 1 ? coords : [[planePos.lng, planePos.lat], [planePos.lng, planePos.lat]],
        },
      });
    }

    // Kamera — 30 saniyede bir (easeTo = 60fps WebGL animasyonu = ağır)
    if (now - lastCameraUpdateRef.current > CAMERA_UPDATE_INTERVAL) {
      lastCameraUpdateRef.current = now;
      map.stop(); // önceki animasyonu iptal et
      map.easeTo({ center: [planePos.lng, planePos.lat], duration: 1500, easing: (x) => x });
    }
  }, [planePos.lng, planePos.lat, bearing, t]);

  // ── Diğer kullanıcılar değişince güncelle ────────────────────────────────
  useEffect(() => {
    otherFlightsRef.current = otherFlights;
    applyOtherFlights(otherFlights);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherFlights]);

  // ── Crewmates badge ───────────────────────────────────────────────────────
  useEffect(() => {
    const badge = crewBadgeElRef.current;
    if (!badge) return;
    badge.dataset.count = String(crewmates.length);
    if (crewmates.length === 0) {
      badge.style.display = "none";
      badge.innerHTML = "";
    } else {
      const names = crewmates
        .map((u) => `<span style="display:inline-flex;align-items:center;gap:4px;"><span style="width:18px;height:18px;border-radius:50%;background:linear-gradient(135deg,#4C1D95,#7C3AED);display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:white;">${u[0]?.toUpperCase() ?? "?"}</span><span style="color:#E2E8F0;font-size:11px;font-weight:600;font-family:system-ui;">${u}</span></span>`)
        .join(`<span style="color:#475569;margin:0 4px;">·</span>`);
      badge.innerHTML = `<div style="display:flex;align-items:center;gap:6px;"><span style="font-size:13px;">👥</span><div style="display:flex;align-items:center;gap:6px;">${names}</div></div>`;
    }
  }, [crewmates]);

  return <div ref={containerRef} className="w-full h-full" style={{ touchAction: "none" }} />;
}
