import { describe, expect, it } from "vitest";
import { forecastUrl, moodFrom, parseForecast, roundCoord } from "@/lib/suggest/weather";

describe("weather mood", () => {
  it("goes cozy when cold, wet, or snowy", () => {
    expect(moodFrom({ tempC: 6, precipMm: 1.2, code: 61 })).toEqual({ mood: "cozy", line: "Chilly and rainy, so cozy picks first." });
    expect(moodFrom({ tempC: 4, precipMm: 0, code: 1 }).line).toBe("Chilly out, so cozy picks first.");
    expect(moodFrom({ tempC: 18, precipMm: 0, code: 80 }).line).toBe("Rainy out, so cozy picks first.");
    expect(moodFrom({ tempC: -2, precipMm: 0.5, code: 73 }).line).toBe("Snowy out, so cozy picks first.");
  });

  it("goes fresh when hot, mild in between", () => {
    expect(moodFrom({ tempC: 31, precipMm: 0, code: 0 }).mood).toBe("fresh");
    expect(moodFrom({ tempC: 18, precipMm: 0, code: 2 }).mood).toBe("mild");
  });

  it("rounds your location to about 10 km", () => {
    expect(roundCoord(37.77493)).toBe(37.8);
    expect(roundCoord(-122.41942)).toBe(-122.4);
    expect(forecastUrl(37.77493, -122.41942)).toContain("latitude=37.8&longitude=-122.4");
  });

  it("reads Open-Meteo's answer, and nothing else", () => {
    expect(parseForecast({ current: { temperature_2m: 7.5, precipitation: 0.4, weather_code: 61 } })).toEqual({
      tempC: 7.5,
      precipMm: 0.4,
      code: 61,
    });
    expect(parseForecast({ current: { temperature_2m: "warm" } })).toBeNull();
    expect(parseForecast(null)).toBeNull();
  });
});
