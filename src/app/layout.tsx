import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Copiloto — Compartilhamento de localização",
  description: "Aplicação de exemplo para compartilhar localização em tempo real.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      {/* Avoid build-time network fetches (e.g. Google Fonts) to keep builds deterministic/offline-friendly. */}
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
