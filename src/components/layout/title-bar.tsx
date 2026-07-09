"use client";

import { useEffect, useState } from "react";
import { Minus, Square, Copy, X } from "lucide-react";

/**
 * Barra de título custom para Electron (frame: false).
 * Se auto-oculta si la app corre en el navegador (no hay window.electronAPI).
 */
export function TitleBar() {
  const [isElectron, setIsElectron] = useState(false);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.electronAPI?.isElectron) {
      setIsElectron(true);
      const off = window.electronAPI.onMaximizeChange?.(setMaximized);
      return off;
    }
  }, []);

  if (!isElectron) return null;

  return (
    <div className="app-drag flex h-9 shrink-0 items-center justify-between bg-sidebar pl-4 text-slate-300">
      <span className="text-xs font-semibold text-slate-400">Taller Villanueva</span>
      <div className="app-no-drag flex h-full">
        <button
          onClick={() => window.electronAPI?.minimize()}
          className="flex w-11 items-center justify-center hover:bg-sidebar-hover"
          aria-label="Minimizar"
        >
          <Minus size={15} />
        </button>
        <button
          onClick={() => window.electronAPI?.maximize()}
          className="flex w-11 items-center justify-center hover:bg-sidebar-hover"
          aria-label="Maximizar"
        >
          {maximized ? <Copy size={13} /> : <Square size={12} />}
        </button>
        <button
          onClick={() => window.electronAPI?.close()}
          className="flex w-11 items-center justify-center hover:bg-red-600 hover:text-white"
          aria-label="Cerrar"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
