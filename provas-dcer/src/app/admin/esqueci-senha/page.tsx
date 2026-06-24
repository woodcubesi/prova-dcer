import Link from "next/link";
import { requestAdminPasswordResetAction } from "@/app/actions/admin";
import { BrandLockup } from "@/components/BrandLockup";

type ForgotPasswordPageProps = {
  searchParams?: Promise<{
    erro?: string;
    ok?: string;
  }>;
};

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const params = searchParams ? await searchParams : {};

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-[#d8def0]">
        <div className="h-1.5 bg-[#000060]" />
        <div className="p-6">
          <BrandLockup compact />
          <Link href="/admin/login" className="mt-4 inline-flex text-sm font-semibold text-[#000060]">
            Voltar para o login
          </Link>
          <h1 className="mt-4 text-2xl font-semibold">Redefinir senha</h1>
          <p className="mt-2 text-sm leading-6 text-[#5d6480]">
            Informe o e-mail cadastrado na equipe administrativa. Se o e-mail estiver ativo, enviaremos um link de
            redefinicao.
          </p>

          {params.erro ? (
            <div className="mt-4 rounded-md border border-[#f2b8bf] bg-[#fff4f2] px-3 py-2 text-sm text-[#b00018]">
              Informe um e-mail valido.
            </div>
          ) : null}

          {params.ok ? (
            <div className="mt-4 rounded-md border border-[#b9dfc7] bg-[#effaf2] px-3 py-2 text-sm text-[#1f623e]">
              Se este e-mail estiver cadastrado, o link de redefinicao foi enviado.
            </div>
          ) : null}

          <form action={requestAdminPasswordResetAction} className="mt-5 space-y-4">
            <label className="block">
              <span className="text-sm font-medium">E-mail</span>
              <input
                name="email"
                type="email"
                autoFocus
                required
                autoComplete="email"
                className="mt-1 w-full rounded-md border border-[#c5cce4] bg-white px-3 py-3 outline-none ring-[#000060] focus:ring-2"
                placeholder="nome@email.com"
              />
            </label>

            <button className="w-full rounded-md bg-[#000060] px-4 py-3 text-sm font-semibold text-white hover:bg-[#000044]">
              Enviar link de redefinicao
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
