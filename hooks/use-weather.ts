"use client";
import { useState, useEffect } from "react";
import type { City } from "@/types";
import { getWeather, type WeatherData } from "@/lib/weather";

export function useWeather(city: City | null | undefined) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!city) { setWeather(null); return; }
    setLoading(true);
    getWeather(city.lat, city.lng).then((data) => {
      setWeather(data);
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city?.id]);

  return { weather, loading };
}

/** Fetch weather for two cities simultaneously */
export function useWeatherPair(from: City | null | undefined, to: City | null | undefined) {
  const dep = useWeather(from);
  const dst = useWeather(to);
  return { departure: dep, destination: dst };
}
