import { FileText, Clock, CheckCircle2, TrendingUp } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/search-input";
import { formatCurrency, toNumber } from "@/lib/utils";
import { publicUrlObras } from "@/lib/storage";
import { ObrasManager, type ObraDTO, type ClienteOpt, type MaterialOpt } from "./obras-manager";
import { EstadoObraFilter } from "./estado-filter";

export const dynamic = "force-dynamic";

export default async function ObrasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string }>;
}) {
  await requireUser();
  const { q, estado } = await searchParams;

  const where = {
    ...(q ? { nombreObra: { contains: q, mode: "insensitive" as const } } : {}),
    ...(estado && estado !== "todos"
      ? { estadoObra: estado as "Presupuestando" | "EnEjecucion" | "Finalizado" | "Cancelado" }
      : {}),
  };

  const [obrasRaw, clientesRaw, materialesRaw, presupuestando, enProgreso, finalizadas, activasValor] =
    await Promise.all([
      prisma.obra.findMany({
        where,
        orderBy: { creadoEn: "desc" },
        include: {
          cliente: { select: { nombreRazonSocial: true } },
          presupuesto: { include: { detalles: true } },
          pagos: { select: { montoAbonado: true } },
          archivos: { orderBy: { creadoEn: "desc" } },
        },
      }),
      prisma.cliente.findMany({
        where: { estado: "Activo" },
        select: { idCliente: true, nombreRazonSocial: true },
        orderBy: { nombreRazonSocial: "asc" },
      }),
      prisma.material.findMany({
        where: { estado: "Activo" },
        select: { idMaterial: true, codigoMaterial: true, nombre: true, cupp: true, unidadMedida: true },
        orderBy: { codigoMaterial: "asc" },
      }),
      prisma.obra.count({ where: { estadoObra: "Presupuestando" } }),
      prisma.obra.count({ where: { estadoObra: "EnEjecucion" } }),
      prisma.obra.count({ where: { estadoObra: "Finalizado" } }),
      prisma.presupuesto.aggregate({
        _sum: { montoTotal: true },
        where: { obra: { estadoObra: { in: ["EnEjecucion", "Presupuestando"] } } },
      }),
    ]);

  const obras: ObraDTO[] = obrasRaw.map((o) => {
    const montoTotal = o.presupuesto ? toNumber(o.presupuesto.montoTotal) : null;
    const totalAbonado = o.pagos.reduce((s, p) => s + toNumber(p.montoAbonado), 0);
    return {
      idObra: o.idObra,
      idCliente: o.idCliente,
      clienteNombre: o.cliente.nombreRazonSocial,
      nombreObra: o.nombreObra,
      descripcion: o.descripcion,
      tipoObra: o.tipoObra,
      ubicacion: o.ubicacion,
      fechaInicio: o.fechaInicio.toISOString(),
      fechaEntregaEstimada: o.fechaEntregaEstimada.toISOString(),
      porcentajeAvance: toNumber(o.porcentajeAvance),
      estadoObra: o.estadoObra,
      montoTotal,
      totalAbonado,
      saldoPendiente: montoTotal != null ? montoTotal - totalAbonado : 0,
      presupuesto: o.presupuesto
        ? {
            costoManoObra: toNumber(o.presupuesto.costoManoObra),
            margenGananciaPorcentaje: toNumber(o.presupuesto.margenGananciaPorcentaje),
            detalles: o.presupuesto.detalles.map((d) => ({
              idMaterial: d.idMaterial,
              cantidadRequerida: toNumber(d.cantidadRequerida),
              precioUnitarioMomento: toNumber(d.precioUnitarioMomento),
            })),
          }
        : null,
      archivos: o.archivos.map((a) => ({
        idArchivo: a.idArchivo,
        nombre: a.nombre,
        url: publicUrlObras(a.path),
        tipoMime: a.tipoMime,
        esImagen: (a.tipoMime ?? "").startsWith("image/"),
      })),
    };
  });

  const clientes: ClienteOpt[] = clientesRaw;
  const materiales: MaterialOpt[] = materialesRaw.map((m) => ({
    idMaterial: m.idMaterial,
    codigoMaterial: m.codigoMaterial,
    nombre: m.nombre,
    cupp: toNumber(m.cupp),
    unidadMedida: m.unidadMedida,
  }));

  return (
    <div>
      <PageHeader title="Gestión de Obras y Proyectos" subtitle="Administrar obras, presupuestos y proyectos" />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Presupuestando" value={presupuestando} accent="blue" icon={<FileText size={22} />} />
        <StatCard label="En Progreso" value={enProgreso} accent="orange" icon={<Clock size={22} />} />
        <StatCard label="Finalizadas" value={finalizadas} accent="green" icon={<CheckCircle2 size={22} />} />
        <StatCard
          label="Valor Total Activas"
          value={formatCurrency(toNumber(activasValor._sum.montoTotal), { decimals: 0 })}
          accent="purple"
          icon={<TrendingUp size={22} />}
        />
      </div>

      <Card className="mb-6 flex flex-col gap-3 p-4 md:flex-row md:items-center">
        <SearchInput className="flex-1" placeholder="Buscar por nombre de obra..." />
        <EstadoObraFilter />
      </Card>

      <ObrasManager obras={obras} clientes={clientes} materiales={materiales} />

      {/* datalists para inputs */}
      <datalist id="tipos-obra">
        <option value="Nave Industrial" />
        <option value="Techo Parabólico" />
        <option value="Escalera Metálica" />
        <option value="Estructura Metálica" />
        <option value="Portón / Reja" />
        <option value="Mezanine" />
      </datalist>
    </div>
  );
}
