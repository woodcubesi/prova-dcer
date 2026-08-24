import Link from "next/link";
import { confirmAdminMfaResetAction } from "@/app/actions/admin";
import { BrandLockup } from "@/components/BrandLockup";

type ConfirmResetMfaPageProps = {
  searchParams?: Promise<{
    erro?: string;
    token?: string;
  }>;
};

export default async function ConfirmResetMfaPage({ searchParams }: ConfirmResetMfaPageProps) {
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
          <h1 className="mt-4 text-2xl font-semibold">Confirmar redefinicao de MFA</h1>
          <p className="mt-2 text-sm leading-6 text-[#5d6480]">
            Ao confirmar, o autenticador atual sera removido e voce configurara um novo MFA no proximo login.
          </p>

          {params.erro ? (
            <div className="mt-4 rounded-md border border-[#f2b8bf] bg-[#fff4f2] px-3 py-2 text-sm text-[#b00018]">
              {params.erro}
            </div>
          ) : null}

          {token ? (
            <form action={confirmAdminMfaResetAction} className="mt-5">
              <input type="hidden" name="token" value={token} />
              <button className="w-full rounded-md bg-[#000060] px-4 py-3 text-sm font-semibold text-white hover:bg-[#000044]">
                Redefinir MFA
              </button>
            </form>
          ) : (
            <div className="mt-5 rounded-md border border-[#f2b8bf] bg-[#fff4f2] px-3 py-2 text-sm text-[#b00018]">
              Link de redefinicao ausente ou invalido. Solicite um novo link.
            </div>
          )}

          <Link href="/admin/redefinir-mfa" className="mt-4 inline-flex text-sm font-semibold text-[#000060]">
            Solicitar outro link
          </Link>
        </div>
      </section>
    </main>
  );
}
