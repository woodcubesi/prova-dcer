import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminRole } from "@/generated/prisma/client";
import { getCategoryLabel } from "@/lib/categories";
import { requireAdminContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type AdminPageProps = {
  searchParams?: Promise<{
    criada?: string;
    erro?: string;
  }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const context = await requireAdminContext();
  const params = searchParams ? await searchParams : {};
  const isTeacher = context.role === AdminRole.TEACHER;
  const scopedChurchId = isTeacher ? context.churchId : null;
  const scopedChurchFilter = scopedChurchId || "__missing_church__";

  const [churches, students, exams, submittedAttempts, administrators, teachers, applications] = await Promise.all([
    prisma.church.count({
      where: {
        active: true,
        ...(isTeacher ? { id: scopedChurchFilter } : {}),
      },
    }),
    prisma.student.count({
      where: {
        active: true,
        ...(isTeacher ? { churchId: scopedChurchFilter } : {}),
      },
    }),
    prisma.exam.count({
      where: isTeacher
        ? {
            applications: {
              some: {
                participants: {
                  some: {
                    student: {
                      churchId: scopedChurchFilter,
                    },
                  },
                },
              },
            },
          }
        : {},
    }),
    prisma.attempt.count({
      where: {
        status: "SUBMITTED",
        ...(isTeacher
          ? {
              student: {
                churchId: scopedChurchFilter,
              },
            }
          : {}),
      },
    }),
    prisma.adminUser.count({ where: { active: true, role: "ADMIN", ...(isTeacher ? { id: "__hidden__" } : {}) } }),
    prisma.adminUser.count({
      where: {
        active: true,
        role: "TEACHER",
        ...(isTeacher ? { churchId: scopedChurchFilter } : {}),
      },
    }),
    prisma.examApplication.findMany({
      where: isTeacher
        ? {
            participants: {
              some: {
                student: {
                  churchId: scopedChurchFilter,
                },
              },
            },
          }
        : {},
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        exam: true,
        participants: {
          ...(isTeacher
            ? {
                where: {
                  student: {
                    churchId: scopedChurchFilter,
                  },
                },
              }
            : {}),
        },
        attempts: {
          ...(isTeacher
            ? {
                where: {
                  student: {
                    churchId: scopedChurchFilter,
                  },
                },
              }
            : {}),
        },
      },
    }),
  ]);
  const stats = [
    [isTeacher ? "Igreja" : "Igrejas", churches],
    ["Alunos", students],
    ["Provas", exams],
    ["Enviadas", submittedAttempts],
    ...(isTeacher ? [] : ([["Administradores", administrators]] as [string, number][])),
    ["Professores", teachers],
  ];

  return (
    <AdminShell
      title="Painel administrativo"
      description="Resumo das provas, aplicacoes ativas e atalhos de operacao."
    >
      {params.criada ? (
        <div className="mb-5 rounded-md border border-[#b9dfc7] bg-[#effaf2] px-4 py-3 text-sm text-[#1f623e]">
          Prova criada com sucesso. Codigo da aplicacao: <strong>{params.criada}</strong>
        </div>
      ) : null}
      {params.erro === "permissao" ? (
        <div className="mb-5 rounded-md border border-[#efc2bd] bg-[#fff4f2] px-4 py-3 text-sm text-[#9b2d20]">
          Acesso restrito para este perfil.
        </div>
      ) : null}
      {isTeacher && !scopedChurchId ? (
        <div className="mb-5 rounded-md border border-[#efc2bd] bg-[#fff4f2] px-4 py-3 text-sm text-[#9b2d20]">
          Seu usuario de professor ainda nao esta vinculado a uma igreja.
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-[#dfe6dd] bg-white p-4">
            <p className="text-sm text-[#68766d]">{label}</p>
            <p className="mt-1 text-3xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="rounded-lg border border-[#dfe6dd] bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Aplicacoes recentes</h2>
              <p className="text-sm text-[#66736a]">Use o codigo ou o link de aluno para aplicar a prova.</p>
            </div>
            <Link
              href="/admin/provas/nova"
              className="rounded-md bg-[#12382a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1c513d]"
            >
              Nova prova
            </Link>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-[#dfe6dd] text-xs uppercase tracking-wide text-[#66736a]">
                <tr>
                  <th className="py-3 pr-4">Aplicacao</th>
                  <th className="py-3 pr-4">Codigo</th>
                  <th className="py-3 pr-4">Tempo</th>
                  <th className="py-3 pr-4">Participantes</th>
                  <th className="py-3 pr-4">Envios</th>
                  <th className="py-3 pr-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((application) => (
                  <tr key={application.id} className="border-b border-[#edf1eb] last:border-0">
                    <td className="py-3 pr-4">
                      <p className="font-medium">{application.title}</p>
                      <p className="text-xs text-[#66736a]">{application.exam.title}</p>
                    </td>
                    <td className="py-3 pr-4 font-mono text-sm">{application.accessCode}</td>
                    <td className="py-3 pr-4">{application.exam.durationMinutes} min</td>
                    <td className="py-3 pr-4">{application.participants.length}</td>
                    <td className="py-3 pr-4">{application.attempts.length}</td>
                    <td className="py-3 pr-4">
                      <span className="rounded-full bg-[#effaf2] px-2 py-1 text-xs font-medium text-[#1f623e]">
                        {application.active ? "Ativa" : "Inativa"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="space-y-3">
          <Link
            href="/prova"
            className="block rounded-lg border border-[#dfe6dd] bg-white p-4 transition hover:border-[#8fc9a6]"
          >
            <p className="text-sm font-semibold text-[#2c6d49]">Tela do aluno</p>
            <p className="mt-1 text-sm text-[#66736a]">Abrir entrada por igreja, categoria e nome.</p>
          </Link>
          <Link
            href="/admin/cadastros"
            className="block rounded-lg border border-[#dfe6dd] bg-white p-4 transition hover:border-[#8fc9a6]"
          >
            <p className="text-sm font-semibold text-[#2c6d49]">Pre-cadastro</p>
            <p className="mt-1 text-sm text-[#66736a]">Adicionar igrejas e alunos antes da aplicacao.</p>
          </Link>
          <Link
            href="/admin/equipe"
            className="block rounded-lg border border-[#dfe6dd] bg-white p-4 transition hover:border-[#8fc9a6]"
          >
            <p className="text-sm font-semibold text-[#2c6d49]">Equipe administrativa</p>
            <p className="mt-1 text-sm text-[#66736a]">Cadastrar administradores e professores.</p>
          </Link>
          <Link
            href="/admin/correcao"
            className="block rounded-lg border border-[#dfe6dd] bg-white p-4 transition hover:border-[#8fc9a6]"
          >
            <p className="text-sm font-semibold text-[#2c6d49]">Conferir provas</p>
            <p className="mt-1 text-sm text-[#66736a]">Ver respostas, tempo total e pontuacao.</p>
          </Link>

          <div className="rounded-lg border border-[#dfe6dd] bg-[#fff9e8] p-4 text-sm text-[#6f5714]">
            Categorias ativas: Junior, Adolescentes e Juvenil.
            <div className="mt-2 flex flex-wrap gap-2">
              {["JUNIOR", "ADOLESCENTES", "JUVENIL"].map((category) => (
                <span key={category} className="rounded-full bg-white px-2 py-1 text-xs">
                  {getCategoryLabel(category)}
                </span>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </AdminShell>
  );
}
