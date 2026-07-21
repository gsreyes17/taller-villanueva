import { Calculator } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { CotizadorManager } from "./cotizador-manager";

export const dynamic = "force-dynamic";

export default async function CotizadorPage() {
  const catalogoRaw = await prisma.productoCatalogo.findMany({
    orderBy: { nombre: "asc" },
  });

  const catalogo = catalogoRaw.map((prod) => ({
    ...prod,
    precioBase: Number(prod.precioBase),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-ink flex items-center gap-2">
          <Calculator className="text-brand" /> Cotizador Rápido
        </h1>
        <p className="mt-1 text-sm text-muted">
          Selecciona un producto común del catálogo o crea una cotización a medida.
        </p>
      </div>

      <CotizadorManager catalogo={catalogo} />
    </div>
  );
}
