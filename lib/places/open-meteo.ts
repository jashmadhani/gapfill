/** Open-Meteo (https://open-meteo.com/) - fully free, no API key required. */

export interface WeatherSnapshot {
  currentTempC: number | null;
  currentConditionCode: number | null;
  dailyHighC: number[];
  dailyLowC: number[];
  dailyConditionCode: number[];
  dailyDates: string[];
}

export async function getWeather(lat: number, lng: number): Promise<WeatherSnapshot | null> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: "temperature_2m,weather_code",
    daily: "temperature_2m_max,temperature_2m_min,weather_code",
    timezone: "auto",
    forecast_days: "5",
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!res.ok) return null;
  const data = await res.json();

  return {
    currentTempC: data.current?.temperature_2m ?? null,
    currentConditionCode: data.current?.weather_code ?? null,
    dailyHighC: data.daily?.temperature_2m_max ?? [],
    dailyLowC: data.daily?.temperature_2m_min ?? [],
    dailyConditionCode: data.daily?.weather_code ?? [],
    dailyDates: data.daily?.time ?? [],
  };
}

/** WMO weather codes (the scheme Open-Meteo uses) collapsed into a short,
 * human label - just enough for a UI chip, not full fidelity. */
const CONDITION_LABELS: Record<number, string> = {
  0: "Clear sky",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  80: "Rain showers",
  81: "Rain showers",
  82: "Violent showers",
  95: "Thunderstorm",
  96: "Thunderstorm",
  99: "Thunderstorm",
};

export function conditionLabel(code: number | null): string {
  if (code === null) return "Unknown";
  return CONDITION_LABELS[code] ?? "Mixed conditions";
}
