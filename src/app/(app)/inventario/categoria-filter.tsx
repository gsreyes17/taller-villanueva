"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/field";

export type CategoriaOpt = {
  idCategoria: number;
  nombre: string;
  padre: string | null;
  porcentajeMerma: number;
};

export function CategoriaFilter({
  categorias,
  zonas,
}: {
  categorias: CategoriaOpt[];
  zonas: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value && value !== "todos") next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Select
        defaultValue={params.get("cat") ?? "todos"}
        onChange={(e) => setParam("cat", e.target.value)}
        className="min-w-48"
      >
        <option value="todos">Todas las categorías</option>
        {categorias.map((c) => (
          <option key={c.idCategoria} value={c.idCategoria}>
            {c.padre ? `${c.padre} › ${c.nombre}` : c.nombre}
          </option>
        ))}
      </Select>
      <Select
        defaultValue={params.get("zona") ?? "todos"}
        onChange={(e) => setParam("zona", e.target.value)}
        className="min-w-40"
      >
        <option value="todos">Todas las zonas</option>
        {zonas.map((z) => (
          <option key={z} value={z}>
            {z}
          </option>
        ))}
      </Select>
      <Select
        defaultValue={params.get("estado") ?? "todos"}
        onChange={(e) => setParam("estado", e.target.value)}
        className="min-w-36"
      >
        <option value="todos">Todos</option>
        <option value="Activo">Activo</option>
        <option value="Descontinuado">Descontinuado</option>
      </Select>
    </div>
  );
}
