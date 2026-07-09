import { Building2, FileText, UserPlus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { ClientesManager, type ClienteDTO } from "./clientes-manager";

export const dynamic = "force-dynamic";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireUser();
  const { q } = await searchParams;

  const where = q
    ? {
        OR: [
          { nombreRazonSocial: { contains: q, mode: "insensitive" as const } },
          { identificacionFiscal: { contains: q } },
          { correo: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const now = new Date();
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);

  const [clientesRaw, totalActivos, conObras, nuevosMes] = await Promise.all([
    prisma.cliente.findMany({
      where,
      orderBy: { creadoEn: "desc" },
      include: {
        _count: {
          select: { obras: { where: { estadoObra: { in: ["EnEjecucion", "Presupuestando"] } } } },
        },
      },
    }),
    prisma.cliente.count({ where: { estado: "Activo" } }),
    prisma.cliente.count({
      where: { obras: { some: { estadoObra: { in: ["EnEjecucion", "Presupuestando"] } } } },
    }),
    prisma.cliente.count({ where: { creadoEn: { gte: inicioMes } } }),
  ]);

  const clientes: ClienteDTO[] = clientesRaw.map((c) => ({
    idCliente: c.idCliente,
    tipoCliente: c.tipoCliente,
    identificacionFiscal: c.identificacionFiscal,
    nombreRazonSocial: c.nombreRazonSocial,
    direccion: c.direccion,
    distrito: c.distrito,
    telefono: c.telefono,
    telefonoSecundario: c.telefonoSecundario,
    correo: c.correo,
    correoSecundario: c.correoSecundario,
    contactoNombre: c.contactoNombre,
    contactoCargo: c.contactoCargo,
    estado: c.estado,
    obrasActivas: c._count.obras,
  }));

  return (
    <div>
      <PageHeader title="Gestión de Clientes" subtitle="Administrar clientes y sus datos" />

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Total Clientes Activos" value={totalActivos} accent="blue" icon={<Building2 size={22} />} />
        <StatCard label="Con Obras en Progreso" value={conObras} accent="green" icon={<FileText size={22} />} />
        <StatCard label="Nuevos Este Mes" value={nuevosMes} accent="orange" icon={<UserPlus size={22} />} />
      </div>

      <ClientesManager clientes={clientes} />
    </div>
  );
}
