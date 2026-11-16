"use client";

import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { cn, formatIsoDate } from "@/lib/utils";

interface DatePickerProps {
  id: string;
  value: string;
  today: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
}

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;

const DAY_LABEL = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function parseIsoDate(isoDate: string) {
  const [year = 2026, month = 1, day = 1] = isoDate.split("-").map(Number);
  return { year, month: month - 1, day };
}

function isoFromParts(year: number, month: number, day: number) {
  return `${year.toString().padStart(4, "0")}-${(month + 1)
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function monthBounds(min: string, max: string) {
  return {
    minYear: Number(min.slice(0, 4)),
    minMonth: Number(min.slice(5, 7)) - 1,
    maxYear: Number(max.slice(0, 4)),
    maxMonth: Number(max.slice(5, 7)) - 1,
  };
}

export default function DatePicker({
  id,
  value,
  today,
  onChange,
  min = "2006-01-01",
  max = "2032-12-31",
}: DatePickerProps) {
  const popoverId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = parseIsoDate(value);
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(selected.year);
  const [viewMonth, setViewMonth] = useState(selected.month);

  const { minYear, minMonth, maxYear, maxMonth } = monthBounds(min, max);

  const years = useMemo(() => {
    const list: number[] = [];
    for (let year = minYear; year <= maxYear; year += 1) list.push(year);
    return list;
  }, [minYear, maxYear]);

  const dayCells = useMemo(() => {
    const daysInMonth = new Date(
      Date.UTC(viewYear, viewMonth + 1, 0),
    ).getUTCDate();
    const firstWeekday =
      (new Date(Date.UTC(viewYear, viewMonth, 1)).getUTCDay() + 6) % 7;
    const cells: Array<{ key: string; day: number | null }> = [];

    for (let index = 0; index < firstWeekday; index += 1) {
      cells.push({
        key: `blank-${viewYear}-${viewMonth}-${index}`,
        day: null,
      });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({ key: `day-${day}`, day });
    }

    return cells;
  }, [viewYear, viewMonth]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const canGoPrevious =
    viewYear > minYear || (viewYear === minYear && viewMonth > minMonth);
  const canGoNext =
    viewYear < maxYear || (viewYear === maxYear && viewMonth < maxMonth);

  const changeMonth = (delta: number) => {
    const next = new Date(Date.UTC(viewYear, viewMonth + delta, 1));
    const nextYear = next.getUTCFullYear();
    const nextMonth = next.getUTCMonth();

    if (
      nextYear < minYear ||
      nextYear > maxYear ||
      (nextYear === minYear && nextMonth < minMonth) ||
      (nextYear === maxYear && nextMonth > maxMonth)
    ) {
      return;
    }

    setViewYear(nextYear);
    setViewMonth(nextMonth);
  };

  const selectDay = (day: number) => {
    const isoDate = isoFromParts(viewYear, viewMonth, day);
    if (isoDate < min || isoDate > max) return;

    onChange(isoDate);
    setOpen(false);
  };

  const togglePicker = () => {
    if (!open) {
      const next = parseIsoDate(value);
      const nextYear = Math.min(Math.max(next.year, minYear), maxYear);
      let nextMonth = next.month;

      if (nextYear === minYear) nextMonth = Math.max(nextMonth, minMonth);
      if (nextYear === maxYear) nextMonth = Math.min(nextMonth, maxMonth);

      setViewYear(nextYear);
      setViewMonth(nextMonth);
    }

    setOpen((current) => !current);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-cyan-300/60" />
          <input
            id={id}
            type="date"
            value={value}
            min={min}
            max={max}
            onChange={(event) => {
              if (!event.target.value) return;
              onChange(event.target.value);
              setOpen(false);
            }}
            className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] pl-9 pr-2 font-mono text-[11px] tabular-nums text-slate-100 outline-none transition [color-scheme:dark] focus:border-cyan-400/45 focus:bg-white/[0.055] focus:ring-2 focus:ring-cyan-400/10"
          />
        </div>

        <button
          ref={triggerRef}
          type="button"
          onClick={togglePicker}
          aria-label="Abrir calendario"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? popoverId : undefined}
          title="Abrir calendario"
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-xl border transition",
            open
              ? "border-cyan-400/45 bg-cyan-400/10 text-cyan-200"
              : "border-white/10 bg-white/[0.035] text-cyan-300/70 hover:border-cyan-400/30 hover:bg-cyan-400/[0.07] hover:text-cyan-200",
          )}
        >
          <CalendarRange className="h-4 w-4" />
        </button>
      </div>

      {open ? (
        <div
          id={popoverId}
          role="dialog"
          aria-label="Seleccionar fecha de análisis"
          className="absolute left-0 top-full z-50 mt-2 w-full animate-fade-in overflow-hidden rounded-xl border border-white/10 bg-slate-950/95 p-3 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9)] backdrop-blur-xl"
        >
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              disabled={!canGoPrevious}
              aria-label="Mes anterior"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-white/10 bg-white/[0.02] text-slate-400 transition hover:border-white/20 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>

            <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5">
              <select
                value={viewMonth}
                onChange={(event) => setViewMonth(Number(event.target.value))}
                aria-label="Mes"
                className="h-7 max-w-[112px] rounded-md border border-white/10 bg-white/[0.03] px-1.5 font-mono text-[9px] uppercase tracking-[0.06em] text-slate-200 outline-none transition focus:border-cyan-400/40 [&>option]:bg-slate-950"
              >
                {MONTHS.map((month, index) => (
                  <option
                    key={month}
                    value={index}
                    disabled={
                      (viewYear === minYear && index < minMonth) ||
                      (viewYear === maxYear && index > maxMonth)
                    }
                  >
                    {month}
                  </option>
                ))}
              </select>

              <select
                value={viewYear}
                onChange={(event) => {
                  const nextYear = Number(event.target.value);
                  setViewYear(nextYear);
                  setViewMonth((current) =>
                    Math.min(
                      Math.max(current, nextYear === minYear ? minMonth : 0),
                      nextYear === maxYear ? maxMonth : 11,
                    ),
                  );
                }}
                aria-label="Año"
                className="h-7 w-[60px] rounded-md border border-white/10 bg-white/[0.03] px-1 font-mono text-[9px] tabular-nums text-slate-200 outline-none transition focus:border-cyan-400/40 [&>option]:bg-slate-950"
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => changeMonth(1)}
              disabled={!canGoNext}
              aria-label="Mes siguiente"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-white/10 bg-white/[0.02] text-slate-400 transition hover:border-white/20 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-2.5 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((weekday) => (
              <span
                key={weekday}
                className="py-1 text-center font-mono text-[7px] uppercase tracking-[0.08em] text-slate-600"
              >
                {weekday}
              </span>
            ))}

            {dayCells.map(({ key, day }) => {
              if (day === null) {
                return <span key={key} aria-hidden="true" />;
              }

              const isoDate = isoFromParts(viewYear, viewMonth, day);
              const disabled = isoDate < min || isoDate > max;
              const isSelected = isoDate === value;
              const isToday = isoDate === today;
              const dayOfWeek = new Date(
                Date.UTC(viewYear, viewMonth, day),
              ).getUTCDay();
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDay(day)}
                  disabled={disabled}
                  aria-label={DAY_LABEL.format(
                    new Date(Date.UTC(viewYear, viewMonth, day)),
                  )}
                  aria-pressed={isSelected}
                  className={cn(
                    "grid h-8 place-items-center rounded-md border border-transparent font-mono text-[9px] tabular-nums transition",
                    isSelected
                      ? "border-cyan-400/45 bg-cyan-400/15 text-cyan-100 shadow-[0_0_10px_-2px_rgba(34,211,238,0.5)]"
                      : isToday
                        ? "border-cyan-400/25 text-cyan-200"
                        : isWeekend
                          ? "text-slate-400 hover:border-white/10 hover:bg-white/[0.06] hover:text-slate-100"
                          : "text-slate-300 hover:border-white/10 hover:bg-white/[0.06] hover:text-slate-100",
                    "disabled:pointer-events-none disabled:opacity-25",
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/5 pt-2">
            <button
              type="button"
              onClick={() => {
                onChange(today);
                setOpen(false);
              }}
              disabled={today < min || today > max}
              className="rounded-md border border-cyan-400/20 bg-cyan-400/[0.06] px-2 py-1 font-mono text-[7px] uppercase tracking-[0.1em] text-cyan-200/80 transition hover:border-cyan-400/40 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Hoy
            </button>

            <span className="min-w-0 truncate font-mono text-[8px] tabular-nums text-slate-500">
              {formatIsoDate(value)}
            </span>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md px-1.5 py-1 font-mono text-[7px] uppercase tracking-[0.1em] text-slate-500 transition hover:text-slate-200"
            >
              Cerrar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
