"use client";

import { AlertTriangle, History, Loader2, Radio, RotateCw } from "lucide-react";

import type { FireDayRow, FireDaySummary } from "@/lib/api";
import type { LoadStatus, Location } from "@/lib/types";
import { formatIsoDate, formatNumber } from "@/lib/utils";

interface FireHistoryCardProps {
  mode: "historical" | "live";
  date: string;
  location: Location;
  summary: FireDaySummary | null;
  status: LoadStatus;
  error: string | null;
  onRetry: () => void;
  suggestion?: FireDayRow | null;
  onSelectDate?: (date: string) => void;
}

export default function FireHistoryCard({
  mode,
  date,
  location,
  summary,
  status,
  error,
  onRetry,
  suggestion,
  onSelectDate,
}: FireHistoryCardProps) {
  const live = mode === "live";

  return (
    <div
      className={`rounded-xl border p-3.5 ${
        live
          ? "border-emerald-400/20 bg-emerald-400/[0.045]"
          : "border-amber-400/20 bg-amber-400/[0.045]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.16em] ${
            live ? "text-emerald-300/90" : "text-amber-300/90"
          }`}
        >
          {live ? (
            <Radio className="h-3 w-3" />
          ) : (
            <History className="h-3 w-3" />
          )}
          {live ? "Live monitoring" : "Historical audit"}
        </span>
        <span
          className={`flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-wider ${
            live
              ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200/80"
              : "border-amber-400/20 bg-amber-400/10 text-amber-200/80"
          }`}
        >
          {live ? (
            <span className="h-1 w-1 rounded-full bg-emerald-300" />
          ) : null}
          {live ? "Live" : "Archive"}
        </span>
      </div>

      <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400">
        Fires recorded in{" "}
        <strong className="font-medium text-slate-200">{location.name}</strong>{" "}
        on{" "}
        <strong className="font-medium text-slate-200">
          {formatIsoDate(date)}
        </strong>
        .
      </p>

      {status === "loading" ? (
        <div className="mt-3 flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.12em] text-slate-500">
          <Loader2 className="h-3 w-3 animate-spin text-cyan-300/70" />
          Querying FIRMS archive
        </div>
      ) : status === "error" ? (
        <div className="mt-3 rounded-lg border border-red-400/20 bg-red-500/[0.06] px-2.5 py-2">
          <p className="flex items-start gap-1.5 text-[9px] leading-relaxed text-red-200/80">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            {error ?? "Could not query the fire archive."}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-1.5 inline-flex items-center gap-1 font-mono text-[7px] uppercase tracking-[0.12em] text-red-200/80 transition hover:text-red-100"
          >
            <RotateCw className="h-2.5 w-2.5" />
            Retry
          </button>
        </div>
      ) : !summary || summary.count === 0 ? (
        <div className="mt-3">
          <p className="text-[9px] leading-relaxed text-slate-500">
            No detections recorded for this date.
          </p>
          {suggestion ? (
            <button
              type="button"
              onClick={() => onSelectDate?.(suggestion.day)}
              className="mt-2 inline-flex items-center gap-1 rounded-md border border-amber-400/25 bg-amber-400/10 px-2 py-1 font-mono text-[7px] uppercase tracking-[0.12em] text-amber-200/90 transition hover:border-amber-300/40 hover:text-amber-100"
            >
              View month peak: {formatIsoDate(suggestion.day)} ·{" "}
              {formatNumber(suggestion.cells)} cells
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {[
              {
                label: "H3 cells with fire",
                value: formatNumber(summary.count),
              },
              {
                label: "MODIS detections",
                value: formatNumber(summary.modis),
              },
              {
                label: "VIIRS detections",
                value: formatNumber(summary.viirs),
              },
              {
                label: "Max FRP",
                value: `${formatNumber(summary.frpMax)} MW`,
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg border border-white/5 bg-slate-950/35 px-2 py-1.5"
              >
                <p className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-slate-500">
                  {stat.label}
                </p>
                <p className="mt-0.5 text-[11px] font-medium tabular-nums text-slate-200">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-2 font-mono text-[7.5px] uppercase tracking-[0.12em] text-slate-600">
            {summary.agreements > 0
              ? `${formatNumber(summary.agreements)} cells confirmed by both sensors`
              : "No dual MODIS + VIIRS match"}
          </p>
        </>
      )}
    </div>
  );
}
