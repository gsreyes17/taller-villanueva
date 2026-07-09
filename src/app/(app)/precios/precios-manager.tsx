"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Pencil, Calculator, MoreVertical } from "lucide-react";
import { actualizarCupp, recalcularCupp } from "./actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Field, Input } from "@/components/ui/field";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { formatCurrency, formatNumber, formatDateTime } from "@/lib/utils";
import type { ActionResult } from "@/lib/validations";

export type MaterialDTO = {
  idMaterial: number;
  codigoMaterial: string;
  nombre: string;
  categoria: string;
  unidadMedida: string;
  stockActual: number;
  stockMinimo: number;
  cupp: number;
  valorTotal: number;
  bajoStock: boolean;
  actualizadoEn: string;
};

export function PreciosManager({
  materiales,
  categorias,
  categoriaActual,
}: {
  materiales: MaterialDTO[];
  categorias: string[];
  categoriaActual?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<MaterialDTO | null>(null);
  const [open, setOpen] = useState(false);

  function editar(m: MaterialDTO) {
    setEditing(m);
    setOpen(true);
  }

  return (
    <>
      <Card className="mb-6 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <SearchInput placeholder="Buscar por código o nombre del material..." />
          </div>
          <CategoriaFilter categorias={categorias} categoriaActual={categoriaActual} />
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-base font-semibold text-ink">
          Lista de Materiales y Costos ({materiales.length})
        </h2>
        <Table>
          <Thead>
            <tr>
              <Th>Código</Th>
              <Th>Material</Th>
              <Th>Categoría</Th>
              <Th>Costo Unitario (CUPP)</Th>
              <Th>Unidad</Th>
              <Th className="text-right">Stock Actual</Th>
              <Th className="text-right">Valor Total</Th>
              <Th className="text-center">Recalcular</Th>
              <Th>Última Actualización</Th>
              <Th className="text-right">Acciones</Th>
            </tr>
          </Thead>
          <tbody>
            {materiales.length === 0 ? (
              <EmptyRow colSpan={10}>No hay materiales registrados.</EmptyRow>
            ) : (
              materiales.map((m) => (
                <Tr key={m.idMaterial}>
                  <Td>
                    <Badge tone="gray">{m.codigoMaterial}</Badge>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink">{m.nombre}</span>
                      {m.bajoStock && <Badge tone="red">Stock bajo</Badge>}
                    </div>
                  </Td>
                  <Td>
                    <Badge tone="gray">{m.categoria}</Badge>
                  </Td>
                  <Td>
                    <button
                      type="button"
                      onClick={() => editar(m)}
                      title="Editar costo unitario"
                      className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 transition-colors hover:text-emerald-700"
                    >
                      {formatCurrency(m.cupp)}
                      <Pencil size={14} className="text-slate-400" />
                    </button>
                  </Td>
                  <Td className="text-muted">{m.unidadMedida}</Td>
                  <Td className={`text-right ${m.bajoStock ? "font-semibold text-red-600" : "text-ink"}`}>
                    {formatNumber(m.stockActual, 2)}
                  </Td>
                  <Td className="text-right font-medium text-ink">{formatCurrency(m.valorTotal)}</Td>
                  <Td className="text-center">
                    <RecalcularBtn idMaterial={m.idMaterial} />
                  </Td>
                  <Td className="text-muted">{formatDateTime(m.actualizadoEn)}</Td>
                  <Td>
                    <div className="flex items-center justify-end">
                      <IconBtn title="Ajustar costo" onClick={() => editar(m)}>
                        <MoreVertical size={16} />
                      </IconBtn>
                    </div>
                  </Td>
                </Tr>
              ))
            )}
          </tbody>
        </Table>
      </Card>

      <CuppModal
        key={editing?.idMaterial ?? "none"}
        open={open}
        material={editing}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}

function CategoriaFilter({
  categorias,
  categoriaActual,
}: {
  categorias: string[];
  categoriaActual?: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function onChange(value: string) {
    const params = new URLSearchParams(window.location.search);
    if (value) params.set("cat", value);
    else params.delete("cat");
    startTransition(() => {
      router.replace(`/precios?${params.toString()}`);
    });
  }

  return (
    <select
      defaultValue={categoriaActual ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-3 pl-4 pr-9 text-sm text-ink shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 sm:w-64"
    >
      <option value="">Todas las categorías</option>
      {categorias.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}

function RecalcularBtn({ idMaterial }: { idMaterial: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const res = await recalcularCupp(idMaterial);
      if (!res.ok) alert(res.error);
      else router.refresh();
    });
  }

  return (
    <Button size="sm" variant="secondary" onClick={onClick} disabled={pending}>
      <Calculator size={15} />
      {pending ? "..." : "Calcular"}
    </Button>
  );
}

function IconBtn({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-100"
    >
      {children}
    </button>
  );
}

function CuppModal({
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
  const [state, formAction] = useActionState<ActionResult | null, FormData>(actualizarCupp, null);

  useEffect(() => {
    if (state?.ok) onSaved();
  }, [state, onSaved]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ajustar Costo Unitario"
      description={material ? material.nombre : undefined}
      size="sm"
    >
      <form action={formAction} className="space-y-5">
        <input type="hidden" name="idMaterial" value={material?.idMaterial ?? ""} />
        {state && !state.ok && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
            {state.error}
          </p>
        )}

        <Field label="Nuevo CUPP (S/)" required>
          <Input
            name="cupp"
            type="number"
            step="0.01"
            min="0"
            defaultValue={material?.cupp ?? 0}
            placeholder="0.00"
            autoFocus
          />
        </Field>

        <div className="flex justify-end gap-3 border-t border-slate-200/70 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <SubmitBtn />
        </div>
      </form>
    </Modal>
  );
}

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Guardando..." : "Guardar"}
    </Button>
  );
}
