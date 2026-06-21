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
    editada?: string;
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
    prisma.adminUser.count({
      where: {
        active: true,
        role: { in: [AdminRole.ADMIN, AdminRole.ADMIN_TEACHER] },
        ...(isTeacher ? { id: "__hidden__" } : {}),
      },
    }),
    prisma.adminUser.count({
      where: {
        active: true,
        role: { in: [AdminRole.TEACHER, AdminRole.ADMIN_TEACHER] },
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
      {params.editada ? (
        <div className="mb-5 rounded-md border border-[#b9dfc7] bg-[#effaf2] px-4 py-3 text-sm text-[#1f623e]">
          Prova atualizada com sucesso.
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

          <div className="mt-4 grid gap-3 md:hidden">
            {applications.map((application) => (
              <div key={application.id} className="rounded-md border border-[#edf1eb] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{application.title}</p>
                    <p className="mt-1 text-sm text-[#66736a]">{application.exam.title}</p>
                  </div>
                  <span className="rounded-full bg-[#effaf2] px-2 py-1 text-xs font-medium text-[#1f623e]">
                    {application.active ? "Ativa" : "Inativa"}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md bg-[#f7faf6] px-3 py-2">
                    <p className="text-xs text-[#66736a]">Codigo</p>
                    <p className="font-mono font-semibold">{application.accessCode}</p>
                  </div>
                  <div className="rounded-md bg-[#f7faf6] px-3 py-2">
                    <p className="text-xs text-[#66736a]">Tempo</p>
                    <p className="font-semibold">{application.exam.durationMinutes} min</p>
                  </div>
                  <div className="rounded-md bg-[#f7faf6] px-3 py-2">
                    <p className="text-xs text-[#66736a]">Participantes</p>
                    <p className="font-semibold">{application.participants.length}</p>
                  </div>
                  <div className="rounded-md bg-[#f7faf6] px-3 py-2">
                    <p className="text-xs text-[#66736a]">Envios</p>
                    <p className="font-semibold">{application.attempts.length}</p>
                  </div>
                </div>
                <Link
                  href={`/admin/provas/${application.id}/editar`}
                  className="mt-3 block rounded-md border border-[#2c6d49] px-3 py-2 text-center text-sm font-semibold text-[#2c6d49]"
                >
                  Editar
                </Link>
              </div>
            ))}
          </div>

          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-[#dfe6dd] text-xs uppercase tracking-wide text-[#66736a]">
                <tr>
                  <th className="py-3 pr-4">Aplicacao</th>
                  <th className="py-3 pr-4">Codigo</th>
                  <th className="py-3 pr-4">Tempo</th>
                  <th className="py-3 pr-4">Participantes</th>
                  <th className="py-3 pr-4">Envios</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4">Acao</th>
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
                    <td className="py-3 pr-4">
                      <Link
                        href={`/admin/provas/${application.id}/editar`}
                        className="rounded-md border border-[#2c6d49] px-3 py-2 text-sm font-semibold text-[#2c6d49] hover:bg-[#effaf2]"
                      >
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {applications.length === 0 ? (
            <div className="mt-4 rounded-md border border-[#edf1eb] bg-[#fbfcfa] p-4 text-sm text-[#66736a]">
              Ainda nao ha aplicacoes criadas.
            </div>
          ) : null}
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
