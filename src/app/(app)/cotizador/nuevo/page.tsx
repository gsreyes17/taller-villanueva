
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { toNumber } from "@/lib/utils";
import { CotizacionForm } from "./cotizacion-form";

export const dynamic = "force-dynamic";

export default async function NuevaCotizacionPage({
  searchParams,
}: {
  searchParams: Promise<{ productoId?: string; tipo?: string }>;
}) {
  await requireUser();
  const { productoId } = await searchParams;

  const [prodRaw, clientes] = await Promise.all([
    productoId
      ? prisma.productoCatalogo.findUnique({ where: { idProducto: parseInt(productoId, 10) } })
      : Promise.resolve(null),
    prisma.cliente.findMany({
      where: { estado: "Activo" },
      select: { idCliente: true, nombreRazonSocial: true, identificacionFiscal: true, telefono: true, correo: true },
      orderBy: { nombreRazonSocial: "asc" },
    }),
  ]);

  const productoPredefinido = prodRaw
    ? { nombre: prodRaw.nombre, descripcion: prodRaw.descripcion, precioBase: toNumber(prodRaw.precioBase), imagenUrl: prodRaw.imagenUrl }
    : null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/cotizador"
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-ink"
        >
          <ArrowLeft size={16} /> Volver al catálogo
        </Link>
        <h1 className="text-3xl font-bold text-ink">
          {productoPredefinido ? "Nueva Cotización" : "Cotización a Medida"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Completa los datos del cliente y los detalles técnicos para generar el PDF.
        </p>
      </div>

      <div className="max-w-4xl">
        <CotizacionForm producto={productoPredefinido} clientes={clientes} />
      </div>
    </div>
  );
}
