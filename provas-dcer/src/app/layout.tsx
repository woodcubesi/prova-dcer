import type { Metadata } from "next";
import { FormDraftManager } from "@/components/FormDraftManager";
import "./globals.css";

export const metadata: Metadata = {
  title: "Provas DCER Paulista",
  description: "Aplicacao web do DCER Paulista para avaliacoes dos Embaixadores e Mensageiras do Rei.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full bg-background text-foreground">
        <FormDraftManager />
        {children}
      </body>
    </html>
  );
}
