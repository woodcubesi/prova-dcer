import { logoutAdminAction, verifyAdminMfaAction } from "@/app/actions/admin";
import { BrandLockup } from "@/components/BrandLockup";
import { requireAdminMfaChallenge } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type MfaPageProps = {
  searchParams?: Promise<{
    erro?: string;
  }>;
};

export default async function AdminMfaPage({ searchParams }: MfaPageProps) {
  const user = await requireAdminMfaChallenge();
  const params = searchParams ? await searchParams : {};

  if (!user.mfaEnabled) {
    redirect("/admin/mfa/configurar");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-[#d8def0]">
        <div className="h-1.5 bg-[#000060]" />
        <div className="p-6">
          <BrandLockup compact />
          <h1 className="mt-5 text-2xl font-semibold">Verificacao em duas etapas</h1>
          <p className="mt-2 text-sm leading-6 text-[#5d6480]">{user.email}</p>

          {params.erro ? (
            <div className="mt-4 rounded-md border border-[#f2b8bf] bg-[#fff4f2] px-3 py-2 text-sm text-[#b00018]">
              Codigo invalido. Tente novamente.
            </div>
          ) : null}

          <form action={verifyAdminMfaAction} className="mt-5 space-y-4">
            <label className="block">
              <span className="text-sm font-medium">Codigo do autenticador</span>
              <input
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                className="mt-1 w-full rounded-md border border-[#c5cce4] bg-white px-3 py-3 text-center font-mono text-2xl tracking-[0.35em] outline-none ring-[#000060] focus:ring-2"
                placeholder="000000"
              />
            </label>

            <button className="w-full rounded-md bg-[#000060] px-4 py-3 text-sm font-semibold text-white hover:bg-[#000044]">
              Verificar
            </button>
          </form>

          <form action={logoutAdminAction} className="mt-3">
            <button className="w-full rounded-md border border-[#d8def0] px-4 py-3 text-sm font-semibold text-[#000060] hover:bg-[#f7f8ff]">
              Cancelar
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
