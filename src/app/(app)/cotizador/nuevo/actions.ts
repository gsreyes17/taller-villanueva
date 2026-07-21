"use server";

import { prisma } from "@/lib/prisma";

export async function saveCotizacionAction(formData: FormData) {
  const nombreCliente = formData.get("nombreCliente") as string;
  const dniRuc = formData.get("dniRuc") as string;
  const telefono = formData.get("telefono") as string;
  const correo = formData.get("correo") as string;
  const producto = formData.get("producto") as string;
  const descripcion = formData.get("descripcion") as string;
  const medidas = formData.get("medidas") as string;
  const cantidad = parseInt(formData.get("cantidad") as string, 10) || 1;
  const precioUnitario = parseFloat(formData.get("precioUnitario") as string) || 0;
  const tiempoEntrega = formData.get("tiempoEntrega") as string;
  const validezDias = parseInt(formData.get("validezDias") as string, 10) || 7;
  
  const precioTotal = cantidad * precioUnitario;

  const cotizacion = await prisma.cotizacionRapida.create({
    data: {
      nombreCliente,
      dniRuc,
      telefono,
      correo,
      producto,
      descripcion,
      medidas,
      cantidad,
      precioUnitario,
      precioTotal,
      tiempoEntrega,
      validezDias,
    },
  });

  // Returning a plain object so it can be passed to Client Component
  return {
    ...cotizacion,
    precioUnitario: Number(cotizacion.precioUnitario),
    precioTotal: Number(cotizacion.precioTotal),
  };
}
