"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { proveedorSchema, compraSchema, type ActionResult } from "@/lib/validations";

function err(e: unknown, dup: string): string {
  const m = e instanceof Error ? e.message : String(e);
  if (m.includes("Unique") || m.includes("P2002") || m.includes("uq_")) return dup;
  return "No se pudo completar la operación.";
}

export async function guardarProveedor(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const id = Number(formData.get("idProveedor")) || 0;
  const parsed = proveedorSchema.safeParse({
    ruc: formData.get("ruc"),
    razonSocial: formData.get("razonSocial"),
    direccion: formData.get("direccion") || undefined,
    telefono: formData.get("telefono") || undefined,
    correo: formData.get("correo") || undefined,
    contactoNombre: formData.get("contactoNombre") || undefined,
    diasCredito: formData.get("diasCredito") ?? 0,
    estado: formData.get("estado") || "Activo",
  });
  if (!parsed.success) {
    return { ok: false, error: "Revise los campos.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;
  const data = {
    ruc: d.ruc,
    razonSocial: d.razonSocial,
    direccion: d.direccion || null,
    telefono: d.telefono || null,
    correo: d.correo || null,
    contactoNombre: d.contactoNombre || null,
    diasCredito: d.diasCredito,
    estado: d.estado,
  };
  try {
    const p = id
      ? await prisma.proveedor.update({ where: { idProveedor: id }, data })
      : await prisma.proveedor.create({ data: { ...data, creadoPor: user.sub } });
    await registrarAuditoria({
      tabla: "Proveedores",
      idRegistro: p.idProveedor,
      accion: id ? "UPDATE" : "INSERT",
      idUsuario: user.sub,
      datosNuevos: { ruc: d.ruc, razonSocial: d.razonSocial },
    });
    revalidatePath("/compras");
    return { ok: true, message: id ? "Proveedor actualizado." : "Proveedor registrado." };
  } catch (e) {
    return { ok: false, error: err(e, "Ya existe un proveedor con ese RUC.") };
  }
}

export async function eliminarProveedor(id: number): Promise<ActionResult> {
  const user = await requireUser();
  const compras = await prisma.compra.count({ where: { idProveedor: id } });
  if (compras > 0) {
    await prisma.proveedor.update({ where: { idProveedor: id }, data: { estado: "Inactivo" } });
    return { ok: true, message: `El proveedor tiene ${compras} compra(s): se desactivó en vez de eliminarlo.` };
  }
  try {
    await prisma.proveedor.delete({ where: { idProveedor: id } });
    await registrarAuditoria({ tabla: "Proveedores", idRegistro: id, accion: "DELETE", idUsuario: user.sub });
    revalidatePath("/compras");
    return { ok: true, message: "Proveedor eliminado." };
  } catch (e) {
    return { ok: false, error: err(e, "") };
  }
}


/**
 * Crea o actualiza una compra en estado Borrador.
 * El flete se prorratea entre los ítems en proporción a su importe, de modo que
 * el costo real de adquisición de cada material lo incluya (y con él, el CUPP).
 * Los totales (subtotal/IGV/total) los recalcula un trigger de BD.
 */
export async function guardarCompra(payload: {
  idCompra?: number;
  idProveedor: number;
  numeroDocumento: string;
  fechaEmision: string;
  flete: number;
  igvPorcentaje: number;
  observaciones?: string;
  detalles: { idMaterial: number; cantidad: number; costoUnitario: number }[];
}): Promise<ActionResult<number>> {
  const user = await requireUser();
  const parsed = compraSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos de compra inválidos." };
  }
  const d = parsed.data;

  // Prorrateo del flete proporcional al importe de cada línea.
  const importes = d.detalles.map((x) => x.cantidad * x.costoUnitario);
  const totalImporte = importes.reduce((s, v) => s + v, 0);
  const fleteDe = (i: number) =>
    totalImporte > 0 ? Math.round(((importes[i] / totalImporte) * d.flete) * 100) / 100 : 0;

  try {
    const idCompra = await prisma.$transaction(async (tx) => {
      if (payload.idCompra) {
        const actual = await tx.compra.findUnique({ where: { idCompra: payload.idCompra } });
        if (!actual) throw new Error("NO_EXISTE");
        // Una compra ya recibida movió stock: no se puede reeditar.
        if (actual.estado === "Recibida") throw new Error("YA_RECIBIDA");
        await tx.detalleCompra.deleteMany({ where: { idCompra: payload.idCompra } });
        await tx.compra.update({
          where: { idCompra: payload.idCompra },
          data: {
            idProveedor: d.idProveedor,
            numeroDocumento: d.numeroDocumento,
            fechaEmision: new Date(d.fechaEmision),
            flete: d.flete,
            igvPorcentaje: d.igvPorcentaje,
            observaciones: d.observaciones || null,
            detalles: {
              create: d.detalles.map((x, i) => ({
                idMaterial: x.idMaterial,
                cantidad: x.cantidad,
                costoUnitario: x.costoUnitario,
                fleteProrrateado: fleteDe(i),
              })),
            },
          },
        });
        return payload.idCompra;
      }
      const creada = await tx.compra.create({
        data: {
          idProveedor: d.idProveedor,
          numeroDocumento: d.numeroDocumento,
          fechaEmision: new Date(d.fechaEmision),
          flete: d.flete,
          igvPorcentaje: d.igvPorcentaje,
          observaciones: d.observaciones || null,
          estado: "Borrador",
          creadoPor: user.sub,
          detalles: {
            create: d.detalles.map((x, i) => ({
              idMaterial: x.idMaterial,
              cantidad: x.cantidad,
              costoUnitario: x.costoUnitario,
              fleteProrrateado: fleteDe(i),
            })),
          },
        },
      });
      return creada.idCompra;
    });

    await registrarAuditoria({
      tabla: "Compras",
      idRegistro: idCompra,
      accion: payload.idCompra ? "UPDATE" : "INSERT",
      idUsuario: user.sub,
      datosNuevos: { numeroDocumento: d.numeroDocumento, items: d.detalles.length },
    });
    revalidatePath("/compras");
    return { ok: true, data: idCompra, message: "Compra guardada." };
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    if (m === "YA_RECIBIDA") {
      return { ok: false, error: "La compra ya fue recibida y afectó el stock: no puede editarse." };
    }
    if (m === "NO_EXISTE") return { ok: false, error: "La compra no existe." };
    return { ok: false, error: err(e, "Ya existe una compra con ese N° de documento para el proveedor.") };
  }
}

/**
 * Marca la compra como Recibida. Esto dispara el trigger de BD que:
 *  1. genera las entradas del kardex (con trazabilidad a la factura), y
 *  2. recalcula el CUPP de cada material con el costo real (precio + flete).
 */
export async function recibirCompra(idCompra: number, fechaRecepcion?: string): Promise<ActionResult> {
  const user = await requireUser();
  try {
    const compra = await prisma.compra.findUnique({
      where: { idCompra },
      include: { _count: { select: { detalles: true } } },
    });
    if (!compra) return { ok: false, error: "La compra no existe." };
    if (compra.estado === "Recibida") return { ok: false, error: "Esta compra ya fue recibida." };
    if (compra.estado === "Anulada") return { ok: false, error: "No se puede recibir una compra anulada." };
    if (compra._count.detalles === 0) {
      return { ok: false, error: "La compra no tiene materiales en el detalle." };
    }

    await prisma.compra.update({
      where: { idCompra },
      data: {
        estado: "Recibida",
        fechaRecepcion: fechaRecepcion ? new Date(fechaRecepcion) : new Date(),
      },
    });
    await registrarAuditoria({
      tabla: "Compras",
      idRegistro: idCompra,
      accion: "UPDATE",
      idUsuario: user.sub,
      datosNuevos: { estado: "Recibida" },
    });
    revalidatePath("/compras");
    revalidatePath("/inventario");
    revalidatePath("/precios");
    return { ok: true, message: "Compra recibida: stock y CUPP actualizados." };
  } catch {
    return { ok: false, error: "No se pudo recibir la compra." };
  }
}

export async function cambiarEstadoCompra(
  idCompra: number,
  estado: "Borrador" | "Confirmada" | "Anulada",
): Promise<ActionResult> {
  const user = await requireUser();
  try {
    const compra = await prisma.compra.findUnique({ where: { idCompra } });
    if (!compra) return { ok: false, error: "La compra no existe." };
    if (compra.estado === "Recibida") {
      return { ok: false, error: "La compra ya fue recibida y afectó el stock: no puede cambiar de estado." };
    }
    await prisma.compra.update({ where: { idCompra }, data: { estado } });
    await registrarAuditoria({
      tabla: "Compras",
      idRegistro: idCompra,
      accion: "UPDATE",
      idUsuario: user.sub,
      datosAnteriores: { estado: compra.estado },
      datosNuevos: { estado },
    });
    revalidatePath("/compras");
    return { ok: true, message: `Compra marcada como ${estado}.` };
  } catch {
    return { ok: false, error: "No se pudo cambiar el estado." };
  }
}

export async function eliminarCompra(idCompra: number): Promise<ActionResult> {
  const user = await requireUser();
  try {
    const compra = await prisma.compra.findUnique({ where: { idCompra } });
    if (!compra) return { ok: false, error: "La compra no existe." };
    if (compra.estado === "Recibida") {
      return {
        ok: false,
        error: "No se puede eliminar una compra recibida (ya afectó el stock). Anúlala si corresponde.",
      };
    }
    await prisma.compra.delete({ where: { idCompra } });
    await registrarAuditoria({ tabla: "Compras", idRegistro: idCompra, accion: "DELETE", idUsuario: user.sub });
    revalidatePath("/compras");
    return { ok: true, message: "Compra eliminada." };
  } catch {
    return { ok: false, error: "No se pudo eliminar la compra." };
  }
}
