"use client";

import { Database, Info, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const DISMISS_KEY = "ignisguard-data-notice-dismissed";

export default function DataNotice() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!window.sessionStorage.getItem(DISMISS_KEY)) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  const close = useCallback(() => {
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // sessionStorage unavailable: just close for this render
    }
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, close]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="data-notice-title"
      className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm"
    >
      <button
        type="button"
        aria-label="Dismiss notice"
        onClick={close}
        className="absolute inset-0 cursor-default"
      />

      <div className="relative w-full max-w-sm animate-fade-in overflow-hidden rounded-2xl border border-cyan-400/20 bg-slate-950/95 shadow-[0_30px_100px_-20px_rgba(0,0,0,0.95)] backdrop-blur-xl">
        <span className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />

        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-slate-400 transition hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-cyan-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="p-5">
          <div className="flex items-center gap-2.5">
            <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-cyan-400/25 bg-cyan-400/10">
              <Database className="h-4.5 w-4.5 text-cyan-300" />
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-orange-400 shadow-[0_0_8px_2px_rgba(251,146,60,0.6)]" />
            </div>
            <div>
              <h2
                id="data-notice-title"
                className="text-sm font-semibold tracking-[0.18em] text-white"
              >
                DATA NOTICE
              </h2>
              <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-slate-500">
                Data availability
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.05] px-3 py-2.5">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300/80" />
            <p className="text-[11px] leading-relaxed text-slate-300">
              Only records from{" "}
              <strong className="font-semibold text-white">2025</strong> are
              currently loaded for{" "}
              <strong className="font-semibold text-white">Jujuy</strong>, due
              to limitations of the free database plan.
            </p>
          </div>

          <p className="mt-3 text-[10px] leading-relaxed text-slate-500">
            Historical data for other periods and regions will be available as
            the database plan is upgraded.
          </p>

          <button
            type="button"
            onClick={close}
            className="mt-4 w-full rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200 transition hover:border-cyan-400/50 hover:bg-cyan-400/15 hover:text-cyan-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
