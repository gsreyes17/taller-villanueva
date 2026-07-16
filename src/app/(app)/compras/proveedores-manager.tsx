"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { guardarProveedor, eliminarProveedor } from "./actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select } from "@/components/ui/field";
import { Badge, EstadoBadge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import type { ActionResult } from "@/lib/validations";

export type ProveedorDTO = {
  idProveedor: number;
  ruc: string;
  razonSocial: string;
  direccion: string | null;
  telefono: string | null;
  correo: string | null;
  contactoNombre: string | null;
  diasCredito: number;
  estado: string; // "Activo" | "Inactivo"
  totalCompras: number;
};

export function ProveedoresManager({ proveedores }: { proveedores: ProveedorDTO[] }) {
  const router = useRouter();
  const [modal, setModal] = useState<{ open: boolean; editing: ProveedorDTO | null }>({
    open: false,
    editing: null,
  });

  async function borrar(p: ProveedorDTO) {
    if (!confirm(`¿Eliminar el proveedor "${p.razonSocial}"?`)) return;
    const res = await eliminarProveedor(p.idProveedor);
    if (!res.ok) alert(res.error);
    else {
      if (res.message) alert(res.message);
      router.refresh();
    }
  }

  return (
    <>
      <div className="mb-6 flex justify-end">
        <Button onClick={() => setModal({ open: true, editing: null })}>
          <Plus size={18} /> Registrar Proveedor
        </Button>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <Thead>
            <tr>
              <Th>Razón Social</Th>
              <Th>Contacto</Th>
              <Th>Correo</Th>
              <Th>Días Crédito</Th>
              <Th className="text-center">Compras</Th>
              <Th>Estado</Th>
              <Th className="text-right">Acciones</Th>
            </tr>
          </Thead>
          <tbody>
            {proveedores.length === 0 && (
              <EmptyRow colSpan={7}>No hay proveedores registrados todavía.</EmptyRow>
            )}
            {proveedores.map((p) => (
              <Tr key={p.idProveedor}>
                <Td>
                  <p className="font-semibold text-ink">{p.razonSocial}</p>
                  <p className="text-xs text-muted">RUC: {p.ruc}</p>
                </Td>
                <Td>
                  {p.contactoNombre || p.telefono ? (
                    <>
                      <p className="text-ink">{p.contactoNombre ?? "—"}</p>
                      <p className="text-xs text-muted">{p.telefono ?? "—"}</p>
                    </>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </Td>
                <Td className="text-muted">{p.correo ?? "—"}</Td>
                <Td>
                  <Badge tone={p.diasCredito === 0 ? "gray" : "navy"}>
                    {p.diasCredito === 0 ? "Contado" : `${p.diasCredito} días`}
                  </Badge>
                </Td>
                <Td className="text-center font-semibold">{p.totalCompras}</Td>
                <Td>
                  <EstadoBadge estado={p.estado} />
                </Td>
                <Td>
                  <div className="flex justify-end gap-1">
                    <button
                      title="Editar proveedor"
                      onClick={() => setModal({ open: true, editing: p })}
                      className="rounded-md p-2 text-slate-500 hover:bg-slate-100"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      title="Eliminar proveedor"
                      onClick={() => borrar(p)}
                      className="rounded-md p-2 text-red-500 hover:bg-red-50"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <ProveedorModal
        key={modal.editing?.idProveedor ?? "new-proveedor"}
        open={modal.open}
        proveedor={modal.editing}
        onClose={() => setModal({ open: false, editing: null })}
        onSaved={() => {
          setModal({ open: false, editing: null });
          router.refresh();
        }}
      />
    </>
  );
}

function ProveedorModal({
  open,
  proveedor,
  onClose,
  onSaved,
}: {
  open: boolean;
  proveedor: ProveedorDTO | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(guardarProveedor, null);
  useEffect(() => {
    if (state?.ok) onSaved();
  }, [state, onSaved]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={proveedor ? "Editar Proveedor" : "Registrar Proveedor"}
      description="Datos del proveedor de materiales"
      size="lg"
    >
      <form action={formAction} className="space-y-4">
        {proveedor && <input type="hidden" name="idProveedor" value={proveedor.idProveedor} />}
        {state && !state.ok && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
            {state.error}
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="RUC" required error={fe(state, "ruc")}>
            <Input name="ruc" defaultValue={proveedor?.ruc} placeholder="20123456789" />
          </Field>
          <Field label="Razón Social" required error={fe(state, "razonSocial")} className="md:col-span-2">
            <Input
              name="razonSocial"
              defaultValue={proveedor?.razonSocial}
              placeholder="Ej: Aceros Arequipa S.A."
            />
          </Field>
        </div>

        <Field label="Dirección" error={fe(state, "direccion")}>
          <Input
            name="direccion"
            defaultValue={proveedor?.direccion ?? ""}
            placeholder="Dirección fiscal del proveedor"
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Teléfono" error={fe(state, "telefono")}>
            <Input name="telefono" defaultValue={proveedor?.telefono ?? ""} placeholder="999 999 999" />
          </Field>
          <Field label="Correo" error={fe(state, "correo")}>
            <Input
              name="correo"
              type="email"
              defaultValue={proveedor?.correo ?? ""}
              placeholder="ventas@proveedor.com"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Contacto" error={fe(state, "contactoNombre")}>
            <Input
              name="contactoNombre"
              defaultValue={proveedor?.contactoNombre ?? ""}
              placeholder="Nombre del vendedor"
            />
          </Field>
          <Field
            label="Días de crédito"
            error={fe(state, "diasCredito")}
            hint="0 = pago al contado"
          >
            <Input
              name="diasCredito"
              type="number"
              min="0"
              step="1"
              defaultValue={proveedor?.diasCredito ?? 0}
            />
          </Field>
          <Field label="Estado" error={fe(state, "estado")}>
            <Select name="estado" defaultValue={proveedor?.estado ?? "Activo"}>
              <option value="Activo">Activo</option>
              <option value="Inactivo">Inactivo</option>
            </Select>
          </Field>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200/70 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <SubmitBtn label={proveedor ? "Guardar Cambios" : "Registrar Proveedor"} />
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
