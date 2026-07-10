"use client";

import { useState } from "react";
import { Printer, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  const [exportando, setExportando] = useState(false);

  async function descargarPDF() {
    // En el aplicativo (Electron) generamos un PDF nativo, sin encabezado
    // "localhost/fecha" del navegador. En web caemos a imprimir → "Guardar como PDF".
    if (typeof window !== "undefined" && window.electronAPI?.exportarPDF) {
      setExportando(true);
      try {
        const res = await window.electronAPI.exportarPDF();
        if (res && res.ok === false && res.error) {
          alert("No se pudo generar el PDF: " + res.error);
        }
      } finally {
        setExportando(false);
      }
    } else {
      window.print();
    }
  }

  return (
    <div className="flex gap-2 print:hidden">
      <Button variant="secondary" onClick={() => window.print()}>
        <Printer size={16} />
        Imprimir
      </Button>
      <Button onClick={descargarPDF} disabled={exportando}>
        <Download size={16} />
        {exportando ? "Generando…" : "Descargar PDF"}
      </Button>
    </div>
  );
}
