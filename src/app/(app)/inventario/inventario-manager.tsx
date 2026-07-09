"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Plus, ArrowDownToLine, ArrowUpFromLine, Pencil, Trash2 } from "lucide-react";
import {
  crearMaterial,
  actualizarMaterial,
  eliminarMaterial,
  registrarMovimiento,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Textarea, Select } from "@/components/ui/field";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { ActionResult } from "@/lib/validations";

export type MaterialDTO = {
  idMaterial: number;
  codigoMaterial: string;
  nombre: string;
  descripcion: string | null;
  categoria: string;
  unidadMedida: string;
  stockActual: number;
  stockMinimo: number;
  stockMaximo: number | null;
  cupp: number;
  areaAlmacen: string | null;
  estanteNivel: string | null;
  estado: string;
};

export function InventarioManager({ materiales }: { materiales: MaterialDTO[] }) {
  const router = useRouter();
  const [matModal, setMatModal] = useState<{ open: boolean; editing: MaterialDTO | null }>({
    open: false,
    editing: null,
  });
  const [movModal, setMovModal] = useState<{ open: boolean; tipo: "Entrada" | "Salida" | null }>({
    open: false,
    tipo: null,
  });

  async function borrar(m: MaterialDTO) {
    if (!confirm(`¿Eliminar el material "${m.nombre}"?`)) return;
    const res = await eliminarMaterial(m.idMaterial);
    if (!res.ok) alert(res.error);
    else router.refresh();
  }

  const isLow = (m: MaterialDTO) => m.stockActual <= m.stockMinimo;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-end gap-2">
        <Button variant="secondary" onClick={() => setMovModal({ open: true, tipo: "Entrada" })}>
          <ArrowDownToLine size={16} /> Entrada
        </Button>
        <Button variant="secondary" onClick={() => setMovModal({ open: true, tipo: "Salida" })}>
          <ArrowUpFromLine size={16} /> Salida
        </Button>
        <Button onClick={() => setMatModal({ open: true, editing: null })}>
          <Plus size={18} /> Registrar Material
        </Button>
      </div>

      <Card className="p-6">
        <h2 className="mb-4 text-base font-semibold text-ink">Materiales en Inventario</h2>
        <Table>
          <Thead>
            <tr>
              <Th>Código</Th>
              <Th>Material</Th>
              <Th>Categoría</Th>
              <Th>Stock</Th>
              <Th>Stock Mín.</Th>
              <Th>CUPP</Th>
              <Th>Valorización</Th>
              <Th>Estado</Th>
              <Th className="text-right">Acciones</Th>
            </tr>
          </Thead>
          <tbody>
            {materiales.length === 0 ? (
              <EmptyRow colSpan={9}>No hay materiales registrados.</EmptyRow>
            ) : (
              materiales.map((m) => (
                <Tr key={m.idMaterial}>
                  <Td className="font-medium text-ink">{m.codigoMaterial}</Td>
                  <Td>
                    <p className="font-semibold text-ink">{m.nombre}</p>
                    {m.descripcion && <p className="text-xs text-muted">{m.descripcion}</p>}
                  </Td>
                  <Td>
                    <Badge tone="gray">{m.categoria}</Badge>
                  </Td>
                  <Td className={isLow(m) ? "font-semibold text-red-600" : "text-ink"}>
                    {formatNumber(m.stockActual)} {m.unidadMedida}
                  </Td>
                  <Td className="text-muted">{formatNumber(m.stockMinimo)}</Td>
                  <Td className="text-ink">{formatCurrency(m.cupp)}</Td>
                  <Td className="text-ink">{formatCurrency(m.stockActual * m.cupp)}</Td>
                  <Td>
                    {m.estado === "Descontinuado" ? (
                      <Badge tone="gray">Descontinuado</Badge>
                    ) : isLow(m) ? (
                      <Badge tone="red">Bajo stock</Badge>
                    ) : (
                      <Badge tone="navy">Normal</Badge>
                    )}
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        title="Editar"
                        onClick={() => setMatModal({ open: true, editing: m })}
                        className="rounded-md p-2 text-slate-500 hover:bg-slate-100"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        title="Eliminar"
                        onClick={() => borrar(m)}
                        className="rounded-md p-2 text-red-500 hover:bg-red-50"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </Td>
                </Tr>
              ))
            )}
          </tbody>
        </Table>
      </Card>

      <MaterialModal
        key={matModal.editing?.idMaterial ?? "new-mat"}
        open={matModal.open}
        material={matModal.editing}
        onClose={() => setMatModal({ open: false, editing: null })}
        onSaved={() => {
          setMatModal({ open: false, editing: null });
          router.refresh();
        }}
      />

      <MovimientoModal
        key={movModal.tipo ?? "mov"}
        open={movModal.open}
        tipo={movModal.tipo}
        materiales={materiales}
        onClose={() => setMovModal({ open: false, tipo: null })}
        onSaved={() => {
          setMovModal({ open: false, tipo: null });
          router.refresh();
        }}
      />
    </>
  );
}

function MaterialModal({
  open,
  material,
  onClose,
  onSaved,
}: {
  open: boolean;
  material: MaterialDTO | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const action = material ? actualizarMaterial : crearMaterial;
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null);
  useEffect(() => {
    if (state?.ok) onSaved();
  }, [state, onSaved]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={material ? "Editar Material" : "Registrar Nuevo Material"}
      description={material ? "Actualice los datos del material" : "Complete los datos del nuevo material para el inventario"}
      size="lg"
    >
      <form action={formAction} className="space-y-5">
        {material && <input type="hidden" name="idMaterial" value={material.idMaterial} />}
        {state && !state.ok && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{state.error}</p>
        )}

        <h3 className="text-base font-semibold text-ink">Identificación</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Código" required error={fe(state, "codigoMaterial")}>
            <Input name="codigoMaterial" defaultValue={material?.codigoMaterial} placeholder="PER-001" />
          </Field>
          <Field label="Nombre" required error={fe(state, "nombre")}>
            <Input name="nombre" defaultValue={material?.nombre} placeholder="Perfil C 6x2" />
          </Field>
        </div>
        <Field label="Descripción">
          <Textarea name="descripcion" defaultValue={material?.descripcion ?? ""} />
        </Field>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Categoría" required error={fe(state, "categoria")}>
            <Input name="categoria" defaultValue={material?.categoria} placeholder="Perfiles" list="categorias-mat" />
          </Field>
          <Field label="Unidad Medida" required error={fe(state, "unidadMedida")}>
            <Input name="unidadMedida" defaultValue={material?.unidadMedida} placeholder="Metro" />
          </Field>
          <Field label="CUPP" hint="Costo unitario promedio">
            <Input name="cupp" type="number" step="0.01" min="0" defaultValue={material?.cupp ?? 0} />
          </Field>
        </div>

        <h3 className="text-base font-semibold text-ink">Control de Stock</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {!material && (
            <Field label="Stock Actual" hint="Saldo de apertura">
              <Input name="stockActual" type="number" step="0.01" min="0" defaultValue={0} />
            </Field>
          )}
          <Field label="Stock Mínimo" required error={fe(state, "stockMinimo")}>
            <Input name="stockMinimo" type="number" step="0.01" min="0" defaultValue={material?.stockMinimo ?? 10} />
          </Field>
          <Field label="Stock Máximo">
            <Input name="stockMaximo" type="number" step="0.01" min="0" defaultValue={material?.stockMaximo ?? ""} />
          </Field>
          {material && (
            <Field label="Estado">
              <Select name="estado" defaultValue={material.estado}>
                <option value="Activo">Activo</option>
                <option value="Descontinuado">Descontinuado</option>
              </Select>
            </Field>
          )}
        </div>

        <h3 className="text-base font-semibold text-ink">Ubicación</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Área de almacén">
            <Input name="areaAlmacen" defaultValue={material?.areaAlmacen ?? ""} placeholder="Zona A" />
          </Field>
          <Field label="Estante / Nivel">
            <Input name="estanteNivel" defaultValue={material?.estanteNivel ?? ""} />
          </Field>
        </div>
        {!material && <input type="hidden" name="estado" value="Activo" />}

        <div className="flex justify-end gap-3 border-t border-slate-200/70 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <SubmitBtn label={material ? "Guardar Cambios" : "Guardar Material"} />
        </div>
      </form>
    </Modal>
  );
}

function MovimientoModal({
  open,
  tipo,
  materiales,
  onClose,
  onSaved,
}: {
  open: boolean;
  tipo: "Entrada" | "Salida" | null;
  materiales: MaterialDTO[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(registrarMovimiento, null);
  const [idMaterial, setIdMaterial] = useState<string>("");
  useEffect(() => {
    if (state?.ok) onSaved();
  }, [state, onSaved]);

  const seleccionado = useMemo(
    () => materiales.find((m) => String(m.idMaterial) === idMaterial),
    [materiales, idMaterial],
  );

  if (!tipo) return null;
  const esEntrada = tipo === "Entrada";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={esEntrada ? "Registrar Entrada de Material" : "Registrar Salida de Material"}
      description={esEntrada ? "Ingreso de stock (compra, devolución, ajuste)" : "Consumo o salida de stock hacia una obra"}
      size="md"
    >
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="tipoMovimiento" value={tipo} />
        {state && !state.ok && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{state.error}</p>
        )}

        <Field label="Material" required error={fe(state, "idMaterial")}>
          <Select
            name="idMaterial"
            value={idMaterial}
            onChange={(e) => setIdMaterial(e.target.value)}
          >
            <option value="">Seleccionar material...</option>
            {materiales
              .filter((m) => m.estado === "Activo")
              .map((m) => (
                <option key={m.idMaterial} value={m.idMaterial}>
                  {m.codigoMaterial} — {m.nombre} (stock: {formatNumber(m.stockActual)} {m.unidadMedida})
                </option>
              ))}
          </Select>
        </Field>

        {seleccionado && (
          <p className="rounded-lg bg-cream px-3 py-2 text-sm text-muted">
            Stock actual: <strong className="text-ink">{formatNumber(seleccionado.stockActual)} {seleccionado.unidadMedida}</strong>
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Cantidad" required error={fe(state, "cantidad")}>
            <Input name="cantidad" type="number" step="0.01" min="0.01" placeholder="0.00" />
          </Field>
          <Field label={esEntrada ? "Costo unitario (S/)" : "Costo unitario (S/)"} hint={esEntrada ? "Actualiza el CUPP al recalcular" : undefined}>
            <Input name="costoUnitario" type="number" step="0.01" min="0" defaultValue={seleccionado?.cupp ?? 0} />
          </Field>
        </div>

        <Field label="Motivo / Referencia">
          <Input name="motivo" placeholder={esEntrada ? "Compra a proveedor..." : "Consumo obra..."} />
        </Field>
        <Field label="N° documento (factura/guía)">
          <Input name="referenciaDocumento" placeholder="Opcional" />
        </Field>

        <div className="flex justify-end gap-3 border-t border-slate-200/70 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <SubmitBtn label={esEntrada ? "Registrar Entrada" : "Registrar Salida"} />
        </div>
      </form>
    </Modal>
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
