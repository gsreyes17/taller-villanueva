"use client";

import { useEffect, useState } from "react";
import { Clock as ClockIcon } from "lucide-react";

export function Header() {
  return (
    <header className="app-drag flex items-center justify-between border-b border-slate-200/70 bg-cream-soft/80 px-6 py-3 backdrop-blur">
      <p className="text-lg font-semibold text-ink">Sistema de Gestión de Obras y Proyectos</p>
      <div className="app-no-drag">
        <Clock />
      </div>
    </header>
  );
}

function Clock() {
  const [time, setTime] = useState<string>("");
  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString("es-PE", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
      );
    tick();
    const id = setInterval(tick, 1000 * 30);
    return () => clearInterval(id);
  }, []);
  if (!time) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-muted">
      <ClockIcon size={14} className="text-brand" />
      {time}
    </span>
  );
}
