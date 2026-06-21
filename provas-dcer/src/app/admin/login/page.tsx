import Link from "next/link";
import { loginAdminAction } from "@/app/actions/admin";
import { BrandLockup } from "@/components/BrandLockup";

type LoginPageProps = {
  searchParams?: Promise<{
    erro?: string;
  }>;
};

export default async function AdminLoginPage({ searchParams }: LoginPageProps) {
  const params = searchParams ? await searchParams : {};

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-[#d8def0]">
        <div className="h-1.5 bg-[#000060]" />
        <div className="p-6">
          <BrandLockup compact />
          <Link href="/" className="mt-4 inline-flex text-sm font-semibold text-[#000060]">
            Provas DCER Paulista
          </Link>
          <h1 className="mt-4 text-2xl font-semibold">Acesso administrativo</h1>
          <p className="mt-2 text-sm leading-6 text-[#5d6480]">
            Entre com e-mail e senha cadastrados. No primeiro acesso, deixe o e-mail em branco e use a senha do ambiente.
          </p>

          {params.erro ? (
            <div className="mt-4 rounded-md border border-[#f2b8bf] bg-[#fff4f2] px-3 py-2 text-sm text-[#b00018]">
              E-mail ou senha invalidos. Tente novamente.
            </div>
          ) : null}

          <form action={loginAdminAction} className="mt-5 space-y-4">
            <label className="block">
              <span className="text-sm font-medium">E-mail</span>
              <input
                name="email"
                type="email"
                autoFocus
                autoComplete="email"
                className="mt-1 w-full rounded-md border border-[#c5cce4] bg-white px-3 py-3 outline-none ring-[#000060] focus:ring-2"
                placeholder="nome@email.com"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Senha</span>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                className="mt-1 w-full rounded-md border border-[#c5cce4] bg-white px-3 py-3 outline-none ring-[#000060] focus:ring-2"
                placeholder="Digite a senha"
              />
            </label>

            <button className="w-full rounded-md bg-[#000060] px-4 py-3 text-sm font-semibold text-white hover:bg-[#000044]">
              Entrar
            </button>
          </form>

          <p className="mt-4 text-xs text-[#5d6480]">
            Cadastre administradores e conselheiros no menu Equipe depois de entrar.
          </p>
        </div>
      </section>
    </main>
  );
}
