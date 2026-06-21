import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Provas DCER Paulista",
  description: "Aplicacao web do DCER Paulista para avaliacoes dos Embaixadores do Rei.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#f4f6fb] text-[#11142f]">{children}</body>
    </html>
  );
}
