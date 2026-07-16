import { Package, DollarSign, TrendingUp, Calculator } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { toNumber, formatCurrency } from "@/lib/utils";
import { PreciosManager, type MaterialDTO } from "./precios-manager";

export const dynamic = "force-dynamic";

export default async function PreciosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string }>;
}) {
  await requireUser();
  const { q, cat } = await searchParams;

  const where = {
    ...(q
      ? {
          OR: [
            { codigoMaterial: { contains: q, mode: "insensitive" as const } },
            { nombre: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(cat ? { categoria: { nombre: cat } } : {}),
  };

  const [materialesRaw, categoriasRaw] = await Promise.all([
    prisma.material.findMany({
      where,
      include: { categoria: true, unidad: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.categoria.findMany({
      where: { estado: "Activo" },
      orderBy: { nombre: "asc" },
      select: { nombre: true },
    }),
  ]);

  const categorias = categoriasRaw.map((c) => c.nombre);

  const materiales: MaterialDTO[] = materialesRaw.map((m) => {
    const stockActual = toNumber(m.stockActual);
    const stockMinimo = toNumber(m.stockMinimo);
    const cupp = toNumber(m.cupp);
    return {
      idMaterial: m.idMaterial,
      codigoMaterial: m.codigoMaterial,
      nombre: m.nombre,
      categoria: m.categoria.nombre,
      unidadMedida: m.unidad.simbolo,
      stockActual,
      stockMinimo,
      cupp,
      valorTotal: stockActual * cupp,
      bajoStock: stockActual <= stockMinimo,
      actualizadoEn: m.actualizadoEn.toISOString(),
    };
  });

  const totalMateriales = materiales.length;
  const valorInventario = materiales.reduce((acc, m) => acc + m.valorTotal, 0);
  const bajoStock = materiales.filter((m) => m.bajoStock).length;
  const costoPromedio =
    totalMateriales > 0 ? materiales.reduce((acc, m) => acc + m.cupp, 0) / totalMateriales : 0;

  return (
    <div>
      <PageHeader
        title="Gestión de Precios y Costos"
        subtitle="Control y seguimiento del costo unitario promedio ponderado (CUPP)"
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Materiales"
          value={totalMateriales}
          hint="Activos en sistema"
          accent="blue"
          icon={<Package size={22} />}
        />
        <StatCard
          label="Valor Inventario"
          value={formatCurrency(valorInventario)}
          hint="Total valorizado"
          accent="green"
          icon={<DollarSign size={22} />}
        />
        <StatCard
          label="Materiales Bajo Stock"
          value={bajoStock}
          hint="Requieren reposición"
          accent="orange"
          icon={<TrendingUp size={22} />}
        />
        <StatCard
          label="Costo Promedio"
          value={formatCurrency(costoPromedio)}
          hint="Por unidad general"
          accent="purple"
          icon={<Calculator size={22} />}
        />
      </div>

      <PreciosManager materiales={materiales} categorias={categorias} categoriaActual={cat} />
    </div>
  );
}
