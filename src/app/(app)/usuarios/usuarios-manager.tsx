"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Plus, Pencil, Trash2, Eye } from "lucide-react";
import { crearUsuario, actualizarUsuario, eliminarUsuario } from "./actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select } from "@/components/ui/field";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { EstadoBadge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { rolLabel, formatDateTime, initials } from "@/lib/utils";
import type { ActionResult } from "@/lib/validations";

export type UsuarioDTO = {
  idUsuario: number;
  nombreUsuario: string;
  nombre: string;
  apellido: string;
  correo: string | null;
  rol: string;
  estado: string;
  ultimoAcceso: string | null;
};

export function UsuariosManager({ usuarios }: { usuarios: UsuarioDTO[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<UsuarioDTO | null>(null);
  const [viewing, setViewing] = useState<UsuarioDTO | null>(null);
  const [open, setOpen] = useState(false);

  function nuevo() {
    setEditing(null);
    setOpen(true);
  }
  function editar(u: UsuarioDTO) {
    setEditing(u);
    setOpen(true);
  }

  async function borrar(u: UsuarioDTO) {
    if (!confirm(`¿Eliminar al usuario "${u.nombre} ${u.apellido}" (@${u.nombreUsuario})?`)) return;
    const res = await eliminarUsuario(u.idUsuario);
    if (!res.ok) alert(res.error);
    else router.refresh();
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-end">
        <Button onClick={nuevo}>
          <Plus size={18} /> Registrar Usuario
        </Button>
      </div>

      <Card className="mb-6 p-4">
        <SearchInput placeholder="Buscar por nombre o usuario..." />
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-base font-semibold text-ink">
          Usuarios Registrados ({usuarios.length})
        </h2>
        <Table>
          <Thead>
            <tr>
              <Th>Nombre Completo</Th>
              <Th>Usuario</Th>
              <Th>Rol</Th>
              <Th>Estado</Th>
              <Th>Último Acceso</Th>
              <Th className="text-right">Acciones</Th>
            </tr>
          </Thead>
          <tbody>
            {usuarios.length === 0 ? (
              <EmptyRow colSpan={6}>No hay usuarios registrados.</EmptyRow>
            ) : (
              usuarios.map((u) => (
                <Tr key={u.idUsuario}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white">
                        {initials(u.nombre, u.apellido)}
                      </span>
                      <p className="font-semibold text-ink">
                        {u.nombre} {u.apellido}
                      </p>
                    </div>
                  </Td>
                  <Td className="text-muted">@{u.nombreUsuario}</Td>
                  <Td>
                    <EstadoBadge estado={rolLabel(u.rol)} />
                  </Td>
                  <Td>
                    <EstadoBadge estado={u.estado} />
                  </Td>
                  <Td className="text-muted">
                    {u.ultimoAcceso ? formatDateTime(u.ultimoAcceso) : "—"}
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      <IconBtn title="Ver" onClick={() => setViewing(u)}>
                        <Eye size={16} />
                      </IconBtn>
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

      <UsuarioFormModal
        key={editing?.idUsuario ?? "new"}
        open={open}
        usuario={editing}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false);
          router.refresh();
        }}
      />

      <UsuarioVerModal usuario={viewing} onClose={() => setViewing(null)} />
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

function UsuarioFormModal({
  open,
  usuario,
  onClose,
  onSaved,
}: {
  open: boolean;
  usuario: UsuarioDTO | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editando = Boolean(usuario);
  const action = usuario ? actualizarUsuario : crearUsuario;
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null);

  useEffect(() => {
    if (state?.ok) onSaved();
  }, [state, onSaved]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editando ? "Editar Usuario" : "Registrar Nuevo Usuario"}
      description={
        editando ? "Actualice los datos del usuario" : "Complete los datos del nuevo usuario"
      }
      size="lg"
    >
      <form action={formAction} className="space-y-5">
        {usuario && <input type="hidden" name="idUsuario" value={usuario.idUsuario} />}
        {state && !state.ok && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
            {state.error}
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Nombre" required error={fe(state, "nombre")}>
            <Input name="nombre" defaultValue={usuario?.nombre} placeholder="Ej: Juan" />
          </Field>
          <Field label="Apellidos" required error={fe(state, "apellido")}>
            <Input name="apellido" defaultValue={usuario?.apellido} placeholder="Ej: Pérez López" />
          </Field>
        </div>

        <Field label="Nombre de usuario" required error={fe(state, "nombreUsuario")}>
          {editando ? (
            <Input value={usuario?.nombreUsuario} disabled />
          ) : (
            <Input name="nombreUsuario" placeholder="Ej: jperez" />
          )}
        </Field>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field
            label="Contraseña"
            required={!editando}
            error={fe(state, "contrasena")}
            hint={editando ? "Dejar en blanco para no cambiar" : "Mínimo 6 caracteres"}
          >
            <Input name="contrasena" type="password" placeholder="••••••••" autoComplete="new-password" />
          </Field>
          {!editando && (
            <Field
              label="Confirmar Contraseña"
              required
              error={fe(state, "confirmarContrasena")}
            >
              <Input
                name="confirmarContrasena"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </Field>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Tipo de usuario" required error={fe(state, "rol")}>
            <Select name="rol" defaultValue={usuario?.rol ?? "Trabajador"}>
              <option value="Trabajador">Empleado</option>
              <option value="Administrador">Administrador</option>
            </Select>
          </Field>
          <Field label="Estado" required error={fe(state, "estado")}>
            <Select name="estado" defaultValue={usuario?.estado ?? "Activo"}>
              <option value="Activo">Activo</option>
              <option value="Inactivo">Inactivo</option>
            </Select>
          </Field>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200/70 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <SubmitBtn label={editando ? "Guardar Cambios" : "Guardar Usuario"} />
        </div>
      </form>
    </Modal>
  );
}

function UsuarioVerModal({
  usuario,
  onClose,
}: {
  usuario: UsuarioDTO | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={Boolean(usuario)}
      onClose={onClose}
      title="Detalle de Usuario"
      size="md"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      {usuario && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-semibold text-white">
              {initials(usuario.nombre, usuario.apellido)}
            </span>
            <div>
              <p className="text-base font-semibold text-ink">
                {usuario.nombre} {usuario.apellido}
              </p>
              <p className="text-sm text-muted">@{usuario.nombreUsuario}</p>
            </div>
          </div>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DetalleItem label="Correo" value={usuario.correo ?? "—"} />
            <DetalleItem label="Rol" value={rolLabel(usuario.rol)} />
            <DetalleItem label="Estado" value={usuario.estado} />
            <DetalleItem
              label="Último Acceso"
              value={usuario.ultimoAcceso ? formatDateTime(usuario.ultimoAcceso) : "—"}
            />
          </dl>
        </div>
      )}
    </Modal>
  );
}

function DetalleItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-ink">{value}</dd>
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
