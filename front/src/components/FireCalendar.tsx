"use client";

import { Flame, Info } from "lucide-react";
import type { FocusEvent, MouseEvent } from "react";
import { Fragment, useMemo, useState } from "react";

import type { FireDataset, Location } from "@/lib/types";
import { cn, formatNumber, heatColor, MONTHS_LONG } from "@/lib/utils";

interface FireCalendarProps {
  dataset: FireDataset;
  location: Location;
  highlightYear?: number;
  highlightMonth?: number;
  onSelectMonth?: (year: number, monthIndex: number) => void;
}

interface TooltipState {
  x: number;
  y: number;
  year: number;
  month: number;
  frp: number;
  detections: number;
}

export default function FireCalendar({
  dataset,
  location,
  highlightYear,
  highlightMonth,
  onSelectMonth,
}: FireCalendarProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const monthlyTotals = useMemo(() => {
    const totals = new Array<number>(12).fill(0);
    for (const cell of dataset.cells) totals[cell.month] += cell.frp;
    return totals;
  }, [dataset]);

  const peakShare =
    monthlyTotals[dataset.peakMonth] /
    Math.max(
      1,
      monthlyTotals.reduce((total, value) => total + value, 0),
    );

  const showTooltip = (
    event: MouseEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>,
    cellIndex: number,
  ) => {
    const cell = dataset.cells[cellIndex];
    const rect = event.currentTarget.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const x = Math.min(
      Math.max(rect.left + rect.width / 2, 96),
      viewportWidth - 96,
    );

    setTooltip({
      x,
      y: rect.top,
      year: cell.year,
      month: cell.month,
      frp: cell.frp,
      detections: cell.detections,
    });
  };

  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3.5">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <Flame className="h-3 w-3 text-orange-400/80" />
            <p className="text-[11px] font-medium text-slate-200">
              FRP mensual normalizado
            </p>
          </div>
          <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-slate-500">
            {dataset.years[0]} — {dataset.years[dataset.years.length - 1]} ·{" "}
            {location.province}
          </p>
        </div>

        <div className="text-right">
          <p className="text-sm font-semibold tabular-nums text-orange-300">
            {formatNumber(dataset.totalDetections)}
          </p>
          <p className="font-mono text-[7px] uppercase tracking-[0.14em] text-slate-600">
            celdas H3
          </p>
        </div>
      </div>

      <div
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: "24px repeat(12, minmax(0, 1fr))" }}
      >
        <div aria-hidden="true" />

        {MONTHS_LONG.map((month, index) => (
          <div
            key={month}
            title={month}
            className={cn(
              "pb-1 text-center font-mono text-[6.5px] font-medium uppercase tracking-wider transition-colors",
              highlightMonth === index ? "text-cyan-300" : "text-slate-600",
            )}
          >
            {month.slice(0, 3)}
          </div>
        ))}

        {dataset.years.map((year, yearIndex) => (
          <Fragment key={year}>
            <div
              className={cn(
                "flex items-center font-mono text-[7px] tabular-nums",
                highlightYear === year ? "text-cyan-300" : "text-slate-600",
              )}
            >
              {yearIndex === 0 ||
              yearIndex === dataset.years.length - 1 ||
              year % 5 === 0
                ? year
                : ""}
            </div>

            {Array.from({ length: 12 }, (_, month) => {
              const cellIndex = yearIndex * 12 + month;
              const cell = dataset.cells[cellIndex];
              const selected =
                highlightYear === year && highlightMonth === month;

              return (
                <button
                  key={`${year}-${MONTHS_LONG[month]}`}
                  type="button"
                  tabIndex={-1}
                  aria-label={`${MONTHS_LONG[month]} ${year}: ${cell.frp.toFixed(1)} MW, ${formatNumber(cell.detections)} celdas H3`}
                  title={`${MONTHS_LONG[month]} ${year} · ${cell.frp.toFixed(1)} MW`}
                  onMouseEnter={(event) => showTooltip(event, cellIndex)}
                  onFocus={(event) => showTooltip(event, cellIndex)}
                  onMouseLeave={() => setTooltip(null)}
                  onBlur={() => setTooltip(null)}
                  onClick={() => onSelectMonth?.(cell.year, cell.month)}
                  className={cn(
                    "h-2.5 w-full cursor-pointer rounded-[2px] transition duration-150 hover:brightness-150 focus:outline-none",
                    selected &&
                      "ring-1 ring-cyan-200/90 ring-offset-1 ring-offset-slate-950",
                    cell.intensity > 0.8 &&
                      "shadow-[0_0_6px_rgba(254,232,56,0.3)]",
                  )}
                  style={{
                    backgroundColor: heatColor(cell.intensity, 0.92),
                  }}
                />
              );
            })}
          </Fragment>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="font-mono text-[7px] uppercase tracking-wider text-slate-600">
          Bajo
        </span>
        <div className="h-1.5 flex-1 rounded-full bg-[linear-gradient(90deg,#0c1626,#1a3258,#2b547f,#537189,#8b8b73,#c2b05e,#fee838)]" />
        <span className="font-mono text-[7px] uppercase tracking-wider text-slate-600">
          Extremo
        </span>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-white/5 pt-2.5">
        <span className="flex items-center gap-1 font-mono text-[8px] uppercase tracking-[0.1em] text-slate-500">
          <Info className="h-2.5 w-2.5 text-cyan-400/60" />
          Pico:{" "}
          <strong className="font-medium text-slate-300">
            {MONTHS_LONG[dataset.peakMonth]}
          </strong>
        </span>
        <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-orange-300/70">
          {Math.round(peakShare * 100)}% del FRP
        </span>
      </div>

      {tooltip ? (
        <div
          className="pointer-events-none fixed z-50 w-max -translate-x-1/2 -translate-y-full rounded-lg border border-cyan-400/20 bg-slate-950/95 px-2.5 py-2 shadow-2xl backdrop-blur-md"
          style={{ left: tooltip.x, top: tooltip.y - 8 }}
        >
          <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-slate-400">
            {MONTHS_LONG[tooltip.month]} {tooltip.year}
          </p>
          <p className="mt-1 text-[11px] font-semibold tabular-nums text-orange-300">
            {tooltip.frp.toFixed(1)} MW
          </p>
          <p className="text-[9px] tabular-nums text-slate-400">
            {formatNumber(tooltip.detections)} celdas H3
          </p>
        </div>
      ) : null}
    </div>
  );
}
