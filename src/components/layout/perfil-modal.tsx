"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { obtenerPerfil, actualizarPerfil, type PerfilData } from "@/app/(app)/mi-perfil/actions";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input } from "@/components/ui/field";
import { rolLabel } from "@/lib/utils";
import type { ActionResult } from "@/lib/validations";

export function PerfilModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [perfil, setPerfil] = useState<PerfilData | null>(null);
  const [cargando, setCargando] = useState(false);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(actualizarPerfil, null);

  // Carga los datos del perfil al abrir.
  useEffect(() => {
    if (!open) return;
    let activo = true;
    setCargando(true);
    obtenerPerfil()
      .then((p) => activo && setPerfil(p))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, [open]);

  // Cierra y refresca al guardar bien.
  useEffect(() => {
    if (state?.ok) {
      onClose();
      router.refresh();
    }
  }, [state, onClose, router]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Mi Perfil"
      description="Actualiza tus datos personales y tu contraseña"
      size="md"
    >
      {cargando || !perfil ? (
        <div className="flex items-center justify-center py-10 text-sm text-muted">Cargando…</div>
      ) : (
        <form action={formAction} className="space-y-5">
          {state && !state.ok && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
              {state.error}
            </p>
          )}

          <div className="flex items-center gap-3 rounded-lg bg-cream px-3 py-2 text-sm">
            <span className="font-semibold text-ink">@{perfil.nombreUsuario}</span>
            <span className="text-muted">·</span>
            <span className="text-muted">{rolLabel(perfil.rol)}</span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nombre" required error={fe(state, "nombre")}>
              <Input name="nombre" defaultValue={perfil.nombre} />
            </Field>
            <Field label="Apellido" required error={fe(state, "apellido")}>
              <Input name="apellido" defaultValue={perfil.apellido} />
            </Field>
            <Field label="Correo" error={fe(state, "correo")}>
              <Input name="correo" type="email" defaultValue={perfil.correo} placeholder="correo@ejemplo.com" />
            </Field>
            <Field label="Número de teléfono" error={fe(state, "telefono")}>
              <Input name="telefono" defaultValue={perfil.telefono} placeholder="Ej: 987654321" />
            </Field>
          </div>

          <div className="border-t border-slate-200/70 pt-4">
            <p className="mb-1 text-sm font-semibold text-ink">Cambiar contraseña</p>
            <p className="mb-3 text-xs text-muted">Déjalo en blanco si no quieres cambiarla.</p>
            <div className="space-y-4">
              <Field label="Contraseña actual" error={fe(state, "contrasenaActual")}>
                <Input name="contrasenaActual" type="password" autoComplete="current-password" placeholder="••••••••" />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Nueva contraseña" error={fe(state, "contrasenaNueva")}>
                  <Input name="contrasenaNueva" type="password" autoComplete="new-password" placeholder="Mínimo 6 caracteres" />
                </Field>
                <Field label="Confirmar nueva" error={fe(state, "confirmarContrasena")}>
                  <Input name="confirmarContrasena" type="password" autoComplete="new-password" placeholder="Repite la contraseña" />
                </Field>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-200/70 pt-4">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <SubmitBtn />
          </div>
        </form>
      )}
    </Modal>
  );
}

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Guardando…" : "Guardar Cambios"}
    </Button>
  );
}

function fe(state: ActionResult | null, field: string): string | undefined {
  if (state && !state.ok && state.fieldErrors) return state.fieldErrors[field]?.[0];
  return undefined;
}
