import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { TitleBar } from "@/components/layout/title-bar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Taller Villanueva — Sistema de Gestión",
  description: "Sistema de gestión de obras, proyectos e inventario de Taller Villanueva",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="flex h-screen flex-col overflow-hidden antialiased">
        <TitleBar />
        <div className="min-h-0 flex-1">{children}</div>
      </body>
    </html>
  );
}
