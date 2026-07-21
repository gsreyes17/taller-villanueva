"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Factory, User, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { loginAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/field";

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, null);
  const [showPass, setShowPass] = useState(false);

  return (
    <div className="w-full max-w-md rounded-2xl bg-white/30 backdrop-blur-md p-8 shadow-2xl border border-white/40">
      {/* Branding */}
      <div className="flex flex-col items-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand text-white shadow-lg">
          <Factory size={32} />
        </div>
        <h1 className="mt-4 text-xl font-bold text-ink">Taller Villanueva</h1>
        <p className="mt-1 text-sm text-black font-medium">Sistema de Gestión de Obras y Proyectos</p>
      </div>

      <form action={formAction} className="mt-8 space-y-5">
        {state && !state.ok && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700 ring-1 ring-red-200">
            <AlertCircle size={16} className="shrink-0" />
            <span>{state.error}</span>
          </div>
        )}

        <div>
          <Label htmlFor="nombreUsuario">Usuario</Label>
          <div className="relative">
            <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black" />
            <input
              id="nombreUsuario"
              name="nombreUsuario"
              type="text"
              autoComplete="username"
              placeholder="Ingrese su usuario"
              className="w-full rounded-lg border border-slate-200/50 bg-white py-2.5 pl-11 pr-4 text-sm text-black shadow-sm placeholder:text-slate-500 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="contrasena">Contraseña</Label>
          <div className="relative">
            <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black" />
            <input
              id="contrasena"
              name="contrasena"
              type={showPass ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Ingrese su contraseña"
              className="w-full rounded-lg border border-slate-200/50 bg-white py-2.5 pl-11 pr-11 text-sm text-black shadow-sm placeholder:text-slate-500 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
            <button
              type="button"
              onClick={() => setShowPass((s) => !s)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-black opacity-70 hover:opacity-100"
              aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <SubmitButton />
      </form>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Ingresando..." : "Iniciar Sesión"}
    </Button>
  );
}
