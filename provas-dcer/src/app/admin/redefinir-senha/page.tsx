import Link from "next/link";
import { resetAdminPasswordAction } from "@/app/actions/admin";
import { BrandLockup } from "@/components/BrandLockup";

type ResetPasswordPageProps = {
  searchParams?: Promise<{
    erro?: string;
    token?: string;
  }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = searchParams ? await searchParams : {};
  const token = params.token || "";

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-[#d8def0]">
        <div className="h-1.5 bg-[#000060]" />
        <div className="p-6">
          <BrandLockup compact />
          <Link href="/admin/login" className="mt-4 inline-flex text-sm font-semibold text-[#000060]">
            Voltar para o login
          </Link>
          <h1 className="mt-4 text-2xl font-semibold">Criar nova senha</h1>
          <p className="mt-2 text-sm leading-6 text-[#5d6480]">
            Defina uma nova senha para acessar a area administrativa.
          </p>

          {params.erro ? (
            <div className="mt-4 rounded-md border border-[#f2b8bf] bg-[#fff4f2] px-3 py-2 text-sm text-[#b00018]">
              {params.erro}
            </div>
          ) : null}

          {token ? (
            <form action={resetAdminPasswordAction} className="mt-5 space-y-4">
              <input type="hidden" name="token" value={token} />
              <label className="block">
                <span className="text-sm font-medium">Nova senha</span>
                <input
                  name="password"
                  type="password"
                  autoFocus
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="mt-1 w-full rounded-md border border-[#c5cce4] bg-white px-3 py-3 outline-none ring-[#000060] focus:ring-2"
                  placeholder="Minimo 6 caracteres"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium">Confirmar senha</span>
                <input
                  name="confirmPassword"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="mt-1 w-full rounded-md border border-[#c5cce4] bg-white px-3 py-3 outline-none ring-[#000060] focus:ring-2"
                  placeholder="Digite novamente"
                />
              </label>

              <button className="w-full rounded-md bg-[#000060] px-4 py-3 text-sm font-semibold text-white hover:bg-[#000044]">
                Salvar nova senha
              </button>
            </form>
          ) : (
            <div className="mt-5 rounded-md border border-[#f2b8bf] bg-[#fff4f2] px-3 py-2 text-sm text-[#b00018]">
              Link de redefinicao ausente ou invalido. Solicite um novo link.
            </div>
          )}

          <Link href="/admin/esqueci-senha" className="mt-4 inline-flex text-sm font-semibold text-[#000060]">
            Solicitar outro link
          </Link>
        </div>
      </section>
    </main>
  );
}
