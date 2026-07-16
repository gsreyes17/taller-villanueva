# Taller Villanueva — Sistema de Gestión · v2.0

Sistema de gestión integral para un **taller de metalmecánica**: clientes, almacén,
inventario con kardex, compras a proveedores, obras, presupuestos, **costeo real y
rentabilidad**, con trazabilidad total. Funciona como **aplicación web** y se empaqueta
como **aplicativo de escritorio** (Windows/macOS) conectándose a una base de datos en la nube.

> 📘 La justificación del modelo, las reglas de negocio y las decisiones de arquitectura
> están en **[DOCUMENTACION.md](./DOCUMENTACION.md)**.

<p align="center"><em>Fábrica sobre naranja · sidebar navy · fondo crema — una identidad visual consistente en login, app, carga e instalador.</em></p>

---

## ✨ Qué incluye

| Módulo | Descripción |
| --- | --- |
| **Login y sesión** | Ingreso por nombre de usuario, sesión JWT en cookie httpOnly, bloqueo temporal tras 5 intentos fallidos. |
| **Dashboard** | KPIs (obras activas, valor en obras, inventario valorizado), resumen financiero del mes, **balance mensual** (tendencia de ingresos/egresos) y alertas del sistema. |
| **Usuarios** | Alta, edición, roles (Administrador/Empleado) y estado. Solo Administrador. |
| **Clientes** | CRUD completo con datos de contacto y persona de contacto; búsqueda y estados. |
| **Obras** | CRUD ligado a cliente, % de avance, presupuesto con **merma ponderada por material e IGV**, **pagos y saldo**, **bocetos/planos** (imágenes/PDF con visor a pantalla completa) y **costeo real** (materiales + horas-hombre + indirectos) con margen. |
| **Inventario** | Materiales con **especificación técnica** (norma ASTM, espesor, medidas, acabado, peso) + **kardex** real: entradas, salidas y ajustes con **validación de stock en la base de datos**. |
| **Almacén** | **Catálogos**: categorías jerárquicas con merma, unidades de medida, y **mapa de ubicaciones físicas** (Zona → Estante → Nivel) con alerta de material sin ubicar. |
| **Compras** | Proveedores y **órdenes de compra** con IGV y **flete prorrateado**. Al recibir, genera el kardex y **recalcula el CUPP con el costo real**. |
| **Precios y Costos** | Control del **CUPP** (costo unitario promedio ponderado). |
| **Reportes** | 7 reportes (operativos y financieros, incl. **rentabilidad**) con **filtros por rango de fechas y por entidad**, impresión limpia y **exportación a PDF nativo**. |
| **Mi Perfil** | Cada usuario edita sus datos (nombre, apellido, correo, teléfono) y cambia su contraseña. |
| **Escritorio** | Ventana sin marco con barra de título propia, pantalla de carga con branding, verificación activa de conexión y pantalla de "sin conexión" con reintento. |

---

## 🧱 Stack técnico

- **Next.js 15** (App Router, Server Actions) + **TypeScript**
- **Prisma 7** con driver adapter `@prisma/adapter-pg` (sin motor Rust → fácil de empaquetar)
- **Supabase** — Postgres administrado (datos) + **Storage** (bocetos/planos)
- **Tailwind CSS v4** + **lucide-react**
- **Autenticación custom**: usuario + `bcryptjs` + JWT (`jose`) en cookie httpOnly
- **Electron** + **electron-builder** para el instalador de escritorio

---

## 🔒 Reglas de negocio e integridad (en la base de datos)

El principio: **la base de datos es la última línea de defensa**. Las reglas críticas viven
en PostgreSQL, no solo en la app — se cumplen aunque se entre por otro cliente.

- **Kardex con stock íntegro** — los triggers validan el stock (impiden salidas sin saldo),
  calculan el `saldo_resultante` y actualizan `stock_actual`. La app **nunca** toca el stock.
- **Merma ponderada por material** — cada material (o su categoría) define su % real:
  cortar plancha merma ~12%, un perfil ~6%. Un 6% plano subestimaría el presupuesto.
- **Importes calculados por la BD** — presupuestos y compras recalculan subtotal, mermas,
  IGV y total por trigger. La UI solo muestra una vista previa con la misma fórmula.
- **CUPP con costo real** — al recibir una compra, el promedio ponderado se recalcula
  incluyendo el **flete prorrateado**.
- **Auditoría** — triggers + helper que asocian **toda escritura al usuario de la sesión**.
- **170 CHECK constraints y 31 FK** — stocks ≥ 0, avance 0–100, horas ≤ 24, fechas
  coherentes, una categoría no puede ser su propio padre, etc.
- **Borrado lógico ante dependencias** — nada con historial se elimina; se desactiva.
- **Row Level Security** en las 18 tablas: bloquea la API REST pública de Supabase.
- **Storage seguro** — subidas/borrados por el servidor con la *service-role key*.

---

## 🚀 Puesta en marcha (web)

Requisitos: **Node.js 20+** y un proyecto de **Supabase** (o cualquier Postgres 14+).

```bash
# 1. Dependencias
npm install

# 2. Entorno: copia y completa con tus credenciales
cp .env.example .env
#    Genera el AUTH_SECRET:
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

# 3. Aplicar el esquema a la base de datos (tablas, triggers, vistas, RLS)
npm run prisma:deploy

# 4. Datos de ejemplo (usuario admin + clientes + materiales + obras)
npm run db:seed
#    (opcional) datos financieros demo para poblar el dashboard:
npm run db:demo

# 5. Arrancar
npm run dev            # http://localhost:3000
```

Credenciales sembradas:

| Usuario | Contraseña | Rol |
| --- | --- | --- |
| `lvillanueva` | `admin123` | Administrador |
| `mtorres` | `empleado123` | Empleado |

> ⚠️ Cambia estas credenciales antes de cualquier uso real.

---

## 🔑 Variables de entorno

| Variable | Requerida | Uso |
| --- | :---: | --- |
| `DATABASE_URL` | ✅ | Runtime — pooler Supavisor (puerto **6543**, `pgbouncer=true`) |
| `DIRECT_URL` | ✅ | Migraciones — conexión directa (puerto **5432**) |
| `AUTH_SECRET` | ✅ | Firma del JWT de sesión |
| `AUTH_SESSION_MAX_AGE` | — | Duración de sesión en segundos (por defecto `28800` = 8 h) |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅¹ | URL del proyecto Supabase (necesaria para los bocetos) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅¹ | Clave de servicio para Storage — **solo servidor, secreta** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | — | Opcional (Realtime/REST) |

¹ Requeridas para la funcionalidad de **bocetos/planos** de las obras. El bucket `obras`
se crea automáticamente en la primera subida.

---

## 🗂️ Estructura del proyecto

```
prisma/
  schema.prisma          # Modelo de datos (Postgres)
  migrations/            # Esquema versionado (tablas, triggers, vistas, RLS)
  seed.ts                # Datos base de ejemplo
scripts/
  gen-icons.mjs          # Genera el ícono de la app en sus 3 tamaños
  seed-demo.ts           # Datos financieros demo (junio–julio)
  smoke-triggers.ts      # Prueba de triggers de BD (con rollback)
  smoke-storage.ts       # Prueba del Storage (subida/URL/borrado)
src/
  lib/                   # prisma, auth, validaciones (zod), utils, audit, storage
  middleware.ts          # Protección de rutas (verifica el JWT)
  components/ui/          # Sistema de diseño (Button, Card, Modal, Table, …)
  components/layout/      # Sidebar, Header, TitleBar, Mi Perfil
  app/
    (auth)/login/         # Login
    (app)/dashboard        # KPIs, balance mensual, alertas
    (app)/usuarios         # CRUD usuarios (Administrador)
    (app)/clientes         # CRUD clientes
    (app)/obras            # Obras + presupuestos + pagos + avance + bocetos
    (app)/inventario       # Materiales + kardex
    (app)/precios          # CUPP
    (app)/reportes         # Reportes + exportación a PDF
    (app)/mi-perfil        # Autogestión de perfil
    api/health             # Chequeo activo de conexión a la BD
electron/                  # Proceso principal, preload, pantalla de carga
build/ · public/           # Íconos y estáticos
```

---

## 🖥️ Aplicativo de escritorio

Electron ejecuta el propio servidor de Next.js **embebido y local** (como Discord con sus
servidores), con la base de datos remota en Supabase.

```bash
npm run electron:dev          # dev: levanta Next + abre la ventana (un solo comando)
npm run electron:build        # genera el instalador (.exe / .dmg) en dist-electron/
npm run electron:build:dir    # solo empaqueta la carpeta (prueba rápida sin instalador)
```

**Configuración del `.env` en el paquete instalado:** el proceso principal busca un `.env`
en este orden y usa el primero que encuentre — así el usuario final lo coloca **después de
instalar**, sin reempaquetar:

1. `%APPDATA%/Taller Villanueva/.env` (Windows) — recomendado
2. `<recursos>/app/.env` (empaquetado, opcional)
3. `.env` junto al ejecutable

Si la base de datos no responde, la app muestra una pantalla de **"sin conexión"** con
botón de reintentar — nunca un error crudo.

---

## ☁️ Despliegue web (Vercel)

1. Sube el repositorio y conéctalo a Vercel (Build Command por defecto: `npm run build`,
   que ya ejecuta `prisma generate`).
2. Configura las variables de entorno del proyecto (las de la tabla anterior; para los
   bocetos añade también las de Supabase).
3. Usa la URL del **pooler** (6543) como `DATABASE_URL` para el entorno serverless.

---

## 🎨 Íconos

El ícono replica el distintivo del login (fábrica blanca sobre cuadrado naranja). Se
regenera con:

```bash
node scripts/gen-icons.mjs
```

Produce `build/icon.png` (instalador), `src/app/icon.png` (favicon web) y
`electron/logo.png` (pantalla de carga). Para usar un logo propio, reemplaza esos archivos.

---

## 📜 Scripts

| Comando | Acción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Build de producción / arranque |
| `npm run prisma:deploy` | Aplica las migraciones a la base de datos |
| `npm run prisma:studio` | Explorador visual de datos |
| `npm run db:seed` / `db:demo` | Datos de ejemplo / datos financieros demo |
| `npm run db:smoke` | Verifica los triggers de la base de datos |
| `npm run electron:dev` / `electron:build` | Escritorio en desarrollo / instalador |

---

<p align="center"><sub>Taller Villanueva · MVP v1.0 — Next.js · Prisma · Supabase · Electron</sub></p>
