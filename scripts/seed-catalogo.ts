import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../prisma/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL! }),
});

/**
 * Catálogo completo de un taller de metalmecánica peruano.
 * Precios referenciales de mercado (Lima, 2026) SIN IGV.
 * Idempotente: usa upsert / búsqueda previa.
 */

// ---------------------------------------------------------------- catálogos
const CATEGORIAS_RAIZ = [
  { nombre: "Acero estructural", descripcion: "Perfiles, planchas, tubos y barras", merma: 6 },
  { nombre: "Consumibles", descripcion: "Soldadura, abrasivos, gases", merma: 3 },
  { nombre: "Fijaciones", descripcion: "Pernos, tornillos, anclajes", merma: 2 },
  { nombre: "Acabados", descripcion: "Pinturas, solventes, recubrimientos", merma: 5 },
  { nombre: "Herramientas", descripcion: "Equipos y herramientas del taller", merma: 0 },
  { nombre: "Seguridad", descripcion: "Equipos de protección personal (EPP)", merma: 0 },
  { nombre: "Accesorios", descripcion: "Elementos ornamentales y complementos", merma: 3 },
];

const SUBCATEGORIAS = [
  // Acero estructural
  { nombre: "Perfiles", padre: "Acero estructural", merma: 6, desc: "Perfiles C, L, T, H, U" },
  { nombre: "Planchas", padre: "Acero estructural", merma: 12, desc: "Planchas LAC, LAF, estriadas" },
  { nombre: "Tubos", padre: "Acero estructural", merma: 6, desc: "Tubos cuadrados, rectangulares, redondos" },
  { nombre: "Barras", padre: "Acero estructural", merma: 5, desc: "Barras lisas, corrugadas, cuadradas" },
  { nombre: "Mallas y expandidos", padre: "Acero estructural", merma: 10, desc: "Malla electrosoldada, metal desplegado" },
  { nombre: "Inoxidable", padre: "Acero estructural", merma: 8, desc: "Acero inoxidable AISI 304/316" },
  // Consumibles
  { nombre: "Soldadura", padre: "Consumibles", merma: 3, desc: "Electrodos y alambres" },
  { nombre: "Abrasivos", padre: "Consumibles", merma: 2, desc: "Discos de corte y desbaste" },
  { nombre: "Gases", padre: "Consumibles", merma: 1, desc: "Oxígeno, argón, CO2, acetileno" },
  { nombre: "Brocas y machos", padre: "Consumibles", merma: 2, desc: "Brocas HSS, machos de roscar" },
  // Fijaciones
  { nombre: "Pernería", padre: "Fijaciones", merma: 2, desc: "Pernos, tuercas, arandelas" },
  { nombre: "Tornillería", padre: "Fijaciones", merma: 2, desc: "Autoperforantes, tirafones" },
  { nombre: "Anclajes", padre: "Fijaciones", merma: 2, desc: "Anclajes expansivos y químicos" },
  // Acabados
  { nombre: "Pinturas", padre: "Acabados", merma: 5, desc: "Base, esmalte, anticorrosivo" },
  { nombre: "Solventes", padre: "Acabados", merma: 4, desc: "Thinner, diluyentes" },
  // Herramientas
  { nombre: "Eléctricas", padre: "Herramientas", merma: 0, desc: "Esmeriles, taladros, soldadoras" },
  { nombre: "Manuales", padre: "Herramientas", merma: 0, desc: "Llaves, martillos, prensas" },
  { nombre: "Medición", padre: "Herramientas", merma: 0, desc: "Wincha, escuadra, nivel, calibrador" },
  // Seguridad
  { nombre: "EPP", padre: "Seguridad", merma: 0, desc: "Caretas, guantes, lentes, botas" },
  // Accesorios
  { nombre: "Ornamental", padre: "Accesorios", merma: 3, desc: "Puntas, volutas, canastillas" },
  { nombre: "Herrajes", padre: "Accesorios", merma: 2, desc: "Bisagras, cerraduras, ruedas" },
];

const UBICACIONES = [
  { zona: "Zona A", estante: "Rack 1", nivel: "Nivel 1", desc: "Perfiles largos — acceso con puente grúa" },
  { zona: "Zona A", estante: "Rack 1", nivel: "Nivel 2", desc: "Perfiles medianos" },
  { zona: "Zona A", estante: "Rack 2", nivel: "Nivel 1", desc: "Tubos estructurales" },
  { zona: "Zona A", estante: "Rack 2", nivel: "Nivel 2", desc: "Barras y varillas" },
  { zona: "Zona B", estante: "Caballete 1", nivel: null, desc: "Planchas en horizontal" },
  { zona: "Zona B", estante: "Caballete 2", nivel: null, desc: "Planchas de gran formato" },
  { zona: "Zona B", estante: "Caballete 3", nivel: null, desc: "Mallas y metal desplegado" },
  { zona: "Zona C", estante: "Anaquel 1", nivel: "Nivel 1", desc: "Consumibles de soldadura (ambiente seco)" },
  { zona: "Zona C", estante: "Anaquel 1", nivel: "Nivel 2", desc: "Discos y abrasivos" },
  { zona: "Zona C", estante: "Anaquel 2", nivel: "Nivel 1", desc: "Pernería y fijaciones" },
  { zona: "Zona C", estante: "Anaquel 2", nivel: "Nivel 2", desc: "Brocas, machos y herramienta de corte" },
  { zona: "Zona D", estante: "Gabinete 1", nivel: null, desc: "Pinturas y solventes (área ventilada)" },
  { zona: "Zona D", estante: "Gabinete 2", nivel: null, desc: "Gases comprimidos (asegurados)" },
  { zona: "Zona E", estante: null, nivel: null, desc: "Patio — recepción y material sin clasificar" },
  { zona: "Zona F", estante: "Tablero 1", nivel: null, desc: "Herramientas eléctricas" },
  { zona: "Zona F", estante: "Tablero 2", nivel: null, desc: "Herramientas manuales y medición" },
  { zona: "Zona G", estante: "Casillero 1", nivel: null, desc: "EPP — equipos de protección personal" },
  { zona: "Zona H", estante: "Vitrina 1", nivel: null, desc: "Accesorios ornamentales y herrajes" },
];

type M = {
  cod: string; nom: string; desc?: string; cat: string; uni: string; zona: string; est?: string;
  norma?: string; esp?: number; med?: string; acab?: string; peso?: number;
  stock: number; min: number; max?: number; cupp: number; merma?: number;
};

// Precios referenciales de mercado peruano 2026, SIN IGV.
const MATERIALES: M[] = [
  // ---------------- Perfiles ----------------
  { cod: "PER-001", nom: 'Perfil C 6"x2" x 3mm', desc: "Perfil estructural tipo C plegado en frío", cat: "Perfiles", uni: "m", zona: "Zona A", est: "Rack 1", norma: "ASTM A36", med: '6"x2"', esp: 3, acab: "Negro", peso: 6.71, stock: 45, min: 30, max: 200, cupp: 28.5 },
  { cod: "PER-002", nom: 'Ángulo L 2"x2" x 1/4"', desc: "Ángulo estructural de alas iguales", cat: "Perfiles", uni: "m", zona: "Zona A", est: "Rack 1", norma: "ASTM A36", med: '2"x2"', esp: 6.35, acab: "Negro", peso: 4.75, stock: 60, min: 24, max: 180, cupp: 22.4 },
  { cod: "PER-003", nom: 'Ángulo L 1"x1" x 1/8"', desc: "Ángulo liviano para marcos", cat: "Perfiles", uni: "m", zona: "Zona A", est: "Rack 1", norma: "ASTM A36", med: '1"x1"', esp: 3.17, acab: "Negro", peso: 1.19, stock: 80, min: 40, max: 250, cupp: 7.2 },
  { cod: "PER-004", nom: 'Perfil U 4"x2" x 3mm', desc: "Canal U estructural", cat: "Perfiles", uni: "m", zona: "Zona A", est: "Rack 1", norma: "ASTM A36", med: '4"x2"', esp: 3, acab: "Negro", peso: 4.9, stock: 30, min: 18, max: 120, cupp: 19.8 },
  { cod: "PER-005", nom: 'Platina 1"x1/8"', desc: "Platina de acero para refuerzos", cat: "Perfiles", uni: "m", zona: "Zona A", est: "Rack 1", norma: "ASTM A36", med: '1"x1/8"', esp: 3.17, acab: "Negro", peso: 0.63, stock: 120, min: 50, max: 300, cupp: 3.9 },
  { cod: "PER-006", nom: 'Platina 2"x1/4"', desc: "Platina para bases y placas", cat: "Perfiles", uni: "m", zona: "Zona A", est: "Rack 1", norma: "ASTM A36", med: '2"x1/4"', esp: 6.35, acab: "Negro", peso: 2.53, stock: 40, min: 20, max: 150, cupp: 11.5 },
  // ---------------- Tubos ----------------
  { cod: "TUB-001", nom: 'Tubo Cuadrado 2"x2" x 2mm', desc: "Tubo estructural cuadrado LAF", cat: "Tubos", uni: "m", zona: "Zona A", est: "Rack 2", norma: "ASTM A500", med: '2"x2"', esp: 2, acab: "Negro", peso: 3.05, stock: 55, min: 25, max: 150, cupp: 15.8 },
  { cod: "TUB-002", nom: 'Tubo Redondo Ø 2" x 2mm', desc: "Tubo estructural redondo", cat: "Tubos", uni: "m", zona: "Zona A", est: "Rack 2", norma: "ASTM A53", med: 'Ø 2"', esp: 2, acab: "Galvanizado", peso: 2.93, stock: 36, min: 20, max: 120, cupp: 19.9 },
  { cod: "TUB-003", nom: 'Tubo Cuadrado 1"x1" x 1.5mm', desc: "Tubo liviano para rejas y marcos", cat: "Tubos", uni: "m", zona: "Zona A", est: "Rack 2", norma: "ASTM A500", med: '1"x1"', esp: 1.5, acab: "Negro", peso: 1.12, stock: 150, min: 60, max: 400, cupp: 5.6 },
  { cod: "TUB-004", nom: 'Tubo Rectangular 2"x1" x 1.5mm', desc: "Tubo rectangular para estructuras livianas", cat: "Tubos", uni: "m", zona: "Zona A", est: "Rack 2", norma: "ASTM A500", med: '2"x1"', esp: 1.5, acab: "Negro", peso: 1.7, stock: 90, min: 40, max: 250, cupp: 8.4 },
  { cod: "TUB-005", nom: 'Tubo Redondo Ø 1" x 1.5mm', desc: "Tubo para pasamanos y barandas", cat: "Tubos", uni: "m", zona: "Zona A", est: "Rack 2", norma: "ASTM A53", med: 'Ø 1"', esp: 1.5, acab: "Galvanizado", peso: 0.95, stock: 70, min: 30, max: 200, cupp: 9.3 },
  { cod: "TUB-006", nom: 'Tubo Cuadrado 3"x3" x 2.5mm', desc: "Tubo estructural para columnas", cat: "Tubos", uni: "m", zona: "Zona A", est: "Rack 2", norma: "ASTM A500", med: '3"x3"', esp: 2.5, acab: "Negro", peso: 5.72, stock: 24, min: 12, max: 100, cupp: 28.9 },
  // ---------------- Planchas ----------------
  { cod: "PLA-001", nom: "Plancha LAC 1/8\" x 4'x8'", desc: "Plancha de acero laminado en caliente", cat: "Planchas", uni: "pln", zona: "Zona B", est: "Caballete 1", norma: "ASTM A36", med: "4'x8'", esp: 3.17, acab: "Negro", peso: 29.6, stock: 12, min: 6, max: 40, cupp: 265.0 },
  { cod: "PLA-002", nom: "Plancha LAF 1/16\" x 4'x8'", desc: "Plancha laminada en frío, superficie lisa", cat: "Planchas", uni: "pln", zona: "Zona B", est: "Caballete 1", norma: "ASTM A1008", med: "4'x8'", esp: 1.5, acab: "Negro", peso: 14.2, stock: 10, min: 5, max: 30, cupp: 138.0 },
  { cod: "PLA-003", nom: "Plancha estriada 1/8\" x 4'x8'", desc: "Plancha antideslizante para escalones", cat: "Planchas", uni: "pln", zona: "Zona B", est: "Caballete 2", norma: "ASTM A36", med: "4'x8'", esp: 3.17, acab: "Estriado", peso: 32.0, stock: 6, min: 3, max: 20, cupp: 298.0 },
  { cod: "PLA-004", nom: "Plancha galvanizada 1/32\" x 4'x8'", desc: "Plancha zincada para cubiertas", cat: "Planchas", uni: "pln", zona: "Zona B", est: "Caballete 1", norma: "ASTM A653", med: "4'x8'", esp: 0.9, acab: "Galvanizado", peso: 8.5, stock: 14, min: 6, max: 40, cupp: 92.0 },
  // ---------------- Barras ----------------
  { cod: "BAR-001", nom: 'Barra lisa Ø 1/2"', desc: "Barra redonda lisa de acero", cat: "Barras", uni: "m", zona: "Zona A", est: "Rack 2", norma: "ASTM A36", med: 'Ø 1/2"', acab: "Negro", peso: 0.99, stock: 60, min: 24, max: 150, cupp: 5.4 },
  { cod: "BAR-002", nom: 'Barra cuadrada 1/2"x1/2"', desc: "Barra cuadrada para rejas ornamentales", cat: "Barras", uni: "m", zona: "Zona A", est: "Rack 2", norma: "ASTM A36", med: '1/2"x1/2"', acab: "Negro", peso: 1.27, stock: 85, min: 40, max: 200, cupp: 6.8 },
  { cod: "BAR-003", nom: "Varilla corrugada 3/8\"", desc: "Varilla de construcción grado 60", cat: "Barras", uni: "var", zona: "Zona A", est: "Rack 2", norma: "ASTM A615", med: '3/8" x 9m', peso: 5.0, stock: 30, min: 12, max: 80, cupp: 21.5 },
  // ---------------- Mallas ----------------
  { cod: "MAL-001", nom: "Malla electrosoldada 15x15 x 6mm", desc: "Malla para cerramientos y losas", cat: "Mallas y expandidos", uni: "m2", zona: "Zona B", est: "Caballete 3", norma: "ASTM A497", med: "15x15 cm", esp: 6, stock: 40, min: 20, max: 120, cupp: 18.9 },
  { cod: "MAL-002", nom: "Metal desplegado 3/4\" x 1.2x2.4m", desc: "Metal desplegado para cerramientos", cat: "Mallas y expandidos", uni: "pln", zona: "Zona B", est: "Caballete 3", med: "1.2x2.4 m", stock: 8, min: 4, max: 25, cupp: 78.0 },
  // ---------------- Inoxidable ----------------
  { cod: "INX-001", nom: 'Tubo inox Ø 1.5" x 1.2mm AISI 304', desc: "Tubo inoxidable para pasamanos", cat: "Inoxidable", uni: "m", zona: "Zona A", est: "Rack 2", norma: "AISI 304", med: 'Ø 1.5"', esp: 1.2, acab: "Inoxidable", peso: 1.4, stock: 18, min: 8, max: 60, cupp: 42.0 },
  { cod: "INX-002", nom: "Plancha inox 1/16\" x 4'x8' AISI 304", desc: "Plancha inoxidable acabado 2B", cat: "Inoxidable", uni: "pln", zona: "Zona B", est: "Caballete 1", norma: "AISI 304", med: "4'x8'", esp: 1.5, acab: "Inoxidable", peso: 14.5, stock: 3, min: 2, max: 12, cupp: 685.0 },
  // ---------------- Soldadura ----------------
  { cod: "SOL-001", nom: 'Electrodo E6011 1/8"', desc: "Electrodo celulósico para acero al carbono", cat: "Soldadura", uni: "kg", zona: "Zona C", est: "Anaquel 1", norma: "AWS E6011", med: '1/8"', stock: 18, min: 15, max: 60, cupp: 16.8 },
  { cod: "SOL-002", nom: 'Electrodo E7018 1/8"', desc: "Electrodo de bajo hidrógeno, alta resistencia", cat: "Soldadura", uni: "kg", zona: "Zona C", est: "Anaquel 1", norma: "AWS E7018", med: '1/8"', stock: 12, min: 10, max: 40, cupp: 19.5 },
  { cod: "SOL-003", nom: 'Electrodo E6013 3/32"', desc: "Electrodo rutílico para lámina delgada", cat: "Soldadura", uni: "kg", zona: "Zona C", est: "Anaquel 1", norma: "AWS E6013", med: '3/32"', stock: 14, min: 8, max: 40, cupp: 15.2 },
  { cod: "SOL-004", nom: "Alambre MIG ER70S-6 0.9mm", desc: "Alambre sólido para soldadura MIG", cat: "Soldadura", uni: "kg", zona: "Zona C", est: "Anaquel 1", norma: "AWS ER70S-6", med: "0.9 mm", stock: 15, min: 6, max: 45, cupp: 13.9 },
  { cod: "SOL-005", nom: 'Varilla TIG inox ER308L 1/16"', desc: "Varilla de aporte para inoxidable", cat: "Soldadura", uni: "kg", zona: "Zona C", est: "Anaquel 1", norma: "AWS ER308L", med: '1/16"', stock: 4, min: 2, max: 15, cupp: 68.0 },
  // ---------------- Abrasivos ----------------
  { cod: "ABR-001", nom: 'Disco de corte 7" x 1/8"', desc: "Disco abrasivo para corte de metal", cat: "Abrasivos", uni: "und", zona: "Zona C", est: "Anaquel 1", med: '7"', stock: 40, min: 20, max: 120, cupp: 5.9 },
  { cod: "ABR-002", nom: 'Disco de corte 4.5" x 1/16"', desc: "Disco delgado para corte fino", cat: "Abrasivos", uni: "und", zona: "Zona C", est: "Anaquel 1", med: '4.5"', stock: 60, min: 30, max: 150, cupp: 3.2 },
  { cod: "ABR-003", nom: 'Disco de desbaste 7" x 1/4"', desc: "Disco para desbaste de cordones", cat: "Abrasivos", uni: "und", zona: "Zona C", est: "Anaquel 1", med: '7"', stock: 25, min: 12, max: 80, cupp: 7.5 },
  { cod: "ABR-004", nom: 'Disco flap 4.5" grano 80', desc: "Disco laminado para acabado", cat: "Abrasivos", uni: "und", zona: "Zona C", est: "Anaquel 1", med: '4.5"', stock: 30, min: 15, max: 90, cupp: 6.8 },
  { cod: "ABR-005", nom: "Lija de fierro #80", desc: "Pliego de lija para preparación", cat: "Abrasivos", uni: "und", zona: "Zona C", est: "Anaquel 1", stock: 50, min: 20, max: 150, cupp: 1.6 },
  // ---------------- Gases ----------------
  { cod: "GAS-001", nom: "Oxígeno industrial 10 m³", desc: "Balón de oxígeno para corte", cat: "Gases", uni: "und", zona: "Zona D", est: "Gabinete 2", stock: 2, min: 1, max: 4, cupp: 68.0 },
  { cod: "GAS-002", nom: "Acetileno 6 kg", desc: "Balón de acetileno para corte", cat: "Gases", uni: "und", zona: "Zona D", est: "Gabinete 2", stock: 2, min: 1, max: 4, cupp: 145.0 },
  { cod: "GAS-003", nom: "Argón 6 m³", desc: "Balón de argón para TIG", cat: "Gases", uni: "und", zona: "Zona D", est: "Gabinete 2", stock: 1, min: 1, max: 3, cupp: 98.0 },
  { cod: "GAS-004", nom: "CO2 industrial 6 kg", desc: "Balón de CO2 para MIG", cat: "Gases", uni: "und", zona: "Zona D", est: "Gabinete 2", stock: 2, min: 1, max: 4, cupp: 52.0 },
  // ---------------- Brocas y machos ----------------
  { cod: "BRO-001", nom: 'Broca HSS 1/4"', desc: "Broca para acero, alta velocidad", cat: "Brocas y machos", uni: "und", zona: "Zona C", est: "Anaquel 2", med: '1/4"', stock: 12, min: 6, max: 30, cupp: 5.4 },
  { cod: "BRO-002", nom: 'Broca HSS 1/2"', desc: "Broca para acero, alta velocidad", cat: "Brocas y machos", uni: "und", zona: "Zona C", est: "Anaquel 2", med: '1/2"', stock: 8, min: 4, max: 20, cupp: 14.8 },
  { cod: "BRO-003", nom: "Juego de machos M8", desc: "Juego de machos de roscar", cat: "Brocas y machos", uni: "jgo", zona: "Zona C", est: "Anaquel 2", med: "M8", stock: 2, min: 1, max: 6, cupp: 38.0 },
  { cod: "BRO-004", nom: 'Broca cobalto 3/8"', desc: "Broca para acero inoxidable", cat: "Brocas y machos", uni: "und", zona: "Zona C", est: "Anaquel 2", med: '3/8"', stock: 6, min: 3, max: 15, cupp: 22.5 },
  // ---------------- Pernería ----------------
  { cod: "FIJ-001", nom: 'Perno hexagonal 1/2"x2" G5', desc: "Perno grado 5 con tuerca y arandela", cat: "Pernería", uni: "und", zona: "Zona C", est: "Anaquel 2", norma: "ASTM A325", med: '1/2"x2"', acab: "Galvanizado", stock: 250, min: 100, max: 600, cupp: 1.65 },
  { cod: "FIJ-002", nom: 'Perno hexagonal 3/8"x1.5" G5', desc: "Perno grado 5 con tuerca", cat: "Pernería", uni: "und", zona: "Zona C", est: "Anaquel 2", norma: "ASTM A325", med: '3/8"x1.5"', acab: "Galvanizado", stock: 300, min: 120, max: 700, cupp: 0.95 },
  { cod: "FIJ-003", nom: 'Tuerca hexagonal 1/2"', desc: "Tuerca galvanizada", cat: "Pernería", uni: "und", zona: "Zona C", est: "Anaquel 2", med: '1/2"', acab: "Galvanizado", stock: 200, min: 80, max: 500, cupp: 0.42 },
  { cod: "FIJ-004", nom: 'Arandela plana 1/2"', desc: "Arandela plana galvanizada", cat: "Pernería", uni: "und", zona: "Zona C", est: "Anaquel 2", med: '1/2"', acab: "Galvanizado", stock: 400, min: 150, max: 800, cupp: 0.18 },
  // ---------------- Tornillería ----------------
  { cod: "TOR-001", nom: 'Autoperforante #12 x 1"', desc: "Tornillo autoperforante para lámina", cat: "Tornillería", uni: "und", zona: "Zona C", est: "Anaquel 2", med: '#12 x 1"', acab: "Zincado", stock: 500, min: 200, max: 1200, cupp: 0.22 },
  { cod: "TOR-002", nom: 'Tirafón 1/4" x 3"', desc: "Tirafón para madera/metal", cat: "Tornillería", uni: "und", zona: "Zona C", est: "Anaquel 2", med: '1/4"x3"', stock: 150, min: 60, max: 400, cupp: 0.68 },
  // ---------------- Anclajes ----------------
  { cod: "ANC-001", nom: 'Anclaje expansivo 1/2" x 3"', desc: "Anclaje mecánico para concreto", cat: "Anclajes", uni: "und", zona: "Zona C", est: "Anaquel 2", med: '1/2"x3"', stock: 80, min: 30, max: 200, cupp: 3.4 },
  { cod: "ANC-002", nom: 'Anclaje químico 3/8"', desc: "Anclaje con resina epóxica", cat: "Anclajes", uni: "und", zona: "Zona C", est: "Anaquel 2", med: '3/8"', stock: 24, min: 12, max: 60, cupp: 8.9 },
  // ---------------- Pinturas ----------------
  { cod: "PIN-001", nom: "Base anticorrosiva gris", desc: "Pintura base epóxica para estructura", cat: "Pinturas", uni: "gal", zona: "Zona D", est: "Gabinete 1", acab: "Mate", stock: 8, min: 4, max: 24, cupp: 58.0 },
  { cod: "PIN-002", nom: "Esmalte sintético negro", desc: "Esmalte de acabado brillante", cat: "Pinturas", uni: "gal", zona: "Zona D", est: "Gabinete 1", acab: "Brillante", stock: 6, min: 3, max: 20, cupp: 52.0 },
  { cod: "PIN-003", nom: "Esmalte sintético blanco", desc: "Esmalte de acabado brillante", cat: "Pinturas", uni: "gal", zona: "Zona D", est: "Gabinete 1", acab: "Brillante", stock: 5, min: 3, max: 20, cupp: 52.0 },
  { cod: "PIN-004", nom: "Pintura en spray negro mate", desc: "Aerosol para retoques", cat: "Pinturas", uni: "und", zona: "Zona D", est: "Gabinete 1", stock: 12, min: 6, max: 36, cupp: 11.5 },
  { cod: "PIN-005", nom: "Zincado en frío (galvanizado)", desc: "Recubrimiento de zinc para retoque", cat: "Pinturas", uni: "gal", zona: "Zona D", est: "Gabinete 1", stock: 2, min: 1, max: 8, cupp: 96.0 },
  // ---------------- Solventes ----------------
  { cod: "SLV-001", nom: "Thinner acrílico", desc: "Diluyente para esmaltes", cat: "Solventes", uni: "gal", zona: "Zona D", est: "Gabinete 1", stock: 6, min: 3, max: 20, cupp: 24.0 },
  { cod: "SLV-002", nom: "Aguarrás mineral", desc: "Diluyente y limpiador", cat: "Solventes", uni: "gal", zona: "Zona D", est: "Gabinete 1", stock: 4, min: 2, max: 12, cupp: 19.5 },
  // ---------------- Herramientas eléctricas ----------------
  { cod: "HER-001", nom: 'Esmeril angular 4.5" 850W', desc: "Amoladora angular para corte y desbaste", cat: "Eléctricas", uni: "und", zona: "Zona F", est: "Tablero 1", stock: 3, min: 2, max: 6, cupp: 285.0 },
  { cod: "HER-002", nom: 'Esmeril angular 7" 2200W', desc: "Amoladora de gran diámetro", cat: "Eléctricas", uni: "und", zona: "Zona F", est: "Tablero 1", stock: 2, min: 1, max: 4, cupp: 520.0 },
  { cod: "HER-003", nom: "Soldadora inverter 200A", desc: "Máquina de soldar por arco (MMA/TIG)", cat: "Eléctricas", uni: "und", zona: "Zona F", est: "Tablero 1", stock: 2, min: 1, max: 4, cupp: 890.0 },
  { cod: "HER-004", nom: "Soldadora MIG 250A", desc: "Máquina de soldar con alambre continuo", cat: "Eléctricas", uni: "und", zona: "Zona F", est: "Tablero 1", stock: 1, min: 1, max: 2, cupp: 2450.0 },
  { cod: "HER-005", nom: 'Taladro percutor 1/2" 750W', desc: "Taladro para metal y concreto", cat: "Eléctricas", uni: "und", zona: "Zona F", est: "Tablero 1", stock: 2, min: 1, max: 4, cupp: 320.0 },
  { cod: "HER-006", nom: "Taladro de banco 16mm", desc: "Taladro de columna para el taller", cat: "Eléctricas", uni: "und", zona: "Zona F", est: "Tablero 1", stock: 1, min: 1, max: 2, cupp: 1150.0 },
  { cod: "HER-007", nom: 'Tronzadora metal 14"', desc: "Sierra de corte para perfiles", cat: "Eléctricas", uni: "und", zona: "Zona F", est: "Tablero 1", stock: 1, min: 1, max: 2, cupp: 780.0 },
  { cod: "HER-008", nom: "Equipo oxicorte completo", desc: "Soplete, manómetros y mangueras", cat: "Eléctricas", uni: "jgo", zona: "Zona F", est: "Tablero 1", stock: 1, min: 1, max: 2, cupp: 640.0 },
  { cod: "HER-009", nom: "Compresora 100 lt 3HP", desc: "Compresor para pintura y limpieza", cat: "Eléctricas", uni: "und", zona: "Zona F", est: "Tablero 1", stock: 1, min: 1, max: 2, cupp: 1380.0 },
  { cod: "HER-010", nom: "Pistola de pintura HVLP", desc: "Pistola gravedad para acabados", cat: "Eléctricas", uni: "und", zona: "Zona F", est: "Tablero 1", stock: 2, min: 1, max: 4, cupp: 165.0 },
  // ---------------- Herramientas manuales ----------------
  { cod: "HMA-001", nom: "Prensa tipo C 6\"", desc: "Prensa de sujeción para armado", cat: "Manuales", uni: "und", zona: "Zona F", est: "Tablero 2", stock: 8, min: 4, max: 16, cupp: 32.0 },
  { cod: "HMA-002", nom: "Prensa rápida 12\"", desc: "Sargento de apriete rápido", cat: "Manuales", uni: "und", zona: "Zona F", est: "Tablero 2", stock: 6, min: 3, max: 12, cupp: 48.0 },
  { cod: "HMA-003", nom: "Martillo de bola 2 lb", desc: "Martillo de forja", cat: "Manuales", uni: "und", zona: "Zona F", est: "Tablero 2", stock: 4, min: 2, max: 8, cupp: 38.0 },
  { cod: "HMA-004", nom: "Combo 6 lb", desc: "Martillo pesado para enderezado", cat: "Manuales", uni: "und", zona: "Zona F", est: "Tablero 2", stock: 2, min: 1, max: 4, cupp: 72.0 },
  { cod: "HMA-005", nom: "Juego de llaves mixtas 8-24mm", desc: "Set de llaves boca-corona", cat: "Manuales", uni: "jgo", zona: "Zona F", est: "Tablero 2", stock: 2, min: 1, max: 4, cupp: 145.0 },
  { cod: "HMA-006", nom: "Alicate de presión 10\"", desc: "Alicate tipo mordaza", cat: "Manuales", uni: "und", zona: "Zona F", est: "Tablero 2", stock: 4, min: 2, max: 8, cupp: 34.0 },
  { cod: "HMA-007", nom: "Cincel plano 12\"", desc: "Cincel para corte en frío", cat: "Manuales", uni: "und", zona: "Zona F", est: "Tablero 2", stock: 3, min: 2, max: 6, cupp: 22.0 },
  { cod: "HMA-008", nom: "Lima plana bastarda 10\"", desc: "Lima para acabado manual", cat: "Manuales", uni: "und", zona: "Zona F", est: "Tablero 2", stock: 5, min: 2, max: 10, cupp: 18.5 },
  { cod: "HMA-009", nom: "Piqueta para escoria", desc: "Martillo desescoriador con cepillo", cat: "Manuales", uni: "und", zona: "Zona F", est: "Tablero 2", stock: 4, min: 2, max: 8, cupp: 14.0 },
  // ---------------- Medición ----------------
  { cod: "MED-001", nom: "Wincha 5 m", desc: "Cinta métrica de acero", cat: "Medición", uni: "und", zona: "Zona F", est: "Tablero 2", stock: 5, min: 3, max: 10, cupp: 18.0 },
  { cod: "MED-002", nom: "Wincha 8 m", desc: "Cinta métrica de acero reforzada", cat: "Medición", uni: "und", zona: "Zona F", est: "Tablero 2", stock: 3, min: 2, max: 6, cupp: 28.0 },
  { cod: "MED-003", nom: 'Escuadra metálica 12"', desc: "Escuadra de precisión para armado", cat: "Medición", uni: "und", zona: "Zona F", est: "Tablero 2", stock: 4, min: 2, max: 8, cupp: 26.0 },
  { cod: "MED-004", nom: "Nivel de burbuja 24\"", desc: "Nivel de aluminio", cat: "Medición", uni: "und", zona: "Zona F", est: "Tablero 2", stock: 3, min: 2, max: 6, cupp: 42.0 },
  { cod: "MED-005", nom: "Calibrador vernier 6\"", desc: "Pie de rey de precisión 0.02mm", cat: "Medición", uni: "und", zona: "Zona F", est: "Tablero 2", stock: 2, min: 1, max: 4, cupp: 68.0 },
  { cod: "MED-006", nom: "Escuadra magnética para soldar", desc: "Sujeción angular magnética", cat: "Medición", uni: "und", zona: "Zona F", est: "Tablero 2", stock: 6, min: 3, max: 12, cupp: 19.5 },
  { cod: "MED-007", nom: "Tiza de soldador (soapstone)", desc: "Marcador para trazado en metal", cat: "Medición", uni: "und", zona: "Zona F", est: "Tablero 2", stock: 20, min: 10, max: 50, cupp: 2.5 },
  // ---------------- EPP ----------------
  { cod: "EPP-001", nom: "Careta de soldar fotosensible", desc: "Máscara automática tono 9-13", cat: "EPP", uni: "und", zona: "Zona G", est: "Casillero 1", stock: 3, min: 2, max: 6, cupp: 185.0 },
  { cod: "EPP-002", nom: "Careta de soldar estándar", desc: "Máscara de mano con visor fijo", cat: "EPP", uni: "und", zona: "Zona G", est: "Casillero 1", stock: 4, min: 2, max: 8, cupp: 38.0 },
  { cod: "EPP-003", nom: "Guantes de cuero para soldador", desc: "Guantes de descarne caña larga", cat: "EPP", uni: "par", zona: "Zona G", est: "Casillero 1", stock: 10, min: 5, max: 24, cupp: 22.0 },
  { cod: "EPP-004", nom: "Lentes de seguridad claros", desc: "Anteojos de policarbonato", cat: "EPP", uni: "und", zona: "Zona G", est: "Casillero 1", stock: 12, min: 6, max: 30, cupp: 8.5 },
  { cod: "EPP-005", nom: "Mandil de cuero", desc: "Delantal de descarne para soldadura", cat: "EPP", uni: "und", zona: "Zona G", est: "Casillero 1", stock: 4, min: 2, max: 8, cupp: 45.0 },
  { cod: "EPP-006", nom: "Respirador media cara", desc: "Respirador con filtros para humos", cat: "EPP", uni: "und", zona: "Zona G", est: "Casillero 1", stock: 4, min: 2, max: 8, cupp: 68.0 },
  { cod: "EPP-007", nom: "Orejeras de seguridad", desc: "Protección auditiva 25dB", cat: "EPP", uni: "und", zona: "Zona G", est: "Casillero 1", stock: 6, min: 3, max: 12, cupp: 24.0 },
  { cod: "EPP-008", nom: "Zapato de seguridad punta de acero", desc: "Calzado dieléctrico", cat: "EPP", uni: "par", zona: "Zona G", est: "Casillero 1", stock: 4, min: 2, max: 10, cupp: 98.0 },
  // ---------------- Ornamental ----------------
  { cod: "ORN-001", nom: "Punta de lanza fundida", desc: "Remate ornamental para rejas", cat: "Ornamental", uni: "und", zona: "Zona H", est: "Vitrina 1", stock: 60, min: 24, max: 150, cupp: 4.2 },
  { cod: "ORN-002", nom: "Voluta ornamental 12cm", desc: "Espiral decorativa forjada", cat: "Ornamental", uni: "und", zona: "Zona H", est: "Vitrina 1", stock: 40, min: 20, max: 120, cupp: 6.5 },
  { cod: "ORN-003", nom: "Canastilla ornamental", desc: "Elemento decorativo torcido", cat: "Ornamental", uni: "und", zona: "Zona H", est: "Vitrina 1", stock: 20, min: 10, max: 60, cupp: 12.8 },
  // ---------------- Herrajes ----------------
  { cod: "HRJ-001", nom: "Bisagra tipo cápsula 3/4\"", desc: "Bisagra soldable para portones", cat: "Herrajes", uni: "und", zona: "Zona H", est: "Vitrina 1", stock: 40, min: 16, max: 100, cupp: 5.8 },
  { cod: "HRJ-002", nom: "Bisagra de libro 4\"", desc: "Bisagra atornillable", cat: "Herrajes", uni: "und", zona: "Zona H", est: "Vitrina 1", stock: 30, min: 12, max: 80, cupp: 7.2 },
  { cod: "HRJ-003", nom: "Cerradura para portón", desc: "Cerradura de sobreponer reforzada", cat: "Herrajes", uni: "und", zona: "Zona H", est: "Vitrina 1", stock: 8, min: 4, max: 20, cupp: 68.0 },
  { cod: "HRJ-004", nom: "Rueda para portón corredizo 4\"", desc: "Rueda con rodamiento y soporte", cat: "Herrajes", uni: "und", zona: "Zona H", est: "Vitrina 1", stock: 12, min: 6, max: 30, cupp: 32.0 },
  { cod: "HRJ-005", nom: "Riel para corredizo 3m", desc: "Riel en U para portón", cat: "Herrajes", uni: "und", zona: "Zona H", est: "Vitrina 1", stock: 6, min: 3, max: 16, cupp: 58.0 },
  { cod: "HRJ-006", nom: "Pasador de seguridad 8\"", desc: "Cerrojo soldable", cat: "Herrajes", uni: "und", zona: "Zona H", est: "Vitrina 1", stock: 15, min: 6, max: 40, cupp: 14.5 },
];

async function main() {
  console.log("🌱 Sembrando catálogo completo del taller...");

  // 1. Unidad "par" (EPP) si no existe
  await prisma.unidadMedida.upsert({
    where: { simbolo: "par" },
    update: {},
    create: { simbolo: "par", nombre: "Par", tipo: "Unidad", factorBase: 1 },
  });

  // 2. Categorías raíz
  for (const c of CATEGORIAS_RAIZ) {
    const ex = await prisma.categoria.findFirst({ where: { nombre: c.nombre, idCategoriaPadre: null } });
    if (!ex) {
      await prisma.categoria.create({
        data: { nombre: c.nombre, descripcion: c.descripcion, porcentajeMerma: c.merma },
      });
    }
  }

  // 3. Subcategorías
  for (const s of SUBCATEGORIAS) {
    const padre = await prisma.categoria.findFirstOrThrow({
      where: { nombre: s.padre, idCategoriaPadre: null },
    });
    const ex = await prisma.categoria.findFirst({
      where: { nombre: s.nombre, idCategoriaPadre: padre.idCategoria },
    });
    if (!ex) {
      await prisma.categoria.create({
        data: {
          nombre: s.nombre,
          descripcion: s.desc,
          idCategoriaPadre: padre.idCategoria,
          porcentajeMerma: s.merma,
        },
      });
    }
  }

  // 4. Ubicaciones
  for (const u of UBICACIONES) {
    const ex = await prisma.ubicacion.findFirst({
      where: { zona: u.zona, estante: u.estante, nivel: u.nivel },
    });
    if (!ex) {
      await prisma.ubicacion.create({
        data: { zona: u.zona, estante: u.estante, nivel: u.nivel, descripcion: u.desc },
      });
    }
  }

  // 5. Materiales
  let creados = 0;
  let actualizados = 0;
  for (const m of MATERIALES) {
    const categoria = await prisma.categoria.findFirstOrThrow({ where: { nombre: m.cat } });
    const unidad = await prisma.unidadMedida.findUniqueOrThrow({ where: { simbolo: m.uni } });
    const ubicacion = await prisma.ubicacion.findFirst({
      where: { zona: m.zona, ...(m.est ? { estante: m.est } : {}) },
    });

    const data = {
      nombre: m.nom,
      descripcion: m.desc ?? null,
      idCategoria: categoria.idCategoria,
      idUnidad: unidad.idUnidad,
      idUbicacion: ubicacion?.idUbicacion ?? null,
      norma: m.norma ?? null,
      espesorMm: m.esp ?? null,
      medidas: m.med ?? null,
      acabado: m.acab ?? null,
      pesoUnitario: m.peso ?? null,
      stockMinimo: m.min,
      stockMaximo: m.max ?? null,
      cupp: m.cupp,
      porcentajeMerma: m.merma ?? null,
    };

    const existe = await prisma.material.findUnique({ where: { codigoMaterial: m.cod } });
    if (existe) {
      // No se toca stockActual: solo el kardex lo modifica.
      await prisma.material.update({ where: { codigoMaterial: m.cod }, data });
      actualizados++;
    } else {
      await prisma.material.create({
        data: { ...data, codigoMaterial: m.cod, stockActual: m.stock },
      });
      creados++;
    }
  }

  const totalCat = await prisma.categoria.count();
  const totalUbi = await prisma.ubicacion.count();
  console.log(`✅ Catálogo listo:`);
  console.log(`   Materiales: ${creados} creados, ${actualizados} actualizados (total ${MATERIALES.length})`);
  console.log(`   Categorías: ${totalCat} · Ubicaciones: ${totalUbi}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
