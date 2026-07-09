import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "navy" | "gray" | "red" | "green" | "orange" | "amber";

const tones: Record<Tone, string> = {
  navy: "bg-navy text-white",
  gray: "bg-slate-200 text-slate-700",
  red: "bg-red-600 text-white",
  green: "bg-emerald-600 text-white",
  orange: "bg-brand text-white",
  amber: "bg-amber-100 text-amber-800",
};

export function Badge({
  tone = "gray",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

/** Badge para estados comunes del dominio. */
export function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, Tone> = {
    Activo: "navy",
    Inactivo: "red",
    Descontinuado: "gray",
    Administrador: "navy",
    Trabajador: "gray",
    Empleado: "gray",
    Presupuestando: "amber",
    "En Ejecución": "navy",
    Finalizado: "green",
    Cancelado: "red",
    Normal: "navy",
    "Bajo stock": "red",
  };
  return <Badge tone={map[estado] ?? "gray"}>{estado}</Badge>;
}
