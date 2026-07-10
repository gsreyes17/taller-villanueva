"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Plus, Pencil, FileText, Trash2, HandCoins, X, Images } from "lucide-react";
import { ArchivosModal, type ArchivoDTO } from "./archivos-modal";
import {
  crearObra,
  actualizarObra,
  actualizarAvance,
  eliminarObra,
  guardarPresupuesto,
  registrarPago,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Textarea, Select } from "@/components/ui/field";
import { EstadoBadge } from "@/components/ui/badge";
import { formatCurrency, formatDate, toDateInput } from "@/lib/utils";
import type { ActionResult } from "@/lib/validations";

export type ObraDTO = {
  idObra: number;
  idCliente: number;
  clienteNombre: string;
  nombreObra: string;
  descripcion: string | null;
  tipoObra: string | null;
  ubicacion: string | null;
  fechaInicio: string;
  fechaEntregaEstimada: string;
  porcentajeAvance: number;
  estadoObra: string; // identificador Prisma: Presupuestando|EnEjecucion|Finalizado|Cancelado
  montoTotal: number | null;
  totalAbonado: number;
  saldoPendiente: number;
  presupuesto: {
    costoManoObra: number;
    margenGananciaPorcentaje: number;
    detalles: { idMaterial: number; cantidadRequerida: number; precioUnitarioMomento: number }[];
  } | null;
  archivos: ArchivoDTO[];
};

export type ClienteOpt = { idCliente: number; nombreRazonSocial: string };
export type MaterialOpt = {
  idMaterial: number;
  codigoMaterial: string;
  nombre: string;
  cupp: number;
  unidadMedida: string;
};

export function estadoLabel(estado: string): string {
  return estado === "EnEjecucion" ? "En Ejecución" : estado;
}

export function ObrasManager({
  obras,
  clientes,
  materiales,
}: {
  obras: ObraDTO[];
  clientes: ClienteOpt[];
  materiales: MaterialOpt[];
}) {
  const router = useRouter();
  const [obraModal, setObraModal] = useState<{ open: boolean; editing: ObraDTO | null }>({ open: false, editing: null });
  const [avanceModal, setAvanceModal] = useState<ObraDTO | null>(null);
  const [presModal, setPresModal] = useState<ObraDTO | null>(null);
  const [pagoModal, setPagoModal] = useState<ObraDTO | null>(null);
  const [archivosId, setArchivosId] = useState<number | null>(null);

  // Se deriva de la lista fresca para que refleje archivos recién subidos.
  const archivosObra = obras.find((o) => o.idObra === archivosId) ?? null;

  const refresh = () => router.refresh();

  async function borrar(o: ObraDTO) {
    if (!confirm(`¿Eliminar la obra "${o.nombreObra}"?`)) return;
    const res = await eliminarObra(o.idObra);
    if (!res.ok) alert(res.error);
    else refresh();
  }

  return (
    <>
      <div className="mb-6 flex justify-end">
        <Button onClick={() => setObraModal({ open: true, editing: null })}>
          <Plus size={18} /> Nueva Obra
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
        {obras.length === 0 && (
          <Card className="col-span-full p-12 text-center text-muted">
            No hay obras registradas todavía.
          </Card>
        )}
        {obras.map((o) => (
          <Card key={o.idObra} className="flex flex-col p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate font-semibold text-ink">{o.nombreObra}</h3>
                <p className="truncate text-sm text-muted">{o.clienteNombre}</p>
              </div>
              <EstadoBadge estado={estadoLabel(o.estadoObra)} />
            </div>

            <div className="mt-4">
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-muted">Progreso</span>
                <span className="font-semibold text-ink">{o.porcentajeAvance}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-navy" style={{ width: `${o.porcentajeAvance}%` }} />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted">Valor Total</p>
                <p className="font-semibold text-ink">
                  {o.montoTotal != null ? formatCurrency(o.montoTotal, { decimals: 0 }) : "—"}
                </p>
              </div>
              <div>
                <p className="text-muted">Saldo Pendiente</p>
                <p className="font-semibold text-ink">
                  {o.montoTotal != null ? formatCurrency(o.saldoPendiente, { decimals: 0 }) : "—"}
                </p>
              </div>
              <div>
                <p className="text-muted">Fecha Inicio</p>
                <p className="font-medium text-ink">{formatDate(o.fechaInicio)}</p>
              </div>
              <div>
                <p className="text-muted">Entrega Est.</p>
                <p className="font-medium text-ink">{formatDate(o.fechaEntregaEstimada)}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              <Button variant="secondary" size="sm" onClick={() => setPresModal(o)}>
                <FileText size={15} /> {o.presupuesto ? "Editar Presup." : "Crear Presupuesto"}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setAvanceModal(o)}>
                Editar Progreso
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setPagoModal(o)}>
                <HandCoins size={15} /> Pago
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setArchivosId(o.idObra)}>
                <Images size={15} /> Bocetos{o.archivos.length ? ` (${o.archivos.length})` : ""}
              </Button>
              <button
                title="Editar obra"
                onClick={() => setObraModal({ open: true, editing: o })}
                className="ml-auto rounded-md p-2 text-slate-500 hover:bg-slate-100"
              >
                <Pencil size={15} />
              </button>
              <button
                title="Eliminar"
                onClick={() => borrar(o)}
                className="rounded-md p-2 text-red-500 hover:bg-red-50"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </Card>
        ))}
      </div>

      <ObraModal
        key={obraModal.editing?.idObra ?? "new-obra"}
        open={obraModal.open}
        obra={obraModal.editing}
        clientes={clientes}
        onClose={() => setObraModal({ open: false, editing: null })}
        onSaved={() => {
          setObraModal({ open: false, editing: null });
          refresh();
        }}
      />
      {avanceModal && (
        <AvanceModal obra={avanceModal} onClose={() => setAvanceModal(null)} onSaved={() => { setAvanceModal(null); refresh(); }} />
      )}
      {presModal && (
        <PresupuestoModal obra={presModal} materiales={materiales} onClose={() => setPresModal(null)} onSaved={() => { setPresModal(null); refresh(); }} />
      )}
      {pagoModal && (
        <PagoModal obra={pagoModal} onClose={() => setPagoModal(null)} onSaved={() => { setPagoModal(null); refresh(); }} />
      )}
      <ArchivosModal
        obra={
          archivosObra
            ? { idObra: archivosObra.idObra, nombreObra: archivosObra.nombreObra, archivos: archivosObra.archivos }
            : null
        }
        onClose={() => setArchivosId(null)}
      />
    </>
  );
}

const ESTADOS = ["Presupuestando", "EnEjecucion", "Finalizado", "Cancelado"] as const;

function ObraModal({
  open,
  obra,
  clientes,
  onClose,
  onSaved,
}: {
  open: boolean;
  obra: ObraDTO | null;
  clientes: ClienteOpt[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const action = obra ? actualizarObra : crearObra;
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null);
  useEffect(() => {
    if (state?.ok) onSaved();
  }, [state, onSaved]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={obra ? "Editar Obra" : "Nueva Obra — Información General"}
      description="Complete los datos generales del proyecto"
      size="lg"
    >
      <form action={formAction} className="space-y-4">
        {obra && <input type="hidden" name="idObra" value={obra.idObra} />}
        {state && !state.ok && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{state.error}</p>
        )}
        <Field label="Cliente" required error={fe(state, "idCliente")}>
          <Select name="idCliente" defaultValue={obra?.idCliente ?? ""}>
            <option value="">Seleccionar cliente</option>
            {clientes.map((c) => (
              <option key={c.idCliente} value={c.idCliente}>
                {c.nombreRazonSocial}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nombre del proyecto" required error={fe(state, "nombreObra")}>
          <Input name="nombreObra" defaultValue={obra?.nombreObra} placeholder="Ej: Nave Industrial - Proyecto Norte" />
        </Field>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Tipo de obra">
            <Input name="tipoObra" defaultValue={obra?.tipoObra ?? ""} placeholder="Ej: Nave Industrial" list="tipos-obra" />
          </Field>
          <Field label="Estado">
            <Select name="estadoObra" defaultValue={obra?.estadoObra ?? "Presupuestando"}>
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {estadoLabel(e)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Descripción detallada">
          <Textarea name="descripcion" defaultValue={obra?.descripcion ?? ""} placeholder="Descripción del proyecto..." />
        </Field>
        <Field label="Ubicación de la obra">
          <Input name="ubicacion" defaultValue={obra?.ubicacion ?? ""} placeholder="Dirección completa" />
        </Field>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Fecha de inicio" required error={fe(state, "fechaInicio")}>
            <Input name="fechaInicio" type="date" defaultValue={obra ? toDateInput(obra.fechaInicio) : ""} />
          </Field>
          <Field label="Fecha de entrega estimada" required error={fe(state, "fechaEntregaEstimada")}>
            <Input name="fechaEntregaEstimada" type="date" defaultValue={obra ? toDateInput(obra.fechaEntregaEstimada) : ""} />
          </Field>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200/70 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <SubmitBtn label={obra ? "Guardar Cambios" : "Guardar Obra"} />
        </div>
      </form>
    </Modal>
  );
}

function AvanceModal({ obra, onClose, onSaved }: { obra: ObraDTO; onClose: () => void; onSaved: () => void }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(actualizarAvance, null);
  const [avance, setAvance] = useState(obra.porcentajeAvance);
  useEffect(() => {
    if (state?.ok) onSaved();
  }, [state, onSaved]);

  return (
    <Modal open onClose={onClose} title="Editar Progreso" description={obra.nombreObra} size="sm">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="idObra" value={obra.idObra} />
        {state && !state.ok && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{state.error}</p>
        )}
        <Field label={`Porcentaje de avance: ${avance}%`}>
          <input
            type="range"
            name="porcentajeAvance"
            min={0}
            max={100}
            value={avance}
            onChange={(e) => setAvance(Number(e.target.value))}
            className="w-full accent-[var(--color-brand)]"
          />
        </Field>
        <Field label="Estado de la obra">
          <Select name="estadoObra" defaultValue={obra.estadoObra}>
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {estadoLabel(e)}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex justify-end gap-3 border-t border-slate-200/70 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <SubmitBtn label="Guardar Progreso" />
        </div>
      </form>
    </Modal>
  );
}

type Fila = { idMaterial: string; cantidad: string; precio: string };

function PresupuestoModal({
  obra,
  materiales,
  onClose,
  onSaved,
}: {
  obra: ObraDTO;
  materiales: MaterialOpt[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [filas, setFilas] = useState<Fila[]>(
    obra.presupuesto?.detalles.length
      ? obra.presupuesto.detalles.map((d) => ({
          idMaterial: String(d.idMaterial),
          cantidad: String(d.cantidadRequerida),
          precio: String(d.precioUnitarioMomento),
        }))
      : [{ idMaterial: "", cantidad: "", precio: "" }],
  );
  const [manoObra, setManoObra] = useState(String(obra.presupuesto?.costoManoObra ?? 0));
  const [margen, setMargen] = useState(String(obra.presupuesto?.margenGananciaPorcentaje ?? 0));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function setFila(i: number, patch: Partial<Fila>) {
    setFilas((f) => f.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }
  function addFila() {
    setFilas((f) => [...f, { idMaterial: "", cantidad: "", precio: "" }]);
  }
  function delFila(i: number) {
    setFilas((f) => f.filter((_, idx) => idx !== i));
  }

  const base = filas.reduce((s, f) => s + (Number(f.cantidad) || 0) * (Number(f.precio) || 0), 0);
  const mermas = Math.round(base * 0.06 * 100) / 100;
  const subtotal = base + mermas + (Number(manoObra) || 0);
  const total = Math.round(subtotal * (1 + (Number(margen) || 0) / 100) * 100) / 100;

  async function submit() {
    setError(null);
    const detalles = filas
      .filter((f) => f.idMaterial && Number(f.cantidad) > 0)
      .map((f) => ({
        idMaterial: Number(f.idMaterial),
        cantidadRequerida: Number(f.cantidad),
        precioUnitarioMomento: Number(f.precio) || 0,
      }));
    if (detalles.length === 0) {
      setError("Agregue al menos un material con cantidad.");
      return;
    }
    setSaving(true);
    const res = await guardarPresupuesto({
      idObra: obra.idObra,
      costoManoObra: Number(manoObra) || 0,
      margenGananciaPorcentaje: Number(margen) || 0,
      detalles,
    });
    setSaving(false);
    if (!res.ok) setError(res.error);
    else onSaved();
  }

  return (
    <Modal open onClose={onClose} title="Presupuesto de Obra" description={obra.nombreObra} size="xl">
      <div className="space-y-4">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}

        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_120px_130px_40px] gap-2 text-xs font-semibold uppercase text-muted">
            <span>Material</span>
            <span>Cantidad</span>
            <span>Precio Unit.</span>
            <span />
          </div>
          {filas.map((f, i) => {
            const usadosEnOtras = new Set(
              filas.filter((_, idx) => idx !== i).map((r) => r.idMaterial).filter(Boolean),
            );
            return (
            <div key={i} className="grid grid-cols-[1fr_120px_130px_40px] items-center gap-2">
              <Select
                value={f.idMaterial}
                onChange={(e) => {
                  const mat = materiales.find((m) => String(m.idMaterial) === e.target.value);
                  setFila(i, { idMaterial: e.target.value, precio: mat && !f.precio ? String(mat.cupp) : f.precio });
                }}
              >
                <option value="">Seleccionar material...</option>
                {materiales.map((m) => (
                  <option
                    key={m.idMaterial}
                    value={m.idMaterial}
                    disabled={usadosEnOtras.has(String(m.idMaterial))}
                  >
                    {m.codigoMaterial} — {m.nombre}
                    {usadosEnOtras.has(String(m.idMaterial)) ? " (ya agregado)" : ""}
                  </option>
                ))}
              </Select>
              <Input type="number" step="0.01" min="0" placeholder="0" value={f.cantidad} onChange={(e) => setFila(i, { cantidad: e.target.value })} />
              <Input type="number" step="0.01" min="0" placeholder="0.00" value={f.precio} onChange={(e) => setFila(i, { precio: e.target.value })} />
              <button onClick={() => delFila(i)} className="rounded-md p-2 text-red-500 hover:bg-red-50" title="Quitar">
                <X size={16} />
              </button>
            </div>
            );
          })}
          <Button variant="ghost" size="sm" onClick={addFila}>
            <Plus size={15} /> Agregar material
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 border-t border-slate-200/70 pt-4 md:grid-cols-2">
          <Field label="Costo de mano de obra (S/)">
            <Input type="number" step="0.01" min="0" value={manoObra} onChange={(e) => setManoObra(e.target.value)} />
          </Field>
          <Field label="Margen de ganancia (%)">
            <Input type="number" step="0.01" min="0" value={margen} onChange={(e) => setMargen(e.target.value)} />
          </Field>
        </div>

        <div className="rounded-xl bg-cream px-4 py-3 text-sm">
          <Row label="Costo de materiales (base)" value={formatCurrency(base)} />
          <Row label="Mermas (6% automático)" value={formatCurrency(mermas)} />
          <Row label="Mano de obra" value={formatCurrency(Number(manoObra) || 0)} />
          <Row label={`Margen (${margen || 0}%)`} value={formatCurrency(total - subtotal)} />
          <div className="mt-2 flex justify-between border-t border-slate-300/60 pt-2 text-base font-bold text-ink">
            <span>Monto Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200/70 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Guardando..." : "Guardar Presupuesto"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function PagoModal({ obra, onClose, onSaved }: { obra: ObraDTO; onClose: () => void; onSaved: () => void }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(registrarPago, null);
  useEffect(() => {
    if (state?.ok) onSaved();
  }, [state, onSaved]);

  return (
    <Modal open onClose={onClose} title="Registrar Pago" description={obra.nombreObra} size="sm">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="idObra" value={obra.idObra} />
        {state && !state.ok && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{state.error}</p>
        )}
        {obra.montoTotal != null && (
          <p className="rounded-lg bg-cream px-3 py-2 text-sm text-muted">
            Saldo pendiente: <strong className="text-ink">{formatCurrency(obra.saldoPendiente)}</strong>
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Monto abonado (S/)" required error={fe(state, "montoAbonado")}>
            <Input name="montoAbonado" type="number" step="0.01" min="0.01" placeholder="0.00" />
          </Field>
          <Field label="Fecha de pago" required error={fe(state, "fechaPago")}>
            <Input name="fechaPago" type="date" defaultValue={toDateInput(new Date())} />
          </Field>
        </div>
        <Field label="Tipo de pago" required>
          <Select name="tipoPago" defaultValue="Transferencia">
            <option>Efectivo</option>
            <option>Transferencia</option>
            <option>Cheque</option>
            <option>Tarjeta</option>
            <option>Otro</option>
          </Select>
        </Field>
        <Field label="Observaciones">
          <Input name="observaciones" placeholder="Opcional" />
        </Field>
        <div className="flex justify-end gap-3 border-t border-slate-200/70 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <SubmitBtn label="Registrar Pago" />
        </div>
      </form>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5 text-muted">
      <span>{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}

function SubmitBtn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Guardando..." : label}
    </Button>
  );
}

function fe(state: ActionResult | null, field: string): string | undefined {
  if (state && !state.ok && state.fieldErrors) return state.fieldErrors[field]?.[0];
  return undefined;
}
