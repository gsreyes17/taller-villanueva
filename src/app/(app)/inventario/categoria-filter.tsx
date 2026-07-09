"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/field";

export function CategoriaFilter({ categorias }: { categorias: string[] }) {
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
    <div className="flex gap-3">
      <Select
        defaultValue={params.get("cat") ?? "todos"}
        onChange={(e) => setParam("cat", e.target.value)}
        className="min-w-40"
      >
        <option value="todos">Todas las categorías</option>
        {categorias.map((c) => (
          <option key={c} value={c}>
            {c}
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
