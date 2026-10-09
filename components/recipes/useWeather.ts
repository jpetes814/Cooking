"use client";

import { useCallback, useEffect, useState } from "react";
import { useOnline } from "@/components/shell/useOnline";
import { forecastUrl, moodFrom, parseForecast, type WeatherMood, type WeatherReading } from "@/lib/suggest/weather";

/**
 * Local weather for "Ideas for tonight", only after you turn it on. The phone's
 * location is rounded to about 10 km and sent only to Open-Meteo (free, no key,
 * no server of ours in between). The last reading is kept on this phone, so
 * with no signal the ideas use it, or fall back to the season.
 */

const ON_KEY = "recipe-box:weather-on";
const CACHE_KEY = "recipe-box:weather";
const FRESH_FOR = 60 * 60 * 1000;
/** An old reading still beats nothing, but not after half a day. */
const USABLE_FOR = 12 * 60 * 60 * 1000;

type Cached = WeatherReading & { at: number };

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing or storage full: weather just won't be remembered.
  }
}

function position(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) reject(new Error("no geolocation"));
    else
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        maximumAge: 3 * 60 * 60 * 1000,
        timeout: 15_000,
      });
  });
}

export interface Weather {
  on: boolean;
  busy: boolean;
  mood: WeatherMood | null;
  /** One line for the card: why these picks, or why weather isn't used. */
  line: string;
  turnOn: () => void;
  turnOff: () => void;
}

export function useWeather(now: number): Weather {
  const online = useOnline();
  const [on, setOn] = useState(() => read<boolean>(ON_KEY) === true);
  const [cached, setCached] = useState<Cached | null>(() => read<Cached>(CACHE_KEY));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      let pos: GeolocationPosition;
      try {
        pos = await position();
      } catch {
        setProblem("Couldn't get your location, so using the season.");
        return false;
      }
      const res = await fetch(forecastUrl(pos.coords.latitude, pos.coords.longitude));
      const reading = res.ok ? parseForecast(await res.json()) : null;
      if (!reading) throw new Error("bad forecast");
      const next = { ...reading, at: Date.now() };
      write(CACHE_KEY, next);
      setCached(next);
      setProblem(null);
      return true;
    } catch {
      setProblem("Couldn't get the weather, so using the season.");
      return true;
    } finally {
      setBusy(false);
    }
  }, []);

  const stale = !cached || now - cached.at > FRESH_FOR;
  useEffect(() => {
    if (!on || !online || !stale || busy || problem) return;
    // On the next tick, so the "checking" state isn't set mid-render.
    const id = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(id);
  }, [on, online, stale, busy, problem, refresh]);

  const turnOn = useCallback(() => {
    void refresh().then((ok) => {
      if (!ok) return;
      write(ON_KEY, true);
      setOn(true);
    });
  }, [refresh]);

  const turnOff = useCallback(() => {
    write(ON_KEY, null);
    write(CACHE_KEY, null);
    setOn(false);
    setCached(null);
    setProblem(null);
  }, []);

  const usable = on && cached && now - cached.at < USABLE_FOR ? cached : null;
  const mood = usable ? moodFrom(usable) : null;
  const line = busy
    ? "Checking the weather..."
    : mood
      ? mood.line
      : problem
        ? problem
        : on && !online
          ? "No signal, so using the season."
          : on
            ? "Using the season."
            : "Picked from your favorites and the season.";

  return { on, busy, mood: mood?.mood ?? null, line, turnOn, turnOff };
}
