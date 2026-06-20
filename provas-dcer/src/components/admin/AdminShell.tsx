import Link from "next/link";
import { logoutAdminAction } from "@/app/actions/admin";

type AdminShellProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function AdminShell({ title, description, children }: AdminShellProps) {
  const navLinkClass =
    "rounded-md border border-[#dfe6dd] px-3 py-2 text-center hover:bg-[#f2f7f0]";

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-3 py-4 sm:px-6 lg:px-8">
      <header className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-[#dfe6dd] sm:p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <Link href="/" className="text-sm font-semibold text-[#2c6d49]">
              Provas DCER Paulista
            </Link>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
            {description ? <p className="mt-1 text-sm text-[#66736a]">{description}</p> : null}
          </div>
          <nav className="grid grid-cols-2 gap-2 text-sm sm:flex sm:flex-wrap">
            <Link className={navLinkClass} href="/admin">
              Painel
            </Link>
            <Link className={navLinkClass} href="/admin/cadastros">
              Cadastros
            </Link>
            <Link className={navLinkClass} href="/admin/equipe">
              Equipe
            </Link>
            <Link className={navLinkClass} href="/admin/provas/nova">
              Nova prova
            </Link>
            <Link className={navLinkClass} href="/admin/correcao">
              Correcao
            </Link>
            <form action={logoutAdminAction} className="col-span-2 sm:col-span-1">
              <button className="w-full rounded-md bg-[#12382a] px-3 py-2 font-medium text-white hover:bg-[#1c513d]">
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
