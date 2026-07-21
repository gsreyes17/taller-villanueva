import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "./utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateCotizacionPdf(data: any, imagenUrlStr?: string | null) {
  const doc = new jsPDF("p", "mm", "a4");

  // Colores corporativos (basados en Taller Villanueva)
  const colorPrimary: [number, number, number] = [249, 115, 22]; // #f97316 (Naranja)
  const colorSecondary: [number, number, number] = [15, 23, 42]; // #0f172a (Negro/Navy oscuro)

  // Cabecera: Logo o Nombre de la Empresa
  doc.setFontSize(22);
  doc.setTextColor(...colorSecondary);
  doc.setFont("helvetica", "bold");
  doc.text("Taller Villanueva", 14, 25);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Sistema de Gestión de Obras y Proyectos", 14, 32);
  doc.text("RUC: 20123456789 (Referencial)", 14, 38);
  doc.text("Dirección: Av. Principal 123, Lima", 14, 44);

  // Bloque: "COTIZACIÓN N° XXXX"
  doc.setFontSize(16);
  doc.setTextColor(...colorPrimary);
  doc.setFont("helvetica", "bold");
  const cotNum = String(data.idCotizacion).padStart(4, "0");
  doc.text(`COTIZACIÓN N° ${cotNum}`, 140, 25);

  doc.setFontSize(10);
  doc.setTextColor(...colorSecondary);
  doc.setFont("helvetica", "normal");
  const fecha = new Date(data.creadoEn || new Date()).toLocaleDateString("es-PE");
  doc.text(`Fecha: ${fecha}`, 140, 32);
  doc.text(`Validez: ${data.validezDias} días`, 140, 38);

  // Línea divisoria
  doc.setDrawColor(200, 200, 200);
  doc.line(14, 50, 196, 50);

  // Datos del Cliente
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Datos del Cliente:", 14, 60);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Cliente: ${data.nombreCliente}`, 14, 67);
  if (data.dniRuc) doc.text(`DNI/RUC: ${data.dniRuc}`, 14, 73);
  if (data.telefono) doc.text(`Teléfono: ${data.telefono}`, 14, 79);
  if (data.correo) doc.text(`Correo: ${data.correo}`, 14, 85);

  // Intentar agregar imagen
  if (imagenUrlStr) {
    try {
      let finalBase64 = imagenUrlStr;
      if (imagenUrlStr.startsWith("/")) {
        const res = await fetch(imagenUrlStr);
        const blob = await res.blob();
        finalBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }
      
      const formatMatch = finalBase64.match(/data:image\/([a-zA-Z0-9]+);base64,/);
      const format = formatMatch ? formatMatch[1].toUpperCase() : "JPEG";
      
      // Dibujar imagen a la derecha de los datos del cliente
      doc.addImage(finalBase64, format === "PNG" ? "PNG" : "JPEG", 130, 55, 60, 45, undefined, "FAST");
    } catch (e) {
      console.warn("No se pudo insertar la imagen en el PDF", e);
    }
  }

  // Tabla de Productos
  const tableData = [
    [
      data.cantidad.toString(),
      data.producto + (data.medidas ? `\nMedidas: ${data.medidas}` : "") + (data.descripcion ? `\nDesc: ${data.descripcion}` : ""),
      formatCurrency(data.precioUnitario),
      formatCurrency(data.precioTotal)
    ]
  ];

  autoTable(doc, {
    startY: 110,
    head: [["Cant.", "Descripción", "P. Unitario", "Total"]],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: colorSecondary, textColor: 255 },
    columnStyles: {
      0: { cellWidth: 20, halign: 'center' },
      1: { cellWidth: 100 },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 35, halign: 'right' },
    },
    styles: { fontSize: 10, cellPadding: 5 }
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable.finalY + 10;

  // Totales
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("TOTAL GENERAL:", 140, finalY);
  doc.text(formatCurrency(data.precioTotal), 175, finalY);

  // Notas finales
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  if (data.tiempoEntrega) {
    doc.text(`Tiempo estimado de entrega: ${data.tiempoEntrega}`, 14, finalY + 15);
  }
  doc.text("Gracias por su preferencia.", 14, finalY + 22);

  // Generar y descargar
  doc.save(`Cotizacion_${cotNum}_${data.nombreCliente.replace(/\s+/g, '_')}.pdf`);
}
