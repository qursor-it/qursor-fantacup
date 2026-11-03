"use client";

import { useState, useEffect, useRef } from "react";

const FIRST_HALF_MS = 25 * 60 * 1000;
const INTERVAL_MS = 5 * 60 * 1000;
const SECOND_HALF_MS = 25 * 60 * 1000;

type ClockState =
  | { phase: "first"; minute: number }
  | { phase: "interval" }
  | { phase: "second"; minute: number }
  | { phase: "ended" };

function computeClock(elapsedMs: number): ClockState {
  if (elapsedMs < 0) return { phase: "ended" };

  if (elapsedMs <= FIRST_HALF_MS) {
    return { phase: "first", minute: Math.max(1, Math.ceil(elapsedMs / 60_000)) };
  }
  if (elapsedMs <= FIRST_HALF_MS + INTERVAL_MS) {
    return { phase: "interval" };
  }
  const secondElapsed = elapsedMs - FIRST_HALF_MS - INTERVAL_MS;
  if (secondElapsed <= SECOND_HALF_MS) {
    return { phase: "second", minute: Math.min(50, 25 + Math.max(1, Math.ceil(secondElapsed / 60_000))) };
  }
  return { phase: "ended" };
}

// elapsedMsAtLoad: computed server-side as (matchClockNow - startsAt) in ms
export default function LiveMatchClock({ elapsedMsAtLoad }: { elapsedMsAtLoad: number }) {
  const mountTimeRef = useRef<number>(0);
  const [clock, setClock] = useState<ClockState>(() => computeClock(elapsedMsAtLoad));

  useEffect(() => {
    mountTimeRef.current = Date.now();

    const id = setInterval(() => {
      const sinceMount = Date.now() - mountTimeRef.current;
      setClock(computeClock(elapsedMsAtLoad + sinceMount));
    }, 30_000);

    return () => clearInterval(id);
  }, [elapsedMsAtLoad]);

  if (clock.phase === "ended") {
    return <i className="pi pi-clock" style={{ fontSize: 16, color: "rgba(255,255,255,0.4)" }} />;
  }

  if (clock.phase === "interval") {
    return (
      <span className="text-xs font-extrabold uppercase tabular-nums" style={{ color: "#fbbf24" }}>
        HT
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <i className="pi pi-clock" style={{ fontSize: 14, color: "rgba(255,255,255,0.4)" }} />
      <span className="text-xs font-extrabold tabular-nums" style={{ color: "rgba(255,255,255,0.85)" }}>
        {clock.minute}&apos;
      </span>
    </div>
  );
}
