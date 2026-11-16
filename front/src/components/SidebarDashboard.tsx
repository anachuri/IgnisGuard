/*

**/

"use client";

import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  CalendarRange,
  Crosshair,
  Download,
  Loader2,
  MapPinned,
  Orbit,
  PanelRightClose,
  RefreshCw,
  RotateCw,
  Satellite,
} from "lucide-react";
import { useState } from "react";

import DatePicker from "@/components/DatePicker";
import FireCalendar from "@/components/FireCalendar";
import FireHistoryCard from "@/components/FireHistoryCard";
import HistoricalComparison from "@/components/HistoricalComparison";
import LocationSearch from "@/components/LocationSearch";
import MetricsCard from "@/components/MetricsCard";
import OnThisDayPanel from "@/components/OnThisDayPanel";
import PredictionCard from "@/components/PredictionCard";
import type {
  FireDayRow,
  FireDaySummary,
  OnThisDayRow,
  RefreshStatus,
} from "@/lib/api";
import { ApiError, downloadFiresCsv, isAbortError } from "@/lib/api";
import { addDaysIso } from "@/lib/fire-data";
import type {
  DateMode,
  FireDataset,
  ForecastHorizon,
  LoadStatus,
  Location,
  Prediction,
} from "@/lib/types";
import { cn, formatIsoDate, weekdayFromIso } from "@/lib/utils";

interface SidebarDashboardProps {
  open: boolean;
  onClose: () => void;
  location: Location;
  locations: readonly Location[];
  onLocationChange: (location: Location) => void;
  date: string;
  onDateChange: (date: string) => void;
  today: string;
  mode: DateMode;
  prediction: Prediction | null;
  predictionDate: string;
  forecastHorizon: ForecastHorizon;
  onForecastHorizonChange: (horizon: ForecastHorizon) => void;
  forecastError: string | null;
  onRetryForecast: () => void;
  dayFires: FireDaySummary | null;
  dayFiresStatus: LoadStatus;
  dayFiresError: string | null;
  onRetryDayFires: () => void;
  dataset: FireDataset | null;
  onSelectMonth: (year: number, monthIndex: number) => void;
  firesSuggestion: FireDayRow | null;
  calendarStatus: LoadStatus;
  calendarError: string | null;
  onRetryCalendar: () => void;
  regionsError: string | null;
  onRetryRegions: () => void;
  onThisDayRows: OnThisDayRow[];
  onThisDayStatus: LoadStatus;
  onThisDayError: string | null;
  onRetryOnThisDay: () => void;
  onRefreshData: (start: string, end: string) => void;
  refresh: RefreshStatus;
}

function LoadError({
  message,
  onRetry,
}: {
  message: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-xl border border-red-400/20 bg-red-500/[0.06] p-3.5">
      <div className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.14em] text-red-200/90">
        <AlertTriangle className="h-3 w-3" />
        Backend unavailable
      </div>
      <p className="mt-1.5 text-[9px] leading-relaxed text-slate-400">
        {message ?? "Could not get a response from the server."}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 inline-flex items-center gap-1 rounded-md border border-red-400/25 bg-red-500/10 px-2 py-1 font-mono text-[7px] uppercase tracking-[0.12em] text-red-200/80 transition hover:border-red-300/40 hover:text-red-100"
      >
        <RotateCw className="h-2.5 w-2.5" />
        Retry
      </button>
    </div>
  );
}

function CalendarSkeleton() {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3.5">
      <div className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.14em] text-slate-500">
        <Loader2 className="h-3 w-3 animate-spin text-cyan-300/70" />
        Loading historical calendar
      </div>
      <div className="mt-3 grid grid-cols-12 gap-[3px]">
        {CALENDAR_SKELETON_CELLS.map((key) => (
          <div
            key={key}
            className="h-2.5 animate-pulse rounded-[2px] bg-white/[0.06]"
          />
        ))}
      </div>
    </div>
  );
}

interface SectionLabelProps {
  index: string;
  title: string;
  icon: LucideIcon;
  meta: string;
}

function SectionLabel({ index, title, icon: Icon, meta }: SectionLabelProps) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="font-mono text-[9px] text-cyan-400/70">{index}</span>
        <Icon className="h-3 w-3 shrink-0 text-cyan-300/60" />
        <h2 className="truncate font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-slate-400">
          {title}
        </h2>
      </div>
      <span className="shrink-0 font-mono text-[7px] uppercase tracking-[0.16em] text-slate-700">
        {meta}
      </span>
    </div>
  );
}

const DATE_PRESETS = [
  { label: "Today", days: 0 },
  { label: "+15 d", days: 15 },
  { label: "+45 d", days: 45 },
];

const FORECAST_HORIZONS: { label: string; days: ForecastHorizon }[] = [
  { label: "7 days", days: 7 },
  { label: "15 days", days: 15 },
  { label: "1 month", days: 30 },
];

const CALENDAR_SKELETON_CELLS = Array.from(
  { length: 72 },
  (_, index) => `calendar-skeleton-${index}`,
);

export default function SidebarDashboard({
  open,
  onClose,
  location,
  locations,
  onLocationChange,
  date,
  onDateChange,
  today,
  mode,
  prediction,
  predictionDate,
  forecastHorizon,
  onForecastHorizonChange,
  forecastError,
  onRetryForecast,
  dayFires,
  dayFiresStatus,
  dayFiresError,
  onRetryDayFires,
  dataset,
  onSelectMonth,
  firesSuggestion,
  calendarStatus,
  calendarError,
  onRetryCalendar,
  regionsError,
  onRetryRegions,
  onThisDayRows,
  onThisDayStatus,
  onThisDayError,
  onRetryOnThisDay,
  onRefreshData,
  refresh,
}: SidebarDashboardProps) {
  const [rangeStart, setRangeStart] = useState(() => addDaysIso(today, -30));
  const [rangeEnd, setRangeEnd] = useState(today);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const parsedDate = new Date(`${date}T12:00:00Z`);
  const highlightYear = parsedDate.getUTCFullYear();
  const highlightMonth = parsedDate.getUTCMonth();
  const rangeInvalid =
    !rangeStart || !rangeEnd || rangeStart > rangeEnd || rangeEnd > today;
  const refreshDisabled = refresh.running || rangeInvalid;
  const exportDisabled = exporting || rangeInvalid;

  const handleExport = () => {
    if (exportDisabled) return;
    setExporting(true);
    setExportError(null);
    downloadFiresCsv(location, rangeStart, rangeEnd)
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        setExportError(
          error instanceof ApiError && error.status === 400
            ? "Invalid range: 366 days max per download."
            : "Could not generate the CSV. Check the backend.",
        );
      })
      .finally(() => setExporting(false));
  };

  return (
    <aside
      inert={!open}
      aria-hidden={!open}
      aria-label="IgnisGuard analytics panel"
      className={cn(
        "fixed bottom-3 right-3 top-3 z-30 w-[400px] max-w-[calc(100vw-1.5rem)] transition-transform duration-500 ease-out sm:bottom-4 sm:right-4 sm:top-4",
        open ? "translate-x-0" : "translate-x-[calc(100%+1.25rem)]",
      )}
    >
      <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80 shadow-[0_30px_100px_-20px_rgba(0,0,0,0.95)] backdrop-blur-md">
        <span className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
        <span className="pointer-events-none absolute left-0 top-0 h-5 w-5 rounded-tl-2xl border-l border-t border-cyan-400/40" />
        <span className="pointer-events-none absolute right-0 top-0 h-5 w-5 rounded-tr-2xl border-r border-t border-cyan-400/25" />
        <span className="pointer-events-none absolute bottom-0 left-0 h-5 w-5 rounded-bl-2xl border-b border-l border-cyan-400/20" />
        <span className="pointer-events-none absolute bottom-0 right-0 h-5 w-5 rounded-br-2xl border-b border-r border-cyan-400/30" />

        <header className="relative shrink-0 border-b border-white/5 px-4 pb-3.5 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-cyan-400/25 bg-cyan-400/10">
                <Orbit className="h-4 w-4 text-cyan-300" />
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-orange-400 shadow-[0_0_8px_2px_rgba(251,146,60,0.6)]" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold tracking-[0.22em] text-white">
                  IGNISGUARD
                </h2>
                <p className="truncate font-mono text-[7.5px] uppercase tracking-[0.18em] text-slate-500">
                  Analytics panel · Burning Activity
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Collapse analytics panel"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-slate-400 transition hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-cyan-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
            >
              <PanelRightClose className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 font-mono text-[7.5px] uppercase tracking-[0.14em] text-emerald-300/80">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              System online
            </span>
            <span className="flex items-center gap-1 font-mono text-[7.5px] uppercase tracking-[0.12em] text-slate-600">
              <Satellite className="h-2.5 w-2.5" />
              Surface telemetry
            </span>
          </div>
        </header>

        <div className="scrollbar-slim relative flex-1 overflow-y-auto px-4 pb-5 pt-4">
          <section className="animate-fade-up">
            <SectionLabel
              index="01"
              title="Location, analysis and data"
              icon={MapPinned}
              meta="Input"
            />

            <LocationSearch
              value={location}
              locations={locations}
              onChange={onLocationChange}
            />

            {regionsError ? (
              <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-400/20 bg-amber-400/[0.05] px-2.5 py-2">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-300/80" />
                <p className="flex-1 text-[9px] leading-relaxed text-amber-100/70">
                  {regionsError}
                </p>
                <button
                  type="button"
                  onClick={onRetryRegions}
                  className="shrink-0 font-mono text-[7px] uppercase tracking-[0.1em] text-amber-200/80 transition hover:text-amber-100"
                >
                  Retry
                </button>
              </div>
            ) : null}

            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between">
                <label
                  htmlFor="analysis-date"
                  className="font-mono text-[8px] uppercase tracking-[0.14em] text-slate-500"
                >
                  Analysis date - Predictions
                </label>
                <span className="font-mono text-[7px] uppercase tracking-[0.12em] text-slate-700">
                  UTC −03
                </span>
              </div>

              <DatePicker
                id="analysis-date"
                value={date}
                today={today}
                onChange={onDateChange}
                min="2006-01-01"
                max="2032-12-31"
              />

              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-[9px] text-slate-500">
                  {weekdayFromIso(date)} · {formatIsoDate(date)}
                </p>
                <div className="flex shrink-0 items-center gap-1">
                  {DATE_PRESETS.map((preset) => {
                    const presetDate = addDaysIso(today, preset.days);
                    const active = presetDate === date;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => onDateChange(presetDate)}
                        className={cn(
                          "rounded-md border px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-[0.08em] transition",
                          active
                            ? "border-cyan-400/35 bg-cyan-400/10 text-cyan-200"
                            : "border-white/10 bg-white/[0.02] text-slate-500 hover:border-white/20 hover:text-slate-300",
                        )}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-3">
              {mode === "forecast" && prediction ? (
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-slate-500">
                      Horizon from today
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      {FORECAST_HORIZONS.map((horizon) => {
                        const active = horizon.days === forecastHorizon;
                        return (
                          <button
                            key={horizon.days}
                            type="button"
                            onClick={() =>
                              onForecastHorizonChange(horizon.days)
                            }
                            className={cn(
                              "rounded-md border px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-[0.08em] transition",
                              active
                                ? "border-orange-400/40 bg-orange-400/10 text-orange-200"
                                : "border-white/10 bg-white/[0.02] text-slate-500 hover:border-white/20 hover:text-slate-300",
                            )}
                          >
                            {horizon.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <PredictionCard
                    prediction={prediction}
                    date={predictionDate}
                    location={location}
                    fallbackReason={forecastError}
                    onRetry={onRetryForecast}
                  />
                </div>
              ) : mode !== "forecast" ? (
                <FireHistoryCard
                  mode={mode}
                  date={date}
                  location={location}
                  summary={dayFires}
                  status={dayFiresStatus}
                  error={dayFiresError}
                  onRetry={onRetryDayFires}
                  suggestion={firesSuggestion}
                  onSelectDate={onDateChange}
                />
              ) : null}
            </div>

            <div className="mt-3">
              <OnThisDayPanel
                location={location}
                date={date}
                rows={onThisDayRows}
                status={onThisDayStatus}
                error={onThisDayError}
                onRetry={onRetryOnThisDay}
              />
            </div>

            <div className="mt-4 border-t border-white/5 pt-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.14em] text-slate-500">
                  <RefreshCw className="h-3 w-3 text-cyan-300/60" />
                  Data refresh · FIRMS
                </span>
                <span className="truncate font-mono text-[7px] uppercase tracking-[0.12em] text-slate-700">
                  {location.name}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label
                    htmlFor="refresh-start"
                    className="mb-1 block font-mono text-[8px] uppercase tracking-[0.14em] text-slate-500"
                  >
                    From
                  </label>
                  <input
                    id="refresh-start"
                    type="date"
                    value={rangeStart}
                    min="2012-01-01"
                    max={today}
                    onChange={(event) => setRangeStart(event.target.value)}
                    className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.035] px-2 font-mono text-[10px] tabular-nums text-slate-100 outline-none transition [color-scheme:dark] focus:border-cyan-400/45 focus:bg-white/[0.055] focus:ring-2 focus:ring-cyan-400/10"
                  />
                </div>
                <div>
                  <label
                    htmlFor="refresh-end"
                    className="mb-1 block font-mono text-[8px] uppercase tracking-[0.14em] text-slate-500"
                  >
                    To
                  </label>
                  <input
                    id="refresh-end"
                    type="date"
                    value={rangeEnd}
                    min="2012-01-01"
                    max={today}
                    onChange={(event) => setRangeEnd(event.target.value)}
                    className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.035] px-2 font-mono text-[10px] tabular-nums text-slate-100 outline-none transition [color-scheme:dark] focus:border-cyan-400/45 focus:bg-white/[0.055] focus:ring-2 focus:ring-cyan-400/10"
                  />
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onRefreshData(rangeStart, rangeEnd)}
                  disabled={refreshDisabled}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 font-mono text-[9px] uppercase tracking-[0.12em] transition",
                    refresh.running
                      ? "cursor-wait border-cyan-400/25 bg-cyan-400/[0.07] text-cyan-200/80"
                      : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-cyan-400/30 hover:bg-cyan-400/[0.07] hover:text-cyan-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-white/10 disabled:hover:bg-white/[0.03] disabled:hover:text-slate-300",
                  )}
                >
                  {refresh.running ? (
                    <Loader2 className="h-3 w-3 shrink-0 animate-spin text-cyan-300" />
                  ) : (
                    <RefreshCw className="h-3 w-3 shrink-0 text-cyan-300/70" />
                  )}
                  {refresh.running ? "Downloading…" : "Refresh FIRMS"}
                </button>

                <button
                  type="button"
                  onClick={handleExport}
                  disabled={exportDisabled}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 font-mono text-[9px] uppercase tracking-[0.12em] transition",
                    exporting
                      ? "cursor-wait border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-200/80"
                      : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-emerald-400/30 hover:bg-emerald-400/[0.07] hover:text-emerald-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-white/10 disabled:hover:bg-white/[0.03] disabled:hover:text-slate-300",
                  )}
                >
                  {exporting ? (
                    <Loader2 className="h-3 w-3 shrink-0 animate-spin text-emerald-300" />
                  ) : (
                    <Download className="h-3 w-3 shrink-0 text-emerald-300/70" />
                  )}
                  {exporting ? "Generating…" : "Hotspot CSV"}
                </button>
              </div>

              {exportError ? (
                <p className="mt-1.5 text-center font-mono text-[8px] uppercase tracking-[0.1em] text-red-300/80">
                  {exportError}
                </p>
              ) : refresh.detail ? (
                <p
                  className={cn(
                    "mt-1.5 text-center font-mono text-[8px] uppercase tracking-[0.1em]",
                    refresh.ok === false ? "text-red-300/80" : "text-slate-500",
                  )}
                >
                  {refresh.detail}
                </p>
              ) : null}
            </div>
          </section>

          <div className="my-5 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          <section className="animate-fade-up [animation-delay:100ms]">
            <SectionLabel
              index="02"
              title="Historical seasonality"
              icon={CalendarRange}
              meta="20 years"
            />
            {calendarStatus === "loading" ? (
              <CalendarSkeleton />
            ) : calendarStatus === "error" ? (
              <LoadError message={calendarError} onRetry={onRetryCalendar} />
            ) : dataset ? (
              <>
                <FireCalendar
                  dataset={dataset}
                  location={location}
                  highlightYear={highlightYear}
                  highlightMonth={highlightMonth}
                  onSelectMonth={onSelectMonth}
                />
                <div className="mt-3">
                  <HistoricalComparison
                    dataset={dataset}
                    year={highlightYear}
                  />
                </div>
              </>
            ) : null}
          </section>

          <div className="my-5 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          <section className="animate-fade-up [animation-delay:180ms]">
            <SectionLabel
              index="03"
              title="Sector metrics"
              icon={Activity}
              meta="Live"
            />
            <MetricsCard location={location} />
          </section>

          <div className="mt-4 flex items-center justify-center gap-1.5 font-mono text-[7px] uppercase tracking-[0.12em] text-slate-700">
            <Crosshair className="h-2.5 w-2.5" />
            Calendar & hotspots via FastAPI · Demo forecast
          </div>
        </div>

        <footer className="relative shrink-0 border-t border-white/5 px-4 py-2.5">
          <div className="flex items-center justify-between gap-2 font-mono text-[7px] uppercase tracking-[0.1em] text-slate-600">
            <span className="flex items-center gap-1">
              <Satellite className="h-2.5 w-2.5 text-cyan-400/50" />
              NASA FIRMS · VIIRS 375m
            </span>
            <span>IgnisGuard v1.0</span>
          </div>
        </footer>
      </div>
    </aside>
  );
}
