"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";

export type OpcionFiltro = { id: number; label: string };

export type FiltrosProps = {
  /** Lista de clientes (se muestra si `mostrarCliente`). */
  clientes?: OpcionFiltro[];
  obras?: OpcionFiltro[];
  proveedores?: OpcionFiltro[];
  categorias?: OpcionFiltro[];
  zonas?: string[];
  mostrarCliente?: boolean;
  mostrarObra?: boolean;
  mostrarProveedor?: boolean;
  mostrarCategoria?: boolean;
  mostrarZona?: boolean;
  mostrarEstadoObra?: boolean;
  mostrarBajoStock?: boolean;
};

const ESTADOS_OBRA: { value: string; label: string }[] = [
  { value: "Presupuestando", label: "Presupuestando" },
  { value: "EnEjecucion", label: "En Ejecución" },
  { value: "Finalizado", label: "Finalizado" },
  { value: "Cancelado", label: "Cancelado" },
];

/** Convierte un Date a `yyyy-MM-dd` en hora local (sin desfase de zona). */
function toInput(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export function Filtros({
  clientes = [],
  obras = [],
  proveedores = [],
  categorias = [],
  zonas = [],
  mostrarCliente,
  mostrarObra,
  mostrarProveedor,
  mostrarCategoria,
  mostrarZona,
  mostrarEstadoObra,
  mostrarBajoStock,
}: FiltrosProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const valor = (key: string) => searchParams.get(key) ?? "";

  /** Aplica un conjunto de cambios sobre los params actuales. */
  function aplicar(cambios: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, val] of Object.entries(cambios)) {
      if (val === null || val === "") params.delete(key);
      else params.set(key, val);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  function preset(tipo: "mes" | "mesPasado" | "anio" | "todo") {
    if (tipo === "todo") {
      aplicar({ desde: null, hasta: null });
      return;
    }
    const hoy = new Date();
    let desde: Date;
    let hasta: Date;
    if (tipo === "mes") {
      desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      hasta = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    } else if (tipo === "mesPasado") {
      desde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      hasta = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
    } else {
      desde = new Date(hoy.getFullYear(), 0, 1);
      hasta = new Date(hoy.getFullYear(), 11, 31);
    }
    aplicar({ desde: toInput(desde), hasta: toInput(hasta) });
  }

  function limpiar() {
    router.replace(pathname);
  }

  const hayFiltros = searchParams.toString().length > 0;

  return (
    <Card className="mb-6 p-4 print:hidden">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Desde" className="w-40">
          <Input
            type="date"
            value={valor("desde")}
            onChange={(e) => aplicar({ desde: e.target.value || null })}
          />
        </Field>

        <Field label="Hasta" className="w-40">
          <Input
            type="date"
            value={valor("hasta")}
            onChange={(e) => aplicar({ hasta: e.target.value || null })}
          />
        </Field>

        <div className="flex flex-wrap gap-1.5 pb-1">
          <Button variant="secondary" size="sm" onClick={() => preset("mes")}>
            Este mes
          </Button>
          <Button variant="secondary" size="sm" onClick={() => preset("mesPasado")}>
            Mes pasado
          </Button>
          <Button variant="secondary" size="sm" onClick={() => preset("anio")}>
            Este año
          </Button>
          <Button variant="secondary" size="sm" onClick={() => preset("todo")}>
            Todo
          </Button>
        </div>

        {mostrarCliente && (
          <Field label="Cliente" className="w-56">
            <Select
              value={valor("idCliente")}
              onChange={(e) => aplicar({ idCliente: e.target.value || null })}
            >
              <option value="">Todos los clientes</option>
              {clientes.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {mostrarObra && (
          <Field label="Obra" className="w-56">
            <Select
              value={valor("idObra")}
              onChange={(e) => aplicar({ idObra: e.target.value || null })}
            >
              <option value="">Todas las obras</option>
              {obras.map((o) => (
                <option key={o.id} value={String(o.id)}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {mostrarProveedor && (
          <Field label="Proveedor" className="w-56">
            <Select
              value={valor("idProveedor")}
              onChange={(e) => aplicar({ idProveedor: e.target.value || null })}
            >
              <option value="">Todos los proveedores</option>
              {proveedores.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {mostrarCategoria && (
          <Field label="Categoría" className="w-52">
            <Select
              value={valor("idCategoria")}
              onChange={(e) => aplicar({ idCategoria: e.target.value || null })}
            >
              <option value="">Todas las categorías</option>
              {categorias.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {mostrarZona && (
          <Field label="Zona" className="w-44">
            <Select
              value={valor("zona")}
              onChange={(e) => aplicar({ zona: e.target.value || null })}
            >
              <option value="">Todas las zonas</option>
              {zonas.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {mostrarEstadoObra && (
          <Field label="Estado de obra" className="w-48">
            <Select
              value={valor("estadoObra")}
              onChange={(e) => aplicar({ estadoObra: e.target.value || null })}
            >
              <option value="">Todos los estados</option>
              {ESTADOS_OBRA.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {mostrarBajoStock && (
          <label className="flex cursor-pointer items-center gap-2 pb-2.5 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/30"
              checked={valor("bajoStock") === "1"}
              onChange={(e) => aplicar({ bajoStock: e.target.checked ? "1" : null })}
            />
            Solo bajo stock
          </label>
        )}

        {hayFiltros && (
          <div className="pb-1">
            <Button variant="ghost" size="sm" onClick={limpiar}>
              <X size={14} />
              Limpiar filtros
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
