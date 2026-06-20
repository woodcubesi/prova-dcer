import Link from "next/link";
import { logoutAdminAction } from "@/app/actions/admin";

type AdminShellProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function AdminShell({ title, description, children }: AdminShellProps) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      <header className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-[#dfe6dd]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link href="/" className="text-sm font-semibold text-[#2c6d49]">
              Provas DCER Paulista
            </Link>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
            {description ? <p className="mt-1 text-sm text-[#66736a]">{description}</p> : null}
          </div>
          <nav className="flex flex-wrap gap-2 text-sm">
            <Link className="rounded-md border border-[#dfe6dd] px-3 py-2 hover:bg-[#f2f7f0]" href="/admin">
              Painel
            </Link>
            <Link className="rounded-md border border-[#dfe6dd] px-3 py-2 hover:bg-[#f2f7f0]" href="/admin/cadastros">
              Cadastros
            </Link>
            <Link className="rounded-md border border-[#dfe6dd] px-3 py-2 hover:bg-[#f2f7f0]" href="/admin/equipe">
              Equipe
            </Link>
            <Link className="rounded-md border border-[#dfe6dd] px-3 py-2 hover:bg-[#f2f7f0]" href="/admin/provas/nova">
              Nova prova
            </Link>
            <Link className="rounded-md border border-[#dfe6dd] px-3 py-2 hover:bg-[#f2f7f0]" href="/admin/correcao">
              Correcao
            </Link>
            <form action={logoutAdminAction}>
              <button className="rounded-md bg-[#12382a] px-3 py-2 font-medium text-white hover:bg-[#1c513d]">
                Sair
              </button>
            </form>
          </nav>
        </div>
      </header>
      <div className="mt-5">{children}</div>
    </main>
  );
}
