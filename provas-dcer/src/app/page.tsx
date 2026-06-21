import Link from "next/link";
import { BrandLockup } from "@/components/BrandLockup";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8">
      <header className="relative overflow-hidden rounded-lg bg-[#000060] px-5 py-6 text-white shadow-sm">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-[#fff200]" />
        <div className="absolute inset-x-0 bottom-0 h-1 bg-[#e00010]" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-4">
            <BrandLockup />
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#fff200]">DCER Paulista</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Sistema de Provas</h1>
            </div>
          </div>
          <Link
            href="/prova"
            className="inline-flex items-center justify-center rounded-md bg-[#fff200] px-5 py-3 text-sm font-semibold text-[#000060] shadow-sm transition hover:bg-[#f4c900]"
          >
            Faça sua Avaliação
          </Link>
        </div>
      </header>

      <section className="mt-5 grid items-start gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Link
          href="/prova"
          className="rounded-lg border border-[#d8def0] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#ffd500] hover:shadow-md"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#000060]">Embaixador</p>
          <h2 className="mt-3 text-2xl font-semibold">Entrar na prova</h2>
          <p className="mt-2 text-sm leading-6 text-[#5d6480]">
            O embaixador escolhe a prova, igreja e categoria, depois digita o nome conforme o cadastro.
          </p>
        </Link>

        <section className="rounded-lg border border-[#d8def0] bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#000060]">Administrativo</p>
          <h2 className="mt-3 text-2xl font-semibold">Acesso da equipe</h2>
          <p className="mt-2 text-sm leading-6 text-[#5d6480]">
            Administradores e conselheiros entram aqui para montar provas, cadastrar pessoas e conferir resultados.
          </p>

          <Link
            href="/admin/login"
            className="mt-4 inline-flex rounded-md bg-[#000060] px-4 py-3 text-sm font-semibold text-white hover:bg-[#000044]"
          >
            Entrar no painel
          </Link>

          <div className="mt-5 grid gap-2 border-t border-[#e8ecf8] pt-4 text-sm">
            <Link className="font-medium text-[#000060] hover:underline" href="/admin/equipe">
              Cadastrar administradores e conselheiros
            </Link>
            <Link className="font-medium text-[#000060] hover:underline" href="/admin/provas/nova">
              Montar prova de multipla escolha
            </Link>
            <Link className="font-medium text-[#000060] hover:underline" href="/admin/correcao">
              Conferir provas enviadas
            </Link>
          </div>
        </section>
      </section>

      <footer className="py-6 text-center text-xs text-[#5f6684]">
        Primeira versao local. Banco PostgreSQL em Docker, pronto para migrar para Linux.
      </footer>
    </main>
  );
}
