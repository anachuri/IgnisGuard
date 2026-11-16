"use client";

import {
  AlertTriangle,
  Crosshair,
  Flame,
  RotateCw,
  Sparkles,
} from "lucide-react";

import type { Location, Prediction } from "@/lib/types";
import { formatIsoDate } from "@/lib/utils";

interface PredictionCardProps {
  prediction: Prediction;
  date: string;
  location: Location;
  fallbackReason?: string | null;
  onRetry?: () => void;
}

export default function PredictionCard({
  prediction,
  date,
  location,
  fallbackReason,
  onRetry,
}: PredictionCardProps) {
  const tone =
    prediction.level === "Extremo"
      ? {
          border: "border-red-500/40",
          glow: "from-red-500/20 via-orange-500/10",
          text: "text-red-300",
          bar: "from-orange-400 via-red-500 to-red-600",
          badge: "border-red-400/30 bg-red-500/10 text-red-200",
        }
      : prediction.level === "Alto"
        ? {
            border: "border-orange-500/35",
            glow: "from-orange-500/18 via-amber-500/8",
            text: "text-orange-300",
            bar: "from-amber-400 via-orange-500 to-red-500",
            badge: "border-orange-400/30 bg-orange-500/10 text-orange-200",
          }
        : prediction.level === "Moderado"
          ? {
              border: "border-amber-400/30",
              glow: "from-amber-400/12 via-amber-500/5",
              text: "text-amber-300",
              bar: "from-lime-400 via-amber-400 to-orange-500",
              badge: "border-amber-400/30 bg-amber-400/10 text-amber-200",
            }
          : {
              border: "border-emerald-400/25",
              glow: "from-emerald-400/10 via-emerald-500/5",
              text: "text-emerald-300",
              bar: "from-emerald-400 via-lime-400 to-amber-400",
              badge: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
            };

  return (
    <div
      className={`relative overflow-hidden rounded-xl border ${tone.border} bg-gradient-to-br ${tone.glow} to-transparent p-4`}
    >
      <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-orange-500/10 blur-2xl" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.22em] text-slate-400">
            <Sparkles className="h-3 w-3 text-orange-300" />
            Predicción XGBoost
          </div>

          <div className="mt-2 flex items-end gap-2">
            <span className="text-4xl font-semibold tracking-tight tabular-nums text-white">
              {prediction.probability.toFixed(1)}
              <span className="ml-0.5 text-lg text-slate-400">%</span>
            </span>
            <span
              className={`mb-1.5 rounded-full border px-2 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-[0.14em] ${tone.badge}`}
            >
              {prediction.level}
            </span>
          </div>

          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-300">
            <AlertTriangle className="mr-1 inline h-3 w-3 -translate-y-px text-amber-400" />
            Probabilidad de incendio:{" "}
            <strong className="font-semibold text-white">
              {prediction.probability.toFixed(1)}%
            </strong>{" "}
            — Condición de {prediction.conditionLabel}.
          </p>
        </div>

        <div
          className="relative grid h-14 w-14 shrink-0 place-items-center rounded-full"
          style={{
            background: `conic-gradient(rgba(251, 146, 60, 0.95) ${prediction.probability * 3.6}deg, rgba(255, 255, 255, 0.08) 0deg)`,
          }}
        >
          <div className="grid h-[52px] w-[52px] place-items-center rounded-full bg-slate-950/95">
            <Flame className={`h-5 w-5 ${tone.text}`} />
          </div>
        </div>
      </div>

      <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${tone.bar}`}
          style={{ width: `${prediction.probability}%` }}
        />
      </div>

      <div className="relative mt-3 grid grid-cols-2 gap-1.5">
        {prediction.drivers.map((driver) => (
          <div
            key={driver.label}
            className="rounded-lg border border-white/5 bg-slate-950/35 px-2 py-1.5"
          >
            <p className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-slate-500">
              {driver.label}
            </p>
            <p className="mt-0.5 text-[11px] font-medium tabular-nums text-slate-200">
              {driver.value}
            </p>
          </div>
        ))}
      </div>

      <div className="relative mt-2.5 flex items-center justify-between gap-2 font-mono text-[8px] uppercase tracking-[0.12em] text-slate-500">
        <span className="flex items-center gap-1">
          <Crosshair className="h-2.5 w-2.5" />
          {location.name} · {formatIsoDate(date)}
        </span>
        <span className="text-cyan-400/60">Conf. {prediction.confidence}%</span>
      </div>

      <p className="relative mt-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-slate-600">
        {prediction.seasonLabel} ·{" "}
        {prediction.source
          ? `${prediction.source} · ${
              prediction.model === "heuristic-v0"
                ? "Modelo heurístico v0"
                : (prediction.model ?? "Modelo demostrativo")
            }`
          : "Modelo demostrativo v2.4"}
      </p>

      {fallbackReason ? (
        <div className="relative mt-2 flex items-center justify-between gap-2 rounded-md border border-amber-400/15 bg-amber-400/[0.04] px-2 py-1">
          <span className="truncate font-mono text-[7px] uppercase tracking-[0.1em] text-amber-200/65">
            {fallbackReason}
          </span>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex shrink-0 items-center gap-1 rounded border border-amber-300/25 px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-[0.1em] text-amber-100/80 transition hover:bg-amber-400/10"
            >
              <RotateCw className="h-2 w-2" />
              Reintentar
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
