"use client";

import * as React from "react";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Warehouse, Plus, Pencil, Trash2, ChevronRight, Package } from "lucide-react";
import {
  guardarCategoria,
  eliminarCategoria,
  guardarUnidad,
  eliminarUnidad,
  guardarUbicacion,
  eliminarUbicacion,
  reubicarMaterial,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { Badge, EstadoBadge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
import type { ActionResult } from "@/lib/validations";

export type AlmacenTab = "ubicaciones" | "categorias" | "unidades";

export type UbicacionDTO = {
  idUbicacion: number;
  zona: string;
  estante: string | null;
  nivel: string | null;
  descripcion: string | null;
  capacidadMax: number | null;
  estado: string;
  materiales: number;
};

export type CategoriaDTO = {
  idCategoria: number;
  nombre: string;
  descripcion: string | null;
  idCategoriaPadre: number | null;
  nombrePadre: string | null;
  porcentajeMerma: number;
  estado: string;
  materiales: number;
  hijas: number;
};

export type UnidadDTO = {
  idUnidad: number;
  simbolo: string;
  nombre: string;
  tipo: string;
  factorBase: number;
  estado: string;
  materiales: number;
};

export type MaterialDTO = {
  idMaterial: number;
  codigoMaterial: string;
  nombre: string;
  stockActual: number;
  idUbicacion: number | null;
  simbolo: string;
};

const TIPOS_UNIDAD = ["Longitud", "Masa", "Area", "Volumen", "Unidad"] as const;

/** Etiqueta legible de una ubicación: "Estante — Nivel", o "General". */
function etiquetaUbicacion(u: Pick<UbicacionDTO, "estante" | "nivel">): string {
  const partes = [u.estante, u.nivel].filter(Boolean) as string[];
  return partes.length > 0 ? partes.join(" — ") : "General";
}

export function AlmacenManager({
  tab,
  ubicaciones,
  categorias,
  unidades,
  materiales,
}: {
  tab: AlmacenTab;
  ubicaciones: UbicacionDTO[];
  categorias: CategoriaDTO[];
  unidades: UnidadDTO[];
  materiales: MaterialDTO[];
}) {
  if (tab === "categorias") return <CategoriasSection categorias={categorias} />;
  if (tab === "unidades") return <UnidadesSection unidades={unidades} />;
  return <UbicacionesSection ubicaciones={ubicaciones} materiales={materiales} />;
}

/* ======================= UBICACIONES ======================= */

function UbicacionesSection({
  ubicaciones,
  materiales,
}: {
  ubicaciones: UbicacionDTO[];
  materiales: MaterialDTO[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<UbicacionDTO | null>(null);
  const [open, setOpen] = useState(false);

  const sinUbicar = useMemo(() => materiales.filter((m) => m.idUbicacion == null), [materiales]);

  // Mapa de ocupación: materiales agrupados por la ubicación que los contiene.
  const porUbicacion = useMemo(() => {
    const map = new Map<number, MaterialDTO[]>();
    for (const m of materiales) {
      if (m.idUbicacion == null) continue;
      const arr = map.get(m.idUbicacion);
      if (arr) arr.push(m);
      else map.set(m.idUbicacion, [m]);
    }
    return map;
  }, [materiales]);

  // Agrupa las ubicaciones por zona conservando el orden del servidor.
  const zonas = useMemo(() => {
    const map = new Map<string, UbicacionDTO[]>();
    for (const u of ubicaciones) {
      const arr = map.get(u.zona);
      if (arr) arr.push(u);
      else map.set(u.zona, [u]);
    }
    return [...map.entries()];
  }, [ubicaciones]);

  function nueva() {
    setEditing(null);
    setOpen(true);
  }
  function editar(u: UbicacionDTO) {
    setEditing(u);
    setOpen(true);
  }

  async function borrar(u: UbicacionDTO) {
    if (!window.confirm(`¿Eliminar la ubicación "${u.zona} · ${etiquetaUbicacion(u)}"?`)) return;
    const res = await eliminarUbicacion(u.idUbicacion);
    if (!res.ok) alert(res.error);
    else router.refresh();
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-end">
        <Button onClick={nueva}>
          <Plus size={18} /> Nueva Ubicación
        </Button>
      </div>

      {sinUbicar.length > 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50/60 p-6">
          <h2 className="mb-1 text-base font-semibold text-ink">
            {sinUbicar.length} material(es) sin ubicación asignada
          </h2>
          <p className="mb-4 text-sm text-muted">
            Asigne una ubicación para saber dónde está guardado cada material dentro del local.
          </p>
          <div className="space-y-2">
            {sinUbicar.map((m) => (
              <SinUbicarRow key={m.idMaterial} material={m} ubicaciones={ubicaciones} />
            ))}
          </div>
        </Card>
      )}

      {zonas.length === 0 ? (
        <Card className="p-12 text-center">
          <Warehouse size={32} className="mx-auto text-slate-300" />
          <p className="mt-3 text-sm text-muted">
            Aún no hay ubicaciones registradas. Cree la primera zona del local.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {zonas.map(([zona, items]) => (
            <Card key={zona} className="p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
                  <Warehouse size={18} className="text-brand" />
                  {zona}
                </h2>
                <Badge tone="navy">{items.length} ubicación(es)</Badge>
              </div>

              <div className="space-y-3">
                {items.map((u) => {
                  const mats = porUbicacion.get(u.idUbicacion) ?? [];
                  return (
                    <div
                      key={u.idUbicacion}
                      className="rounded-lg border border-slate-200 bg-white p-3.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-ink">{etiquetaUbicacion(u)}</p>
                            <Badge tone={mats.length > 0 ? "orange" : "gray"}>
                              {mats.length} material(es)
                            </Badge>
                            {u.estado !== "Activo" && <EstadoBadge estado={u.estado} />}
                          </div>
                          {u.descripcion && (
                            <p className="mt-0.5 text-xs text-muted">{u.descripcion}</p>
                          )}
                          {u.capacidadMax != null && (
                            <p className="mt-0.5 text-xs text-muted">
                              Capacidad máx.: {formatNumber(u.capacidadMax, 2)}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <IconBtn title="Editar" onClick={() => editar(u)}>
                            <Pencil size={16} />
                          </IconBtn>
                          <IconBtn title="Eliminar" danger onClick={() => borrar(u)}>
                            <Trash2 size={16} />
                          </IconBtn>
                        </div>
                      </div>

                      {mats.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {mats.map((m) => (
                            <Badge
                              key={m.idMaterial}
                              tone="gray"
                              className="px-2 py-0.5 text-[11px]"
                              title={m.nombre}
                            >
                              {m.codigoMaterial}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}

      <UbicacionFormModal
        key={editing?.idUbicacion ?? "new"}
        open={open}
        ubicacion={editing}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}

function SinUbicarRow({
  material,
  ubicaciones,
}: {
  material: MaterialDTO;
  ubicaciones: UbicacionDTO[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function asignar(value: string) {
    if (!value) return;
    setSaving(true);
    const res = await reubicarMaterial(material.idMaterial, Number(value));
    setSaving(false);
    if (!res.ok) alert(res.error);
    else router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200/70 bg-white px-3.5 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <Package size={16} className="shrink-0 text-amber-600" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{material.nombre}</p>
          <p className="text-xs text-muted">
            {material.codigoMaterial} · Stock: {formatNumber(material.stockActual, 2)}{" "}
            {material.simbolo}
          </p>
        </div>
      </div>
      <Select
        className="w-full sm:w-64"
        defaultValue=""
        disabled={saving}
        aria-label={`Asignar ubicación a ${material.nombre}`}
        onChange={(e) => asignar(e.target.value)}
      >
        <option value="">— Asignar ubicación —</option>
        {ubicaciones.map((u) => (
          <option key={u.idUbicacion} value={u.idUbicacion}>
            {u.zona} · {etiquetaUbicacion(u)}
          </option>
        ))}
      </Select>
    </div>
  );
}

function UbicacionFormModal({
  open,
  ubicacion,
  onClose,
  onSaved,
}: {
  open: boolean;
  ubicacion: UbicacionDTO | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(guardarUbicacion, null);

  useEffect(() => {
    if (state?.ok) onSaved();
  }, [state, onSaved]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={ubicacion ? "Editar Ubicación" : "Nueva Ubicación"}
      description="Zona, estante y nivel donde se almacena el material dentro del local"
      size="md"
    >
      <form action={formAction} className="space-y-5">
        {ubicacion && <input type="hidden" name="idUbicacion" value={ubicacion.idUbicacion} />}
        {state && !state.ok && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
            {state.error}
          </p>
        )}

        <Field label="Zona" required hint="Ej: Zona A, Patio, Almacén 2" error={fe(state, "zona")}>
          <Input name="zona" defaultValue={ubicacion?.zona} placeholder="Ej: Zona A" />
        </Field>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Estante" error={fe(state, "estante")}>
            <Input name="estante" defaultValue={ubicacion?.estante ?? ""} placeholder="Ej: E-01" />
          </Field>
          <Field label="Nivel" error={fe(state, "nivel")}>
            <Input name="nivel" defaultValue={ubicacion?.nivel ?? ""} placeholder="Ej: Nivel 2" />
          </Field>
        </div>

        <Field label="Descripción" error={fe(state, "descripcion")}>
          <Textarea
            name="descripcion"
            defaultValue={ubicacion?.descripcion ?? ""}
            placeholder="Referencia para ubicar el material rápidamente"
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Capacidad máx." error={fe(state, "capacidadMax")}>
            <Input
              name="capacidadMax"
              type="number"
              step="0.01"
              min="0"
              defaultValue={ubicacion?.capacidadMax ?? ""}
              placeholder="Opcional"
            />
          </Field>
          <Field label="Estado">
            <Select name="estado" defaultValue={ubicacion?.estado ?? "Activo"}>
              <option value="Activo">Activo</option>
              <option value="Inactivo">Inactivo</option>
            </Select>
          </Field>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200/70 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <SubmitBtn label={ubicacion ? "Guardar Cambios" : "Crear Ubicación"} />
        </div>
      </form>
    </Modal>
  );
}

/* ======================= CATEGORÍAS ======================= */

function CategoriasSection({ categorias }: { categorias: CategoriaDTO[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<CategoriaDTO | null>(null);
  const [open, setOpen] = useState(false);

  function nueva() {
    setEditing(null);
    setOpen(true);
  }
  function editar(c: CategoriaDTO) {
    setEditing(c);
    setOpen(true);
  }

  async function borrar(c: CategoriaDTO) {
    if (!window.confirm(`¿Eliminar la categoría "${c.nombre}"?`)) return;
    const res = await eliminarCategoria(c.idCategoria);
    if (!res.ok) alert(res.error);
    else {
      if (res.message) alert(res.message);
      router.refresh();
    }
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-end">
        <Button onClick={nueva}>
          <Plus size={18} /> Nueva Categoría
        </Button>
      </div>

      <Card className="p-6">
        <h2 className="mb-4 text-base font-semibold text-ink">
          Categorías ({categorias.length})
        </h2>
        <Table>
          <Thead>
            <tr>
              <Th>Nombre</Th>
              <Th>Descripción</Th>
              <Th className="text-center">Merma %</Th>
              <Th className="text-center">Subcategorías</Th>
              <Th className="text-center">Materiales</Th>
              <Th>Estado</Th>
              <Th className="text-right">Acciones</Th>
            </tr>
          </Thead>
          <tbody>
            {categorias.length === 0 ? (
              <EmptyRow colSpan={7}>No hay categorías registradas.</EmptyRow>
            ) : (
              categorias.map((c) => (
                <Tr key={c.idCategoria}>
                  <Td>
                    {c.nombrePadre ? (
                      <div className="flex items-center gap-1 pl-4">
                        <span className="text-xs text-muted">{c.nombrePadre}</span>
                        <ChevronRight size={12} className="text-slate-400" />
                        <span className="font-semibold text-ink">{c.nombre}</span>
                      </div>
                    ) : (
                      <span className="font-semibold text-ink">{c.nombre}</span>
                    )}
                  </Td>
                  <Td className="text-muted">{c.descripcion ?? "—"}</Td>
                  <Td className="text-center">
                    <Badge tone="amber">{formatNumber(c.porcentajeMerma, 2)}%</Badge>
                  </Td>
                  <Td className="text-center text-muted">{c.hijas}</Td>
                  <Td className="text-center text-muted">{c.materiales}</Td>
                  <Td>
                    <EstadoBadge estado={c.estado} />
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      <IconBtn title="Editar" onClick={() => editar(c)}>
                        <Pencil size={16} />
                      </IconBtn>
                      <IconBtn title="Eliminar" danger onClick={() => borrar(c)}>
                        <Trash2 size={16} />
                      </IconBtn>
                    </div>
                  </Td>
                </Tr>
              ))
            )}
          </tbody>
        </Table>
      </Card>

      <CategoriaFormModal
        key={editing?.idCategoria ?? "new"}
        open={open}
        categoria={editing}
        categorias={categorias}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}

function CategoriaFormModal({
  open,
  categoria,
  categorias,
  onClose,
  onSaved,
}: {
  open: boolean;
  categoria: CategoriaDTO | null;
  categorias: CategoriaDTO[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(guardarCategoria, null);

  useEffect(() => {
    if (state?.ok) onSaved();
  }, [state, onSaved]);

  // Una categoría no puede ser su propia padre.
  const padres = categorias.filter((c) => c.idCategoria !== categoria?.idCategoria);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={categoria ? "Editar Categoría" : "Nueva Categoría"}
      description="Clasificación jerárquica de los materiales"
      size="md"
    >
      <form action={formAction} className="space-y-5">
        {categoria && <input type="hidden" name="idCategoria" value={categoria.idCategoria} />}
        {state && !state.ok && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
            {state.error}
          </p>
        )}

        <Field label="Nombre" required error={fe(state, "nombre")}>
          <Input name="nombre" defaultValue={categoria?.nombre} placeholder="Ej: Planchas" />
        </Field>

        <Field label="Descripción" error={fe(state, "descripcion")}>
          <Textarea
            name="descripcion"
            defaultValue={categoria?.descripcion ?? ""}
            placeholder="Opcional"
          />
        </Field>

        <Field label="Categoría padre" error={fe(state, "idCategoriaPadre")}>
          <Select name="idCategoriaPadre" defaultValue={categoria?.idCategoriaPadre ?? ""}>
            <option value="">— Ninguna (categoría raíz) —</option>
            {padres.map((c) => (
              <option key={c.idCategoria} value={c.idCategoria}>
                {c.nombrePadre ? `${c.nombrePadre} › ${c.nombre}` : c.nombre}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field
            label="Merma esperada %"
            hint="Se usa para calcular la merma del presupuesto si el material no define la suya"
            error={fe(state, "porcentajeMerma")}
          >
            <Input
              name="porcentajeMerma"
              type="number"
              step="0.01"
              min="0"
              max="100"
              defaultValue={categoria?.porcentajeMerma ?? 6}
            />
          </Field>
          <Field label="Estado">
            <Select name="estado" defaultValue={categoria?.estado ?? "Activo"}>
              <option value="Activo">Activo</option>
              <option value="Inactivo">Inactivo</option>
            </Select>
          </Field>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200/70 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <SubmitBtn label={categoria ? "Guardar Cambios" : "Crear Categoría"} />
        </div>
      </form>
    </Modal>
  );
}

/* ======================= UNIDADES ======================= */

function UnidadesSection({ unidades }: { unidades: UnidadDTO[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<UnidadDTO | null>(null);
  const [open, setOpen] = useState(false);

  function nueva() {
    setEditing(null);
    setOpen(true);
  }
  function editar(u: UnidadDTO) {
    setEditing(u);
    setOpen(true);
  }

  async function borrar(u: UnidadDTO) {
    if (!window.confirm(`¿Eliminar la unidad "${u.nombre}" (${u.simbolo})?`)) return;
    const res = await eliminarUnidad(u.idUnidad);
    if (!res.ok) alert(res.error);
    else {
      if (res.message) alert(res.message);
      router.refresh();
    }
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-end">
        <Button onClick={nueva}>
          <Plus size={18} /> Nueva Unidad
        </Button>
      </div>

      <Card className="p-6">
        <h2 className="mb-4 text-base font-semibold text-ink">
          Unidades de Medida ({unidades.length})
        </h2>
        <Table>
          <Thead>
            <tr>
              <Th>Símbolo</Th>
              <Th>Nombre</Th>
              <Th>Tipo</Th>
              <Th className="text-right">Factor base</Th>
              <Th className="text-center">Materiales</Th>
              <Th>Estado</Th>
              <Th className="text-right">Acciones</Th>
            </tr>
          </Thead>
          <tbody>
            {unidades.length === 0 ? (
              <EmptyRow colSpan={7}>No hay unidades registradas.</EmptyRow>
            ) : (
              unidades.map((u) => (
                <Tr key={u.idUnidad}>
                  <Td>
                    <Badge tone="gray">{u.simbolo}</Badge>
                  </Td>
                  <Td className="font-semibold text-ink">{u.nombre}</Td>
                  <Td>
                    <Badge tone="navy">{u.tipo}</Badge>
                  </Td>
                  <Td className="text-right text-muted">{formatNumber(u.factorBase, 2)}</Td>
                  <Td className="text-center text-muted">{u.materiales}</Td>
                  <Td>
                    <EstadoBadge estado={u.estado} />
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      <IconBtn title="Editar" onClick={() => editar(u)}>
                        <Pencil size={16} />
                      </IconBtn>
                      <IconBtn title="Eliminar" danger onClick={() => borrar(u)}>
                        <Trash2 size={16} />
                      </IconBtn>
                    </div>
                  </Td>
                </Tr>
              ))
            )}
          </tbody>
        </Table>
      </Card>

      <UnidadFormModal
        key={editing?.idUnidad ?? "new"}
        open={open}
        unidad={editing}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}

function UnidadFormModal({
  open,
  unidad,
  onClose,
  onSaved,
}: {
  open: boolean;
  unidad: UnidadDTO | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(guardarUnidad, null);

  useEffect(() => {
    if (state?.ok) onSaved();
  }, [state, onSaved]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={unidad ? "Editar Unidad" : "Nueva Unidad"}
      description="Unidad de medida usada por los materiales"
      size="md"
    >
      <form action={formAction} className="space-y-5">
        {unidad && <input type="hidden" name="idUnidad" value={unidad.idUnidad} />}
        {state && !state.ok && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
            {state.error}
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Símbolo" required error={fe(state, "simbolo")}>
            <Input name="simbolo" defaultValue={unidad?.simbolo} placeholder="Ej: kg" />
          </Field>
          <Field label="Nombre" required error={fe(state, "nombre")}>
            <Input name="nombre" defaultValue={unidad?.nombre} placeholder="Ej: Kilogramo" />
          </Field>
        </div>

        <Field label="Tipo" required error={fe(state, "tipo")}>
          <Select name="tipo" defaultValue={unidad?.tipo ?? "Unidad"}>
            {TIPOS_UNIDAD.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field
            label="Factor base"
            hint="Equivalencia respecto a la unidad base de su tipo. Ej: cm = 0.01 m"
            error={fe(state, "factorBase")}
          >
            <Input
              name="factorBase"
              type="number"
              step="0.000001"
              min="0"
              defaultValue={unidad?.factorBase ?? 1}
            />
          </Field>
          <Field label="Estado">
            <Select name="estado" defaultValue={unidad?.estado ?? "Activo"}>
              <option value="Activo">Activo</option>
              <option value="Inactivo">Inactivo</option>
            </Select>
          </Field>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200/70 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <SubmitBtn label={unidad ? "Guardar Cambios" : "Crear Unidad"} />
        </div>
      </form>
    </Modal>
  );
}

/* ======================= Helpers locales ======================= */

function IconBtn({
  children,
  title,
  danger,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`rounded-md p-2 transition-colors hover:bg-slate-100 ${
        danger ? "text-red-500 hover:bg-red-50" : "text-slate-500"
      }`}
    >
      {children}
    </button>
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
