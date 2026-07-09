import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <main className="bg-login flex h-full items-center justify-center overflow-y-auto p-4">
      <LoginForm />
    </main>
  );
}
