"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { clienteSchema, type ActionResult } from "@/lib/validations";

function parse(formData: FormData) {
  return clienteSchema.safeParse({
    tipoCliente: formData.get("tipoCliente"),
    identificacionFiscal: formData.get("identificacionFiscal"),
    nombreRazonSocial: formData.get("nombreRazonSocial"),
    direccion: formData.get("direccion"),
    distrito: formData.get("distrito") || undefined,
    telefono: formData.get("telefono"),
    telefonoSecundario: formData.get("telefonoSecundario") || undefined,
    correo: formData.get("correo") || undefined,
    correoSecundario: formData.get("correoSecundario") || undefined,
    contactoNombre: formData.get("contactoNombre") || undefined,
    contactoCargo: formData.get("contactoCargo") || undefined,
    estado: formData.get("estado") || "Activo",
  });
}

function toData(d: ReturnType<typeof clienteSchema.parse>) {
  return {
    tipoCliente: d.tipoCliente,
    identificacionFiscal: d.identificacionFiscal,
    nombreRazonSocial: d.nombreRazonSocial,
    direccion: d.direccion,
    distrito: d.distrito || null,
    telefono: d.telefono,
    telefonoSecundario: d.telefonoSecundario || null,
    correo: d.correo || null,
    correoSecundario: d.correoSecundario || null,
    contactoNombre: d.contactoNombre || null,
    contactoCargo: d.contactoCargo || null,
    estado: d.estado,
  };
}

export async function crearCliente(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = parse(formData);
  if (!parsed.success) {
    return { ok: false, error: "Revise los campos.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  try {
    const cliente = await prisma.cliente.create({
      data: { ...toData(parsed.data), creadoPor: user.sub },
    });
    await registrarAuditoria({
      tabla: "Clientes",
      idRegistro: cliente.idCliente,
      accion: "INSERT",
      idUsuario: user.sub,
      datosNuevos: { nombreRazonSocial: cliente.nombreRazonSocial, identificacionFiscal: cliente.identificacionFiscal },
    });
    revalidatePath("/clientes");
    return { ok: true, message: "Cliente registrado correctamente." };
  } catch (e) {
    return { ok: false, error: errorMsg(e, "identificación fiscal") };
  }
}

export async function actualizarCliente(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = Number(formData.get("idCliente"));
  const parsed = parse(formData);
  if (!id || !parsed.success) {
    return { ok: false, error: "Revise los campos.", fieldErrors: parsed.success ? undefined : parsed.error.flatten().fieldErrors };
  }
  try {
    await prisma.cliente.update({
      where: { idCliente: id },
      data: { ...toData(parsed.data), actualizadoPor: user.sub },
    });
    await registrarAuditoria({ tabla: "Clientes", idRegistro: id, accion: "UPDATE", idUsuario: user.sub });
    revalidatePath("/clientes");
    return { ok: true, message: "Cliente actualizado." };
  } catch (e) {
    return { ok: false, error: errorMsg(e, "identificación fiscal") };
  }
}

export async function eliminarCliente(id: number): Promise<ActionResult> {
  const user = await requireUser();
  try {
    const obras = await prisma.obra.count({ where: { idCliente: id } });
    if (obras > 0) {
      // Baja lógica si tiene obras asociadas (FK RESTRICT).
      await prisma.cliente.update({ where: { idCliente: id }, data: { estado: "Inactivo", actualizadoPor: user.sub } });
      await registrarAuditoria({ tabla: "Clientes", idRegistro: id, accion: "UPDATE", idUsuario: user.sub, datosNuevos: { estado: "Inactivo" } });
      return { ok: true, message: "El cliente tiene obras asociadas: se marcó como Inactivo." };
    }
    await prisma.cliente.delete({ where: { idCliente: id } });
    await registrarAuditoria({ tabla: "Clientes", idRegistro: id, accion: "DELETE", idUsuario: user.sub });
    revalidatePath("/clientes");
    return { ok: true, message: "Cliente eliminado." };
  } catch (e) {
    return { ok: false, error: errorMsg(e) };
  }
}

function errorMsg(e: unknown, uniqueField = "valor"): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("Unique constraint") || msg.includes("uq_") || msg.includes("P2002")) {
    return `Ya existe un registro con esa ${uniqueField}.`;
  }
  return "No se pudo completar la operación.";
}
