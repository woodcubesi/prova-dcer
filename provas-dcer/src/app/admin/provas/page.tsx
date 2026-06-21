import Link from "next/link";
import { deleteExamApplicationAction } from "@/app/actions/admin";
import { AdminShell } from "@/components/admin/AdminShell";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { AdminRole } from "@/generated/prisma/client";
import { requireAdminContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ExamsPageProps = {
  searchParams?: Promise<{
    erro?: string;
    ok?: string;
  }>;
};

export default async function ExamsPage({ searchParams }: ExamsPageProps) {
  const context = await requireAdminContext();
  const params = searchParams ? await searchParams : {};
  const isTeacher = context.role === AdminRole.TEACHER;
  const scopedChurchId = isTeacher ? context.churchId : null;

  const applications = await prisma.examApplication.findMany({
    where: isTeacher
      ? {
          participants: {
            some: {
              student: {
                churchId: scopedChurchId || "__missing_church__",
              },
            },
          },
        }
      : {},
    orderBy: { createdAt: "desc" },
    include: {
      exam: true,
      _count: {
        select: {
          attempts: true,
          participants: true,
        },
      },
    },
  });

  return (
    <AdminShell title="Provas" description="Consulte, edite provas ainda nao iniciadas e crie novas aplicacoes.">
      {isTeacher && !scopedChurchId ? (
        <div className="mb-4 rounded-md border border-[#efc2bd] bg-[#fff4f2] px-4 py-3 text-sm text-[#9b2d20]">
          Seu usuario de professor ainda nao esta vinculado a uma igreja.
        </div>
      ) : null}
      {params.erro ? (
        <div className="mb-4 rounded-md border border-[#efc2bd] bg-[#fff4f2] px-4 py-3 text-sm text-[#9b2d20]">
          {params.erro}
        </div>
      ) : null}
      {params.ok === "editada" ? (
        <div className="mb-4 rounded-md border border-[#b9dfc7] bg-[#effaf2] px-4 py-3 text-sm text-[#1f623e]">
          Prova atualizada com sucesso.
        </div>
      ) : null}
      {params.ok === "excluida" ? (
        <div className="mb-4 rounded-md border border-[#b9dfc7] bg-[#effaf2] px-4 py-3 text-sm text-[#1f623e]">
          Prova excluida com sucesso.
        </div>
      ) : null}

      <section className="rounded-lg border border-[#dfe6dd] bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Provas criadas</h2>
            <p className="text-sm text-[#66736a]">
              Provas com tentativas iniciadas ficam protegidas contra edicao de conteudo, mas podem ser excluidas.
            </p>
          </div>
          <Link
            href="/admin/provas/nova"
            className="rounded-md bg-[#12382a] px-4 py-2 text-center text-sm font-semibold text-white hover:bg-[#1c513d]"
          >
            Nova prova
          </Link>
        </div>

        <div className="mt-4 grid gap-3 md:hidden">
          {applications.map((application) => (
            <div key={application.id} className="rounded-md border border-[#edf1eb] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{application.exam.title}</p>
                  <p className="mt-1 text-sm text-[#66736a]">{application.title}</p>
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
                  <p className="text-xs text-[#66736a]">Aprovacao</p>
                  <p className="font-semibold">{application.exam.passingPercent ?? 70}%</p>
                </div>
                <div className="rounded-md bg-[#f7faf6] px-3 py-2">
                  <p className="text-xs text-[#66736a]">Participantes</p>
                  <p className="font-semibold">{application._count.participants}</p>
                </div>
                <div className="rounded-md bg-[#f7faf6] px-3 py-2">
                  <p className="text-xs text-[#66736a]">Tentativas</p>
                  <p className="font-semibold">{application._count.attempts}</p>
                </div>
              </div>
              <Link
                href={`/admin/provas/${application.id}/editar`}
                className="mt-3 block rounded-md border border-[#2c6d49] px-3 py-2 text-center text-sm font-semibold text-[#2c6d49]"
              >
                Editar
              </Link>
              <Link
                href={`/admin/provas/${application.id}/relatorio`}
                className="mt-2 block rounded-md bg-[#12382a] px-3 py-2 text-center text-sm font-semibold text-white"
              >
                Relatorio PDF
              </Link>
              <form action={deleteExamApplicationAction} className="mt-2">
                <input type="hidden" name="applicationId" value={application.id} />
                <ConfirmSubmitButton
                  message={`Excluir a prova "${application.exam.title}"? Esta acao tambem remove envios e respostas desta aplicacao.`}
                  className="w-full rounded-md border border-[#d7b6ad] px-3 py-2 text-center text-sm font-semibold text-[#8d3b2d]"
                >
                  Excluir
                </ConfirmSubmitButton>
              </form>
            </div>
          ))}
        </div>

        <div className="mt-4 hidden overflow-x-auto md:block">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-[#dfe6dd] text-xs uppercase tracking-wide text-[#66736a]">
              <tr>
                <th className="py-3 pr-4">Prova</th>
                <th className="py-3 pr-4">Codigo</th>
                <th className="py-3 pr-4">Tempo</th>
                <th className="py-3 pr-4">Aprovacao</th>
                <th className="py-3 pr-4">Participantes</th>
                <th className="py-3 pr-4">Tentativas</th>
                <th className="py-3 pr-4">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((application) => (
                <tr key={application.id} className="border-b border-[#edf1eb] last:border-0">
                  <td className="py-3 pr-4">
                    <p className="font-medium">{application.exam.title}</p>
                    <p className="text-xs text-[#66736a]">{application.title}</p>
                  </td>
                  <td className="py-3 pr-4 font-mono">{application.accessCode}</td>
                  <td className="py-3 pr-4">{application.exam.durationMinutes} min</td>
                  <td className="py-3 pr-4">{application.exam.passingPercent ?? 70}%</td>
                  <td className="py-3 pr-4">{application._count.participants}</td>
                  <td className="py-3 pr-4">{application._count.attempts}</td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/provas/${application.id}/editar`}
                        className="rounded-md border border-[#2c6d49] px-3 py-2 text-sm font-semibold text-[#2c6d49] hover:bg-[#effaf2]"
                      >
                        Editar
                      </Link>
                      <Link
                        href={`/admin/provas/${application.id}/relatorio`}
                        className="rounded-md bg-[#12382a] px-3 py-2 text-sm font-semibold text-white hover:bg-[#1c513d]"
                      >
                        Relatorio PDF
                      </Link>
                      <form action={deleteExamApplicationAction}>
                        <input type="hidden" name="applicationId" value={application.id} />
                        <ConfirmSubmitButton
                          message={`Excluir a prova "${application.exam.title}"? Esta acao tambem remove envios e respostas desta aplicacao.`}
                          className="rounded-md border border-[#d7b6ad] px-3 py-2 text-sm font-semibold text-[#8d3b2d] hover:bg-[#fff4f2]"
                        >
                          Excluir
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {applications.length === 0 ? (
                <tr>
                  <td className="py-6 pr-4 text-sm text-[#66736a]" colSpan={7}>
                    Nenhuma prova criada ainda.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {applications.length === 0 ? (
          <div className="mt-4 rounded-md border border-[#edf1eb] bg-[#fbfcfa] p-4 text-sm text-[#66736a] md:hidden">
            Nenhuma prova criada ainda.
          </div>
        ) : null}
      </section>
    </AdminShell>
  );
}
