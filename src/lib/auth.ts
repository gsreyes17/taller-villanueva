import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "tv_session";

export type SessionUser = {
  sub: number; // id_usuario
  nombreUsuario: string;
  nombre: string;
  apellido: string;
  rol: "Administrador" | "Trabajador";
};

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("Falta AUTH_SECRET en las variables de entorno.");
  return new TextEncoder().encode(secret);
}

function maxAge() {
  return Number(process.env.AUTH_SESSION_MAX_AGE ?? 28800); // 8h
}

/** Firma un JWT de sesión. `sub` (estándar JWT) es string; guardamos el id ahí. */
export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({
    nombreUsuario: user.nombreUsuario,
    nombre: user.nombre,
    apellido: user.apellido,
    rol: user.rol,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.sub))
    .setIssuedAt()
    .setExpirationTime(`${maxAge()}s`)
    .sign(getSecret());
}

/** Verifica un JWT y devuelve el usuario o null. */
export async function verifySession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      sub: Number(payload.sub),
      nombreUsuario: String(payload.nombreUsuario),
      nombre: String(payload.nombre),
      apellido: String(payload.apellido),
      rol: payload.rol as SessionUser["rol"],
    };
  } catch {
    return null;
  }
}

/** Crea la cookie de sesión (usar dentro de Server Action / Route Handler). */
export async function createSession(user: SessionUser): Promise<void> {
  const token = await signSession(user);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAge(),
  });
}

/** Elimina la cookie de sesión. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Devuelve el usuario de la sesión actual, o null. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

/** Exige sesión; redirige a /login si no hay. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Exige rol Administrador; redirige a /dashboard si no lo es. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.rol !== "Administrador") redirect("/dashboard");
  return user;
}
