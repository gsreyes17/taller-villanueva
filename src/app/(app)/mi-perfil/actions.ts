"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUser, createSession } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { perfilSchema, type ActionResult } from "@/lib/validations";

export type PerfilData = {
  nombre: string;
  apellido: string;
  correo: string;
  telefono: string;
  nombreUsuario: string;
  rol: string;
};

/** Devuelve los datos editables del usuario de la sesión. */
export async function obtenerPerfil(): Promise<PerfilData> {
  const sesion = await requireUser();
  const u = await prisma.usuario.findUnique({
    where: { idUsuario: sesion.sub },
    select: { nombre: true, apellido: true, correo: true, telefono: true, nombreUsuario: true, rol: true },
  });
  return {
    nombre: u?.nombre ?? "",
    apellido: u?.apellido ?? "",
    correo: u?.correo ?? "",
    telefono: u?.telefono ?? "",
    nombreUsuario: u?.nombreUsuario ?? sesion.nombreUsuario,
    rol: u?.rol ?? sesion.rol,
  };
}

/** Actualiza el propio perfil (datos y, opcionalmente, contraseña). */
export async function actualizarPerfil(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const sesion = await requireUser();

  const parsed = perfilSchema.safeParse({
    nombre: formData.get("nombre"),
    apellido: formData.get("apellido"),
    correo: formData.get("correo") || "",
    telefono: formData.get("telefono") || "",
    contrasenaActual: formData.get("contrasenaActual") || "",
    contrasenaNueva: formData.get("contrasenaNueva") || "",
    confirmarContrasena: formData.get("confirmarContrasena") || "",
  });
  if (!parsed.success) {
    return { ok: false, error: "Revise los campos.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;

  const usuario = await prisma.usuario.findUnique({ where: { idUsuario: sesion.sub } });
  if (!usuario) return { ok: false, error: "No se encontró su usuario." };

  const data: {
    nombre: string;
    apellido: string;
    correo: string | null;
    telefono: string | null;
    contrasenaHash?: string;
  } = {
    nombre: d.nombre,
    apellido: d.apellido,
    correo: d.correo || null,
    telefono: d.telefono || null,
  };

  const quiereCambiar = Boolean(d.contrasenaNueva);
  if (quiereCambiar) {
    const valida = await bcrypt.compare(d.contrasenaActual || "", usuario.contrasenaHash);
    if (!valida) {
      return {
        ok: false,
        error: "La contraseña actual no es correcta.",
        fieldErrors: { contrasenaActual: ["Contraseña incorrecta"] },
      };
    }
    data.contrasenaHash = await bcrypt.hash(d.contrasenaNueva!, 10);
  }

  try {
    await prisma.usuario.update({ where: { idUsuario: sesion.sub }, data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unique") || msg.includes("P2002")) {
      return { ok: false, error: "Ese correo ya está en uso por otro usuario.", fieldErrors: { correo: ["Correo en uso"] } };
    }
    return { ok: false, error: "No se pudo actualizar el perfil." };
  }

  // Refresca la sesión para que el nombre/rol se reflejen sin re-login.
  await createSession({
    sub: sesion.sub,
    nombreUsuario: usuario.nombreUsuario,
    nombre: d.nombre,
    apellido: d.apellido,
    rol: usuario.rol,
  });

  await registrarAuditoria({
    tabla: "Usuarios",
    idRegistro: sesion.sub,
    accion: "UPDATE",
    idUsuario: sesion.sub,
    datosNuevos: { perfil: true, contrasenaCambiada: quiereCambiar },
  });

  revalidatePath("/", "layout");
  return { ok: true, message: quiereCambiar ? "Perfil y contraseña actualizados." : "Perfil actualizado." };
}
