import Link from "next/link";
import { logoutAdminAction } from "@/app/actions/admin";
import { BrandLockup } from "@/components/BrandLockup";

type AdminShellProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function AdminShell({ title, description, children }: AdminShellProps) {
  const navLinkClass =
    "rounded-md border border-[#d8def0] px-3 py-2 text-center hover:bg-[#f7f8ff]";

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-3 py-4 sm:px-6 lg:px-8">
      <header className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-[#d8def0]">
        <div className="h-1.5 bg-[#000060]" />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-col gap-3 p-3 sm:flex-row sm:items-center sm:p-4">
            <Link href="/" aria-label="Inicio">
              <BrandLockup compact />
            </Link>
            <div className="min-w-0">
              <Link href="/" className="text-sm font-semibold text-[#000060]">
                Provas DCER Paulista
              </Link>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
              {description ? <p className="mt-1 text-sm text-[#5d6480]">{description}</p> : null}
            </div>
          </div>
          <nav className="grid grid-cols-2 gap-2 p-3 text-sm sm:flex sm:flex-wrap sm:p-4">
            <Link className={navLinkClass} href="/admin">
              Painel
            </Link>
            <Link className={navLinkClass} href="/admin/cadastros">
              Cadastros
            </Link>
            <Link className={navLinkClass} href="/admin/equipe">
              Equipe
            </Link>
            <Link className={navLinkClass} href="/admin/provas">
              Provas
            </Link>
            <Link className={navLinkClass} href="/admin/correcao">
              Correcao
            </Link>
            <form action={logoutAdminAction} className="col-span-2 sm:col-span-1">
              <button className="w-full rounded-md bg-[#000060] px-3 py-2 font-medium text-white hover:bg-[#000044]">
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
