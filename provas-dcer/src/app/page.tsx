import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [activeApplications, students, submittedAttempts] = await Promise.all([
    prisma.examApplication.count({ where: { active: true } }),
    prisma.student.count({ where: { active: true } }),
    prisma.attempt.count({ where: { status: "SUBMITTED" } }),
  ]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 rounded-lg bg-[#12382a] px-5 py-6 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#b7e4c7]">DCER Paulista</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Sistema de Provas</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#e8f5ee]">
            Monte provas, libere para alunos por igreja/categoria/nome e corrija sem mostrar a nota ao final.
          </p>
        </div>
        <Link
          href="/prova"
          className="inline-flex items-center justify-center rounded-md bg-[#f5c84c] px-5 py-3 text-sm font-semibold text-[#1b211d] shadow-sm transition hover:bg-[#ebbd3a]"
        >
          Aplicar prova
        </Link>
      </header>

      <section className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-[#dfe6dd] bg-white p-4">
          <p className="text-sm text-[#68766d]">Aplicacoes ativas</p>
          <p className="mt-1 text-3xl font-semibold">{activeApplications}</p>
        </div>
        <div className="rounded-lg border border-[#dfe6dd] bg-white p-4">
          <p className="text-sm text-[#68766d]">Alunos cadastrados</p>
          <p className="mt-1 text-3xl font-semibold">{students}</p>
        </div>
        <div className="rounded-lg border border-[#dfe6dd] bg-white p-4">
          <p className="text-sm text-[#68766d]">Provas enviadas</p>
          <p className="mt-1 text-3xl font-semibold">{submittedAttempts}</p>
        </div>
      </section>

      <section className="mt-5 grid flex-1 gap-4 lg:grid-cols-3">
        <Link
          href="/prova"
          className="rounded-lg border border-[#dfe6dd] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#8fc9a6] hover:shadow-md"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2c6d49]">Aluno</p>
          <h2 className="mt-3 text-2xl font-semibold">Entrar na prova</h2>
          <p className="mt-2 text-sm leading-6 text-[#66736a]">
            O aluno escolhe a prova, igreja e categoria, depois digita o nome conforme o cadastro.
          </p>
        </Link>

        <Link
          href="/admin/provas/nova"
          className="rounded-lg border border-[#dfe6dd] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#8fc9a6] hover:shadow-md"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2c6d49]">Professor</p>
          <h2 className="mt-3 text-2xl font-semibold">Montar prova</h2>
          <p className="mt-2 text-sm leading-6 text-[#66736a]">
            Crie questoes objetivas e discursivas, defina o tempo total e selecione igrejas/categorias.
          </p>
        </Link>

        <Link
          href="/admin/correcao"
          className="rounded-lg border border-[#dfe6dd] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#8fc9a6] hover:shadow-md"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2c6d49]">Coordenacao</p>
          <h2 className="mt-3 text-2xl font-semibold">Conferir provas</h2>
          <p className="mt-2 text-sm leading-6 text-[#66736a]">
            Veja respostas enviadas, tempo usado e finalize a pontuacao das questoes abertas.
          </p>
        </Link>
      </section>

      <footer className="py-6 text-center text-xs text-[#68766d]">
        Primeira versao local. Banco PostgreSQL em Docker, pronto para migrar para Linux.
      </footer>
    </main>
  );
}
