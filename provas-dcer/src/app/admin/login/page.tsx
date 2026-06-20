import Link from "next/link";
import { loginAdminAction } from "@/app/actions/admin";

type LoginPageProps = {
  searchParams?: Promise<{
    erro?: string;
  }>;
};

export default async function AdminLoginPage({ searchParams }: LoginPageProps) {
  const params = searchParams ? await searchParams : {};

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-lg bg-white p-6 shadow-sm ring-1 ring-[#dfe6dd]">
        <Link href="/" className="text-sm font-semibold text-[#2c6d49]">
          Provas DCER Paulista
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">Acesso administrativo</h1>
        <p className="mt-2 text-sm leading-6 text-[#66736a]">
          Use a senha local para montar provas, cadastrar alunos e conferir respostas.
        </p>

        {params.erro ? (
          <div className="mt-4 rounded-md border border-[#efc2bd] bg-[#fff4f2] px-3 py-2 text-sm text-[#9b2d20]">
            Senha invalida. Tente novamente.
          </div>
        ) : null}

        <form action={loginAdminAction} className="mt-5 space-y-4">
          <label className="block">
            <span className="text-sm font-medium">Senha</span>
            <input
              name="password"
              type="password"
              autoFocus
              className="mt-1 w-full rounded-md border border-[#cdd8cf] bg-white px-3 py-3 outline-none ring-[#2c6d49] focus:ring-2"
              placeholder="Digite a senha"
            />
          </label>

          <button className="w-full rounded-md bg-[#12382a] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1c513d]">
            Entrar
          </button>
        </form>

        <p className="mt-4 text-xs text-[#66736a]">
          A senha administrativa e configurada no ambiente do servidor.
        </p>
      </section>
    </main>
  );
}
