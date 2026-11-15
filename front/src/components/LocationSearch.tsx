"use client";

import { ChevronDown, MapPin, Search, X } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useId, useMemo, useState } from "react";

import type { Location } from "@/lib/types";
import { cn } from "@/lib/utils";

interface LocationSearchProps {
  value: Location;
  locations: readonly Location[];
  onChange: (location: Location) => void;
}

export default function LocationSearch({
  value,
  locations,
  onChange,
}: LocationSearchProps) {
  const listboxId = useId();
  const [query, setQuery] = useState(value.name);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const normalizedQuery = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!normalizedQuery) return locations;
    return locations.filter((location) =>
      `${location.name} ${location.province} ${location.biome}`
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [locations, normalizedQuery]);

  const selectLocation = (location: Location) => {
    onChange(location);
    setQuery(location.name);
    setOpen(false);
    setActiveIndex(0);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      if (open && filtered[activeIndex]) {
        event.preventDefault();
        selectLocation(filtered[activeIndex]);
      }
      return;
    }

    if (event.key === "Escape") {
      setOpen(false);
      setQuery(value.name);
      setActiveIndex(0);
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-cyan-300/60" />
        <input
          type="text"
          value={query}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && filtered[activeIndex]
              ? `${listboxId}-${filtered[activeIndex].id}`
              : undefined
          }
          placeholder="Buscar ciudad o región…"
          autoComplete="off"
          spellCheck={false}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] pl-9 pr-16 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/45 focus:bg-white/[0.055] focus:ring-2 focus:ring-cyan-400/10"
        />

        <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {query && query !== value.name ? (
            <button
              type="button"
              aria-label="Limpiar búsqueda"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setQuery("");
                setOpen(true);
              }}
              className="grid h-6 w-6 place-items-center rounded-md text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-slate-600 transition-transform",
              open && "rotate-180",
            )}
          />
        </div>
      </div>

      {open ? (
        <div className="absolute z-40 mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/95 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
            <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-slate-500">
              Sectores monitoreados
            </span>
            <span className="font-mono text-[8px] text-cyan-400/60">
              {filtered.length.toString().padStart(2, "0")}
            </span>
          </div>

          <div
            id={listboxId}
            role="listbox"
            aria-label="Regiones disponibles"
            className="scrollbar-slim max-h-64 overflow-y-auto p-1.5"
          >
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-xs leading-relaxed text-slate-500">
                Sin coincidencias en la base regional. Probá con Córdoba, Salta
                o Jujuy.
              </p>
            ) : (
              filtered.map((location, index) => {
                const active = location.id === value.id;
                return (
                  <button
                    key={location.id}
                    id={`${listboxId}-${location.id}`}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectLocation(location)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition",
                      index === activeIndex
                        ? "bg-cyan-400/10"
                        : "hover:bg-white/5",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-7 w-7 shrink-0 place-items-center rounded-lg border",
                        active
                          ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-300"
                          : "border-white/10 bg-white/[0.03] text-slate-500",
                      )}
                    >
                      <MapPin className="h-3.5 w-3.5" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-medium text-slate-200">
                          {location.name}
                        </span>
                        {active ? (
                          <span className="h-1 w-1 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_6px_2px_rgba(34,211,238,0.5)]" />
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-[8px] uppercase tracking-[0.12em] text-slate-500">
                        {location.province} · {location.biome}
                      </span>
                    </span>

                    <span className="shrink-0 font-mono text-[8px] tabular-nums text-slate-600">
                      {location.lat.toFixed(1)}, {location.lon.toFixed(1)}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
