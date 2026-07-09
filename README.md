# Taller Villanueva — Sistema de Gestión

Sistema de gestión de obras, proyectos e inventario para un taller de metalmecánica.
Web app en **Next.js 15 + Prisma 7 + Supabase (Postgres)**, empaquetable como
aplicativo de escritorio con **Electron** (fase 2).

## Stack

- **Next.js 15** (App Router, Server Actions) + **TypeScript**
- **Prisma 7** con driver adapter `@prisma/adapter-pg` (sin motor Rust)
- **Supabase** (Postgres administrado) como base de datos
- **Tailwind CSS v4** + **lucide-react**
- **Auth custom**: usuario + `bcryptjs` + JWT propio (`jose`) en cookie httpOnly
- **Electron** + **electron-builder** para el instalador de escritorio (fase 2)

## Requisitos

- Node.js 20+
- Un proyecto de Supabase (o cualquier Postgres 14+)

## Puesta en marcha (web)

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar entorno
cp .env.example .env
#   Edita .env con tus cadenas de conexión de Supabase y un AUTH_SECRET.
#   Genera el secreto:
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

# 3. Generar el cliente de Prisma
npm run prisma:generate

# 4. Aplicar el esquema a la base de datos (crea tablas, triggers, vistas, RLS)
#    La migración inicial ya está escrita en prisma/migrations/0_init/.
npm run prisma:deploy       # producción / primera vez
#   (en desarrollo puedes usar `npm run prisma:migrate` para crear nuevas migraciones)

# 5. Sembrar datos de ejemplo (usuario admin + clientes + materiales + obras)
npm run db:seed

# 6. Arrancar
npm run dev
```

Abre http://localhost:3000 e inicia sesión con:

| Usuario        | Contraseña     | Rol           |
| -------------- | -------------- | ------------- |
| `lvillanueva`  | `admin123`     | Administrador |
| `mtorres`      | `empleado123`  | Empleado      |

> ⚠️ Cambia estas credenciales antes de cualquier despliegue real.

## Variables de entorno

| Variable                         | Uso                                                        |
| -------------------------------- | ---------------------------------------------------------- |
| `DATABASE_URL`                   | Runtime — pooler Supavisor (puerto **6543**, `pgbouncer=true`) |
| `DIRECT_URL`                     | Migraciones — conexión directa (puerto **5432**)           |
| `AUTH_SECRET`                    | Firma del JWT de sesión (obligatorio)                      |
| `AUTH_SESSION_MAX_AGE`           | Duración de sesión en segundos (por defecto 28800 = 8h)    |
| `NEXT_PUBLIC_SUPABASE_URL` …     | Opcionales — solo si usas Storage/Realtime/REST de Supabase |

## Estructura

```
prisma/
  schema.prisma            # Modelo (traducido de MySQL a Postgres)
  migrations/0_init/       # Migración inicial: tablas + triggers + vistas + RLS
  seed.ts                  # Datos de ejemplo
src/
  lib/                     # prisma, auth, validaciones (zod), utils, audit
  middleware.ts            # Protección de rutas (verifica el JWT)
  components/ui/           # Sistema de diseño (Button, Card, Modal, Table, …)
  components/layout/       # Sidebar, Header, PageHeader, TitleBar (Electron)
  app/
    (auth)/login/          # Login
    (app)/dashboard        # KPIs, resumen financiero, alertas
    (app)/usuarios         # CRUD usuarios (solo Administrador)
    (app)/clientes         # CRUD clientes
    (app)/obras            # Obras + presupuestos (mermas 6%) + pagos + avance
    (app)/inventario       # Materiales + kardex (entradas/salidas/ajustes)
    (app)/precios          # CUPP (costo unitario promedio ponderado)
    (app)/reportes         # 6 reportes (operativos y financieros)
    api/health             # Chequeo activo de conexión a la BD (SELECT 1)
electron/                  # Empaquetado de escritorio (fase 2)
```

## Reglas de negocio implementadas

- **Kardex con integridad de stock**: los movimientos se insertan vía
  `Movimientos_Inventario`; los **triggers de BD** validan stock (impiden salidas
  sin saldo), calculan `saldo_resultante` y actualizan `Materiales.stock_actual`.
  La app **nunca** modifica `stock_actual` directamente.
- **Mermas automáticas (6%)**: un trigger recalcula `costo_mermas` del presupuesto.
- **Auditoría**: triggers para Obras/Materiales + helper `registrarAuditoria` para
  el resto de tablas. Toda escritura queda asociada al usuario de la sesión.
- **CHECK constraints**: stocks ≥ 0, avance 0–100, montos ≥ 0, fechas coherentes.
- **RLS activado** en todas las tablas (bloquea el REST API de Supabase; Prisma
  accede con el rol `postgres`, que hace BYPASSRLS).

## Empaquetado de escritorio (Electron)

### Desarrollo (un solo comando)

```bash
npm run electron:dev
```

Levanta `next dev` y, cuando el puerto 3000 responde, abre la ventana de Electron
apuntando a él (usa tu `.env` local para conectar a Supabase). Un solo comando,
gracias a `concurrently` + `wait-on`.

### Empaquetado (instalador)

```bash
npm run electron:build       # build de Next (standalone) + instalador (.exe / .dmg)
npm run electron:build:dir   # solo la carpeta empaquetada (sin instalador) para probar rápido
```

El resultado queda en `dist-electron/`.

### Variables de entorno en el paquete

El server embebido necesita `DATABASE_URL` y `AUTH_SECRET` en runtime. El proceso
principal (`electron/main.js`) busca un `.env` en este orden y usa el primero:

1. `%APPDATA%/Taller Villanueva/.env` (Windows) — **recomendado**: el usuario final
   coloca aquí su `.env` **después de instalar**, sin necesidad de reempaquetar.
2. `<recursos>/app/.env` — si decides empaquetar un `.env` (descomenta el bloque en
   `electron-builder.yml`).
3. `.env` junto al ejecutable.

Si no encuentra ninguno o la BD no responde, la app muestra una pantalla clara de
**"sin conexión"** con botón de reintentar (nunca un error crudo).

Detalles de la arquitectura de escritorio en [`DECISIONES.md`](./DECISIONES.md).

## Notas

- Este proyecto usa **auth custom** (no Supabase Auth), decidido para que el login
  por **nombre de usuario** del prototipo funcione tal cual. Ver `DECISIONES.md`.
- El esquema fue **extendido** respecto al SQL original con campos opcionales que
  exigen los formularios del prototipo (documentado en `schema.prisma`).
