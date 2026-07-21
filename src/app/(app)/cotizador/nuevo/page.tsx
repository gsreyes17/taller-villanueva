
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CotizacionForm } from "./cotizacion-form";

export const dynamic = "force-dynamic";

export default async function NuevaCotizacionPage({
  searchParams,
}: {
  searchParams: Promise<{ productoId?: string; tipo?: string }>;
}) {
  const { productoId } = await searchParams;
  let productoPredefinido = null;

  if (productoId) {
    const prod = await prisma.productoCatalogo.findUnique({
      where: { idProducto: parseInt(productoId, 10) },
    });
    if (prod) {
      productoPredefinido = prod;
    }
  }

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
        <CotizacionForm producto={productoPredefinido} />
      </div>
    </div>
  );
}
