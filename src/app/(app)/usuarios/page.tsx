import { Users, ShieldCheck, UserCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { UsuariosManager, type UsuarioDTO } from "./usuarios-manager";

export const dynamic = "force-dynamic";

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();
  const { q } = await searchParams;

  const where = q
    ? {
        OR: [
          { nombre: { contains: q, mode: "insensitive" as const } },
          { apellido: { contains: q, mode: "insensitive" as const } },
          { nombreUsuario: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [usuariosRaw, total, administradores, activos] = await Promise.all([
    prisma.usuario.findMany({ where, orderBy: { creadoEn: "desc" } }),
    prisma.usuario.count(),
    prisma.usuario.count({ where: { rol: "Administrador" } }),
    prisma.usuario.count({ where: { estado: "Activo" } }),
  ]);

  const usuarios: UsuarioDTO[] = usuariosRaw.map((u) => ({
    idUsuario: u.idUsuario,
    nombreUsuario: u.nombreUsuario,
    nombre: u.nombre,
    apellido: u.apellido,
    correo: u.correo,
    rol: u.rol,
    estado: u.estado,
    ultimoAcceso: u.ultimoAcceso ? u.ultimoAcceso.toISOString() : null,
  }));

  return (
    <div>
      <PageHeader title="Gestión de Usuarios" subtitle="Administrar usuarios del sistema" />

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Total Usuarios" value={total} accent="blue" icon={<Users size={22} />} />
        <StatCard
          label="Administradores"
          value={administradores}
          accent="purple"
          icon={<ShieldCheck size={22} />}
        />
        <StatCard label="Activos" value={activos} accent="green" icon={<UserCheck size={22} />} />
      </div>

      <UsuariosManager usuarios={usuarios} />
    </div>
  );
}
