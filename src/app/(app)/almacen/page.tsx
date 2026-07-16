import * as React from "react";
import Link from "next/link";
import { Warehouse, Tags, Ruler, MapPin, Package } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { cn, toNumber } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import {
  AlmacenManager,
  type UbicacionDTO,
  type CategoriaDTO,
  type UnidadDTO,
  type MaterialDTO,
  type AlmacenTab,
} from "./almacen-manager";

export const dynamic = "force-dynamic";

export default async function AlmacenPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireUser();
  const { tab } = await searchParams;
  const activeTab: AlmacenTab =
    tab === "categorias" ? "categorias" : tab === "unidades" ? "unidades" : "ubicaciones";

  const [ubicacionesRaw, categoriasRaw, unidadesRaw, materialesRaw, sinUbicar] = await Promise.all([
    prisma.ubicacion.findMany({
      include: { _count: { select: { materiales: true } } },
      orderBy: [{ zona: "asc" }, { estante: "asc" }, { nivel: "asc" }],
    }),
    prisma.categoria.findMany({
      include: { padre: true, _count: { select: { materiales: true, hijas: true } } },
      orderBy: { nombre: "asc" },
    }),
    prisma.unidadMedida.findMany({
      include: { _count: { select: { materiales: true } } },
      orderBy: { simbolo: "asc" },
    }),
    prisma.material.findMany({
      where: { estado: "Activo" },
      select: {
        idMaterial: true,
        codigoMaterial: true,
        nombre: true,
        stockActual: true,
        idUbicacion: true,
        unidad: { select: { simbolo: true } },
      },
      orderBy: { codigoMaterial: "asc" },
    }),
    prisma.material.count({ where: { idUbicacion: null } }),
  ]);

  // Los Decimal de Prisma no son serializables hacia un client component: se
  // convierten con toNumber() antes de cruzar la frontera "use client".
  const ubicaciones: UbicacionDTO[] = ubicacionesRaw.map((u) => ({
    idUbicacion: u.idUbicacion,
    zona: u.zona,
    estante: u.estante,
    nivel: u.nivel,
    descripcion: u.descripcion,
    capacidadMax: u.capacidadMax == null ? null : toNumber(u.capacidadMax),
    estado: u.estado,
    materiales: u._count.materiales,
  }));

  const categorias: CategoriaDTO[] = categoriasRaw.map((c) => ({
    idCategoria: c.idCategoria,
    nombre: c.nombre,
    descripcion: c.descripcion,
    idCategoriaPadre: c.idCategoriaPadre,
    nombrePadre: c.padre?.nombre ?? null,
    porcentajeMerma: toNumber(c.porcentajeMerma),
    estado: c.estado,
    materiales: c._count.materiales,
    hijas: c._count.hijas,
  }));

  const unidades: UnidadDTO[] = unidadesRaw.map((u) => ({
    idUnidad: u.idUnidad,
    simbolo: u.simbolo,
    nombre: u.nombre,
    tipo: u.tipo,
    factorBase: toNumber(u.factorBase),
    estado: u.estado,
    materiales: u._count.materiales,
  }));

  const materiales: MaterialDTO[] = materialesRaw.map((m) => ({
    idMaterial: m.idMaterial,
    codigoMaterial: m.codigoMaterial,
    nombre: m.nombre,
    stockActual: toNumber(m.stockActual),
    idUbicacion: m.idUbicacion,
    simbolo: m.unidad?.simbolo ?? "",
  }));

  const zonas = new Set(ubicaciones.map((u) => u.zona)).size;

  return (
    <div>
      <PageHeader
        title="Almacén"
        subtitle="Clasificación de materiales y ubicaciones físicas del local"
      />

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Zonas"
          value={zonas}
          hint="Áreas físicas del local"
          accent="blue"
          icon={<Warehouse size={22} />}
        />
        <StatCard
          label="Ubicaciones"
          value={ubicaciones.length}
          hint="Zona / estante / nivel"
          accent="purple"
          icon={<MapPin size={22} />}
        />
        <StatCard
          label="Categorías"
          value={categorias.length}
          hint="Clasificación de materiales"
          accent="green"
          icon={<Tags size={22} />}
        />
        <StatCard
          label="Materiales sin ubicar"
          value={sinUbicar}
          hint={sinUbicar > 0 ? "Requieren asignación de ubicación" : "Todo el stock está ubicado"}
          accent="orange"
          icon={<Package size={22} />}
        />
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <TabLink href="?tab=ubicaciones" active={activeTab === "ubicaciones"}>
          <MapPin size={16} /> Ubicaciones
        </TabLink>
        <TabLink href="?tab=categorias" active={activeTab === "categorias"}>
          <Tags size={16} /> Categorías
        </TabLink>
        <TabLink href="?tab=unidades" active={activeTab === "unidades"}>
          <Ruler size={16} /> Unidades
        </TabLink>
      </div>

      <AlmacenManager
        tab={activeTab}
        ubicaciones={ubicaciones}
        categorias={categorias}
        unidades={unidades}
        materiales={materiales}
      />
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
