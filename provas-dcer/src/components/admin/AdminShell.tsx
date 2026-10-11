import Link from "next/link";
import { logoutAdminAction } from "@/app/actions/admin";
import { BrandLockup } from "@/components/BrandLockup";
import { AdminRole } from "@/generated/prisma/client";
import { getAdminContext } from "@/lib/auth";

type AdminShellProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

export async function AdminShell({ title, description, children }: AdminShellProps) {
  const context = await getAdminContext();
  const isTeacher = context?.role === AdminRole.TEACHER;
  const navLinkClass =
    "rounded-md border border-[#d8def0] px-3 py-2 text-center hover:bg-[#f7f8ff]";
  const navLinks = [
    { href: "/admin", label: "Painel", visible: true },
    { href: "/admin/cadastros", label: "Cadastros", visible: true },
    { href: "/admin/equipe", label: "Equipe", visible: !isTeacher },
    { href: "/admin/eventos", label: "Eventos", visible: true },
    { href: "/admin/provas", label: "Provas", visible: !isTeacher },
    { href: "/admin/correcao", label: "Correcao", visible: true },
    { href: "/admin/relatorios", label: "Relatorios", visible: true },
    { href: "/admin/seguranca", label: "Seguranca", visible: !isTeacher },
  ];

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-3 py-4 sm:px-6 lg:px-8">
      <header className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-[#d8def0]">
        <div className="h-1.5 bg-[#000060]" />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-col gap-5 p-3 sm:flex-row sm:items-center sm:gap-7 sm:p-4">
            <Link href="/" aria-label="Inicio">
              <BrandLockup compact />
            </Link>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
              {description ? <p className="mt-1 text-sm text-[#5d6480]">{description}</p> : null}
            </div>
          </div>
          <nav className="grid grid-cols-2 gap-2 p-3 text-sm sm:flex sm:flex-wrap sm:p-4">
            {navLinks
              .filter((link) => link.visible)
              .map((link) => (
                <Link key={link.href} className={navLinkClass} href={link.href}>
                  {link.label}
                </Link>
              ))}
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
