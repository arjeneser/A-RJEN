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
          "esri-satellite": {
            type: "raster",
            tiles: [
              "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            ],
            tileSize: 256,
            attribution: "© Esri, Maxar, Earthstar Geographics",
          },
          "esri-labels": {
            type: "raster",
            tiles: [
              "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
            ],
            tileSize: 256,
          },
        },
        layers: [
          {
            id: "esri-satellite-layer",
            type: "raster",
            source: "esri-satellite",
          },
          {
            id: "esri-labels-layer",
            type: "raster",
            source: "esri-labels",
          },
        ],
      },
      center: [planePos.lng, planePos.lat],
      zoom: 6,
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
          "line-color": "rgba(255,255,255,0.4)",
          "line-width": 1.5,
          "line-dasharray": [4, 6],
        },
      });

      // Tamamlanan iz
      map.addSource("trail", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: trailCoords.length > 1 ? trailCoords : [[planePos.lng, planePos.lat], [planePos.lng, planePos.lat]] },
        },
      });
      map.addLayer({
        id: "trail",
        type: "line",
        source: "trail",
        paint: {
          "line-color": "#60C8FF",
          "line-width": 2.5,
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
        .setPopup(new maplibregl.Popup({ closeButton: false, offset: 12 })
          .setHTML(`<div style="color:white;font-weight:700;font-size:12px;background:rgba(20,30,60,0.95);padding:4px 8px;border-radius:6px;border:1px solid rgba(59,130,246,0.5)">${departure.name}</div>`))
        .addTo(map);

      // Varış marker
      const dstEl = document.createElement("div");
      dstEl.innerHTML = `
        <div style="background:rgba(245,158,11,0.9);border:2px solid white;border-radius:50%;width:14px;height:14px;box-shadow:0 0 10px rgba(245,158,11,0.8)"></div>
      `;
      new maplibregl.Marker({ element: dstEl, anchor: "center" })
        .setLngLat([destination.lng, destination.lat])
        .setPopup(new maplibregl.Popup({ closeButton: false, offset: 12 })
          .setHTML(`<div style="color:white;font-weight:700;font-size:12px;background:rgba(20,30,60,0.95);padding:4px 8px;border-radius:6px;border:1px solid rgba(245,158,11,0.5)">${destination.name}</div>`))
        .addTo(map);

      // Uçak marker
      const planeEl = document.createElement("div");
      planeEl.style.cssText = `width:64px;height:64px;transform:rotate(${bearing}deg);filter:drop-shadow(0 0 8px rgba(255,255,255,0.6))`;
      planeEl.innerHTML = `<img src="/airplane-top.png" style="width:100%;height:100%;object-fit:contain" />`;
      markerRef.current = new maplibregl.Marker({ element: planeEl, anchor: "center" })
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

    // Uçağı hareket ettir
    if (markerRef.current) {
      const el = markerRef.current.getElement() as HTMLDivElement;
      el.style.transform = `rotate(${bearing}deg)`;
      markerRef.current.setLngLat([planePos.lng, planePos.lat]);
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
          coordinates: trailCoords.length > 1 ? trailCoords : [[planePos.lng, planePos.lat], [planePos.lng, planePos.lat]],
        },
      });
    }
  }, [planePos.lng, planePos.lat, bearing, trailCoords]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ background: "#0a0f1e" }}
    />
  );
}
