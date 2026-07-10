"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Building2,
  HardHat,
  Boxes,
  DollarSign,
  FileBarChart,
  Factory,
  LogOut,
  Settings,
} from "lucide-react";
import { logoutAction } from "@/app/(auth)/actions";
import { PerfilModal } from "@/components/layout/perfil-modal";
import { cn, initials, rolLabel } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/usuarios", label: "Usuarios", icon: Users, adminOnly: true },
  { href: "/clientes", label: "Clientes", icon: Building2 },
  { href: "/obras", label: "Obras", icon: HardHat },
  { href: "/inventario", label: "Inventario", icon: Boxes },
  { href: "/precios", label: "Precios y Costos", icon: DollarSign },
  { href: "/reportes", label: "Reportes", icon: FileBarChart },
] as const;

export function Sidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [perfilOpen, setPerfilOpen] = useState(false);

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col bg-sidebar text-slate-300 transition-all duration-200",
        collapsed ? "w-20" : "w-64",
      )}
    >
      {/* Logo — el ícono naranja contrae/expande el sidebar */}
      <div className="flex items-center gap-3 px-4 py-4">
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
          className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-lg transition-transform duration-200 hover:bg-brand-hover hover:scale-105 active:scale-95"
        >
          <Factory size={22} className="transition-transform duration-200 group-hover:rotate-6" />
        </button>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-white">Taller Villanueva</p>
            <p className="truncate text-xs text-sidebar-muted">Sistema de Gestión</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="mt-2 flex-1 space-y-1 px-3">
        {NAV.filter((n) => !("adminOnly" in n && n.adminOnly) || user.rol === "Administrador").map(
          (item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-brand text-white shadow-sm"
                    : "text-slate-300 hover:bg-sidebar-hover hover:text-white",
                  collapsed && "justify-center",
                )}
              >
                <Icon size={20} className="shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          },
        )}
      </nav>

      {/* Usuario (abre Mi Perfil) + cerrar sesión */}
      <div className="border-t border-white/10 p-3">
        <button
          onClick={() => setPerfilOpen(true)}
          title="Configurar mi perfil"
          className={cn(
            "group flex w-full items-center gap-3 rounded-lg p-1.5 text-left transition-colors hover:bg-sidebar-hover",
            collapsed && "justify-center",
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
            {initials(user.nombre, user.apellido)}
          </div>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                  {user.nombre} {user.apellido}
                </p>
                <p className="truncate text-xs text-sidebar-muted">{rolLabel(user.rol)}</p>
              </div>
              <Settings
                size={16}
                className="shrink-0 text-sidebar-muted transition-colors group-hover:text-white"
              />
            </>
          )}
        </button>

        <form action={logoutAction} className="mt-2">
          <button
            type="submit"
            title="Cerrar sesión"
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-red-600 hover:text-white",
              collapsed && "justify-center px-0",
            )}
          >
            <LogOut size={18} className="shrink-0" />
            {!collapsed && <span>Cerrar Sesión</span>}
          </button>
        </form>
      </div>

      <PerfilModal open={perfilOpen} onClose={() => setPerfilOpen(false)} />
    </aside>
  );
}
