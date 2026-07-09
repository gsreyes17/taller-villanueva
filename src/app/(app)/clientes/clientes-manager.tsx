"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Plus, Pencil, Trash2, History } from "lucide-react";
import { crearCliente, actualizarCliente, eliminarCliente } from "./actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select } from "@/components/ui/field";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { EstadoBadge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import type { ActionResult } from "@/lib/validations";

export type ClienteDTO = {
  idCliente: number;
  tipoCliente: string;
  identificacionFiscal: string;
  nombreRazonSocial: string;
  direccion: string;
  distrito: string | null;
  telefono: string;
  telefonoSecundario: string | null;
  correo: string | null;
  correoSecundario: string | null;
  contactoNombre: string | null;
  contactoCargo: string | null;
  estado: string;
  obrasActivas: number;
};

export function ClientesManager({ clientes }: { clientes: ClienteDTO[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<ClienteDTO | null>(null);
  const [open, setOpen] = useState(false);

  function nuevo() {
    setEditing(null);
    setOpen(true);
  }
  function editar(c: ClienteDTO) {
    setEditing(c);
    setOpen(true);
  }

  async function borrar(c: ClienteDTO) {
    if (!confirm(`¿Eliminar a "${c.nombreRazonSocial}"?`)) return;
    const res = await eliminarCliente(c.idCliente);
    if (!res.ok) alert(res.error);
    else router.refresh();
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-end">
        <Button onClick={nuevo}>
          <Plus size={18} /> Registrar Cliente
        </Button>
      </div>

      <Card className="mb-6 p-4">
        <SearchInput placeholder="Buscar por nombre, RUC o razón social..." />
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-base font-semibold text-ink">
          Clientes Registrados ({clientes.length})
        </h2>
        <Table>
          <Thead>
            <tr>
              <Th>Razón Social</Th>
              <Th>RUC / DNI</Th>
              <Th>Teléfono</Th>
              <Th>Email</Th>
              <Th className="text-center">Obras Activas</Th>
              <Th>Estado</Th>
              <Th className="text-right">Acciones</Th>
            </tr>
          </Thead>
          <tbody>
            {clientes.length === 0 ? (
              <EmptyRow colSpan={7}>No hay clientes registrados.</EmptyRow>
            ) : (
              clientes.map((c) => (
                <Tr key={c.idCliente}>
                  <Td>
                    <p className="font-semibold text-ink">{c.nombreRazonSocial}</p>
                    {c.distrito && <p className="text-xs text-muted">{c.distrito}</p>}
                  </Td>
                  <Td className="text-muted">{c.identificacionFiscal}</Td>
                  <Td className="text-muted">{c.telefono}</Td>
                  <Td className="text-muted">{c.correo ?? "—"}</Td>
                  <Td className="text-center">
                    <span className="inline-flex min-w-7 justify-center rounded-md border border-slate-200 px-2 py-0.5 text-xs font-semibold">
                      {c.obrasActivas}
                    </span>
                  </Td>
                  <Td>
                    <EstadoBadge estado={c.estado} />
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      <IconBtn title="Historial" onClick={() => router.push("/reportes")}>
                        <History size={16} />
                      </IconBtn>
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

      <ClienteFormModal
        key={editing?.idCliente ?? "new"}
        open={open}
        cliente={editing}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}

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

function ClienteFormModal({
  open,
  cliente,
  onClose,
  onSaved,
}: {
  open: boolean;
  cliente: ClienteDTO | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const action = cliente ? actualizarCliente : crearCliente;
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null);

  useEffect(() => {
    if (state?.ok) onSaved();
  }, [state, onSaved]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={cliente ? "Editar Cliente" : "Registrar Nuevo Cliente"}
      description={cliente ? "Actualice los datos del cliente" : "Complete los datos del nuevo cliente"}
      size="lg"
    >
      <form action={formAction} className="space-y-5">
        {cliente && <input type="hidden" name="idCliente" value={cliente.idCliente} />}
        {state && !state.ok && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
            {state.error}
          </p>
        )}

        <SectionTitle>Información General</SectionTitle>
        <Field label="Tipo de cliente" required>
          <Select name="tipoCliente" defaultValue={cliente?.tipoCliente ?? "Empresa"}>
            <option value="PersonaNatural">Persona Natural</option>
            <option value="Empresa">Empresa</option>
          </Select>
        </Field>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Razón Social / Nombre" required error={fe(state, "nombreRazonSocial")}>
            <Input name="nombreRazonSocial" defaultValue={cliente?.nombreRazonSocial} placeholder="Ej: Constructora ABC S.A.C." />
          </Field>
          <Field label="RUC / DNI" required error={fe(state, "identificacionFiscal")}>
            <Input name="identificacionFiscal" defaultValue={cliente?.identificacionFiscal} placeholder="11 dígitos" />
          </Field>
        </div>

        <SectionTitle>Información de Contacto</SectionTitle>
        <Field label="Dirección completa" required error={fe(state, "direccion")}>
          <Input name="direccion" defaultValue={cliente?.direccion} placeholder="Av/Jr/Calle..." />
        </Field>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Distrito / Ciudad">
            <Input name="distrito" defaultValue={cliente?.distrito ?? ""} placeholder="Ej: Lima, Ate" />
          </Field>
          <Field label="Teléfono principal" required error={fe(state, "telefono")}>
            <Input name="telefono" defaultValue={cliente?.telefono} placeholder="Ej: 01-2345678" />
          </Field>
          <Field label="Teléfono secundario">
            <Input name="telefonoSecundario" defaultValue={cliente?.telefonoSecundario ?? ""} placeholder="Opcional" />
          </Field>
          <Field label="Email principal" error={fe(state, "correo")}>
            <Input name="correo" type="email" defaultValue={cliente?.correo ?? ""} placeholder="correo@ejemplo.com" />
          </Field>
          <Field label="Email secundario">
            <Input name="correoSecundario" type="email" defaultValue={cliente?.correoSecundario ?? ""} placeholder="Opcional" />
          </Field>
          <Field label="Estado">
            <Select name="estado" defaultValue={cliente?.estado ?? "Activo"}>
              <option value="Activo">Activo</option>
              <option value="Inactivo">Inactivo</option>
            </Select>
          </Field>
        </div>

        <SectionTitle>Persona de Contacto</SectionTitle>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Nombre del contacto">
            <Input name="contactoNombre" defaultValue={cliente?.contactoNombre ?? ""} placeholder="Nombre completo" />
          </Field>
          <Field label="Cargo">
            <Input name="contactoCargo" defaultValue={cliente?.contactoCargo ?? ""} placeholder="Ej: Gerente de Proyectos" />
          </Field>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200/70 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <SubmitBtn label={cliente ? "Guardar Cambios" : "Guardar Cliente"} />
        </div>
      </form>
    </Modal>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-ink">{children}</h3>;
}

export function SubmitBtn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Guardando..." : label}
    </Button>
  );
}

export function fe(state: ActionResult | null, field: string): string | undefined {
  if (state && !state.ok && state.fieldErrors) return state.fieldErrors[field]?.[0];
  return undefined;
}
