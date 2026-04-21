"use client";
import { useEffect, useRef, useMemo } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { City } from "@/types";
import { greatCircleInterpolate, greatCirclePoints, calculateBearing } from "@/lib/geo";

interface WorldMapProps {
  departure: City;
  destination: City;
  progress: number;
}

export function WorldMap({ departure, destination, progress }: WorldMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<maplibregl.Map | null>(null);
  const markerRef    = useRef<maplibregl.Marker | null>(null);
  const planeElRef   = useRef<HTMLDivElement | null>(null);
  const initRef      = useRef(false);

  const t        = Math.max(0, Math.min(1, progress));
  const planePos = greatCircleInterpolate(departure, destination, t);
  const nextPos  = greatCircleInterpolate(departure, destination, Math.min(1, t + 0.015));
  const bearing  = calculateBearing(planePos, nextPos);

  const routeCoords = useMemo(
    () => greatCirclePoints(departure, destination, 80).map((p) => [p.lng, p.lat] as [number, number]),
    [departure, destination]
  );

  const doneCount  = Math.floor(t * routeCoords.length);
  const trailCoords = routeCoords.slice(0, doneCount + 1);

  // ── Map init ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || initRef.current) return;
    initRef.current = true;

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
            attribution: "© OpenStreetMap contributors © CARTO",
          },
        },
        layers: [
          {
            id: "carto-voyager-layer",
            type: "raster",
            source: "carto-voyager",
          },
        ],
      },
      center: [planePos.lng, planePos.lat],
      zoom: 8,
      bearing: 0,
      pitch: 0,
      interactive: false,
      attributionControl: false,
    });

    mapRef.current = map;

    map.on("load", () => {
      // Tam rota (kesik çizgi)
      map.addSource("route-full", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: routeCoords },
        },
      });
      map.addLayer({
        id: "route-full",
        type: "line",
        source: "route-full",
        paint: {
          "line-color": "rgba(30,30,30,0.5)",
          "line-width": 2,
          "line-dasharray": [4, 6],
        },
      });

      // Tamamlanan iz
      map.addSource("trail", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: trailCoords.length > 1
              ? trailCoords
              : [[planePos.lng, planePos.lat], [planePos.lng, planePos.lat]],
          },
        },
      });
      map.addLayer({
        id: "trail",
        type: "line",
        source: "trail",
        paint: {
          "line-color": "#2563EB",
          "line-width": 3,
          "line-opacity": 0.9,
        },
      });

      // Kalkış marker
      const depEl = document.createElement("div");
      depEl.innerHTML = `
        <div style="background:rgba(59,130,246,0.9);border:2px solid white;border-radius:50%;width:14px;height:14px;box-shadow:0 0 10px rgba(59,130,246,0.8)"></div>
      `;
      new maplibregl.Marker({ element: depEl, anchor: "center" })
        .setLngLat([departure.lng, departure.lat])
        .setPopup(
          new maplibregl.Popup({ closeButton: false, offset: 12 }).setHTML(
            `<div style="color:white;font-weight:700;font-size:12px;background:rgba(20,30,60,0.95);padding:4px 8px;border-radius:6px;border:1px solid rgba(59,130,246,0.5)">${departure.name}</div>`
          )
        )
        .addTo(map);

      // Varış marker
      const dstEl = document.createElement("div");
      dstEl.innerHTML = `
        <div style="background:rgba(245,158,11,0.9);border:2px solid white;border-radius:50%;width:14px;height:14px;box-shadow:0 0 10px rgba(245,158,11,0.8)"></div>
      `;
      new maplibregl.Marker({ element: dstEl, anchor: "center" })
        .setLngLat([destination.lng, destination.lat])
        .setPopup(
          new maplibregl.Popup({ closeButton: false, offset: 12 }).setHTML(
            `<div style="color:white;font-weight:700;font-size:12px;background:rgba(20,30,60,0.95);padding:4px 8px;border-radius:6px;border:1px solid rgba(245,158,11,0.5)">${destination.name}</div>`
          )
        )
        .addTo(map);

      // Uçak marker — dış kapsayıcı MapLibre'nin marker'ı
      // İç div sadece rotasyon için (MapLibre'nin kendi transform'unu bozmaz)
      const outerEl = document.createElement("div");
      outerEl.style.cssText = "width:72px;height:72px;background:transparent;";

      const innerEl = document.createElement("div");
      innerEl.style.cssText = `
        width:72px;
        height:72px;
        background:transparent;
        transform:rotate(${bearing - 90}deg);
        transition:transform 0.4s ease;
        filter:drop-shadow(0 2px 8px rgba(0,0,0,0.7)) drop-shadow(0 0 4px rgba(0,0,0,0.5));
      `;
      innerEl.innerHTML = `<img src="/airplane-top.png" style="width:100%;height:100%;object-fit:contain;display:block;mix-blend-mode:multiply;" />`;

      outerEl.appendChild(innerEl);
      planeElRef.current = innerEl;

      markerRef.current = new maplibregl.Marker({ element: outerEl, anchor: "center" })
        .setLngLat([planePos.lng, planePos.lat])
        .addTo(map);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        initRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Update plane position & trail ─────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.loaded()) return;

    // Uçağı hareket ettir + döndür (sadece iç div döner, MapLibre wrapper'ı değil)
    if (markerRef.current) {
      markerRef.current.setLngLat([planePos.lng, planePos.lat]);
    }
    if (planeElRef.current) {
      planeElRef.current.style.transform = `rotate(${bearing - 90}deg)`;
    }

    // Haritayı uçağın üzerine ortalı tut
    map.easeTo({ center: [planePos.lng, planePos.lat], duration: 800, easing: (t) => t });

    // İzi güncelle
    const trailSrc = map.getSource("trail") as maplibregl.GeoJSONSource | undefined;
    if (trailSrc) {
      trailSrc.setData({
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: trailCoords.length > 1
            ? trailCoords
            : [[planePos.lng, planePos.lat], [planePos.lng, planePos.lat]],
        },
      });
    }
  }, [planePos.lng, planePos.lat, bearing, trailCoords]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
    />
  );
}
