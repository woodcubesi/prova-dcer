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
        <footer className="px-3 pb-3 text-center text-[10px] leading-relaxed text-[#7f8aa5]">
          Desenvolvido por Josu&eacute; Sampaio Lopes Coutinho -{" "}
          <a className="hover:text-[#c7d2ff]" href="mailto:josue@woodcube.com.br">
            josue@woodcube.com.br
          </a>
        </footer>
      </body>
    </html>
  );
}
