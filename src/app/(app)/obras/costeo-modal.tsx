"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Plus, Trash2, HardHat, Zap } from "lucide-react";
import {
  registrarManoObra,
  eliminarManoObra,
  registrarCostoIndirecto,
  eliminarCostoIndirecto,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency, formatDate, formatNumber, toDateInput } from "@/lib/utils";
import type { ActionResult } from "@/lib/validations";
import type { ObraDTO } from "./obras-manager";

const TIPOS_INDIRECTO = ["Energia", "Transporte", "Equipos", "Consumibles", "Subcontrato", "Otro"] as const;
const TIPO_LABEL: Record<string, string> = {
  Energia: "Energía",
  Transporte: "Transporte",
  Equipos: "Equipos",
  Consumibles: "Consumibles",
  Subcontrato: "Subcontrato",
  Otro: "Otro",
};

/**
 * Costeo real de la obra: materiales consumidos (kardex) + mano de obra +
 * costos indirectos, contrastados contra lo presupuestado.
 */
export function CosteoModal({ obra, onClose }: { obra: ObraDTO | null; onClose: () => void }) {
  const router = useRouter();
  const [tab, setTab] = useState<"resumen" | "mano" | "indirectos">("resumen");

  if (!obra) return null;

  const costoMano = obra.manoObra.reduce((s, h) => s + h.costo, 0);
  const costoIndirecto = obra.costosIndirectos.reduce((s, c) => s + c.monto, 0);
  const costoTotal = obra.costoMaterialesReal + costoMano + costoIndirecto;
  const presupuestado = obra.montoTotal ?? 0;
  const margen = presupuestado - costoTotal;
  const margenPct = presupuestado > 0 ? (margen / presupuestado) * 100 : 0;
  const horasTotales = obra.manoObra.reduce((s, h) => s + h.horas, 0);

  async function borrarMano(id: number) {
    if (!confirm("¿Eliminar este registro de horas?")) return;
    const r = await eliminarManoObra(id);
    if (!r.ok) alert(r.error);
    else router.refresh();
  }
  async function borrarIndirecto(id: number) {
    if (!confirm("¿Eliminar este costo?")) return;
    const r = await eliminarCostoIndirecto(id);
    if (!r.ok) alert(r.error);
    else router.refresh();
  }

  return (
    <Modal open onClose={onClose} title="Costeo real de la obra" description={obra.nombreObra} size="xl">
      {/* Pestañas */}
      <div className="mb-5 flex gap-1 border-b border-slate-200">
        {([
          ["resumen", "Resumen"],
          ["mano", `Mano de obra (${obra.manoObra.length})`],
          ["indirectos", `Costos indirectos (${obra.costosIndirectos.length})`],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              tab === k
                ? "border-brand text-brand"
                : "border-transparent text-muted hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "resumen" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="mb-3 text-sm font-semibold text-ink">Costo real incurrido</p>
            <Linea label="Materiales consumidos (kardex)" value={obra.costoMaterialesReal} />
            <Linea label={`Mano de obra (${formatNumber(horasTotales, 2)} h)`} value={costoMano} />
            <Linea label="Costos indirectos" value={costoIndirecto} />
            <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-ink">
              <span>Costo total real</span>
              <span>{formatCurrency(costoTotal)}</span>
            </div>
          </div>

          <div
            className={cn(
              "rounded-xl border p-4",
              margen >= 0 ? "border-emerald-200 bg-emerald-50/60" : "border-red-200 bg-red-50/60",
            )}
          >
            <div className="flex justify-between text-sm">
              <span className="text-muted">Presupuestado (con IGV)</span>
              <span className="font-medium text-ink">{formatCurrency(presupuestado)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Costo real</span>
              <span className="font-medium text-ink">− {formatCurrency(costoTotal)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-slate-300/50 pt-2">
              <span className="text-sm font-semibold text-ink">Margen real</span>
              <span
                className={cn(
                  "text-lg font-bold",
                  margen >= 0 ? "text-emerald-600" : "text-red-600",
                )}
              >
                {formatCurrency(margen)}{" "}
                <span className="text-sm font-medium">({formatNumber(margenPct, 1)}%)</span>
              </span>
            </div>
            {presupuestado === 0 && (
              <p className="mt-2 text-xs text-muted">
                Esta obra aún no tiene presupuesto: el margen no es representativo.
              </p>
            )}
          </div>
        </div>
      )}

      {tab === "mano" && (
        <div className="space-y-4">
          <ManoObraForm idObra={obra.idObra} onSaved={() => router.refresh()} />
          {obra.manoObra.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Aún no hay horas registradas.</p>
          ) : (
            <div className="space-y-2">
              {obra.manoObra.map((h) => (
                <div
                  key={h.idManoObra}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {h.descripcion || "Trabajo en obra"}
                    </p>
                    <p className="text-xs text-muted">
                      {formatDate(h.fecha)} · {formatNumber(h.horas, 2)} h × {formatCurrency(h.tarifaHora)}
                      {h.trabajador && ` · ${h.trabajador}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink">{formatCurrency(h.costo)}</span>
                    <button
                      onClick={() => borrarMano(h.idManoObra)}
                      className="rounded-md p-1.5 text-red-500 hover:bg-red-50"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "indirectos" && (
        <div className="space-y-4">
          <CostoIndirectoForm idObra={obra.idObra} onSaved={() => router.refresh()} />
          {obra.costosIndirectos.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Aún no hay costos indirectos.</p>
          ) : (
            <div className="space-y-2">
              {obra.costosIndirectos.map((c) => (
                <div
                  key={c.idCostoIndirecto}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge tone="gray">{TIPO_LABEL[c.tipo] ?? c.tipo}</Badge>
                      <p className="truncate text-sm text-ink">{c.descripcion || "—"}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">{formatDate(c.fecha)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink">{formatCurrency(c.monto)}</span>
                    <button
                      onClick={() => borrarIndirecto(c.idCostoIndirecto)}
                      className="rounded-md p-1.5 text-red-500 hover:bg-red-50"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function Linea({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between py-0.5 text-sm text-muted">
      <span>{label}</span>
      <span className="font-medium text-ink">{formatCurrency(value)}</span>
    </div>
  );
}

function ManoObraForm({ idObra, onSaved }: { idObra: number; onSaved: () => void }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(registrarManoObra, null);
  useEffect(() => {
    if (state?.ok) onSaved();
  }, [state, onSaved]);

  return (
    <form action={formAction} key={state?.ok ? Math.random() : "form"} className="rounded-xl bg-cream p-4">
      <input type="hidden" name="idObra" value={idObra} />
      <div className="mb-3 flex items-center gap-2">
        <HardHat size={16} className="text-brand" />
        <p className="text-sm font-semibold text-ink">Registrar horas trabajadas</p>
      </div>
      {state && !state.ok && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
          {state.error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Field label="Fecha" required>
          <Input name="fecha" type="date" defaultValue={toDateInput(new Date())} />
        </Field>
        <Field label="Horas" required>
          <Input name="horas" type="number" step="0.5" min="0.5" max="24" placeholder="8" />
        </Field>
        <Field label="Tarifa/hora (S/)" required>
          <Input name="tarifaHora" type="number" step="0.01" min="0" placeholder="18.00" />
        </Field>
        <Field label="Descripción">
          <Input name="descripcion" placeholder="Armado de estructura" />
        </Field>
      </div>
      <div className="mt-3 flex justify-end">
        <SubmitBtn label="Agregar horas" />
      </div>
    </form>
  );
}

function CostoIndirectoForm({ idObra, onSaved }: { idObra: number; onSaved: () => void }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    registrarCostoIndirecto,
    null,
  );
  useEffect(() => {
    if (state?.ok) onSaved();
  }, [state, onSaved]);

  return (
    <form action={formAction} key={state?.ok ? Math.random() : "form"} className="rounded-xl bg-cream p-4">
      <input type="hidden" name="idObra" value={idObra} />
      <div className="mb-3 flex items-center gap-2">
        <Zap size={16} className="text-brand" />
        <p className="text-sm font-semibold text-ink">Registrar costo indirecto</p>
      </div>
      {state && !state.ok && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
          {state.error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Field label="Tipo" required>
          <Select name="tipo" defaultValue="Energia">
            {TIPOS_INDIRECTO.map((t) => (
              <option key={t} value={t}>
                {TIPO_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Fecha" required>
          <Input name="fecha" type="date" defaultValue={toDateInput(new Date())} />
        </Field>
        <Field label="Monto (S/)" required>
          <Input name="monto" type="number" step="0.01" min="0.01" placeholder="0.00" />
        </Field>
        <Field label="Descripción">
          <Input name="descripcion" placeholder="Alquiler de grúa" />
        </Field>
      </div>
      <div className="mt-3 flex justify-end">
        <SubmitBtn label="Agregar costo" />
      </div>
    </form>
  );
}

function SubmitBtn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      <Plus size={15} />
      {pending ? "Guardando…" : label}
    </Button>
  );
}
