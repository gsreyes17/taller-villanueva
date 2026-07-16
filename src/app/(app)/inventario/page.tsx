import { Boxes, TrendingUp, AlertTriangle, ArrowDownToLine } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/search-input";
import { formatCurrency, toNumber } from "@/lib/utils";
import { InventarioManager, type MaterialDTO } from "./inventario-manager";
import { CategoriaFilter } from "./categoria-filter";

export const dynamic = "force-dynamic";

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string; estado?: string; zona?: string }>;
}) {
  await requireUser();
  const { q, cat, estado, zona } = await searchParams;

  const where = {
    ...(q
      ? {
          OR: [
            { codigoMaterial: { contains: q, mode: "insensitive" as const } },
            { nombre: { contains: q, mode: "insensitive" as const } },
            { norma: { contains: q, mode: "insensitive" as const } },
            { medidas: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(cat && cat !== "todos" ? { idCategoria: Number(cat) } : {}),
    ...(zona && zona !== "todos" ? { ubicacion: { zona } } : {}),
    ...(estado && estado !== "todos" ? { estado: estado as "Activo" | "Descontinuado" } : {}),
  };

  const hace7dias = new Date(Date.now() - 7 * 86400_000);
  const conCatalogos = {
    categoria: { include: { padre: true } },
    unidad: true,
    ubicacion: true,
  } as const;

  const [materialesRaw, todos, entradasSemana, categorias, unidades, ubicaciones] = await Promise.all([
    prisma.material.findMany({ where, include: conCatalogos, orderBy: { codigoMaterial: "asc" } }),
    prisma.material.findMany({ select: { stockActual: true, stockMinimo: true, cupp: true, estado: true } }),
    prisma.movimientoInventario.count({
      where: { tipoMovimiento: "Entrada", fechaMovimiento: { gte: hace7dias } },
    }),
    prisma.categoria.findMany({
      where: { estado: "Activo" },
      include: { padre: { select: { nombre: true } } },
      orderBy: { nombre: "asc" },
    }),
    prisma.unidadMedida.findMany({ where: { estado: "Activo" }, orderBy: { simbolo: "asc" } }),
    prisma.ubicacion.findMany({
      where: { estado: "Activo" },
      orderBy: [{ zona: "asc" }, { estante: "asc" }, { nivel: "asc" }],
    }),
  ]);

  const materiales: MaterialDTO[] = materialesRaw.map((m) => ({
    idMaterial: m.idMaterial,
    codigoMaterial: m.codigoMaterial,
    nombre: m.nombre,
    descripcion: m.descripcion,
    idCategoria: m.idCategoria,
    categoriaNombre: m.categoria.nombre,
    categoriaPadre: m.categoria.padre?.nombre ?? null,
    idUnidad: m.idUnidad,
    unidadSimbolo: m.unidad.simbolo,
    idUbicacion: m.idUbicacion,
    ubicacionLabel: m.ubicacion
      ? [m.ubicacion.zona, m.ubicacion.estante, m.ubicacion.nivel].filter(Boolean).join(" · ")
      : null,
    norma: m.norma,
    espesorMm: m.espesorMm == null ? null : toNumber(m.espesorMm),
    medidas: m.medidas,
    acabado: m.acabado,
    pesoUnitario: m.pesoUnitario == null ? null : toNumber(m.pesoUnitario),
    stockActual: toNumber(m.stockActual),
    stockMinimo: toNumber(m.stockMinimo),
    stockMaximo: m.stockMaximo == null ? null : toNumber(m.stockMaximo),
    cupp: toNumber(m.cupp),
    porcentajeMerma: m.porcentajeMerma == null ? null : toNumber(m.porcentajeMerma),
    mermaEfectiva: toNumber(m.porcentajeMerma ?? m.categoria.porcentajeMerma),
    estado: m.estado,
  }));

  const catalogos = {
    categorias: categorias.map((c) => ({
      idCategoria: c.idCategoria,
      nombre: c.nombre,
      padre: c.padre?.nombre ?? null,
      porcentajeMerma: toNumber(c.porcentajeMerma),
    })),
    unidades: unidades.map((u) => ({ idUnidad: u.idUnidad, simbolo: u.simbolo, nombre: u.nombre })),
    ubicaciones: ubicaciones.map((u) => ({
      idUbicacion: u.idUbicacion,
      label: [u.zona, u.estante, u.nivel].filter(Boolean).join(" · "),
    })),
  };

  const activos = todos.filter((m) => m.estado === "Activo");
  const valorTotal = activos.reduce((s, m) => s + toNumber(m.stockActual) * toNumber(m.cupp), 0);
  const bajoStock = activos.filter((m) => toNumber(m.stockActual) <= toNumber(m.stockMinimo)).length;
  const zonas = Array.from(new Set(ubicaciones.map((u) => u.zona)));

  return (
    <div>
      <PageHeader title="Gestión de Inventario" subtitle="Administrar materiales y stock" />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Materiales" value={activos.length} accent="blue" icon={<Boxes size={22} />} />
        <StatCard label="Valor Total" value={formatCurrency(valorTotal, { decimals: 0 })} accent="green" icon={<TrendingUp size={22} />} />
        <StatCard label="Bajo Stock Mínimo" value={bajoStock} accent="orange" icon={<AlertTriangle size={22} />} />
        <StatCard label="Entradas Esta Semana" value={entradasSemana} accent="purple" icon={<ArrowDownToLine size={22} />} />
      </div>

      {bajoStock > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/70 px-4 py-3">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-red-500" />
          <p className="text-sm text-red-800">
            <strong>{bajoStock} materiales</strong> están bajo el stock mínimo. Se recomienda generar
            órdenes de compra.
          </p>
        </div>
      )}

      <Card className="mb-6 flex flex-col gap-3 p-4 md:flex-row md:items-center">
        <SearchInput className="flex-1" placeholder="Buscar por código, nombre, norma o medidas..." />
        <CategoriaFilter categorias={catalogos.categorias} zonas={zonas} />
      </Card>

      <InventarioManager materiales={materiales} catalogos={catalogos} />
    </div>
  );
}
