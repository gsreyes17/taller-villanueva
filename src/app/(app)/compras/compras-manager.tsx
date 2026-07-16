"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, PackageCheck, X, FileText } from "lucide-react";
import { guardarCompra, recibirCompra, eliminarCompra } from "./actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { formatCurrency, formatDate, toDateInput } from "@/lib/utils";

export type DetalleCompraDTO = {
  idDetalleCompra: number;
  idMaterial: number;
  materialNombre: string;
  materialCodigo: string;
  unidadSimbolo: string;
  cantidad: number;
  costoUnitario: number;
  fleteProrrateado: number;
};

export type CompraDTO = {
  idCompra: number;
  idProveedor: number;
  proveedorNombre: string;
  numeroDocumento: string;
  fechaEmision: string;
  fechaRecepcion: string | null;
  estado: string; // "Borrador" | "Confirmada" | "Recibida" | "Anulada"
  subtotal: number;
  flete: number;
  igvPorcentaje: number;
  igvMonto: number;
  total: number;
  moneda: string;
  observaciones: string | null;
  detalles: DetalleCompraDTO[];
};

export type ProveedorOpt = { idProveedor: number; razonSocial: string; ruc: string };
export type MaterialOpt = {
  idMaterial: number;
  codigoMaterial: string;
  nombre: string;
  cupp: number;
  unidadSimbolo: string;
};

type Tone = "navy" | "gray" | "red" | "green" | "orange" | "amber";

const estadoTono: Record<string, Tone> = {
  Borrador: "gray",
  Confirmada: "amber",
  Recibida: "green",
  Anulada: "red",
};

export function ComprasManager({
  compras,
  proveedores,
  materiales,
}: {
  compras: CompraDTO[];
  proveedores: ProveedorOpt[];
  materiales: MaterialOpt[];
}) {
  const router = useRouter();
  const [modal, setModal] = useState<{ open: boolean; editing: CompraDTO | null }>({
    open: false,
    editing: null,
  });
  const [detalleModal, setDetalleModal] = useState<CompraDTO | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  async function recibir(c: CompraDTO) {
    const ok = confirm(
      `¿Recibir la compra ${c.numeroDocumento}?\n\n` +
        "Al recibir se actualizará el stock y el CUPP. Esta acción no se puede deshacer.",
    );
    if (!ok) return;
    setBusy(c.idCompra);
    const res = await recibirCompra(c.idCompra);
    setBusy(null);
    if (!res.ok) alert(res.error);
    else router.refresh();
  }

  async function borrar(c: CompraDTO) {
    if (!confirm(`¿Eliminar la compra ${c.numeroDocumento}?`)) return;
    setBusy(c.idCompra);
    const res = await eliminarCompra(c.idCompra);
    setBusy(null);
    if (!res.ok) alert(res.error);
    else router.refresh();
  }

  return (
    <>
      <div className="mb-6 flex justify-end">
        <Button onClick={() => setModal({ open: true, editing: null })}>
          <Plus size={18} /> Nueva Compra
        </Button>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <Thead>
            <tr>
              <Th>N° Documento</Th>
              <Th>Proveedor</Th>
              <Th>Fecha Emisión</Th>
              <Th className="text-center">Ítems</Th>
              <Th className="text-right">Subtotal</Th>
              <Th className="text-right">IGV</Th>
              <Th className="text-right">Total</Th>
              <Th>Estado</Th>
              <Th className="text-right">Acciones</Th>
            </tr>
          </Thead>
          <tbody>
            {compras.length === 0 && (
              <EmptyRow colSpan={9}>No hay compras registradas todavía.</EmptyRow>
            )}
            {compras.map((c) => {
              const recibida = c.estado === "Recibida";
              const anulada = c.estado === "Anulada";
              const editable = !recibida && !anulada;
              return (
                <Tr key={c.idCompra}>
                  <Td className="font-semibold">{c.numeroDocumento}</Td>
                  <Td>{c.proveedorNombre}</Td>
                  <Td>{formatDate(c.fechaEmision)}</Td>
                  <Td className="text-center">{c.detalles.length}</Td>
                  <Td className="text-right">{formatCurrency(c.subtotal)}</Td>
                  <Td className="text-right text-muted">{formatCurrency(c.igvMonto)}</Td>
                  <Td className="text-right font-bold">{formatCurrency(c.total)}</Td>
                  <Td>
                    <Badge tone={estadoTono[c.estado] ?? "gray"}>{c.estado}</Badge>
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        title="Ver detalle"
                        onClick={() => setDetalleModal(c)}
                        className="rounded-md p-2 text-slate-500 hover:bg-slate-100"
                      >
                        <FileText size={15} />
                      </button>
                      {editable && (
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={busy === c.idCompra}
                          onClick={() => recibir(c)}
                        >
                          <PackageCheck size={15} /> Recibir
                        </Button>
                      )}
                      {!recibida && (
                        <button
                          title="Editar compra"
                          onClick={() => setModal({ open: true, editing: c })}
                          className="rounded-md p-2 text-slate-500 hover:bg-slate-100"
                        >
                          <Pencil size={15} />
                        </button>
                      )}
                      {!recibida && (
                        <button
                          title="Eliminar compra"
                          onClick={() => borrar(c)}
                          className="rounded-md p-2 text-red-500 hover:bg-red-50"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      {modal.open && (
        <CompraModal
          key={modal.editing?.idCompra ?? "new-compra"}
          compra={modal.editing}
          proveedores={proveedores}
          materiales={materiales}
          onClose={() => setModal({ open: false, editing: null })}
          onSaved={() => {
            setModal({ open: false, editing: null });
            router.refresh();
          }}
        />
      )}

      {detalleModal && (
        <DetalleModal compra={detalleModal} onClose={() => setDetalleModal(null)} />
      )}
    </>
  );
}

type Fila = { idMaterial: string; cantidad: string; costo: string };

function CompraModal({
  compra,
  proveedores,
  materiales,
  onClose,
  onSaved,
}: {
  compra: CompraDTO | null;
  proveedores: ProveedorOpt[];
  materiales: MaterialOpt[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [idProveedor, setIdProveedor] = useState(compra ? String(compra.idProveedor) : "");
  const [numeroDocumento, setNumeroDocumento] = useState(compra?.numeroDocumento ?? "");
  const [fechaEmision, setFechaEmision] = useState(
    compra ? toDateInput(compra.fechaEmision) : toDateInput(new Date()),
  );
  const [flete, setFlete] = useState(String(compra?.flete ?? 0));
  const [igv, setIgv] = useState(String(compra?.igvPorcentaje ?? 18));
  const [observaciones, setObservaciones] = useState(compra?.observaciones ?? "");
  const [filas, setFilas] = useState<Fila[]>(
    compra?.detalles.length
      ? compra.detalles.map((d) => ({
          idMaterial: String(d.idMaterial),
          cantidad: String(d.cantidad),
          costo: String(d.costoUnitario),
        }))
      : [{ idMaterial: "", cantidad: "", costo: "" }],
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function setFila(i: number, patch: Partial<Fila>) {
    setFilas((f) => f.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }
  function addFila() {
    setFilas((f) => [...f, { idMaterial: "", cantidad: "", costo: "" }]);
  }
  function delFila(i: number) {
    setFilas((f) => f.filter((_, idx) => idx !== i));
  }

  // Totales en vivo — deben coincidir con lo que calcula el trigger de BD.
  const subtotal = filas.reduce(
    (s, f) => s + (Number(f.cantidad) || 0) * (Number(f.costo) || 0),
    0,
  );
  const fleteNum = Number(flete) || 0;
  const igvNum = Number(igv) || 0;
  const igvMonto = Math.round((subtotal + fleteNum) * (igvNum / 100) * 100) / 100;
  const total = Math.round((subtotal + fleteNum + igvMonto) * 100) / 100;

  async function submit() {
    setError(null);
    const detalles = filas
      .filter((f) => f.idMaterial && Number(f.cantidad) > 0)
      .map((f) => ({
        idMaterial: Number(f.idMaterial),
        cantidad: Number(f.cantidad),
        costoUnitario: Number(f.costo) || 0,
      }));
    if (detalles.length === 0) {
      setError("Agregue al menos un material con cantidad.");
      return;
    }
    if (!idProveedor) {
      setError("Seleccione un proveedor.");
      return;
    }
    if (!numeroDocumento.trim()) {
      setError("Ingrese el N° de documento.");
      return;
    }
    if (!fechaEmision) {
      setError("Ingrese la fecha de emisión.");
      return;
    }

    setSaving(true);
    const res = await guardarCompra({
      idCompra: compra?.idCompra,
      idProveedor: Number(idProveedor),
      numeroDocumento: numeroDocumento.trim(),
      fechaEmision,
      flete: fleteNum,
      igvPorcentaje: igvNum,
      observaciones: observaciones.trim() || undefined,
      detalles,
    });
    setSaving(false);
    if (!res.ok) setError(res.error);
    else onSaved();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={compra ? "Editar Compra" : "Nueva Compra"}
      description="Registre la factura/guía del proveedor y el detalle de materiales"
      size="xl"
    >
      <div className="space-y-4">
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Proveedor" required>
            <Select value={idProveedor} onChange={(e) => setIdProveedor(e.target.value)}>
              <option value="">Seleccionar proveedor...</option>
              {proveedores.map((p) => (
                <option key={p.idProveedor} value={p.idProveedor}>
                  {p.razonSocial}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="N° Documento" required>
            <Input
              value={numeroDocumento}
              onChange={(e) => setNumeroDocumento(e.target.value)}
              placeholder="F001-00012345"
            />
          </Field>
          <Field label="Fecha de emisión" required>
            <Input type="date" value={fechaEmision} onChange={(e) => setFechaEmision(e.target.value)} />
          </Field>
        </div>

        <div className="space-y-2 border-t border-slate-200/70 pt-4">
          <p className="text-sm font-semibold text-ink">Detalle de materiales</p>
          <div className="grid grid-cols-[1fr_110px_130px_40px] gap-2 text-xs font-semibold uppercase text-muted">
            <span>Material</span>
            <span>Cantidad</span>
            <span>Costo Unit.</span>
            <span />
          </div>
          {filas.map((f, i) => {
            const usadosEnOtras = new Set(
              filas.filter((_, idx) => idx !== i).map((r) => r.idMaterial).filter(Boolean),
            );
            const mat = materiales.find((m) => String(m.idMaterial) === f.idMaterial);
            return (
              <div key={i} className="grid grid-cols-[1fr_110px_130px_40px] items-center gap-2">
                <Select
                  value={f.idMaterial}
                  onChange={(e) => {
                    const elegido = materiales.find((m) => String(m.idMaterial) === e.target.value);
                    setFila(i, {
                      idMaterial: e.target.value,
                      costo: elegido && !f.costo ? String(elegido.cupp) : f.costo,
                    });
                  }}
                >
                  <option value="">Seleccionar material...</option>
                  {materiales.map((m) => (
                    <option
                      key={m.idMaterial}
                      value={m.idMaterial}
                      disabled={usadosEnOtras.has(String(m.idMaterial))}
                    >
                      {m.codigoMaterial} — {m.nombre} ({m.unidadSimbolo})
                      {usadosEnOtras.has(String(m.idMaterial)) ? " (ya agregado)" : ""}
                    </option>
                  ))}
                </Select>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={mat ? mat.unidadSimbolo : "0"}
                  value={f.cantidad}
                  onChange={(e) => setFila(i, { cantidad: e.target.value })}
                />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={f.costo}
                  onChange={(e) => setFila(i, { costo: e.target.value })}
                />
                <button
                  onClick={() => delFila(i)}
                  className="rounded-md p-2 text-red-500 hover:bg-red-50"
                  title="Quitar material"
                >
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
          <Field label="Flete / transporte (S/)" hint="Se prorratea entre los ítems para el costo real">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={flete}
              onChange={(e) => setFlete(e.target.value)}
            />
          </Field>
          <Field label="IGV (%)">
            <Input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={igv}
              onChange={(e) => setIgv(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Observaciones">
          <Textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Notas sobre la compra (opcional)"
          />
        </Field>

        <div className="rounded-xl bg-cream px-4 py-3 text-sm">
          <TotalRow label="Subtotal (sin IGV)" value={formatCurrency(subtotal)} />
          <TotalRow label="Flete" value={formatCurrency(fleteNum)} />
          <TotalRow label={`IGV (${igvNum}%)`} value={formatCurrency(igvMonto)} />
          <div className="mt-2 flex justify-between border-t border-slate-300/60 pt-2 text-base font-bold text-ink">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200/70 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Guardando..." : compra ? "Guardar Cambios" : "Guardar Compra"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function DetalleModal({ compra, onClose }: { compra: CompraDTO; onClose: () => void }) {
  return (
    <Modal
      open
      onClose={onClose}
      title={`Compra ${compra.numeroDocumento}`}
      description={compra.proveedorNombre}
      size="lg"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <p className="text-muted">Estado</p>
            <Badge tone={estadoTono[compra.estado] ?? "gray"}>{compra.estado}</Badge>
          </div>
          <div>
            <p className="text-muted">Fecha Emisión</p>
            <p className="font-medium text-ink">{formatDate(compra.fechaEmision)}</p>
          </div>
          <div>
            <p className="text-muted">Fecha Recepción</p>
            <p className="font-medium text-ink">{formatDate(compra.fechaRecepcion)}</p>
          </div>
          <div>
            <p className="text-muted">Moneda</p>
            <p className="font-medium text-ink">{compra.moneda}</p>
          </div>
        </div>

        <Table>
          <Thead>
            <tr>
              <Th>Material</Th>
              <Th className="text-right">Cantidad</Th>
              <Th className="text-right">Costo Unit.</Th>
              <Th className="text-right">Flete Prorrat.</Th>
              <Th className="text-right">Importe</Th>
            </tr>
          </Thead>
          <tbody>
            {compra.detalles.length === 0 && <EmptyRow colSpan={5}>Sin materiales.</EmptyRow>}
            {compra.detalles.map((d) => (
              <Tr key={d.idDetalleCompra}>
                <Td>
                  <p className="font-medium text-ink">{d.materialNombre}</p>
                  <p className="text-xs text-muted">{d.materialCodigo}</p>
                </Td>
                <Td className="text-right">
                  {d.cantidad} {d.unidadSimbolo}
                </Td>
                <Td className="text-right">{formatCurrency(d.costoUnitario)}</Td>
                <Td className="text-right text-muted">{formatCurrency(d.fleteProrrateado)}</Td>
                <Td className="text-right font-medium">
                  {formatCurrency(d.cantidad * d.costoUnitario)}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>

        {compra.observaciones && (
          <div className="rounded-lg bg-cream px-3 py-2 text-sm">
            <p className="text-muted">Observaciones</p>
            <p className="text-ink">{compra.observaciones}</p>
          </div>
        )}

        <div className="rounded-xl bg-cream px-4 py-3 text-sm">
          <TotalRow label="Subtotal (sin IGV)" value={formatCurrency(compra.subtotal)} />
          <TotalRow label="Flete" value={formatCurrency(compra.flete)} />
          <TotalRow label={`IGV (${compra.igvPorcentaje}%)`} value={formatCurrency(compra.igvMonto)} />
          <div className="mt-2 flex justify-between border-t border-slate-300/60 pt-2 text-base font-bold text-ink">
            <span>Total</span>
            <span>{formatCurrency(compra.total)}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5 text-muted">
      <span>{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}
