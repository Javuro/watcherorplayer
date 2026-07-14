"use client";

import maplibregl, {
  type GeoJSONSource,
  type Map as MapLibreMap,
} from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import type { City } from "../campaign";

type MapLibreSignalGlobeProps = {
  cities: City[];
  selectedCity: City;
  variant?: "console" | "dark" | "immersive";
};

const lightStyleUrl = "https://tiles.openfreemap.org/styles/positron";
const darkStyleUrl = "https://tiles.openfreemap.org/styles/dark";

export function MapLibreSignalGlobe({
  cities,
  selectedCity,
  variant = "dark",
}: MapLibreSignalGlobeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [zoom, setZoom] = useState(1.15);
  const styleUrl = variant === "console" ? lightStyleUrl : darkStyleUrl;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    let signalTimer: number | undefined;
    const map = new maplibregl.Map({
      attributionControl: false,
      center: [18, 18],
      container: containerRef.current,
      dragRotate: true,
      maxPitch: 75,
      pitch: 0,
      style: styleUrl,
      zoom: 1.15,
    });

    mapRef.current = map;
    const updateImmersiveCamera = () => {
      if (variant !== "immersive") {
        return;
      }

      const leftPadding = window.innerWidth >= 1024
        ? Math.min(640, Math.round(window.innerWidth * 0.43))
        : 0;
      const topPadding = window.innerWidth < 640 ? 210 : 0;

      map.setPadding({
        bottom: 0,
        left: leftPadding,
        right: 0,
        top: topPadding,
      });
      map.resize();
    };

    updateImmersiveCamera();
    window.addEventListener("resize", updateImmersiveCamera);
    if (variant === "dark") {
      map.addControl(
        new maplibregl.NavigationControl({
          showCompass: true,
          showZoom: true,
          visualizePitch: true,
        }),
        "bottom-right",
      );
    }
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-left",
    );

    map.on("style.load", () => {
      map.setProjection({ type: "globe" });
      map.setSky({
        "atmosphere-blend": 0,
        "fog-color": "#030506",
        "fog-ground-blend": 0,
        "horizon-color": "#030506",
        "horizon-fog-blend": 0,
        "sky-color": "#030506",
        "sky-horizon-blend": 0,
      });

      map.addSource("city-signals", {
        data: createCitySignalData(cities, selectedCity.id, new Date()),
        type: "geojson",
      });

      map.addLayer({
        id: "city-signal-aura",
        paint: {
          "circle-blur": 1,
          "circle-color": [
            "case",
            ["==", ["get", "selected"], 1],
            "#7ee0bd",
            "#69cce0",
          ],
          "circle-opacity": [
            "case",
            ["==", ["get", "night"], 1],
            ["case", ["==", ["get", "selected"], 1], 0.34, 0.18],
            0.03,
          ],
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            1,
            ["case", ["==", ["get", "selected"], 1], 31, 20],
            8,
            ["case", ["==", ["get", "selected"], 1], 54, 38],
          ],
        },
        source: "city-signals",
        type: "circle",
      });

      map.addLayer({
        id: "city-signal-halo",
        paint: {
          "circle-blur": 0.75,
          "circle-color": [
            "case",
            ["==", ["get", "selected"], 1],
            "#7ee0bd",
            "#5fb9d0",
          ],
          "circle-opacity": [
            "case",
            ["==", ["get", "selected"], 1],
            ["case", ["==", ["get", "night"], 1], 0.82, 0.36],
            ["case", ["==", ["get", "night"], 1], 0.52, 0.12],
          ],
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            1,
            ["case", ["==", ["get", "selected"], 1], 14, 9],
            8,
            ["case", ["==", ["get", "selected"], 1], 28, 18],
          ],
        },
        source: "city-signals",
        type: "circle",
      });

      map.addLayer({
        id: "city-signal-core",
        paint: {
          "circle-color": [
            "case",
            ["==", ["get", "selected"], 1],
            ["case", ["==", ["get", "night"], 1], "#d2fff0", "#a8e8d3"],
            ["case", ["==", ["get", "night"], 1], "#a9edff", "#79bfd0"],
          ],
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            1,
            ["case", ["==", ["get", "selected"], 1], 5, 3.5],
            8,
            ["case", ["==", ["get", "selected"], 1], 9, 6],
          ],
          "circle-stroke-color": "rgba(228,255,249,0.9)",
          "circle-stroke-width": 1.2,
        },
        source: "city-signals",
        type: "circle",
      });

      map.on("click", "city-signal-core", (event) => {
        const feature = event.features?.[0];
        const coordinates = feature?.geometry.type === "Point"
          ? feature.geometry.coordinates
          : null;

        if (!coordinates) {
          return;
        }

        map.flyTo({
          center: [coordinates[0], coordinates[1]],
          duration: 1400,
          essential: true,
          pitch: 48,
          zoom: 7,
        });
      });

      map.on("mouseenter", "city-signal-core", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "city-signal-core", () => {
        map.getCanvas().style.cursor = "grab";
      });

      signalTimer = window.setInterval(() => {
        const now = new Date();
        const citySource = map.getSource("city-signals") as
          | GeoJSONSource
          | undefined;

        citySource?.setData(createCitySignalData(cities, selectedCity.id, now));
      }, 60_000);

      setIsReady(true);
    });

    map.on("zoom", () => setZoom(map.getZoom()));

    map.on("error", () => {
      setMapError("The live globe could not load its map tiles.");
    });

    return () => {
      if (signalTimer) {
        window.clearInterval(signalTimer);
      }
      window.removeEventListener("resize", updateImmersiveCamera);
      map.remove();
      mapRef.current = null;
    };
  }, [cities, selectedCity.id, styleUrl, variant]);

  function showEarth() {
    mapRef.current?.easeTo({
      center: [18, 18],
      duration: 1400,
      pitch: 0,
      zoom: 1.15,
    });
  }

  function showSelectedCity() {
    mapRef.current?.flyTo({
      center: [selectedCity.coordinates.lng, selectedCity.coordinates.lat],
      duration: 1800,
      essential: true,
      pitch: 52,
      zoom: 8,
    });
  }

  function moveMap(x: number, y: number) {
    mapRef.current?.panBy([x, y], { duration: 350 });
  }

  function handleZoom(nextZoom: number) {
    setZoom(nextZoom);
    mapRef.current?.setZoom(nextZoom);
  }

  if (variant === "console") {
    return (
      <div className="overflow-hidden rounded-2xl border border-[#292522] bg-[#eee7d8] p-3 text-[#171412] shadow-[10px_12px_0_rgba(0,0,0,0.35)] sm:p-4">
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#2d2925] bg-[#f8f4eb] p-2">
          <div className="grid grid-cols-4 gap-1">
            <ConsoleButton label="Left" onClick={() => moveMap(-100, 0)}>
              ←
            </ConsoleButton>
            <ConsoleButton label="Right" onClick={() => moveMap(100, 0)}>
              →
            </ConsoleButton>
            <ConsoleButton label="Up" onClick={() => moveMap(0, -100)}>
              ↑
            </ConsoleButton>
            <ConsoleButton label="Down" onClick={() => moveMap(0, 100)}>
              ↓
            </ConsoleButton>
          </div>
          <label className="ml-auto flex min-w-40 flex-1 items-center gap-3 px-2 text-xs font-semibold uppercase tracking-[0.16em]">
            Zoom
            <input
              aria-label="Globe zoom"
              className="min-w-24 flex-1 accent-[#df2c72]"
              max="10"
              min="1"
              onChange={(event) => handleZoom(Number(event.target.value))}
              step="0.1"
              type="range"
              value={zoom}
            />
          </label>
        </div>

        <div className="relative mt-3 overflow-hidden rounded-lg border border-[#b8afa1] bg-[#dcebed]">
          <div className="h-[460px] w-full sm:h-[520px]" ref={containerRef} />
          {!isReady && !mapError ? <GlobeLoading light /> : null}
          {mapError ? <GlobeError message={mapError} /> : null}
        </div>

        <div className="flex flex-col gap-3 px-1 pb-1 pt-4 font-mono text-xs leading-5 text-[#686158] sm:flex-row sm:items-center sm:justify-between">
          <span>Drag to spin. Scroll to zoom. Tap a pin to enter a city.</span>
          <div className="flex gap-2 font-sans">
            <button
              className="rounded-md border border-[#b8afa1] bg-[#f8f4eb] px-3 py-2 font-semibold text-[#171412]"
              onClick={showEarth}
              type="button"
            >
              Earth
            </button>
            <button
              className="rounded-md bg-[#df2c72] px-3 py-2 font-semibold text-white"
              onClick={showSelectedCity}
              type="button"
            >
              {selectedCity.name}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "immersive") {
    return (
      <div className="absolute inset-0 overflow-hidden bg-[#030506]">
        <div
          className="absolute inset-0 h-full min-h-[760px] w-full [filter:brightness(1.08)_contrast(1.14)_saturate(0.66)] lg:[filter:brightness(1.18)_contrast(1.16)_saturate(0.7)]"
          ref={containerRef}
        />
        <div className="pointer-events-none absolute bottom-24 right-5 z-10 flex items-center gap-3 rounded-md border border-white/10 bg-black/55 px-3 py-2 backdrop-blur sm:bottom-28 sm:right-9">
          <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-400">
            Drag to spin / scroll to zoom
          </span>
          <button
            className="pointer-events-auto rounded bg-white/10 px-2.5 py-1.5 text-[10px] font-semibold uppercase text-white transition hover:bg-white/20"
            onClick={showEarth}
            type="button"
          >
            Reset Earth
          </button>
        </div>
        {!isReady && !mapError ? <GlobeLoading /> : null}
        {mapError ? <GlobeError message={mapError} /> : null}
      </div>
    );
  }

  return (
    <div className="relative mt-8 overflow-hidden rounded-3xl border border-zinc-800 bg-[#050607] shadow-2xl shadow-sky-950/30">
      <div
        className="h-[560px] min-h-[68vh] w-full [filter:brightness(1.18)_contrast(1.06)_saturate(0.86)]"
        ref={containerRef}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 bg-gradient-to-b from-black/75 via-black/20 to-transparent p-4 pb-16">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-sky-200">
            Live Earth
          </p>
          <p className="mt-2 text-sm text-zinc-300">
            Tap a signal to enter its city.
          </p>
        </div>
        <div className="pointer-events-auto flex gap-2">
          <button
            className="rounded-md border border-white/15 bg-black/55 px-3 py-2 text-xs font-semibold text-white backdrop-blur"
            onClick={showEarth}
            type="button"
          >
            Earth
          </button>
          <button
            className="rounded-md bg-sky-300 px-3 py-2 text-xs font-semibold text-black"
            onClick={showSelectedCity}
            type="button"
          >
            {selectedCity.name}
          </button>
        </div>
      </div>

      {!isReady && !mapError ? <GlobeLoading /> : null}

      {mapError ? (
        <div className="absolute inset-x-4 bottom-4 rounded-xl border border-amber-300/20 bg-black/85 p-4 text-sm text-amber-100 backdrop-blur">
          {mapError}
        </div>
      ) : null}
    </div>
  );
}

function createCitySignalData(
  cityList: City[],
  selectedCityId: string,
  date: Date,
) {
  const solarPoint = getSubsolarPoint(date);

  return {
    features: cityList.map((city) => ({
      geometry: {
        coordinates: [city.coordinates.lng, city.coordinates.lat],
        type: "Point" as const,
      },
      properties: {
        cityId: city.id,
        cityName: city.name,
        night: isNightAt(city.coordinates.lat, city.coordinates.lng, solarPoint)
          ? 1
          : 0,
        selected: city.id === selectedCityId ? 1 : 0,
        status: city.status,
      },
      type: "Feature" as const,
    })),
    type: "FeatureCollection" as const,
  };
}

function isNightAt(
  lat: number,
  lng: number,
  solarPoint: { lat: number; lng: number },
) {
  const latitude = toRadians(lat);
  const longitude = toRadians(lng);
  const solarLatitude = toRadians(solarPoint.lat);
  const solarLongitude = toRadians(solarPoint.lng);
  const solarAltitude =
    Math.sin(latitude) * Math.sin(solarLatitude) +
    Math.cos(latitude) *
      Math.cos(solarLatitude) *
      Math.cos(longitude - solarLongitude);

  return solarAltitude < 0;
}

function getSubsolarPoint(date: Date) {
  const julianDate = date.getTime() / 86_400_000 + 2_440_587.5;
  const daysSinceJ2000 = julianDate - 2_451_545;
  const meanLongitude = normalizeDegrees(
    280.46 + 0.9856474 * daysSinceJ2000,
  );
  const meanAnomaly = toRadians(
    normalizeDegrees(357.528 + 0.9856003 * daysSinceJ2000),
  );
  const eclipticLongitude = toRadians(
    normalizeDegrees(
      meanLongitude +
        1.915 * Math.sin(meanAnomaly) +
        0.02 * Math.sin(2 * meanAnomaly),
    ),
  );
  const obliquity = toRadians(23.439 - 0.0000004 * daysSinceJ2000);
  const declination = Math.asin(
    Math.sin(obliquity) * Math.sin(eclipticLongitude),
  );
  const rightAscension = Math.atan2(
    Math.cos(obliquity) * Math.sin(eclipticLongitude),
    Math.cos(eclipticLongitude),
  );
  const greenwichSiderealTime = normalizeDegrees(
    280.46061837 + 360.98564736629 * daysSinceJ2000,
  );

  return {
    lat: toDegrees(declination),
    lng: normalizeLongitude(toDegrees(rightAscension) - greenwichSiderealTime),
  };
}

function normalizeDegrees(value: number) {
  return ((value % 360) + 360) % 360;
}

function normalizeLongitude(value: number) {
  return ((value + 540) % 360) - 180;
}

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number) {
  return (radians * 180) / Math.PI;
}

function ConsoleButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="grid h-8 w-8 place-items-center rounded border border-[#292522] bg-[#c9f5ce] text-base font-bold shadow-[2px_2px_0_#292522] active:translate-x-px active:translate-y-px active:shadow-none"
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function GlobeLoading({ light = false }: { light?: boolean }) {
  return (
    <div
      className={`absolute inset-0 grid place-items-center p-6 text-center ${light ? "bg-[#dcebed]" : "bg-[#050607]"}`}
    >
      <div>
        <div
          className={`mx-auto h-10 w-10 animate-spin rounded-full border-2 ${light ? "border-[#b8afa1] border-t-[#df2c72]" : "border-zinc-800 border-t-sky-300"}`}
        />
        <p
          className={`mt-4 text-sm font-semibold ${light ? "text-[#171412]" : "text-white"}`}
        >
          Loading live Earth
        </p>
      </div>
    </div>
  );
}

function GlobeError({ message }: { message: string }) {
  return (
    <div className="absolute inset-x-4 bottom-4 rounded-xl border border-amber-300/20 bg-black/85 p-4 text-sm text-amber-100 backdrop-blur">
      {message}
    </div>
  );
}
