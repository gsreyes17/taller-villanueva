import Link from "next/link";
import { ShoppingCart, Truck, PackageCheck, Building2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/search-input";
import { cn, formatCurrency, toNumber } from "@/lib/utils";
import { ComprasManager, type CompraDTO, type ProveedorOpt, type MaterialOpt } from "./compras-manager";
import { ProveedoresManager, type ProveedorDTO } from "./proveedores-manager";

export const dynamic = "force-dynamic";

export default async function ComprasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  await requireUser();
  const { q, tab } = await searchParams;
  const activeTab = tab === "proveedores" ? "proveedores" : "compras";

  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

  const whereCompras = q
    ? {
        OR: [
          { numeroDocumento: { contains: q, mode: "insensitive" as const } },
          { proveedor: { razonSocial: { contains: q, mode: "insensitive" as const } } },
        ],
      }
    : {};

  const whereProveedores = q
    ? {
        OR: [
          { razonSocial: { contains: q, mode: "insensitive" as const } },
          { ruc: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [
    comprasRaw,
    proveedoresRaw,
    materialesRaw,
    comprasDelMes,
    totalCompradoMes,
    pendientesRecibir,
    proveedoresActivos,
  ] = await Promise.all([
    prisma.compra.findMany({
      where: whereCompras,
      orderBy: { fechaEmision: "desc" },
      include: {
        proveedor: true,
        detalles: { include: { material: { include: { unidad: true } } } },
      },
    }),
    prisma.proveedor.findMany({
      where: whereProveedores,
      orderBy: { razonSocial: "asc" },
      include: { _count: { select: { compras: true } } },
    }),
    prisma.material.findMany({
      where: { estado: "Activo" },
      select: {
        idMaterial: true,
        codigoMaterial: true,
        nombre: true,
        cupp: true,
        unidad: { select: { simbolo: true } },
      },
      orderBy: { codigoMaterial: "asc" },
    }),
    prisma.compra.count({ where: { fechaEmision: { gte: inicioMes } } }),
    prisma.compra.aggregate({
      _sum: { total: true },
      where: { estado: "Recibida", fechaEmision: { gte: inicioMes } },
    }),
    prisma.compra.count({ where: { estado: { in: ["Borrador", "Confirmada"] } } }),
    prisma.proveedor.count({ where: { estado: "Activo" } }),
  ]);

  const compras: CompraDTO[] = comprasRaw.map((c) => ({
    idCompra: c.idCompra,
    idProveedor: c.idProveedor,
    proveedorNombre: c.proveedor.razonSocial,
    numeroDocumento: c.numeroDocumento,
    fechaEmision: c.fechaEmision.toISOString(),
    fechaRecepcion: c.fechaRecepcion ? c.fechaRecepcion.toISOString() : null,
    estado: c.estado,
    subtotal: toNumber(c.subtotal),
    flete: toNumber(c.flete),
    igvPorcentaje: toNumber(c.igvPorcentaje),
    igvMonto: toNumber(c.igvMonto),
    total: toNumber(c.total),
    moneda: c.moneda,
    observaciones: c.observaciones,
    detalles: c.detalles.map((d) => ({
      idDetalleCompra: d.idDetalleCompra,
      idMaterial: d.idMaterial,
      materialNombre: d.material.nombre,
      materialCodigo: d.material.codigoMaterial,
      unidadSimbolo: d.material.unidad.simbolo,
      cantidad: toNumber(d.cantidad),
      costoUnitario: toNumber(d.costoUnitario),
      fleteProrrateado: toNumber(d.fleteProrrateado),
    })),
  }));

  const proveedores: ProveedorDTO[] = proveedoresRaw.map((p) => ({
    idProveedor: p.idProveedor,
    ruc: p.ruc,
    razonSocial: p.razonSocial,
    direccion: p.direccion,
    telefono: p.telefono,
    correo: p.correo,
    contactoNombre: p.contactoNombre,
    diasCredito: p.diasCredito,
    estado: p.estado,
    totalCompras: p._count.compras,
  }));

  // El selector de compras necesita todos los proveedores activos, no sólo los filtrados por `q`.
  const proveedoresOpt: ProveedorOpt[] = (
    await prisma.proveedor.findMany({
      where: { estado: "Activo" },
      select: { idProveedor: true, razonSocial: true, ruc: true },
      orderBy: { razonSocial: "asc" },
    })
  ).map((p) => ({ idProveedor: p.idProveedor, razonSocial: p.razonSocial, ruc: p.ruc }));

  const materiales: MaterialOpt[] = materialesRaw.map((m) => ({
    idMaterial: m.idMaterial,
    codigoMaterial: m.codigoMaterial,
    nombre: m.nombre,
    cupp: toNumber(m.cupp),
    unidadSimbolo: m.unidad.simbolo,
  }));

  return (
    <div>
      <PageHeader
        title="Compras y Proveedores"
        subtitle="Gestión de adquisiciones y costo real de materiales"
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Compras del Mes"
          value={comprasDelMes}
          accent="blue"
          icon={<ShoppingCart size={22} />}
        />
        <StatCard
          label="Total Comprado"
          value={formatCurrency(toNumber(totalCompradoMes._sum.total), { decimals: 0 })}
          hint="Compras recibidas este mes"
          accent="green"
          icon={<Truck size={22} />}
        />
        <StatCard
          label="Pendientes de Recibir"
          value={pendientesRecibir}
          accent="orange"
          icon={<PackageCheck size={22} />}
        />
        <StatCard
          label="Proveedores Activos"
          value={proveedoresActivos}
          accent="purple"
          icon={<Building2 size={22} />}
        />
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <TabLink href="?tab=compras" active={activeTab === "compras"}>
          <ShoppingCart size={16} /> Compras
        </TabLink>
        <TabLink href="?tab=proveedores" active={activeTab === "proveedores"}>
          <Building2 size={16} /> Proveedores
        </TabLink>
      </div>

      <Card className="mb-6 p-4">
        <SearchInput
          placeholder={
            activeTab === "compras"
              ? "Buscar por N° de documento o proveedor..."
              : "Buscar por razón social o RUC..."
          }
        />
      </Card>

      {activeTab === "compras" ? (
        <ComprasManager compras={compras} proveedores={proveedoresOpt} materiales={materiales} />
      ) : (
        <ProveedoresManager proveedores={proveedores} />
      )}
    </div>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors",
        active
          ? "bg-brand text-white shadow-sm"
          : "border border-slate-200 bg-white text-ink hover:bg-slate-50",
      )}
    >
      {children}
    </Link>
  );
}
