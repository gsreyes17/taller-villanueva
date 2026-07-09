"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/field";

export function EstadoObraFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setEstado(value: string) {
    const next = new URLSearchParams(params.toString());
    if (value && value !== "todos") next.set("estado", value);
    else next.delete("estado");
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <Select
      defaultValue={params.get("estado") ?? "todos"}
      onChange={(e) => setEstado(e.target.value)}
      className="min-w-48"
    >
      <option value="todos">Todos los estados</option>
      <option value="Presupuestando">Presupuestando</option>
      <option value="EnEjecucion">En Ejecución</option>
      <option value="Finalizado">Finalizado</option>
      <option value="Cancelado">Cancelado</option>
    </Select>
  );
}
