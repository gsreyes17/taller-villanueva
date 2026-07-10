"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-[var(--radius-card)] border border-slate-200/70 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
          <AlertTriangle size={28} />
        </div>
        <h2 className="mt-4 text-lg font-bold text-ink">Ocurrió un problema</h2>
        <p className="mt-1 text-sm text-muted">
          No se pudo completar la operación. Puedes reintentar; si el problema persiste,
          revisa tu conexión a internet.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="secondary" onClick={() => reset()}>
            <RotateCcw size={16} /> Reintentar
          </Button>
          <Button onClick={() => (window.location.href = "/dashboard")}>Ir al inicio</Button>
        </div>
      </div>
    </div>
  );
}
