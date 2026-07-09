import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { Prisma } from "../../prisma/generated/prisma/client";

/** Combina clases de Tailwind resolviendo conflictos. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Decimalish = Prisma.Decimal | number | string | null | undefined;

/** Convierte un Decimal de Prisma (o número) a number seguro. */
export function toNumber(value: Decimalish): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  return Number(value.toString());
}

/** Formatea moneda en soles peruanos: S/ 1,234.50 */
export function formatCurrency(value: Decimalish, opts?: { decimals?: number }): string {
  const n = toNumber(value);
  return `S/ ${n.toLocaleString("es-PE", {
    minimumFractionDigits: opts?.decimals ?? 2,
    maximumFractionDigits: opts?.decimals ?? 2,
  })}`;
}

/** Formatea un número con separadores de miles. */
export function formatNumber(value: Decimalish, decimals = 0): string {
  return toNumber(value).toLocaleString("es-PE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: 2,
  });
}

/** Fecha corta: 09/07/2026 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "dd/MM/yyyy", { locale: es });
}

/** Fecha ISO para inputs date: 2026-07-09 */
export function toDateInput(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "yyyy-MM-dd");
}

/** Fecha con hora: 09/07/2026 14:30 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "dd/MM/yyyy HH:mm", { locale: es });
}

/** Saludo según la hora del día. */
export function saludoHora(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

/** Iniciales para el avatar (LV). */
export function initials(nombre: string, apellido?: string): string {
  const a = nombre?.trim()?.[0] ?? "";
  const b = apellido?.trim()?.[0] ?? "";
  return (a + b).toUpperCase() || "?";
}

/** Etiqueta de rol para la UI: Trabajador -> "Empleado". */
export function rolLabel(rol: string): string {
  return rol === "Trabajador" ? "Empleado" : rol;
}
