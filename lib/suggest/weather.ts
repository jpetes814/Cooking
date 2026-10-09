/**
 * Turns a weather reading into a mood for "Ideas for tonight". Pure so it can
 * be tested; the reading itself comes from lib/suggest/useWeather.ts.
 */

export type WeatherMood = "cozy" | "fresh" | "mild";

export interface WeatherReading {
  tempC: number;
  /** Rain or snow in the last hour, in mm. */
  precipMm: number;
  /** WMO weather code from Open-Meteo. */
  code: number;
}

const COLD_C = 10;
const HOT_C = 26;

function isWet(code: number, precipMm: number): "rain" | "snow" | null {
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95 || precipMm > 0.2) return "rain";
  return null;
}

/** The mood and the line the card shows to explain it. */
export function moodFrom(w: WeatherReading): { mood: WeatherMood; line: string } {
  const wet = isWet(w.code, w.precipMm);
  const cold = w.tempC < COLD_C;
  if (wet === "snow") return { mood: "cozy", line: "Snowy out, so cozy picks first." };
  if (cold && wet) return { mood: "cozy", line: "Chilly and rainy, so cozy picks first." };
  if (cold) return { mood: "cozy", line: "Chilly out, so cozy picks first." };
  if (wet) return { mood: "cozy", line: "Rainy out, so cozy picks first." };
  if (w.tempC > HOT_C) return { mood: "fresh", line: "Hot out, so fresh picks first." };
  return { mood: "mild", line: "Mild out, so the season leads." };
}

/** One decimal place is about 10 km: enough for the weather, not enough to find you. */
export function roundCoord(x: number): number {
  return Math.round(x * 10) / 10;
}

export function forecastUrl(lat: number, lon: number): string {
  return `https://api.open-meteo.com/v1/forecast?latitude=${roundCoord(lat)}&longitude=${roundCoord(lon)}&current=temperature_2m,precipitation,weather_code`;
}

/** Reads Open-Meteo's answer, or null if it isn't the shape we expect. */
export function parseForecast(json: unknown): WeatherReading | null {
  const cur = (json as { current?: Record<string, unknown> } | null)?.current;
  if (!cur) return null;
  const tempC = cur.temperature_2m;
  const precipMm = cur.precipitation ?? 0;
  const code = cur.weather_code ?? 0;
  if (typeof tempC !== "number" || typeof precipMm !== "number" || typeof code !== "number") return null;
  return { tempC, precipMm, code };
}
