"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Plus, ArrowDownToLine, ArrowUpFromLine, Pencil, Trash2, MapPin } from "lucide-react";
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
  idCategoria: number;
  categoriaNombre: string;
  categoriaPadre: string | null;
  idUnidad: number;
  unidadSimbolo: string;
  idUbicacion: number | null;
  ubicacionLabel: string | null;
  norma: string | null;
  espesorMm: number | null;
  medidas: string | null;
  acabado: string | null;
  pesoUnitario: number | null;
  stockActual: number;
  stockMinimo: number;
  stockMaximo: number | null;
  cupp: number;
  porcentajeMerma: number | null;
  /** Merma que realmente se aplicará (propia o heredada de la categoría). */
  mermaEfectiva: number;
  estado: string;
};

export type Catalogos = {
  categorias: { idCategoria: number; nombre: string; padre: string | null; porcentajeMerma: number }[];
  unidades: { idUnidad: number; simbolo: string; nombre: string }[];
  ubicaciones: { idUbicacion: number; label: string }[];
};

export function InventarioManager({
  materiales,
  catalogos,
}: {
  materiales: MaterialDTO[];
  catalogos: Catalogos;
}) {
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
              <Th>Clasificación</Th>
              <Th>Ubicación</Th>
              <Th>Stock</Th>
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
                    <p className="text-xs text-muted">
                      {[m.norma, m.medidas, m.espesorMm ? `${m.espesorMm} mm` : null, m.acabado]
                        .filter(Boolean)
                        .join(" · ") || m.descripcion || "—"}
                    </p>
                  </Td>
                  <Td>
                    <Badge tone="gray">{m.categoriaNombre}</Badge>
                    {m.categoriaPadre && (
                      <p className="mt-0.5 text-[11px] text-muted">{m.categoriaPadre}</p>
                    )}
                  </Td>
                  <Td>
                    {m.ubicacionLabel ? (
                      <span className="inline-flex items-center gap-1 text-xs text-ink">
                        <MapPin size={12} className="text-brand" />
                        {m.ubicacionLabel}
                      </span>
                    ) : (
                      <Badge tone="amber">Sin ubicar</Badge>
                    )}
                  </Td>
                  <Td className={isLow(m) ? "font-semibold text-red-600" : "text-ink"}>
                    {formatNumber(m.stockActual)} {m.unidadSimbolo}
                    <span className="block text-[11px] text-muted">mín. {formatNumber(m.stockMinimo)}</span>
                  </Td>
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
        catalogos={catalogos}
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
  catalogos,
  onClose,
  onSaved,
}: {
  open: boolean;
  material: MaterialDTO | null;
  catalogos: Catalogos;
  onClose: () => void;
  onSaved: () => void;
}) {
  const action = material ? actualizarMaterial : crearMaterial;
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null);
  const [idCategoria, setIdCategoria] = useState<string>(String(material?.idCategoria ?? ""));
  useEffect(() => {
    if (state?.ok) onSaved();
  }, [state, onSaved]);

  // Merma que se hereda si el material no define la suya.
  const mermaCategoria = catalogos.categorias.find(
    (c) => String(c.idCategoria) === idCategoria,
  )?.porcentajeMerma;

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
            <Input name="nombre" defaultValue={material?.nombre} placeholder='Perfil C 6"x2" x 3mm' />
          </Field>
        </div>
        <Field label="Descripción">
          <Textarea name="descripcion" defaultValue={material?.descripcion ?? ""} />
        </Field>

        <h3 className="text-base font-semibold text-ink">Clasificación</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Categoría" required error={fe(state, "idCategoria")}>
            <Select
              name="idCategoria"
              value={idCategoria}
              onChange={(e) => setIdCategoria(e.target.value)}
            >
              <option value="">Seleccionar...</option>
              {catalogos.categorias.map((c) => (
                <option key={c.idCategoria} value={c.idCategoria}>
                  {c.padre ? `${c.padre} › ${c.nombre}` : c.nombre}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Unidad de medida" required error={fe(state, "idUnidad")}>
            <Select name="idUnidad" defaultValue={material?.idUnidad ?? ""}>
              <option value="">Seleccionar...</option>
              {catalogos.unidades.map((u) => (
                <option key={u.idUnidad} value={u.idUnidad}>
                  {u.nombre} ({u.simbolo})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ubicación en almacén" hint="Dónde se guarda en el local">
            <Select name="idUbicacion" defaultValue={material?.idUbicacion ?? ""}>
              <option value="">— Sin ubicar —</option>
              {catalogos.ubicaciones.map((u) => (
                <option key={u.idUbicacion} value={u.idUbicacion}>
                  {u.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <h3 className="text-base font-semibold text-ink">Especificaciones técnicas</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Norma / Calidad" hint="Ej: ASTM A36">
            <Input name="norma" defaultValue={material?.norma ?? ""} list="normas-mat" />
          </Field>
          <Field label="Medidas" hint="Ej: 4'x8', 6&quot;x2&quot;">
            <Input name="medidas" defaultValue={material?.medidas ?? ""} />
          </Field>
          <Field label="Espesor (mm)" error={fe(state, "espesorMm")}>
            <Input name="espesorMm" type="number" step="0.01" min="0" defaultValue={material?.espesorMm ?? ""} />
          </Field>
          <Field label="Acabado" hint="Ej: Negro, Galvanizado">
            <Input name="acabado" defaultValue={material?.acabado ?? ""} list="acabados-mat" />
          </Field>
          <Field label="Peso unitario" hint="kg por unidad de medida" error={fe(state, "pesoUnitario")}>
            <Input name="pesoUnitario" type="number" step="0.001" min="0" defaultValue={material?.pesoUnitario ?? ""} />
          </Field>
          <Field
            label="Merma propia (%)"
            hint={
              mermaCategoria != null
                ? `Vacío = hereda ${mermaCategoria}% de la categoría`
                : "Vacío = hereda la merma de la categoría"
            }
            error={fe(state, "porcentajeMerma")}
          >
            <Input name="porcentajeMerma" type="number" step="0.01" min="0" max="100" defaultValue={material?.porcentajeMerma ?? ""} />
          </Field>
        </div>

        <h3 className="text-base font-semibold text-ink">Stock y costo</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {!material && (
            <Field label="Stock Actual" hint="Saldo de apertura">
              <Input name="stockActual" type="number" step="0.01" min="0" defaultValue={0} />
            </Field>
          )}
          <Field label="Stock Mínimo" required error={fe(state, "stockMinimo")}>
            <Input name="stockMinimo" type="number" step="0.01" min="0" defaultValue={material?.stockMinimo ?? 10} />
          </Field>
          <Field label="Stock Máximo" error={fe(state, "stockMaximo")}>
            <Input name="stockMaximo" type="number" step="0.01" min="0" defaultValue={material?.stockMaximo ?? ""} />
          </Field>
          <Field label="CUPP (S/)" hint={material ? "Se recalcula al recibir compras" : "Costo inicial"}>
            <Input name="cupp" type="number" step="0.01" min="0" defaultValue={material?.cupp ?? 0} />
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
        {!material && <input type="hidden" name="estado" value="Activo" />}

        <datalist id="normas-mat">
          <option value="ASTM A36" />
          <option value="ASTM A500" />
          <option value="ASTM A53" />
          <option value="AISI 304" />
          <option value="AISI 316" />
          <option value="AWS E6011" />
          <option value="AWS E7018" />
        </datalist>
        <datalist id="acabados-mat">
          <option value="Negro" />
          <option value="Galvanizado" />
          <option value="Inoxidable" />
          <option value="Pintado" />
          <option value="Cromado" />
        </datalist>

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
                  {m.codigoMaterial} — {m.nombre} (stock: {formatNumber(m.stockActual)} {m.unidadSimbolo})
                </option>
              ))}
          </Select>
        </Field>

        {seleccionado && (
          <p className="rounded-lg bg-cream px-3 py-2 text-sm text-muted">
            Stock actual:{" "}
            <strong className="text-ink">
              {formatNumber(seleccionado.stockActual)} {seleccionado.unidadSimbolo}
            </strong>
            {seleccionado.ubicacionLabel && (
              <span className="ml-2 text-xs">· Ubicación: {seleccionado.ubicacionLabel}</span>
            )}
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
