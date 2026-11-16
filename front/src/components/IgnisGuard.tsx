"use client";

import {
  ChevronRight,
  Flame,
  Loader2,
  Orbit,
  PanelRightOpen,
  Radio,
  Satellite,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import GlobeView from "@/components/GlobeView";
import SidebarDashboard from "@/components/SidebarDashboard";
import Starfield from "@/components/Starfield";
import type { OnThisDayRow, RefreshStatus } from "@/lib/api";
import {
  getCalendar,
  getFires,
  getOnThisDay,
  getRefreshStatus,
  getRegions,
  isAbortError,
  mergeApiRegions,
  startRefresh,
  toFireDataset,
  toFirePoints,
} from "@/lib/api";
import { buildPrediction, getDateMode, todayIso } from "@/lib/fire-data";
import { DEFAULT_LOCATION_ID, LOCATIONS } from "@/lib/locations";
import type { FireDataset, FirePoint, LoadStatus, Location } from "@/lib/types";
import { cn, formatNumber } from "@/lib/utils";

const CALENDAR_YEARS = 20;
const API_DEBOUNCE_MS = 220;

function MissionClock() {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setTime(new Date().toISOString().slice(11, 19));
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <span
      suppressHydrationWarning
      className="font-mono text-[8px] tabular-nums tracking-[0.1em] text-slate-400"
    >
      {time ?? "--:--:--"} UTC
    </span>
  );
}

function BootScreen() {
  return (
    <main className="relative grid h-dvh w-full place-items-center overflow-hidden bg-[#030712]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-[18%] -top-[28%] h-[68vw] w-[68vw] rounded-full bg-cyan-500/[0.055] blur-[150px]" />
        <div className="absolute -bottom-[34%] right-[2%] h-[58vw] w-[58vw] rounded-full bg-orange-600/[0.05] blur-[160px]" />
        <div className="cyber-grid absolute inset-0 opacity-60" />
      </div>

      <Starfield />

      <div className="relative z-10 flex flex-col items-center gap-4">
        <div className="relative grid h-16 w-16 place-items-center rounded-2xl border border-cyan-400/25 bg-cyan-400/10 shadow-[0_0_60px_-10px_rgba(34,211,238,0.6)]">
          <Orbit className="h-8 w-8 animate-spin text-cyan-300 [animation-duration:8s]" />
          <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-orange-400 shadow-[0_0_10px_3px_rgba(251,146,60,0.55)]" />
        </div>

        <div className="text-center">
          <p className="text-sm font-semibold tracking-[0.36em] text-white">
            IGNISGUARD<span className="text-orange-400">.</span>
          </p>
          <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.26em] text-cyan-300/70">
            Inicializando telemetría orbital
          </p>
        </div>

        <div className="h-px w-44 overflow-hidden bg-white/10">
          <div className="h-full w-1/2 animate-shimmer bg-gradient-to-r from-transparent via-cyan-300 to-transparent" />
        </div>
      </div>
    </main>
  );
}

export default function IgnisGuard() {
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setToday(todayIso()), 420);
    return () => window.clearTimeout(timer);
  }, []);

  if (!today) return <BootScreen />;
  return <IgnisGuardDashboard today={today} />;
}

function IgnisGuardDashboard({ today }: { today: string }) {
  const [locations, setLocations] = useState<readonly Location[]>(LOCATIONS);
  const [locationId, setLocationId] = useState(DEFAULT_LOCATION_ID);
  const [regionsStatus, setRegionsStatus] = useState<LoadStatus>("loading");
  const [regionsError, setRegionsError] = useState<string | null>(null);
  const [regionsAttempt, setRegionsAttempt] = useState(0);

  const [date, setDate] = useState(today);
  const [apiDate, setApiDate] = useState(today);
  const [sidebarOpen, setSidebarOpen] = useState(
    () => window.matchMedia("(min-width: 768px)").matches,
  );

  const [dataset, setDataset] = useState<FireDataset | null>(null);
  const [calendarStatus, setCalendarStatus] = useState<LoadStatus>("idle");
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [calendarAttempt, setCalendarAttempt] = useState(0);

  const [onThisDayRows, setOnThisDayRows] = useState<OnThisDayRow[]>([]);
  const [onThisDayStatus, setOnThisDayStatus] = useState<LoadStatus>("idle");
  const [onThisDayError, setOnThisDayError] = useState<string | null>(null);
  const [onThisDayAttempt, setOnThisDayAttempt] = useState(0);

  const [firesEnabled, setFiresEnabled] = useState(false);
  const [firesStatus, setFiresStatus] = useState<LoadStatus>("idle");
  const [firesError, setFiresError] = useState<string | null>(null);
  const [firesAttempt, setFiresAttempt] = useState(0);
  const [firePoints, setFirePoints] = useState<FirePoint[]>([]);

  const [refresh, setRefresh] = useState<RefreshStatus>({
    running: false,
    started_at: null,
    finished_at: null,
    ok: null,
    detail: "",
    request: null,
  });
  const refreshPoll = useRef<number | null>(null);

  const calendarToYear = Number(today.slice(0, 4));
  const calendarFromYear = calendarToYear - (CALENDAR_YEARS - 1);
  const location =
    locations.find((item) => item.id === locationId) ??
    locations[0] ??
    LOCATIONS[0];
  const mode = getDateMode(date, today);
  const apiMode = getDateMode(apiDate, today);
  const generating = firesStatus === "loading";

  const prediction = useMemo(
    () => (mode === "forecast" ? buildPrediction(location, date, today) : null),
    [date, location, mode, today],
  );

  const maxFrp = useMemo(
    () =>
      firePoints.length ? Math.max(...firePoints.map((point) => point.frp)) : 0,
    [firePoints],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setApiDate(date), API_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [date]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: regionsAttempt fuerza el reintento manual
  useEffect(() => {
    const controller = new AbortController();
    setRegionsStatus("loading");
    setRegionsError(null);

    getRegions(controller.signal)
      .then((regions) => {
        if (regions.length === 0) {
          setLocations(LOCATIONS);
          setRegionsStatus("error");
          setRegionsError(
            "El backend no tiene regiones cargadas. Usando la lista local hasta que /api/regions devuelva datos.",
          );
          return;
        }

        setLocations(mergeApiRegions(regions));
        setRegionsStatus("success");
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        setLocations(LOCATIONS);
        setRegionsStatus("error");
        setRegionsError(
          "No se pudo conectar con /api/regions. Revisá NEXT_PUBLIC_API_URL o levantá FastAPI.",
        );
      });

    return () => controller.abort();
  }, [regionsAttempt]);

  useEffect(() => {
    if (locations.length === 0) return;
    if (!locations.some((item) => item.id === locationId)) {
      setLocationId(locations[0].id);
    }
  }, [locationId, locations]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: calendarAttempt fuerza el reintento manual
  useEffect(() => {
    if (regionsStatus === "loading") {
      setCalendarStatus("loading");
      return;
    }

    if (regionsStatus === "error" || !location.apiId) {
      setDataset(null);
      setCalendarStatus("error");
      setCalendarError(
        regionsError ?? "La región seleccionada no tiene id de FastAPI.",
      );
      return;
    }

    const controller = new AbortController();
    setCalendarStatus("loading");
    setCalendarError(null);

    getCalendar(
      location.apiId,
      calendarFromYear,
      calendarToYear,
      controller.signal,
    )
      .then((rows) => {
        setDataset(toFireDataset(rows, calendarFromYear, calendarToYear));
        setCalendarStatus("success");
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        setDataset(null);
        setCalendarStatus("error");
        setCalendarError(
          "No se pudo cargar /api/calendar para esta región. Reintentá cuando el backend esté en línea.",
        );
      });

    return () => controller.abort();
  }, [
    calendarAttempt,
    calendarFromYear,
    calendarToYear,
    location.apiId,
    regionsError,
    regionsStatus,
  ]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: onThisDayAttempt fuerza el reintento manual
  useEffect(() => {
    if (regionsStatus === "loading") {
      setOnThisDayStatus("loading");
      return;
    }

    if (regionsStatus === "error" || !location.apiId) {
      setOnThisDayRows([]);
      setOnThisDayStatus("error");
      setOnThisDayError(
        regionsError ?? "La región seleccionada no tiene id de FastAPI.",
      );
      return;
    }

    const controller = new AbortController();
    const month = Number(apiDate.slice(5, 7));
    const day = Number(apiDate.slice(8, 10));
    setOnThisDayStatus("loading");
    setOnThisDayError(null);

    getOnThisDay(location.apiId, month, day, controller.signal)
      .then((rows) => {
        setOnThisDayRows(rows);
        setOnThisDayStatus("success");
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        setOnThisDayRows([]);
        setOnThisDayStatus("error");
        setOnThisDayError(
          "No se pudo cargar /api/on-this-day para esta fecha.",
        );
      });

    return () => controller.abort();
  }, [apiDate, location.apiId, onThisDayAttempt, regionsError, regionsStatus]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: firesAttempt fuerza el reintento manual
  useEffect(() => {
    if (!firesEnabled) {
      setFiresStatus("idle");
      setFiresError(null);
      setFirePoints([]);
      return;
    }

    if (apiMode === "forecast") {
      setFirePoints([]);
      setFiresStatus("error");
      setFiresError(
        "No hay detecciones para fechas futuras. Elegí una fecha histórica o de hoy.",
      );
      return;
    }

    if (regionsStatus === "loading") {
      setFiresStatus("loading");
      return;
    }

    if (regionsStatus === "error" || !location.apiId) {
      setFirePoints([]);
      setFiresStatus("error");
      setFiresError(
        regionsError ?? "La región seleccionada no tiene id de FastAPI.",
      );
      return;
    }

    const controller = new AbortController();
    setFiresStatus("loading");
    setFiresError(null);
    setFirePoints([]);

    getFires(location.apiId, apiDate, controller.signal)
      .then((response) => {
        setFirePoints(toFirePoints(response));
        setFiresStatus("success");
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        setFirePoints([]);
        setFiresStatus("error");
        setFiresError(
          "No se pudo consultar /api/fires. Verificá que FastAPI esté en línea.",
        );
      });

    return () => controller.abort();
  }, [
    apiDate,
    apiMode,
    firesAttempt,
    firesEnabled,
    location.apiId,
    regionsError,
    regionsStatus,
  ]);

  const handleGenerate = () => {
    if (generating) return;

    if (firesEnabled) {
      setFiresEnabled(false);
      return;
    }

    if (mode === "forecast") {
      setFiresStatus("error");
      setFiresError(
        "No hay detecciones para fechas futuras. Elegí una fecha histórica o de hoy.",
      );
      return;
    }

    setFiresEnabled(true);
  };

  const retryFires = () => setFiresAttempt((attempt) => attempt + 1);

  const handleRefreshData = (start: string, end: string) => {
    if (refresh.running || location.apiId == null) return;

    startRefresh({ region_id: location.apiId, start, end })
      .then(() =>
        setRefresh((current) => ({
          ...current,
          running: true,
          detail: "",
          ok: null,
        })),
      )
      .catch(() =>
        setRefresh((current) => ({
          ...current,
          running: false,
          ok: false,
          detail: "No se pudo iniciar el refresh en el backend.",
        })),
      );
  };

  useEffect(() => {
    if (!refresh.running) return;

    const poll = () => {
      getRefreshStatus()
        .then((status) => {
          setRefresh(status);
          if (!status.running) {
            if (refreshPoll.current !== null) {
              window.clearInterval(refreshPoll.current);
              refreshPoll.current = null;
            }
            if (status.ok) {
              setCalendarAttempt((attempt) => attempt + 1);
              setOnThisDayAttempt((attempt) => attempt + 1);
              setFiresAttempt((attempt) => attempt + 1);
            }
          }
        })
        .catch(() => {});
    };

    poll();
    refreshPoll.current = window.setInterval(poll, 3000);
    return () => {
      if (refreshPoll.current !== null) {
        window.clearInterval(refreshPoll.current);
        refreshPoll.current = null;
      }
    };
  }, [refresh.running]);

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#030712] text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-[18%] -top-[28%] h-[68vw] w-[68vw] rounded-full bg-cyan-500/[0.055] blur-[150px]" />
        <div className="absolute -bottom-[34%] right-[2%] h-[58vw] w-[58vw] rounded-full bg-orange-600/[0.05] blur-[160px]" />
        <div className="cyber-grid absolute inset-0 opacity-60" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 12%, #030712 84%)",
          }}
        />
      </div>

      <Starfield />

      <div
        className={cn(
          "absolute inset-0 transition-[right] duration-500 ease-out",
          sidebarOpen ? "lg:right-[416px]" : "lg:right-0",
        )}
      >
        <GlobeView
          location={location}
          firePoints={firePoints}
          showFires={firesEnabled}
          generating={firesStatus === "loading"}
        />

        <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-4 sm:p-5">
          <div className="pointer-events-auto flex items-center gap-2.5">
            <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-cyan-400/25 bg-slate-950/55 shadow-[0_0_30px_-8px_rgba(34,211,238,0.45)] backdrop-blur-md">
              <Orbit className="h-5 w-5 text-cyan-300" />
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-orange-400 shadow-[0_0_9px_2px_rgba(251,146,60,0.65)]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tracking-[0.3em] text-white">
                  IGNISGUARD<span className="text-orange-400">.</span>
                </span>
                <span className="hidden rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[6.5px] uppercase tracking-[0.14em] text-slate-400 sm:inline">
                  NASA Space Apps
                </span>
              </div>
              <p className="mt-0.5 hidden font-mono text-[7px] uppercase tracking-[0.22em] text-slate-500 sm:block sm:text-[7.5px]">
                Burning Activity Calendar
              </p>
            </div>
          </div>

          <div className="pointer-events-auto flex flex-col items-end gap-2">
            <div className="hidden items-center gap-1 xl:flex">
              {["FIRMS", "VIIRS 375 m", "XGBoost"].map((label) => (
                <span
                  key={label}
                  className="rounded border border-white/10 bg-slate-950/50 px-1.5 py-0.5 font-mono text-[6.5px] uppercase tracking-[0.12em] text-slate-500 backdrop-blur-sm"
                >
                  {label}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/60 px-2.5 py-1.5 shadow-lg backdrop-blur-md">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              <span className="hidden font-mono text-[7px] uppercase tracking-[0.14em] text-emerald-300/90 sm:inline">
                En línea
              </span>
              <span className="hidden h-3 w-px bg-white/10 sm:block" />
              <MissionClock />
            </div>
          </div>
        </header>

        <div className="pointer-events-none absolute bottom-5 right-4 z-20 hidden w-[252px] md:block">
          <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-1.5">
              <Flame className="h-3 w-3 text-orange-400" />
              <span className="font-mono text-[7.5px] uppercase tracking-[0.17em] text-slate-400">
                Focos de calor · VIIRS
              </span>
              <span
                className={cn(
                  "ml-auto h-1.5 w-1.5 rounded-full",
                  firesStatus === "error"
                    ? "bg-red-400 shadow-[0_0_7px_2px_rgba(248,113,113,0.55)]"
                    : firesEnabled
                      ? "bg-emerald-400 shadow-[0_0_7px_2px_rgba(52,211,153,0.55)]"
                      : "bg-slate-600",
                )}
              />
            </div>

            <div className="mt-2 flex items-center gap-3">
              <span className="flex items-center gap-1 text-[8px] text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-400 shadow-[0_0_7px_2px_rgba(251,146,60,0.55)]" />
                FRP alto
              </span>
              <span className="flex items-center gap-1 text-[8px] text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_7px_2px_rgba(239,68,68,0.55)]" />
                FRP crítico
              </span>
              <span className="flex items-center gap-1 text-[8px] text-slate-500">
                <span className="h-2 w-2 rounded-full border border-cyan-300/70 shadow-[0_0_6px_2px_rgba(34,211,238,0.55)]" />
                MODIS+VIIRS
              </span>
              <span className="ml-auto font-mono text-[7px] tabular-nums text-slate-600">
                {firesStatus === "loading"
                  ? "consultando"
                  : firesStatus === "error"
                    ? "error"
                    : firesEnabled
                      ? `${firePoints.length} focos`
                      : "sin datos"}
              </span>
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-2 font-mono text-[7px] uppercase tracking-[0.1em] text-slate-600">
              <span className="flex items-center gap-1">
                <Satellite className="h-2.5 w-2.5 text-cyan-400/50" />
                {location.name}
              </span>
              <span className="tabular-nums">
                {location.lat.toFixed(2)}° / {location.lon.toFixed(2)}°
              </span>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2.5 px-4 pb-5 sm:pb-6">
          {generating ? (
            <div className="flex items-center gap-2 rounded-full border border-cyan-400/20 bg-slate-950/75 px-3 py-1 font-mono text-[7.5px] uppercase tracking-[0.14em] text-cyan-200/80 backdrop-blur-md">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" />
              Consultando FIRMS · pasada orbital
            </div>
          ) : firesError ? (
            <div className="flex items-center gap-2 rounded-full border border-red-400/25 bg-slate-950/80 px-3 py-1 font-mono text-[7.5px] uppercase tracking-[0.14em] text-red-200/85 backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              <span className="max-w-[70vw] truncate">{firesError}</span>
              {firesEnabled && mode !== "forecast" ? (
                <button
                  type="button"
                  onClick={retryFires}
                  className="pointer-events-auto ml-1 rounded border border-red-300/30 px-1.5 py-0.5 text-[7px] tracking-[0.1em] text-red-100/90 transition hover:bg-red-400/10"
                >
                  Reintentar
                </button>
              ) : null}
            </div>
          ) : firesEnabled ? (
            <div className="flex items-center gap-2 rounded-full border border-orange-400/20 bg-slate-950/75 px-3 py-1 font-mono text-[7.5px] uppercase tracking-[0.14em] text-orange-200/80 backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400 shadow-[0_0_7px_2px_rgba(251,146,60,0.6)]" />
              {firePoints.length > 0
                ? `${formatNumber(firePoints.length)} focos · FRP máx. ${Math.round(maxFrp)} MW`
                : "Sin detecciones para esta fecha"}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 font-mono text-[7px] uppercase tracking-[0.14em] text-slate-600">
              <Radio className="h-2.5 w-2.5 text-cyan-400/40" />
              Sensor VIIRS 375 m en espera
            </div>
          )}

          <div className="pointer-events-auto flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              aria-pressed={firesEnabled}
              className={cn(
                "group relative flex max-w-[calc(100vw-2rem)] items-center gap-2.5 overflow-hidden rounded-full border px-5 py-3 text-[11px] font-semibold shadow-2xl outline-none transition duration-300 sm:text-xs",
                firesEnabled
                  ? "border-orange-300/50 bg-gradient-to-r from-orange-600 via-red-600 to-orange-600 text-white shadow-[0_0_45px_-6px_rgba(249,115,22,0.8)]"
                  : "border-orange-400/40 bg-gradient-to-r from-orange-500/95 via-red-600/95 to-orange-500/95 text-white shadow-[0_0_45px_-8px_rgba(249,115,22,0.7)] hover:scale-[1.02] hover:shadow-[0_0_55px_-6px_rgba(249,115,22,0.9)]",
                "focus-visible:ring-2 focus-visible:ring-orange-300/60 disabled:cursor-wait disabled:opacity-90",
              )}
            >
              <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_20%,rgba(255,255,255,0.22)_50%,transparent_80%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              {generating ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <Flame
                  className={cn(
                    "h-4 w-4 shrink-0",
                    firesEnabled && "fill-white/20",
                  )}
                />
              )}
              <span className="relative truncate">
                {generating
                  ? "Consultando NASA FIRMS / VIIRS…"
                  : firesEnabled
                    ? "Ocultar Puntos de Incendio"
                    : "Generar Puntos de Incendio (NASA FIRMS / VIIRS)"}
              </span>
              {firesEnabled ? (
                <span className="ml-1 shrink-0 rounded-full bg-slate-950/30 px-2 py-0.5 font-mono text-[8px] tabular-nums">
                  {firePoints.length}
                </span>
              ) : (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70 transition-transform group-hover:translate-x-0.5" />
              )}
            </button>

            <p className="flex items-center gap-1 font-mono text-[6.5px] uppercase tracking-[0.14em] text-slate-700">
              <Sparkles className="h-2 w-2" />
              Arrastrá el globo para rotar · Flechas ← →
            </p>
          </div>
        </div>
      </div>

      <SidebarDashboard
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        location={location}
        locations={locations}
        onLocationChange={(nextLocation) => setLocationId(nextLocation.id)}
        date={date}
        onDateChange={setDate}
        today={today}
        mode={mode}
        prediction={prediction}
        dataset={dataset}
        calendarStatus={calendarStatus}
        calendarError={calendarError}
        onRetryCalendar={() => setCalendarAttempt((attempt) => attempt + 1)}
        regionsError={regionsError}
        onRetryRegions={() => setRegionsAttempt((attempt) => attempt + 1)}
        onThisDayRows={onThisDayRows}
        onThisDayStatus={onThisDayStatus}
        onThisDayError={onThisDayError}
        onRetryOnThisDay={() => setOnThisDayAttempt((attempt) => attempt + 1)}
        onRefreshData={handleRefreshData}
        refresh={refresh}
      />

      {!sidebarOpen ? (
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          aria-label="Abrir panel de análisis"
          className="fixed right-0 top-1/2 z-40 flex -translate-y-1/2 items-center gap-1 rounded-l-xl border border-r-0 border-cyan-400/25 bg-slate-950/80 px-2 py-4 text-cyan-300 shadow-2xl backdrop-blur-md transition hover:bg-cyan-400/10 hover:text-cyan-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
        >
          <PanelRightOpen className="h-4 w-4" />
          <span className="hidden font-mono text-[7px] uppercase tracking-[0.18em] [writing-mode:vertical-rl] sm:inline">
            Panel de análisis
          </span>
        </button>
      ) : null}
    </main>
  );
}
