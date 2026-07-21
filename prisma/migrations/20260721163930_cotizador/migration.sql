-- CreateTable
CREATE TABLE "Producto_Catalogo" (
    "id_producto" SERIAL NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "descripcion" TEXT,
    "precio_base" DECIMAL(10,2) NOT NULL,
    "imagen_url" VARCHAR(500),
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Producto_Catalogo_pkey" PRIMARY KEY ("id_producto")
);

-- CreateTable
CREATE TABLE "Cotizacion_Rapida" (
    "id_cotizacion" SERIAL NOT NULL,
    "nombre_cliente" VARCHAR(150) NOT NULL,
    "dni_ruc" VARCHAR(20),
    "telefono" VARCHAR(20),
    "correo" VARCHAR(100),
    "producto" VARCHAR(150) NOT NULL,
    "descripcion" TEXT,
    "medidas" VARCHAR(100),
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "precio_unitario" DECIMAL(10,2) NOT NULL,
    "precio_total" DECIMAL(12,2) NOT NULL,
    "tiempo_entrega" VARCHAR(100),
    "validez_dias" INTEGER NOT NULL DEFAULT 7,
    "imagen_url" VARCHAR(500),
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cotizacion_Rapida_pkey" PRIMARY KEY ("id_cotizacion")
);
