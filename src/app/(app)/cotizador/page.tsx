import { Calculator } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { toNumber } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { CotizadorManager } from "./cotizador-manager";

export const dynamic = "force-dynamic";

export default async function CotizadorPage() {
  await requireUser();

  const [catalogoRaw, clientes] = await Promise.all([
    prisma.productoCatalogo.findMany({ orderBy: { nombre: "asc" } }),
    prisma.cliente.findMany({
      where: { estado: "Activo" },
      select: { idCliente: true, nombreRazonSocial: true, identificacionFiscal: true, telefono: true, correo: true },
      orderBy: { nombreRazonSocial: "asc" },
    }),
  ]);

  const catalogo = catalogoRaw.map((prod) => ({
    idProducto: prod.idProducto,
    nombre: prod.nombre,
    descripcion: prod.descripcion,
    precioBase: toNumber(prod.precioBase),
    imagenUrl: prod.imagenUrl,
  }));

  return (
    <div>
      <PageHeader
        title="Cotizador Rápido"
        subtitle="Genera cotizaciones en PDF a partir del catálogo o a medida"
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-muted">
            <Calculator size={14} className="text-brand" />
            {catalogo.length} productos en catálogo
          </span>
        }
      />
      <CotizadorManager catalogo={catalogo} clientes={clientes} />
    </div>
  );
}
