"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, requireAdmin } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import {
  categoriaSchema,
  unidadSchema,
  ubicacionSchema,
  type ActionResult,
} from "@/lib/validations";

function err(e: unknown, dup: string): string {
  const m = e instanceof Error ? e.message : String(e);
  if (m.includes("Unique") || m.includes("P2002") || m.includes("uq_")) return dup;
  if (m.includes("Foreign key") || m.includes("P2003")) return "Hay registros que dependen de este elemento.";
  return "No se pudo completar la operación.";
}

// --------------------------- Categorías ------------------------------
export async function guardarCategoria(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireAdmin();
  const id = Number(formData.get("idCategoria")) || 0;
  const parsed = categoriaSchema.safeParse({
    nombre: formData.get("nombre"),
    descripcion: formData.get("descripcion") || undefined,
    idCategoriaPadre: formData.get("idCategoriaPadre") || undefined,
    porcentajeMerma: formData.get("porcentajeMerma") ?? 6,
    estado: formData.get("estado") || "Activo",
  });
  if (!parsed.success) {
    return { ok: false, error: "Revise los campos.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;

  // Una categoría no puede ser su propio padre (el CHECK de BD también lo impide).
  if (id && d.idCategoriaPadre === id) {
    return { ok: false, error: "Una categoría no puede ser su propia categoría padre." };
  }

  const data = {
    nombre: d.nombre,
    descripcion: d.descripcion || null,
    idCategoriaPadre: d.idCategoriaPadre ?? null,
    porcentajeMerma: d.porcentajeMerma,
    estado: d.estado,
  };
  try {
    const cat = id
      ? await prisma.categoria.update({ where: { idCategoria: id }, data })
      : await prisma.categoria.create({ data });
    await registrarAuditoria({
      tabla: "Categorias",
      idRegistro: cat.idCategoria,
      accion: id ? "UPDATE" : "INSERT",
      idUsuario: user.sub,
      datosNuevos: { nombre: d.nombre, porcentajeMerma: d.porcentajeMerma },
    });
    revalidatePath("/almacen");
    revalidatePath("/inventario");
    return { ok: true, message: id ? "Categoría actualizada." : "Categoría creada." };
  } catch (e) {
    return { ok: false, error: err(e, "Ya existe una categoría con ese nombre bajo el mismo padre.") };
  }
}

export async function eliminarCategoria(id: number): Promise<ActionResult> {
  const user = await requireAdmin();
  try {
    const [materiales, hijas] = await Promise.all([
      prisma.material.count({ where: { idCategoria: id } }),
      prisma.categoria.count({ where: { idCategoriaPadre: id } }),
    ]);
    if (materiales > 0 || hijas > 0) {
      // Tiene dependencias: baja lógica para no romper la trazabilidad.
      await prisma.categoria.update({ where: { idCategoria: id }, data: { estado: "Inactivo" } });
      await registrarAuditoria({ tabla: "Categorias", idRegistro: id, accion: "UPDATE", idUsuario: user.sub, datosNuevos: { estado: "Inactivo" } });
      return {
        ok: true,
        message: `La categoría tiene ${materiales} material(es) y ${hijas} subcategoría(s): se desactivó en vez de eliminarla.`,
      };
    }
    await prisma.categoria.delete({ where: { idCategoria: id } });
    await registrarAuditoria({ tabla: "Categorias", idRegistro: id, accion: "DELETE", idUsuario: user.sub });
    revalidatePath("/almacen");
    return { ok: true, message: "Categoría eliminada." };
  } catch (e) {
    return { ok: false, error: err(e, "") };
  }
}

// --------------------------- Unidades --------------------------------
export async function guardarUnidad(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireAdmin();
  const id = Number(formData.get("idUnidad")) || 0;
  const parsed = unidadSchema.safeParse({
    simbolo: formData.get("simbolo"),
    nombre: formData.get("nombre"),
    tipo: formData.get("tipo"),
    factorBase: formData.get("factorBase") ?? 1,
    estado: formData.get("estado") || "Activo",
  });
  if (!parsed.success) {
    return { ok: false, error: "Revise los campos.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  try {
    const u = id
      ? await prisma.unidadMedida.update({ where: { idUnidad: id }, data: parsed.data })
      : await prisma.unidadMedida.create({ data: parsed.data });
    await registrarAuditoria({
      tabla: "Unidades_Medida",
      idRegistro: u.idUnidad,
      accion: id ? "UPDATE" : "INSERT",
      idUsuario: user.sub,
    });
    revalidatePath("/almacen");
    return { ok: true, message: id ? "Unidad actualizada." : "Unidad creada." };
  } catch (e) {
    return { ok: false, error: err(e, "Ya existe una unidad con ese símbolo.") };
  }
}

export async function eliminarUnidad(id: number): Promise<ActionResult> {
  const user = await requireAdmin();
  const enUso = await prisma.material.count({ where: { idUnidad: id } });
  if (enUso > 0) {
    await prisma.unidadMedida.update({ where: { idUnidad: id }, data: { estado: "Inactivo" } });
    return { ok: true, message: `La unidad está en uso por ${enUso} material(es): se desactivó.` };
  }
  try {
    await prisma.unidadMedida.delete({ where: { idUnidad: id } });
    await registrarAuditoria({ tabla: "Unidades_Medida", idRegistro: id, accion: "DELETE", idUsuario: user.sub });
    revalidatePath("/almacen");
    return { ok: true, message: "Unidad eliminada." };
  } catch (e) {
    return { ok: false, error: err(e, "") };
  }
}

// --------------------------- Ubicaciones -----------------------------
export async function guardarUbicacion(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const id = Number(formData.get("idUbicacion")) || 0;
  const parsed = ubicacionSchema.safeParse({
    zona: formData.get("zona"),
    estante: formData.get("estante") || undefined,
    nivel: formData.get("nivel") || undefined,
    descripcion: formData.get("descripcion") || undefined,
    capacidadMax: formData.get("capacidadMax") || undefined,
    estado: formData.get("estado") || "Activo",
  });
  if (!parsed.success) {
    return { ok: false, error: "Revise los campos.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;
  const data = {
    zona: d.zona,
    estante: d.estante || null,
    nivel: d.nivel || null,
    descripcion: d.descripcion || null,
    capacidadMax: d.capacidadMax ?? null,
    estado: d.estado,
  };
  try {
    const ub = id
      ? await prisma.ubicacion.update({ where: { idUbicacion: id }, data })
      : await prisma.ubicacion.create({ data });
    await registrarAuditoria({
      tabla: "Ubicaciones",
      idRegistro: ub.idUbicacion,
      accion: id ? "UPDATE" : "INSERT",
      idUsuario: user.sub,
      datosNuevos: { zona: d.zona, estante: d.estante, nivel: d.nivel },
    });
    revalidatePath("/almacen");
    revalidatePath("/inventario");
    return { ok: true, message: id ? "Ubicación actualizada." : "Ubicación creada." };
  } catch (e) {
    return { ok: false, error: err(e, "Ya existe esa combinación de zona/estante/nivel.") };
  }
}

export async function eliminarUbicacion(id: number): Promise<ActionResult> {
  const user = await requireUser();
  const enUso = await prisma.material.count({ where: { idUbicacion: id } });
  if (enUso > 0) {
    return {
      ok: false,
      error: `No se puede eliminar: hay ${enUso} material(es) almacenados aquí. Reubícalos primero.`,
    };
  }
  try {
    await prisma.ubicacion.delete({ where: { idUbicacion: id } });
    await registrarAuditoria({ tabla: "Ubicaciones", idRegistro: id, accion: "DELETE", idUsuario: user.sub });
    revalidatePath("/almacen");
    return { ok: true, message: "Ubicación eliminada." };
  } catch (e) {
    return { ok: false, error: err(e, "") };
  }
}

/** Reubica un material a otra zona/estante/nivel del local. */
export async function reubicarMaterial(idMaterial: number, idUbicacion: number | null): Promise<ActionResult> {
  const user = await requireUser();
  try {
    const antes = await prisma.material.findUnique({
      where: { idMaterial },
      select: { idUbicacion: true, nombre: true },
    });
    await prisma.material.update({ where: { idMaterial }, data: { idUbicacion } });
    await registrarAuditoria({
      tabla: "Materiales",
      idRegistro: idMaterial,
      accion: "UPDATE",
      idUsuario: user.sub,
      datosAnteriores: { idUbicacion: antes?.idUbicacion },
      datosNuevos: { idUbicacion },
    });
    revalidatePath("/almacen");
    revalidatePath("/inventario");
    return { ok: true, message: "Material reubicado." };
  } catch (e) {
    return { ok: false, error: err(e, "") };
  }
}
