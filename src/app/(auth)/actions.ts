"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession } from "@/lib/auth";
import { loginSchema, type ActionResult } from "@/lib/validations";

const MAX_INTENTOS = 5;
const BLOQUEO_MINUTOS = 15;

export async function loginAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    nombreUsuario: formData.get("nombreUsuario"),
    contrasena: formData.get("contrasena"),
  });

  if (!parsed.success) {
    return { ok: false, error: "Complete usuario y contraseña." };
  }

  const { nombreUsuario, contrasena } = parsed.data;

  const usuario = await prisma.usuario.findUnique({
    where: { nombreUsuario },
  });

  const credencialesInvalidas: ActionResult = {
    ok: false,
    error: "Usuario o contraseña incorrectos.",
  };

  if (!usuario) return credencialesInvalidas;

  if (usuario.estado === "Inactivo") {
    return { ok: false, error: "Su cuenta está inactiva. Contacte al administrador." };
  }

  if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) {
    return {
      ok: false,
      error: "Cuenta bloqueada temporalmente por intentos fallidos. Intente más tarde.",
    };
  }

  const valido = await bcrypt.compare(contrasena, usuario.contrasenaHash);

  if (!valido) {
    const intentos = usuario.intentosFallidos + 1;
    await prisma.usuario.update({
      where: { idUsuario: usuario.idUsuario },
      data: {
        intentosFallidos: intentos,
        bloqueadoHasta:
          intentos >= MAX_INTENTOS
            ? new Date(Date.now() + BLOQUEO_MINUTOS * 60_000)
            : null,
      },
    });
    return credencialesInvalidas;
  }

  // Login correcto: resetea intentos, marca último acceso
  await prisma.usuario.update({
    where: { idUsuario: usuario.idUsuario },
    data: { intentosFallidos: 0, bloqueadoHasta: null, ultimoAcceso: new Date() },
  });

  await createSession({
    sub: usuario.idUsuario,
    nombreUsuario: usuario.nombreUsuario,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    rol: usuario.rol,
  });

  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
