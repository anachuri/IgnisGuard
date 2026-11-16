"use client";

import { BarChart3, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo } from "react";

import type { FireDataset } from "@/lib/types";
import { cn, formatNumber, MONTHS_LONG } from "@/lib/utils";

interface HistoricalComparisonProps {
  dataset: FireDataset;
  year: number;
}

/**
 * Compara el año seleccionado contra el promedio multi-anual del dataset:
 * focos (celdas H3) por mes arriba/abajo del promedio y desvío anual total.
 */
export default function HistoricalComparison({
  dataset,
  year,
}: HistoricalComparisonProps) {
  const stats = useMemo(() => {
    const years = dataset.years.length;
    if (years === 0) return null;

    const monthlyAvg = new Array<number>(12).fill(0);
    for (const cell of dataset.cells) monthlyAvg[cell.month] += cell.detections;
    for (let month = 0; month < 12; month++) monthlyAvg[month] /= years;

    const yearCells = dataset.cells.filter((cell) => cell.year === year);
    const yearTotal = yearCells.reduce(
      (total, cell) => total + cell.detections,
      0,
    );
    const avgYearTotal = dataset.totalDetections / years;

    const anomalies = yearCells.map(
      (cell) => cell.detections - monthlyAvg[cell.month],
    );
    const maxAbs = Math.max(1, ...anomalies.map((value) => Math.abs(value)));

    const deviation =
      avgYearTotal > 0 ? (yearTotal - avgYearTotal) / avgYearTotal : 0;

    return {
      monthlyAvg,
      yearTotal,
      avgYearTotal,
      anomalies,
      maxAbs,
      deviation,
    };
  }, [dataset, year]);

  if (!stats) return null;

  const moreFires = stats.deviation > 0;

  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <BarChart3 className="h-3 w-3 text-cyan-300/80" />
          <p className="text-[11px] font-medium text-slate-200">
            Comparación histórica
          </p>
        </div>
        <span className="font-mono text-[7px] uppercase tracking-[0.12em] text-slate-600">
          {year} vs promedio {dataset.years[0]}–
          {dataset.years[dataset.years.length - 1]}
        </span>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-slate-950/35 px-2.5 py-2">
        <div>
          <p className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-slate-500">
            Focos detectados {year}
          </p>
          <p className="mt-0.5 text-[13px] font-semibold tabular-nums text-slate-100">
            {formatNumber(stats.yearTotal)}
            <span className="ml-1.5 font-mono text-[8px] font-normal text-slate-500">
              prom. {formatNumber(Math.round(stats.avgYearTotal))}
            </span>
          </p>
        </div>
        <span
          className={cn(
            "flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[8px] font-semibold tabular-nums",
            moreFires
              ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
              : "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
          )}
        >
          {moreFires ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          {moreFires ? "+" : ""}
          {Math.round(stats.deviation * 100)}%
        </span>
      </div>

      <div className="mt-2.5 space-y-1">
        {MONTHS_LONG.map((month, monthIndex) => {
          const anomaly = stats.anomalies[monthIndex] ?? 0;
          const width = (Math.abs(anomaly) / stats.maxAbs) * 50;
          const positive = anomaly > 0;

          return (
            <div key={month} className="flex items-center gap-2">
              <span className="w-7 shrink-0 font-mono text-[7px] uppercase tracking-wider text-slate-600">
                {month.slice(0, 3)}
              </span>
              <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.04]">
                <span className="absolute left-1/2 top-0 h-full w-px bg-white/15" />
                <div
                  className={cn(
                    "absolute top-0 h-full rounded-full",
                    positive
                      ? "bg-gradient-to-r from-amber-500/70 to-amber-300"
                      : "bg-gradient-to-l from-cyan-500/70 to-cyan-300",
                  )}
                  style={
                    positive
                      ? { left: "50%", width: `${width}%` }
                      : { right: "50%", width: `${width}%` }
                  }
                />
              </div>
              <span
                className={cn(
                  "w-14 shrink-0 text-right font-mono text-[7.5px] tabular-nums",
                  positive ? "text-amber-300/80" : "text-cyan-300/70",
                )}
              >
                {anomaly === 0
                  ? "±0"
                  : `${positive ? "+" : "−"}${formatNumber(Math.round(Math.abs(anomaly)))}`}
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-2 font-mono text-[7px] uppercase tracking-[0.12em] text-slate-700">
        Desvío de celdas H3 vs media mensual del período
      </p>
    </div>
  );
}
