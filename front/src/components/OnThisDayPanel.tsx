"use client";

import { CalendarClock, Loader2, RotateCw } from "lucide-react";

import type { OnThisDayRow } from "@/lib/api";
import type { LoadStatus, Location } from "@/lib/types";
import { formatIsoDate, formatNumber } from "@/lib/utils";

interface OnThisDayPanelProps {
  location: Location;
  date: string;
  rows: OnThisDayRow[];
  status: LoadStatus;
  error: string | null;
  onRetry: () => void;
}

export default function OnThisDayPanel({
  location,
  date,
  rows,
  status,
  error,
  onRetry,
}: OnThisDayPanelProps) {
  const maxCells = Math.max(1, ...rows.map((row) => row.cells));
  const monthDay = date.slice(5);

  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <CalendarClock className="h-3 w-3 text-cyan-300/80" />
          <p className="text-[11px] font-medium text-slate-200">
            Un día como hoy
          </p>
        </div>
        <span className="font-mono text-[7px] uppercase tracking-[0.12em] text-slate-600">
          {formatIsoDate(date).slice(0, 6)}
        </span>
      </div>

      <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.12em] text-slate-500">
        {location.name} · {monthDay} en cada año
      </p>

      {status === "loading" ? (
        <div className="mt-3 flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.12em] text-slate-500">
          <Loader2 className="h-3 w-3 animate-spin text-cyan-300/70" />
          Consultando archivo
        </div>
      ) : status === "error" ? (
        <div className="mt-3 rounded-lg border border-red-400/20 bg-red-500/[0.06] px-2.5 py-2">
          <p className="text-[9px] leading-relaxed text-red-200/80">
            {error ?? "No se pudo consultar el archivo histórico."}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-1.5 inline-flex items-center gap-1 font-mono text-[7px] uppercase tracking-[0.12em] text-red-200/80 transition hover:text-red-100"
          >
            <RotateCw className="h-2.5 w-2.5" />
            Reintentar
          </button>
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-[9px] leading-relaxed text-slate-500">
          Sin detecciones registradas para esta fecha.
        </p>
      ) : (
        <div className="mt-2.5 space-y-1">
          {rows.map((row) => (
            <div key={row.y} className="flex items-center gap-2">
              <span className="w-8 shrink-0 font-mono text-[8px] tabular-nums text-slate-500">
                {row.y}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-orange-500/70 to-amber-300"
                  style={{ width: `${(row.cells / maxCells) * 100}%` }}
                />
              </div>
              <span className="w-14 shrink-0 text-right font-mono text-[7.5px] tabular-nums text-slate-500">
                {formatNumber(row.cells)} celdas
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
