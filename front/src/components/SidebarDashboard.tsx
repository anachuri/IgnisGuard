/*

**/

"use client";

import type { LucideIcon } from "lucide-react";
import {
  Activity,
  CalendarDays,
  CalendarRange,
  Crosshair,
  History,
  MapPinned,
  Orbit,
  PanelRightClose,
  Radio,
  Satellite,
} from "lucide-react";

import FireCalendar from "@/components/FireCalendar";
import LocationSearch from "@/components/LocationSearch";
import MetricsCard from "@/components/MetricsCard";
import PredictionCard from "@/components/PredictionCard";
import { addDaysIso } from "@/lib/fire-data";
import type { DateMode, FireDataset, Location, Prediction } from "@/lib/types";
import { cn, formatIsoDate, weekdayFromIso } from "@/lib/utils";

interface SidebarDashboardProps {
  open: boolean;
  onClose: () => void;
  location: Location;
  onLocationChange: (location: Location) => void;
  date: string;
  onDateChange: (date: string) => void;
  today: string;
  mode: DateMode;
  prediction: Prediction | null;
  dataset: FireDataset;
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
  { label: "Hoy", days: 0 },
  { label: "+15 d", days: 15 },
  { label: "+45 d", days: 45 },
];

export default function SidebarDashboard({
  open,
  onClose,
  location,
  onLocationChange,
  date,
  onDateChange,
  today,
  mode,
  prediction,
  dataset,
}: SidebarDashboardProps) {
  const parsedDate = new Date(`${date}T12:00:00Z`);
  const highlightYear = parsedDate.getUTCFullYear();
  const highlightMonth = parsedDate.getUTCMonth();

  return (
    <aside
      inert={!open}
      aria-hidden={!open}
      aria-label="Panel de análisis IgnisGuard"
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
                  Panel de análisis · Burning Activity
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Colapsar panel de análisis"
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
              Sistema en línea
            </span>
            <span className="flex items-center gap-1 font-mono text-[7.5px] uppercase tracking-[0.12em] text-slate-600">
              <Satellite className="h-2.5 w-2.5" />
              Telemetría de superficie
            </span>
          </div>
        </header>

        <div className="scrollbar-slim relative flex-1 overflow-y-auto px-4 pb-5 pt-4">
          <section className="animate-fade-up">
            <SectionLabel
              index="01"
              title="Ubicación y ventana temporal"
              icon={MapPinned}
              meta="Input"
            />

            <LocationSearch value={location} onChange={onLocationChange} />

            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between">
                <label
                  htmlFor="analysis-date"
                  className="font-mono text-[8px] uppercase tracking-[0.14em] text-slate-500"
                >
                  Fecha de análisis
                </label>
                <span className="font-mono text-[7px] uppercase tracking-[0.12em] text-slate-700">
                  UTC −03
                </span>
              </div>

              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-cyan-300/60" />
                <input
                  id="analysis-date"
                  type="date"
                  value={date}
                  min="2006-01-01"
                  max="2032-12-31"
                  onChange={(event) =>
                    event.target.value && onDateChange(event.target.value)
                  }
                  className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] pl-9 pr-3 font-mono text-[11px] tabular-nums text-slate-100 outline-none transition [color-scheme:dark] focus:border-cyan-400/45 focus:bg-white/[0.055] focus:ring-2 focus:ring-cyan-400/10"
                />
              </div>

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
                <PredictionCard
                  prediction={prediction}
                  date={date}
                  location={location}
                />
              ) : mode === "historical" ? (
                <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.045] p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.16em] text-amber-300/90">
                      <History className="h-3 w-3" />
                      Auditoría Histórica
                    </span>
                    <span className="rounded border border-amber-400/20 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-wider text-amber-200/80">
                      Archivo
                    </span>
                  </div>
                  <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400">
                    Reconstrucción satelital del{" "}
                    <strong className="font-medium text-slate-200">
                      {formatIsoDate(date)}
                    </strong>
                    . El registro VIIRS/MODIS permite comparar la actividad
                    térmica con el acumulado de las últimas dos décadas.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.045] p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.16em] text-emerald-300/90">
                      <Radio className="h-3 w-3" />
                      Monitoreo en curso
                    </span>
                    <span className="flex items-center gap-1 rounded border border-emerald-400/20 bg-emerald-400/10 px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-wider text-emerald-200/80">
                      <span className="h-1 w-1 rounded-full bg-emerald-300" />
                      Live
                    </span>
                  </div>
                  <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400">
                    Ventana satelital activa para{" "}
                    <strong className="font-medium text-slate-200">
                      {location.name}
                    </strong>
                    . Los focos FIRMS se actualizan con cada pasada orbital.
                  </p>
                </div>
              )}
            </div>
          </section>

          <div className="my-5 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          <section className="animate-fade-up [animation-delay:100ms]">
            <SectionLabel
              index="02"
              title="Estacionalidad histórica"
              icon={CalendarRange}
              meta="20 años"
            />
            <FireCalendar
              dataset={dataset}
              location={location}
              highlightYear={highlightYear}
              highlightMonth={highlightMonth}
            />
          </section>

          <div className="my-5 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          <section className="animate-fade-up [animation-delay:180ms]">
            <SectionLabel
              index="03"
              title="Métricas del sector"
              icon={Activity}
              meta="Live"
            />
            <MetricsCard location={location} />
          </section>

          <div className="mt-4 flex items-center justify-center gap-1.5 font-mono text-[7px] uppercase tracking-[0.12em] text-slate-700">
            <Crosshair className="h-2.5 w-2.5" />
            Modelo demostrativo · Datos simulados
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
