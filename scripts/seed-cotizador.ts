import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("🌱 Poblando catálogo de cotizador rápido...");

  const productos = [
    {
      nombre: "Puerta Enrollable de Acero",
      descripcion: "Puerta enrollable fabricada en acero galvanizado, ideal para locales comerciales y garajes.",
      precioBase: 1200.0,
      imagenUrl: "/images/Puerta Enrollable de Acero.jpg",
    },
    {
      nombre: "Reja de Seguridad para Ventana",
      descripcion: "Reja de protección fabricada en fierro cuadrado liso de 1/2 pulgada con marco en ángulo.",
      precioBase: 350.0,
      imagenUrl: "/images/Reja de Seguridad para Ventana.jpg",
    },
    {
      nombre: "Escalera Metálica de Caracol",
      descripcion: "Escalera de pasos metálicos antideslizantes con pasamanos resistente. Diseño ahorrador de espacio.",
      precioBase: 2800.0,
      imagenUrl: "/images/Escalera Metálica de Caracol.jpg",
    },
    {
      nombre: "Estructura de Techo Metálico",
      descripcion: "Tijerales y viguetas metálicas para cobertura ligera (Aluzinc o Calamina).",
      precioBase: 85.0, // precio por m2 aprox
      imagenUrl: "/images/Estructura de Techo Metálico.jpg",
    },
    {
      nombre: "Baranda de Acero Inoxidable",
      descripcion: "Baranda en tubo de acero inoxidable AISI 304, ideal para escaleras y balcones.",
      precioBase: 450.0,
      imagenUrl: "/images/Baranda de Acero Inoxidable.jpg",
    },
    {
      nombre: "Estante Metálico Multiusos",
      descripcion: "Estante de 4 niveles fabricado en ángulo ranurado, ideal para almacenes o talleres.",
      precioBase: 120.0,
      imagenUrl: "/images/Estante Metálico Multiusos.jpg",
    },
    {
      nombre: "Puerta Cortafuego",
      descripcion: "Puerta metálica con certificación RF, incluye barra antipánico y cierrapuertas.",
      precioBase: 1800.0,
      imagenUrl: "/images/Puerta Cortafuego.jpg",
    }
  ];

  await prisma.productoCatalogo.deleteMany({});

  for (const prod of productos) {
    await prisma.productoCatalogo.create({
      data: prod,
    });
  }

  console.log("✅ Catálogo poblado con 4 productos.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
