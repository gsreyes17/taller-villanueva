"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { usuarioCreateSchema, usuarioUpdateSchema, type ActionResult } from "@/lib/validations";

export async function crearUsuario(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireAdmin();

  const parsed = usuarioCreateSchema.safeParse({
    nombre: formData.get("nombre"),
    apellido: formData.get("apellido"),
    nombreUsuario: formData.get("nombreUsuario"),
    contrasena: formData.get("contrasena"),
    confirmarContrasena: formData.get("confirmarContrasena"),
    rol: formData.get("rol"),
    estado: formData.get("estado") || "Activo",
  });
  if (!parsed.success) {
    return { ok: false, error: "Revise los campos.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const d = parsed.data;
  try {
    const contrasenaHash = await bcrypt.hash(d.contrasena, 10);
    const usuario = await prisma.usuario.create({
      data: {
        nombre: d.nombre,
        apellido: d.apellido,
        nombreUsuario: d.nombreUsuario,
        contrasenaHash,
        rol: d.rol,
        estado: d.estado,
      },
    });
    await registrarAuditoria({
      tabla: "Usuarios",
      idRegistro: usuario.idUsuario,
      accion: "INSERT",
      idUsuario: user.sub,
      datosNuevos: {
        nombreUsuario: usuario.nombreUsuario,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        rol: usuario.rol,
        estado: usuario.estado,
      },
    });
    revalidatePath("/usuarios");
    return { ok: true, message: "Usuario registrado correctamente." };
  } catch (e) {
    return { ok: false, error: errorMsg(e) };
  }
}

export async function actualizarUsuario(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireAdmin();

  const parsed = usuarioUpdateSchema.safeParse({
    idUsuario: formData.get("idUsuario"),
    nombre: formData.get("nombre"),
    apellido: formData.get("apellido"),
    rol: formData.get("rol"),
    estado: formData.get("estado"),
    contrasena: formData.get("contrasena") || "",
  });
  if (!parsed.success) {
    return { ok: false, error: "Revise los campos.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const d = parsed.data;

  // Un administrador no puede desactivarse a sí mismo.
  if (d.idUsuario === user.sub && d.estado === "Inactivo") {
    return { ok: false, error: "No puede desactivar su propia cuenta." };
  }

  try {
    const data: {
      nombre: string;
      apellido: string;
      rol: "Administrador" | "Trabajador";
      estado: "Activo" | "Inactivo";
      contrasenaHash?: string;
    } = {
      nombre: d.nombre,
      apellido: d.apellido,
      rol: d.rol,
      estado: d.estado,
    };

    // Solo re-hashear si se envió una contraseña nueva.
    if (d.contrasena && d.contrasena.length > 0) {
      data.contrasenaHash = await bcrypt.hash(d.contrasena, 10);
    }

    await prisma.usuario.update({
      where: { idUsuario: d.idUsuario },
      data,
    });
    await registrarAuditoria({
      tabla: "Usuarios",
      idRegistro: d.idUsuario,
      accion: "UPDATE",
      idUsuario: user.sub,
      datosNuevos: {
        nombre: d.nombre,
        apellido: d.apellido,
        rol: d.rol,
        estado: d.estado,
        contrasenaCambiada: Boolean(d.contrasena),
      },
    });
    revalidatePath("/usuarios");
    return { ok: true, message: "Usuario actualizado." };
  } catch (e) {
    return { ok: false, error: errorMsg(e) };
  }
}

export async function eliminarUsuario(id: number): Promise<ActionResult> {
  const user = await requireAdmin();

  // Un administrador no puede eliminarse a sí mismo.
  if (id === user.sub) {
    return { ok: false, error: "No puede eliminar su propia cuenta." };
  }

  try {
    await prisma.usuario.delete({ where: { idUsuario: id } });
    await registrarAuditoria({
      tabla: "Usuarios",
      idRegistro: id,
      accion: "DELETE",
      idUsuario: user.sub,
    });
    revalidatePath("/usuarios");
    return { ok: true, message: "Usuario eliminado." };
  } catch (e) {
    return { ok: false, error: errorMsg(e) };
  }
}

function errorMsg(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("Unique") || msg.includes("P2002")) {
    return "Ya existe un usuario con ese nombre de usuario.";
  }
  return "No se pudo completar la operación.";
}
