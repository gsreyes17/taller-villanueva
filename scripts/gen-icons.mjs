import sharp from "sharp";
import { mkdirSync } from "node:fs";

// Ícono de la app: réplica del distintivo del login
// (cuadrado naranja redondeado + fábrica blanca de lucide).
const FACTORY_PATHS = `
  <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/>
  <path d="M17 18h1"/><path d="M12 18h1"/><path d="M7 18h1"/>`;

// Tile completo (fondo naranja) — para instalador, barra de tareas y favicon.
const tile = (size) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
    <rect width="1024" height="1024" rx="224" ry="224" fill="#F97316"/>
    <g transform="translate(256,256) scale(21.3333)" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${FACTORY_PATHS}</g>
  </svg>`,
);

// Solo el glifo blanco (transparente) — va dentro del recuadro naranja de la
// pantalla de carga, igual que en el login.
const glyph = (size) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
    <g transform="translate(192,192) scale(26.6667)" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${FACTORY_PATHS}</g>
  </svg>`,
);

mkdirSync("build", { recursive: true });
mkdirSync("public", { recursive: true });

const jobs = [
  ["build/icon.png", tile(1024)],   // electron-builder genera .ico/.icns desde este
  ["src/app/icon.png", tile(512)],  // favicon de la web (Next lo detecta solo)
  ["public/logo-tile.png", tile(512)],
  ["electron/logo.png", glyph(256)], // pantalla de carga (dentro del recuadro naranja)
];

for (const [out, svg] of jobs) {
  await sharp(svg).png().toFile(out);
  console.log("✓", out);
}
console.log("Íconos generados.");
