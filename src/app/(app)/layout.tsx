import { requireUser } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="app-shell flex h-full overflow-hidden">
      <Sidebar user={user} />
      <div className="app-main-col flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="bg-app flex-1 overflow-y-auto px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
