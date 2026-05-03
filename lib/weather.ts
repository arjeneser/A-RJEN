export interface WeatherData {
  temp: number;
  icon: string;
  label: string;
}

// WMO Weather interpretation codes → icon + Turkish label
function codeToWeather(code: number): { icon: string; label: string } {
  if (code === 0)                       return { icon: "☀️",  label: "Açık" };
  if (code === 1)                       return { icon: "🌤️", label: "Az Bulutlu" };
  if (code === 2)                       return { icon: "⛅",  label: "Parçalı Bulutlu" };
  if (code === 3)                       return { icon: "☁️",  label: "Kapalı" };
  if (code >= 45 && code <= 48)         return { icon: "🌫️", label: "Sisli" };
  if (code >= 51 && code <= 55)         return { icon: "🌦️", label: "Çisenti" };
  if (code >= 61 && code <= 65)         return { icon: "🌧️", label: "Yağmurlu" };
  if (code >= 71 && code <= 77)         return { icon: "🌨️", label: "Karlı" };
  if (code >= 80 && code <= 82)         return { icon: "🌦️", label: "Sağanak" };
  if (code >= 85 && code <= 86)         return { icon: "🌨️", label: "Kar Sağanağı" };
  if (code >= 95 && code <= 99)         return { icon: "⛈️", label: "Fırtına" };
  return { icon: "🌡️", label: "Değişken" };
}

// Simple in-memory cache (TTL: 30 min per coordinate pair)
const weatherCache = new Map<string, { data: WeatherData; ts: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

export async function getWeather(lat: number, lng: number): Promise<WeatherData | null> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const cached = weatherCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lng}` +
      `&current=temperature_2m,weathercode` +
      `&timezone=auto`;

    const res = await fetch(url);
    if (!res.ok) return null;

    const json = await res.json();
    const temp = Math.round(json.current.temperature_2m as number);
    const code = json.current.weathercode as number;
    const { icon, label } = codeToWeather(code);

    const data: WeatherData = { temp, icon, label };
    weatherCache.set(key, { data, ts: Date.now() });
    return data;
  } catch {
    return null;
  }
}
