"use client";

import { Activity, Droplets, Flame, Leaf, Sprout } from "lucide-react";
import { useEffect, useState } from "react";

import type { DrynessLevel, Location, Severity } from "@/lib/types";
import { cn, formatNumber, MONTHS_LONG } from "@/lib/utils";

interface MetricsCardProps {
  location: Location;
}

const DRY_STYLES: Record<DrynessLevel, string> = {
  Low: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  Moderate: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  High: "border-orange-400/30 bg-orange-400/10 text-orange-300",
  Critical: "border-red-400/30 bg-red-500/10 text-red-300",
};

const SEVERITY_STYLES: Record<Severity, string> = {
  Low: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  Medium: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  High: "border-orange-400/25 bg-orange-400/10 text-orange-300",
  Extreme: "border-red-400/25 bg-red-500/10 text-red-300",
};

export default function MetricsCard({ location }: MetricsCardProps) {
  const [recoveryProgress, setRecoveryProgress] = useState(0);

  useEffect(() => {
    setRecoveryProgress(0);
    const timer = window.setTimeout(
      () => setRecoveryProgress(location.recovery.percent),
      160,
    );
    return () => window.clearTimeout(timer);
  }, [location.recovery.percent]);

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/45">
      {/* FRP acumulado */}
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="grid h-6 w-6 place-items-center rounded-lg border border-orange-400/20 bg-orange-400/10">
              <Flame className="h-3 w-3 text-orange-300" />
            </span>
            <div>
              <p className="font-mono text-[8px] uppercase tracking-[0.15em] text-slate-500">
                Historical total
              </p>
              <p className="text-[11px] font-medium text-slate-300">
                Fire Radiative Power
              </p>
            </div>
          </div>
          <span className="rounded border border-orange-400/20 bg-orange-400/5 px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-wider text-orange-300/80">
            FRP
          </span>
        </div>

        <div className="mt-2.5 flex items-end gap-1.5">
          <span className="text-[26px] font-semibold leading-none tracking-tight tabular-nums text-white">
            {formatNumber(location.frpTotalGw, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}
          </span>
          <span className="mb-0.5 text-[11px] font-medium text-orange-300/80">
            GW
          </span>
          <span className="mb-0.5 ml-auto flex items-center gap-1 font-mono text-[8px] uppercase tracking-wider text-slate-600">
            <Activity className="h-2.5 w-2.5 text-cyan-400/60" />
            20 years
          </span>
        </div>

        <p className="mt-1 text-[9px] leading-relaxed text-slate-500">
          Integrated thermal energy detected by satellite in the sector.
        </p>

        <div className="mt-2 flex h-6 items-end gap-[3px]" aria-hidden="true">
          {location.season.map((value, index) => (
            <div
              key={MONTHS_LONG[index]}
              className="flex-1 rounded-sm bg-gradient-to-t from-orange-600/25 to-amber-400/80 transition-all duration-500"
              style={{ height: `${18 + value * 82}%` }}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between font-mono text-[6.5px] uppercase tracking-wider text-slate-700">
          <span>Jan</span>
          <span>Jul</span>
          <span>Dec</span>
        </div>
      </div>

      {/* Materia seca */}
      <div className="border-t border-white/5 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="grid h-6 w-6 place-items-center rounded-lg border border-amber-400/20 bg-amber-400/10">
              <Leaf className="h-3 w-3 text-amber-300" />
            </span>
            <p className="text-[11px] font-medium text-slate-300">
              Dry biomass status
            </p>
          </div>
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 font-mono text-[7px] font-semibold uppercase tracking-[0.12em]",
              DRY_STYLES[location.dryness.level],
            )}
          >
            {location.dryness.level}
          </span>
        </div>

        <div className="mt-2.5 flex items-center justify-between font-mono text-[8px] uppercase tracking-wider text-slate-500">
          <span className="flex items-center gap-1">
            <Droplets className="h-2.5 w-2.5 text-cyan-400/60" />
            Vegetation humidity{" "}
            <strong className="ml-0.5 font-medium tabular-nums text-slate-300">
              {location.dryness.humidity.toFixed(1)}%
            </strong>
          </span>
          <span>
            Fuel{" "}
            <strong className="font-medium tabular-nums text-slate-300">
              {location.dryness.fuelLoad}%
            </strong>
          </span>
        </div>

        <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-red-500 transition-[width] duration-700 ease-out"
            style={{ width: `${location.dryness.score}%` }}
          />
          <span className="absolute inset-y-0 left-1/2 w-px bg-slate-950/60" />
          <span className="absolute inset-y-0 left-3/4 w-px bg-slate-950/60" />
        </div>
        <p className="mt-1 text-[9px] leading-relaxed text-slate-500">
          Fine biomass available for ignition in the analyzed window.
        </p>
      </div>

      {/* Recuperación vegetal */}
      <div className="border-t border-white/5 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="grid h-6 w-6 place-items-center rounded-lg border border-emerald-400/20 bg-emerald-400/10">
              <Sprout className="h-3 w-3 text-emerald-300" />
            </span>
            <p className="text-[11px] font-medium text-slate-300">
              Vegetation recovery
            </p>
          </div>
          <span className="font-mono text-[7px] uppercase tracking-[0.12em] text-slate-600">
            Last fire · {location.recovery.lastFireYear}
          </span>
        </div>

        <div className="mt-2.5 flex items-end justify-between gap-2">
          <div className="flex items-end gap-1.5">
            <span className="text-[26px] font-semibold leading-none tabular-nums text-emerald-300">
              {recoveryProgress}%
            </span>
            <span className="mb-0.5 text-[10px] text-slate-400">recovered</span>
          </div>
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 font-mono text-[7px] uppercase tracking-[0.1em]",
              SEVERITY_STYLES[location.recovery.severity],
            )}
          >
            Initial severity: {location.recovery.severity}
          </span>
        </div>

        <div className="relative mt-2 h-2.5 overflow-hidden rounded-full bg-white/5">
          <div
            className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-emerald-500 via-lime-400 to-emerald-300 transition-[width] duration-1000 ease-out"
            style={{ width: `${recoveryProgress}%` }}
          >
            <span className="absolute inset-y-0 -left-1/3 w-1/3 animate-shimmer bg-gradient-to-r from-transparent via-white/45 to-transparent" />
          </div>
        </div>

        <div className="mt-1 flex items-center justify-between font-mono text-[7px] uppercase tracking-wider text-slate-600">
          <span>0%</span>
          <span>{location.recovery.monthsSince} months since event</span>
          <span>100%</span>
        </div>
        <p className="mt-1 text-[9px] leading-relaxed text-slate-500">
          {recoveryProgress}% recovered · Initial severity:{" "}
          {location.recovery.severity}.
        </p>
      </div>
    </div>
  );
}
